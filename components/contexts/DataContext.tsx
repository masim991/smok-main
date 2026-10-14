"use client"

import type * as React from "react"
import { createContext, useContext, useState, useEffect, useRef, type ReactNode, useCallback } from "react"
import { type IStorage } from "@/components/services/storage/Storage"
import { localMemoryStorage } from "@/components/services/storage/LocalMemoryStorage"
import { notificationService } from "@/components/services/notifications/LocalNotifications"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"
import { entriesOnDay, weekSummary, monthTrend, goalCurrent, goalProgress, isManualOnlyGoal } from "@/lib/recordMetrics"
import { accountDataKey, queueMutation, reconcileRemote, type PendingMutation } from "@/lib/syncPolicy"
import { errorMessage } from "@/lib/errorMessage"
import { entryToRemote, goalToRemote, remoteToGoal } from "@/lib/remoteRecords"

// 추천 목표 템플릿(초기 선택용)
export const PRESET_GOALS = [
  {
    type: "reduction" as const,
    title: "Reduce Daily Cigarettes",
    description: "Gradually reduce your daily cigarette intake",
    target: 5,
  },
  {
    type: "smoke_free_days" as const,
    title: "Smoke-Free Days",
    description: "Have more days without smoking",
    target: 3,
  },
  {
    type: "milestone" as const,
    title: "7-Day Milestone",
    description: "Go 7 days without smoking",
    target: 7,
  },
  {
    type: "reduction" as const,
    title: "Half Your Intake",
    description: "Cut your daily cigarettes in half",
    target: 10, // This should be calculated based on user's average
  },
  {
    type: "smoke_free_days" as const,
    title: "Weekend Warrior",
    description: "Keep your weekends smoke-free",
    target: 2,
  },
]

// 흡연 기록 항목 모델
export interface SmokeEntry {
  id: string
  date: string
  count: number
  notes?: string
}

export type GoalType = "reduction" | "smoke_free_days" | "milestone" | "streak"

// 목표 모델
export interface Goal {
  id: string
  type: GoalType
  target: number // e.g., 5 cigarettes for reduction, 7 for smoke-free days
  startDate: string
  status: "active" | "completed" | "failed"
  currentValue: number
  title: string
  description: string
  completedAt?: string
  difficulty: 'easy' | 'medium' | 'hard' | 'extreme'
  icon: string
  redMeanTitle?: string
  redMeanDescription?: string
}

// 전역 데이터 컨텍스트에서 제공하는 기능 정의
interface DataContextType {
  entries: SmokeEntry[]
  goals: Goal[]
  addEntry: (count: number, notes?: string) => Promise<void>
  removeEntry: (id: string) => Promise<void>
  addGoal: (goal: Omit<Goal, "id" | "status" | "startDate" | "completedAt">) => Promise<Goal>
  updateGoal: (id: string, updates: Partial<Goal>) => Promise<Goal | undefined>
  removeGoal: (id: string) => Promise<void>
  getEntriesByDate: (date: Date) => SmokeEntry[]
  getWeeklySummary: () => { day: string; date: string; cigarettes: number }[]
  getMonthlyTrend: () => { week: number; average: number; startDate: string; endDate: string }[]
  getGoalProgress: (goal: Goal) => { current: number; target: number; progress: number }
  getActiveGoals: () => Goal[]
  getCompletedGoals: () => Goal[]
  updateGoalProgress: (id: string, progress: number) => Promise<void>
  completeGoal: (id: string) => Promise<void>
  syncError: string | null
  retrySync: () => Promise<void>
  legacyDataAvailable: boolean
  importLegacyData: () => Promise<void>
}

const DataContext = createContext<DataContextType | undefined>(undefined)

const GOALS_STORAGE_KEY = "@SmokeTracker:goals"

const STORAGE_KEY = "@SmokeTracker:entries"

interface DataProviderProps {
  children: ReactNode
  storage?: IStorage // Optional dependency injection for future DB swap
}

type AccountMutation = PendingMutation<SmokeEntry | Goal>
type AccountSnapshot = { entries: SmokeEntry[]; goals: Goal[]; pending: AccountMutation[]; legacyImported?: boolean }

export const DataProvider: React.FC<DataProviderProps> = ({ children, storage }) => {
  const store = storage ?? localMemoryStorage
  const [entries, setEntries] = useState<SmokeEntry[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [pending, setPending] = useState<AccountMutation[]>([])
  const [syncError, setSyncError] = useState<string | null>(null)
  const [legacyDataAvailable, setLegacyDataAvailable] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const { user } = useAuth()
  const scope = user?.id ?? 'guest'
  const scopeRef = useRef(scope)
  scopeRef.current = scope
  const [loadedScope, setLoadedScope] = useState<string | null>(null)
  const snapshotRef = useRef<AccountSnapshot>({ entries: [], goals: [], pending: [] })
  const writeQueue = useRef(Promise.resolve())
  const localQueue = useRef(Promise.resolve())
  const flushInFlight = useRef<Promise<void> | null>(null)
  const blockedMutations = useRef(new Set<string>())

  const persist = useCallback(async (snapshot: AccountSnapshot) => {
    const key = user ? accountDataKey(user.id) : null
    writeQueue.current = writeQueue.current.catch(() => undefined).then(async () => {
      if (key) await store.setItem(key, JSON.stringify(snapshot))
      else {
        await store.setItem(STORAGE_KEY, JSON.stringify(snapshot.entries))
        await store.setItem(GOALS_STORAGE_KEY, JSON.stringify(snapshot.goals))
      }
    })
    await writeQueue.current
    if (scopeRef.current === (user?.id ?? 'guest')) {
      snapshotRef.current = snapshot
      setEntries(snapshot.entries)
      setGoals(snapshot.goals)
      setPending(snapshot.pending)
    }
  }, [store, user?.id])

  const enqueueLocal = useCallback(async <T,>(work: () => Promise<T>): Promise<T> => {
    const task = localQueue.current.catch(() => undefined).then(work)
    localQueue.current = task.then(() => undefined, () => undefined)
    return task
  }, [])

  const flushPending = useCallback(async () => {
    if (!user) return
    if (flushInFlight.current) return flushInFlight.current
    const userId = user.id
    const task = (async () => {
      const attempted = new Set<AccountMutation>()
      while (true) {
        const operation = snapshotRef.current.pending.find(item => !attempted.has(item))
        if (!operation || scopeRef.current !== userId) break
        attempted.add(operation)
        if (blockedMutations.current.has(`${operation.table}:${operation.id}`)) continue
        try {
          const query = supabase.from(operation.table)
          let result: { error: { message: string } | null }
          if (operation.kind === 'delete') {
            result = await query.delete().eq('user_id', userId).eq('id', operation.id)
          } else if (operation.table === 'entries') {
            result = await query.upsert(entryToRemote(operation.value as SmokeEntry, userId))
          } else {
            result = await query.upsert(goalToRemote(operation.value as Goal, userId))
          }
          if (result.error) throw result.error
          await enqueueLocal(async () => {
            const current = snapshotRef.current
            if (current.pending.includes(operation)) {
              await persist({ ...current, pending: current.pending.filter(item => item !== operation) })
            }
          })
        } catch (error) {
          setSyncError(`동기화 실패: ${errorMessage(error)}`)
        }
      }
    })()
    flushInFlight.current = task
    try { await task } finally { flushInFlight.current = null }
  }, [persist, user?.id, enqueueLocal])

  // Remote data is merged conservatively; local-only and conflicting rows are never overwritten.
  const syncFromSupabase = useCallback(async () => {
    if (!user || loadedScope !== user.id) return
    const userId = user.id
    try {
      const entryResult = await supabase.from('entries').select('id,date,count,notes').eq('user_id', userId)
      if (entryResult.error) throw entryResult.error
      const goalResult = await supabase.from('goals')
        .select('id,type,target,start_date,status,current_value,title,description,completed_at,difficulty,icon,red_mean_title,red_mean_description')
        .eq('user_id', userId)
      if (goalResult.error) throw goalResult.error
      if (scopeRef.current !== userId) return
      await enqueueLocal(async () => {
        if (scopeRef.current !== userId) return
        const local = snapshotRef.current
        const mergedEntries = reconcileRemote(local.entries, (entryResult.data ?? []) as SmokeEntry[], local.pending as PendingMutation<SmokeEntry>[], 'entries')
        const mergedGoals = reconcileRemote(local.goals, (goalResult.data ?? []).map(remoteToGoal), local.pending as PendingMutation<Goal>[], 'goals')
        const acknowledged = new Set([...mergedEntries.acknowledged.map(id => `entries:${id}`), ...mergedGoals.acknowledged.map(id => `goals:${id}`)])
        const next: AccountSnapshot = {
          entries: mergedEntries.records, goals: mergedGoals.records,
          pending: local.pending.filter(item => !acknowledged.has(`${item.table}:${item.id}`)),
          legacyImported: local.legacyImported,
        }
        const blocked = new Set([...mergedEntries.conflicts.map(id => `entries:${id}`), ...mergedGoals.conflicts.map(id => `goals:${id}`)])
        blockedMutations.current = blocked
        await persist(next)
        setSyncError(blocked.size ? `동기화 충돌 ${blocked.size}건: 로컬 기록을 보존했습니다.` : null)
      })
      await flushPending()
    } catch (error) {
      setSyncError(`동기화 조회 실패: ${errorMessage(error)}`)
    }
  }, [user?.id, loadedScope, persist, flushPending, enqueueLocal])

  const saveLocal = useCallback(async (
    nextEntries: SmokeEntry[] | ((current: SmokeEntry[]) => SmokeEntry[]),
    nextGoals: Goal[] | ((current: Goal[], entriesAfter: SmokeEntry[]) => Goal[]),
    mutations: AccountMutation[] | ((entries: SmokeEntry[], goals: Goal[]) => AccountMutation[]) = [],
  ) => {
    const changed = await enqueueLocal(async () => {
      if (loadedScope !== scope || scopeRef.current !== scope) throw new Error('Data is still loading')
      const current = snapshotRef.current
      const entriesAfter = typeof nextEntries === 'function' ? nextEntries(current.entries) : nextEntries
      const goalsAfter = typeof nextGoals === 'function' ? nextGoals(current.goals, entriesAfter) : nextGoals
      const operations = typeof mutations === 'function' ? mutations(entriesAfter, goalsAfter) : mutations
      if (entriesAfter === current.entries && goalsAfter === current.goals && operations.length === 0) return false
      let nextPending = current.pending
      if (user) for (const mutation of operations) nextPending = queueMutation(nextPending, mutation)
      await persist({ ...current, entries: entriesAfter, goals: goalsAfter, pending: nextPending })
      return operations.length > 0
    }).catch(error => {
      setSyncError(`로컬 저장 실패: ${errorMessage(error)}`)
      throw error
    })
    if (user && changed) await flushPending()
  }, [loadedScope, scope, user?.id, persist, flushPending, enqueueLocal])

  const importLegacyData = useCallback(async () => {
    if (!user || loadedScope !== user.id) throw new Error('Sign in before importing local records')
    const pairs = await store.multiGet([STORAGE_KEY, GOALS_STORAGE_KEY])
    const oldEntries: SmokeEntry[] = JSON.parse(pairs.find(([key]) => key === STORAGE_KEY)?.[1] ?? '[]')
    const oldGoals: Goal[] = JSON.parse(pairs.find(([key]) => key === GOALS_STORAGE_KEY)?.[1] ?? '[]')
    await enqueueLocal(async () => {
      const current = snapshotRef.current
      const entryIds = new Set(current.entries.map(item => item.id))
      const goalIds = new Set(current.goals.map(item => item.id))
      const extraEntries = oldEntries.filter(item => !entryIds.has(item.id))
      const extraGoals = oldGoals.filter(item => !goalIds.has(item.id))
      let nextPending = current.pending
      for (const entry of extraEntries) nextPending = queueMutation(nextPending, { table: 'entries', kind: 'upsert', id: entry.id, value: entry })
      for (const goal of extraGoals) nextPending = queueMutation(nextPending, { table: 'goals', kind: 'upsert', id: goal.id, value: goal })
      await persist({ ...current, entries: [...current.entries, ...extraEntries], goals: [...current.goals, ...extraGoals], pending: nextPending, legacyImported: true })
    })
    setLegacyDataAvailable(false)
    await syncFromSupabase()
  }, [user?.id, loadedScope, store, persist, syncFromSupabase, enqueueLocal])

  // Helper functions for goals
  // 활성 목표 목록 반환
  const getActiveGoals = useCallback(() => {
    return goals.filter(goal => goal.status === 'active')
  }, [goals])

  // 완료된 목표 목록 반환
  const getCompletedGoals = useCallback(() => {
    return goals.filter(goal => goal.status === 'completed')
  }, [goals])

  const updateGoalProgress = useCallback(async (id: string, progress: number) => {
    try {
      await saveLocal(current => current, current => current.map(goal =>
        goal.id === id ? { ...goal, currentValue: progress } : goal
      ), (_entries, updatedGoals) => {
        const changed = updatedGoals.find(goal => goal.id === id)
        return changed ? [{ table: 'goals', kind: 'upsert', id, value: changed }] : []
      })
    } catch (error) {
      console.error('Error updating goal progress:', error)
      throw error
    }
  }, [saveLocal])

  const completeGoal = useCallback(async (id: string) => {
    try {
      const goal = goals.find(g => g.id === id)
      await saveLocal(current => current, current => current.map(item =>
        item.id === id ? {
          ...item,
          status: 'completed' as const,
          completedAt: new Date().toISOString()
        } : item
      ), (_entries, updatedGoals) => {
        const changed = updatedGoals.find(item => item.id === id)
        return changed ? [{ table: 'goals', kind: 'upsert', id, value: changed }] : []
      })
      
      // Send congratulatory notification
      if (goal) {
        await notificationService.scheduleGoalReminder(
          goal.title || 'Goal',
          `🎉 Congratulations! You've completed your goal: ${goal.title}!`
        )
      }
    } catch (error) {
      console.error('Error completing goal:', error)
      throw error
    }
  }, [goals, saveLocal])

  // Load data on mount
  // 마운트 시 로컬 저장소에서 데이터 로드
  useEffect(() => {
    let cancelled = false
    const loadData = async () => {
      let loaded = false
      // Never let a previous account's snapshot back writes for this scope.
      snapshotRef.current = { entries: [], goals: [], pending: [] }
      setIsLoading(true)
      setLoadedScope(null)
      setSyncError(null)
      setEntries([])
      setGoals([])
      setPending([])
      blockedMutations.current = new Set()
      try {
        let snapshot: AccountSnapshot
        if (user) {
          const accountJson = await store.getItem(accountDataKey(user.id))
          snapshot = accountJson ? JSON.parse(accountJson) : { entries: [], goals: [], pending: [] }
          const legacy = await store.multiGet([STORAGE_KEY, GOALS_STORAGE_KEY])
          const legacyEntries = legacy.find(([key]) => key === STORAGE_KEY)?.[1]
          const legacyGoals = legacy.find(([key]) => key === GOALS_STORAGE_KEY)?.[1]
          if (!cancelled) setLegacyDataAvailable(!snapshot.legacyImported && Boolean((legacyEntries && JSON.parse(legacyEntries).length) || (legacyGoals && JSON.parse(legacyGoals).length)))
        } else {
          const pairs = await store.multiGet([STORAGE_KEY, GOALS_STORAGE_KEY])
          snapshot = {
            entries: JSON.parse(pairs.find(([key]) => key === STORAGE_KEY)?.[1] ?? '[]'),
            goals: JSON.parse(pairs.find(([key]) => key === GOALS_STORAGE_KEY)?.[1] ?? '[]'),
            pending: [],
          }
          if (!cancelled) setLegacyDataAvailable(false)
        }
        if (cancelled) return
        snapshot.pending ??= []
        snapshotRef.current = snapshot
        setEntries(snapshot.entries)
        setGoals(snapshot.goals)
        setPending(snapshot.pending)
        loaded = true
      } catch (e) {
        if (!cancelled) setSyncError(`로컬 데이터 로드 실패: ${errorMessage(e)}`)
      } finally {
        if (!cancelled) {
          // A failed load stays unloaded so writes and sync are blocked and the stored data is not overwritten.
          if (loaded) setLoadedScope(scope)
          setIsLoading(false)
        }
      }
    }
    loadData()
    return () => { cancelled = true }
  }, [store, scope])

  // 로그인 상태가 생기면 원격 동기화 시도
  useEffect(() => {
    if (user && loadedScope === user.id) {
      syncFromSupabase()
    }
  }, [user?.id, loadedScope, syncFromSupabase])

  // 기록 추가: 로컬 상태/저장소 갱신 후 로그인 시 Supabase upsert
  const addEntry = async (count: number, notes?: string): Promise<void> => {
    try {
      const newEntry: SmokeEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        date: new Date().toISOString(),
        count,
        notes,
      }
      await saveLocal(current => [...current, newEntry], current => current, [{ table: 'entries', kind: 'upsert', id: newEntry.id, value: newEntry }])
    } catch (error) {
      console.error("Error adding entry:", error)
      throw error
    }
  }

  // 기록 삭제: 로컬/원격 삭제
  const removeEntry = async (id: string) => {
    try {
      await saveLocal(current => current.filter(entry => entry.id !== id), current => current, [{ table: 'entries', kind: 'delete', id }])
    } catch (error) {
      console.error("Error removing entry:", error)
      throw error
    }
  }

  // 목표 추가: 기본값/시작일 설정 후 로컬/원격 반영 + 알림 예약
  const addGoal = async (goal: Omit<Goal, "id" | "status" | "startDate" | "completedAt">) => {
    try {
      // If target is 0, calculate it based on user's average for reduction goals
      let target = goal.target
      if (goal.type === "reduction" && target === 0) {
        const weeklyAvg = getWeeklySummary().reduce((sum, day) => sum + day.cigarettes, 0) / 7
        target = Math.max(1, Math.floor(weeklyAvg * 0.5)) // Default to half of weekly average
      }

      const newGoal: Goal = {
        ...goal,
        target,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        status: "active",
        startDate: new Date().toISOString(),
        currentValue: goal.currentValue || 0,
      }
      await saveLocal(current => current, current => [...current, newGoal], [{ table: 'goals', kind: 'upsert', id: newGoal.id, value: newGoal }])
      
      // Schedule notification for new goal
      try {
        await notificationService.scheduleGoalReminder(newGoal.title, newGoal.description)
      } catch (notifError) {
        console.log('Could not schedule notification:', notifError)
      }
      
      return newGoal
    } catch (error) {
      console.error("Error adding goal:", error)
      throw error
    }
  }

  // 목표 업데이트: 완료 조건 체크 포함, 로컬/원격 반영
  const updateGoal = async (id: string, updates: Partial<Goal>) => {
    try {
      let changed: Goal | undefined
      await saveLocal(current => current, current => current.map((goal) => {
        if (goal.id === id) {
          const updatedGoal = { ...goal, ...updates }
          // Check if goal is completed
          if (
            updatedGoal.currentValue !== undefined &&
            updatedGoal.currentValue >= updatedGoal.target &&
            updatedGoal.status !== "completed"
          ) {
            updatedGoal.status = "completed"
            updatedGoal.completedAt = new Date().toISOString()
          }
          changed = updatedGoal
          return updatedGoal
        }
        return goal
      }), (_entries, updatedGoals) => {
        const updated = updatedGoals.find(goal => goal.id === id)
        return updated ? [{ table: 'goals', kind: 'upsert', id, value: updated }] : []
      })
      return changed
    } catch (error) {
      console.error("Error updating goal:", error)
      throw error
    }
  }

  // 목표 삭제: 로컬/원격 반영
  const removeGoal = async (id: string) => {
    try {
      await saveLocal(current => current, current => current.filter(goal => goal.id !== id), [{ table: 'goals', kind: 'delete', id }])
    } catch (error) {
      console.error("Error removing goal:", error)
      throw error
    }
  }

  // 특정 날짜의 기록 반환
  const getEntriesByDate = (date: Date): SmokeEntry[] => {
    return entriesOnDay(entries, date)
  }

  // 최근 1주 요약(요일별 총 개비)
  const getWeeklySummary = (): { day: string; date: string; cigarettes: number }[] => {
    return weekSummary(entries, new Date())
  }

  // 이번 달 주차별 평균 추세
  const getMonthlyTrend = (): { week: number; average: number; startDate: string; endDate: string }[] => {
    return monthTrend(entries, new Date())
  }

  // entries 변화에 따라 활성 목표의 진행도 갱신 및 완료 처리
  const updateGoalsProgress = useCallback(async () => {
    try {
      if (goals.length === 0) return
      const completed: Goal[] = []
      await saveLocal(current => current, (currentGoals, currentEntries) => {
        const next = currentGoals.map(goal => {
        if (goal.status !== 'active' || isManualOnlyGoal(goal)) return goal
        const currentValue = goalCurrent(goal, currentEntries, new Date())
        const shouldComplete = goal.type !== 'reduction' && goal.target > 0 && currentValue >= goal.target
        if (goal.currentValue === currentValue && !shouldComplete) return goal
        const updated: Goal = {
          ...goal,
          currentValue,
          ...(shouldComplete ? { status: 'completed' as const, completedAt: new Date().toISOString() } : {}),
        }
        if (shouldComplete) completed.push(updated)
        return updated
        })
        return next.every((goal, index) => goal === currentGoals[index]) ? currentGoals : next
      }, (_entries, updatedGoals) => updatedGoals
        .filter((goal, index) => goal !== snapshotRef.current.goals[index])
        .map(goal => ({ table: 'goals', kind: 'upsert', id: goal.id, value: goal })))
      for (const goal of completed) {
        notificationService.scheduleGoalReminder(
          goal.title || 'Goal',
          `🎉 Amazing! You've reached your goal: ${goal.title}!`
        ).catch(console.error)
      }
    } catch (error) {
      console.error("Error updating goals progress:", error)
    }
  }, [entries, goals, saveLocal])

  // entries 변경 시 진행도 자동 업데이트
  useEffect(() => {
    if (!isLoading) {
      updateGoalsProgress()
    }
  }, [entries, updateGoalsProgress, isLoading])

  // 개별 목표 진행도 계산(퍼센트)
  const getGoalProgress = (goal: Goal) => {
    return goalProgress(goal, entries, new Date())
  }

  const contextValue: DataContextType = {
    entries: loadedScope === scope ? entries : [],
    goals: loadedScope === scope ? goals : [],
    addEntry,
    removeEntry,
    addGoal,
    updateGoal,
    removeGoal,
    getEntriesByDate,
    getWeeklySummary,
    getMonthlyTrend,
    getGoalProgress,
    getActiveGoals,
    getCompletedGoals,
    updateGoalProgress,
    completeGoal,
    syncError,
    retrySync: syncFromSupabase,
    legacyDataAvailable,
    importLegacyData,
  }

  // 주기적으로 캐시 정리
  useEffect(() => {
    const interval = setInterval(() => {
      if (store.cleanExpiredCache) {
        store.cleanExpiredCache()
      }
    }, 5 * 60 * 1000) // Clean every 5 minutes

    return () => clearInterval(interval)
  }, [store])

  return (
    <DataContext.Provider value={contextValue}>
      {children}
    </DataContext.Provider>
  );
};
export const useData = () => {
  const context = useContext(DataContext)
  if (context === undefined) {
    throw new Error("useData must be used within a DataProvider")
  }
  return context
}
