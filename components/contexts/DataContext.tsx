"use client"

import type * as React from "react"
import { createContext, useContext, useState, useEffect, type ReactNode, useCallback } from "react"
import { type IStorage, AsyncStorageProvider } from "@/components/services/storage/Storage"
import { localMemoryStorage } from "@/components/services/storage/LocalMemoryStorage"
import { notificationService } from "@/components/services/notifications/LocalNotifications"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"

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
}

const DataContext = createContext<DataContextType | undefined>(undefined)

const GOALS_STORAGE_KEY = "@SmokeTracker:goals"

const STORAGE_KEY = "@SmokeTracker:entries"

interface DataProviderProps {
  children: ReactNode
  storage?: IStorage // Optional dependency injection for future DB swap
}

// 앱 전역에서 기록/목표 데이터를 제공하고 로컬/원격(Supabase) 동기화를 담당
export const DataProvider: React.FC<DataProviderProps> = ({ children, storage }) => {
  const store = storage ?? localMemoryStorage
  const [entries, setEntries] = useState<SmokeEntry[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { user } = useAuth()

  // 로그인 후 Supabase에서 최신 데이터를 가져와 로컬에 반영
  const syncFromSupabase = useCallback(async () => {
    if (!user) return
    try {
      const { data: remoteEntries, error: e1 } = await supabase
        .from('entries')
        .select('id,date,count,notes')
        .eq('user_id', user.id)
      if (!e1 && remoteEntries) {
        setEntries(remoteEntries as any)
        await store.setItem(STORAGE_KEY, JSON.stringify(remoteEntries))
      }
    } catch (e) {
      console.log('[Sync] Entries fetch skipped:', e)
    }
    try {
      const { data: remoteGoals, error: e2 } = await supabase
        .from('goals')
        .select('id,type,target,start_date,status,current_value,title,description,completed_at,difficulty,icon,red_mean_title,red_mean_description')
        .eq('user_id', user.id)
      if (!e2 && remoteGoals) {
        const mapped = (remoteGoals as any[]).map(g => ({
          id: g.id,
          type: g.type,
          target: g.target,
          startDate: g.start_date,
          status: g.status,
          currentValue: g.current_value,
          title: g.title,
          description: g.description,
          completedAt: g.completed_at ?? undefined,
          difficulty: g.difficulty,
          icon: g.icon,
          redMeanTitle: g.red_mean_title ?? undefined,
          redMeanDescription: g.red_mean_description ?? undefined,
        })) as Goal[]
        setGoals(mapped)
        await store.setItem(GOALS_STORAGE_KEY, JSON.stringify(mapped))
      }
    } catch (e) {
      console.log('[Sync] Goals fetch skipped:', e)
    }
  }, [user, store])

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
      const updatedGoals = goals.map(goal => 
        goal.id === id ? { ...goal, currentValue: progress } as Goal : goal
      )
      setGoals(updatedGoals)
      await store.setItem(GOALS_STORAGE_KEY, JSON.stringify(updatedGoals))
    } catch (error) {
      console.error('Error updating goal progress:', error)
      throw error
    }
  }, [goals, store])

  const completeGoal = useCallback(async (id: string) => {
    try {
      const goal = goals.find(g => g.id === id)
      const updatedGoals = goals.map(goal => 
        goal.id === id ? { 
          ...goal, 
          status: 'completed' as const,
          completedAt: new Date().toISOString() 
        } as Goal : goal
      )
      setGoals(updatedGoals)
      await store.setItem(GOALS_STORAGE_KEY, JSON.stringify(updatedGoals))
      
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
  }, [goals, store])

  // Load data on mount
  // 마운트 시 로컬 저장소에서 데이터 로드
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true)
      try {
        // Preload frequently accessed keys
        await store.preloadData?.([STORAGE_KEY, GOALS_STORAGE_KEY])
        
        const pairs = await store.multiGet([STORAGE_KEY, GOALS_STORAGE_KEY])
        const entriesJson = pairs.find(([key]: [string, string | null]) => key === STORAGE_KEY)?.[1]
        const goalsJson = pairs.find(([key]: [string, string | null]) => key === GOALS_STORAGE_KEY)?.[1]
        
        if (entriesJson) {
          const parsedEntries = JSON.parse(entriesJson)
          setEntries(parsedEntries)
        }
        if (goalsJson) {
          const parsedGoals = JSON.parse(goalsJson)
          setGoals(parsedGoals)
        }
      } catch (e) {
        console.error("Failed to load data", e)
      } finally {
        setIsLoading(false)
      }
    }
    loadData()
  }, [store])

  // 로그인 상태가 생기면 원격 동기화 시도
  useEffect(() => {
    if (user) {
      syncFromSupabase()
    }
  }, [user, syncFromSupabase])

  // entries 변경 시 로컬 저장소에 저장
  useEffect(() => {
    const saveData = async () => {
      if (entries.length > 0 || isLoading === false) { // Only save if we have data or finished loading
        try {
          await store.setItem(STORAGE_KEY, JSON.stringify(entries))
          console.log('Entries saved successfully:', entries.length)
        } catch (e) {
          console.error("Failed to save entries data", e)
        }
      }
    }
    saveData()
  }, [entries, store, isLoading])

  // goals 변경 시 로컬 저장소에 저장
  useEffect(() => {
    const saveGoals = async () => {
      if (goals.length > 0 || isLoading === false) { // Only save if we have data or finished loading
        try {
          await store.setItem(GOALS_STORAGE_KEY, JSON.stringify(goals))
          console.log('Goals saved successfully:', goals.length)
        } catch (e) {
          console.error("Failed to save goals data", e)
        }
      }
    }
    saveGoals()
  }, [goals, store, isLoading])

  // 기록 추가: 로컬 상태/저장소 갱신 후 로그인 시 Supabase upsert
  const addEntry = async (count: number, notes?: string): Promise<void> => {
    try {
      const newEntry: SmokeEntry = {
        id: Date.now().toString(),
        date: new Date().toISOString(),
        count,
        notes,
      }
      const updatedEntries = [...entries, newEntry]
      setEntries(updatedEntries)
      await store.setItem(STORAGE_KEY, JSON.stringify(updatedEntries))
      // remote upsert
      if (user) {
        try {
          await supabase.from('entries').upsert({
            id: newEntry.id,
            user_id: user.id,
            date: newEntry.date,
            count: newEntry.count,
            notes: newEntry.notes ?? null,
          })
        } catch (e) {
          console.log('[Sync] addEntry upsert skipped:', e)
        }
      }
    } catch (error) {
      console.error("Error adding entry:", error)
      throw error
    }
  }

  // 기록 삭제: 로컬/원격 삭제
  const removeEntry = async (id: string) => {
    try {
      const updatedEntries = entries.filter((e) => e.id !== id)
      setEntries(updatedEntries)
      await store.setItem(STORAGE_KEY, JSON.stringify(updatedEntries))
      if (user) {
        try {
          await supabase.from('entries').delete().eq('user_id', user.id).eq('id', id)
        } catch (e) {
          console.log('[Sync] removeEntry delete skipped:', e)
        }
      }
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
        id: Date.now().toString(),
        status: "active",
        startDate: new Date().toISOString(),
        currentValue: goal.currentValue || 0,
      }
      const updatedGoals = [...goals, newGoal]
      setGoals(updatedGoals)
      await store.setItem(GOALS_STORAGE_KEY, JSON.stringify(updatedGoals))
      if (user) {
        try {
          await supabase.from('goals').upsert({
            id: newGoal.id,
            user_id: user.id,
            type: newGoal.type,
            target: newGoal.target,
            start_date: newGoal.startDate,
            status: newGoal.status,
            current_value: newGoal.currentValue,
            title: newGoal.title,
            description: newGoal.description,
            completed_at: newGoal.completedAt ?? null,
            difficulty: newGoal.difficulty,
            icon: newGoal.icon,
            red_mean_title: newGoal.redMeanTitle ?? null,
            red_mean_description: newGoal.redMeanDescription ?? null,
          })
        } catch (e) {
          console.log('[Sync] addGoal upsert skipped:', e)
        }
      }
      
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
      const updatedGoals = goals.map((goal) => {
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
          return updatedGoal
        }
        return goal
      })

      setGoals(updatedGoals)
      await store.setItem(GOALS_STORAGE_KEY, JSON.stringify(updatedGoals))
      if (user) {
        try {
          const g = updatedGoals.find((gg) => gg.id === id)
          if (g) {
            await supabase.from('goals').upsert({
              id: g.id,
              user_id: user.id,
              type: g.type,
              target: g.target,
              start_date: g.startDate,
              status: g.status,
              current_value: g.currentValue,
              title: g.title,
              description: g.description,
              completed_at: g.completedAt ?? null,
              difficulty: g.difficulty,
              icon: g.icon,
              red_mean_title: g.redMeanTitle ?? null,
              red_mean_description: g.redMeanDescription ?? null,
            })
          }
        } catch (e) {
          console.log('[Sync] updateGoal upsert skipped:', e)
        }
      }
      return updatedGoals.find((g) => g.id === id)
    } catch (error) {
      console.error("Error updating goal:", error)
      throw error
    }
  }

  // 목표 삭제: 로컬/원격 반영
  const removeGoal = async (id: string) => {
    try {
      const updatedGoals = goals.filter((goal) => goal.id !== id)
      setGoals(updatedGoals)
      await store.setItem(GOALS_STORAGE_KEY, JSON.stringify(updatedGoals))
      if (user) {
        try {
          await supabase.from('goals').delete().eq('user_id', user.id).eq('id', id)
        } catch (e) {
          console.log('[Sync] removeGoal delete skipped:', e)
        }
      }
    } catch (error) {
      console.error("Error removing goal:", error)
      throw error
    }
  }

  // 특정 날짜의 기록 반환
  const getEntriesByDate = (date: Date): SmokeEntry[] => {
    try {
      const dateString = date.toISOString().split("T")[0]
      return entries.filter((entry) => entry.date.startsWith(dateString))
    } catch (error) {
      console.error("Error getting entries by date:", error)
      return []
    }
  }

  // 최근 1주 요약(요일별 총 개비)
  const getWeeklySummary = (): { day: string; date: string; cigarettes: number }[] => {
    try {
      const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
      const today = new Date()
      const weekStart = new Date(today)
      weekStart.setDate(today.getDate() - today.getDay()) // Start of current week

      return days.map((day, index) => {
        const currentDate = new Date(weekStart)
        currentDate.setDate(weekStart.getDate() + index)
        const dateString = currentDate.toISOString().split("T")[0]

        const dayEntries = entries.filter((entry) => entry.date.startsWith(dateString))

        const totalCigarettes = dayEntries.reduce((sum, entry) => sum + entry.count, 0)

        return {
          day,
          date: dateString,
          cigarettes: totalCigarettes,
        }
      })
    } catch (error) {
      console.error("Error getting weekly summary:", error)
      return []
    }
  }

  // 이번 달 주차별 평균 추세
  const getMonthlyTrend = (): { week: number; average: number; startDate: string; endDate: string }[] => {
    try {
      const result = []
      const today = new Date()
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0)

      const currentStart = new Date(firstDay)
      let weekNumber = 1

      while (currentStart <= lastDay) {
        const currentEnd = new Date(currentStart)
        currentEnd.setDate(currentStart.getDate() + 6)
        if (currentEnd > lastDay) currentEnd.setDate(lastDay.getDate())

        const weekEntries = entries.filter((entry) => {
          const entryDate = new Date(entry.date)
          return entryDate >= currentStart && entryDate <= currentEnd
        })

        const totalCigarettes = weekEntries.reduce((sum, entry) => sum + entry.count, 0)
        const daysInWeek = Math.ceil((currentEnd.getTime() - currentStart.getTime() + 1) / (1000 * 60 * 60 * 24))

        result.push({
          week: weekNumber,
          average: daysInWeek > 0 ? totalCigarettes / daysInWeek : 0,
          startDate: currentStart.toISOString().split("T")[0],
          endDate: currentEnd.toISOString().split("T")[0],
        })

        currentStart.setDate(currentStart.getDate() + 7)
        weekNumber++
      }

      return result
    } catch (error) {
      console.error("Error getting monthly trend:", error)
      return []
    }
  }

  // entries 변화에 따라 활성 목표의 진행도 갱신 및 완료 처리
  const updateGoalsProgress = useCallback(async () => {
    try {
      if (goals.length === 0) return;
      
      const updatedGoals = goals.map((goal) => {
        if (goal.status !== "active") return goal

        let currentValue = 0

        if (goal.type === "reduction") {
          // For reduction goals, track daily average reduction
          const weeklyData = getWeeklySummary()
          const weeklyTotal = weeklyData.reduce((sum, day) => sum + day.cigarettes, 0)
          currentValue = Math.max(0, goal.target - (weeklyTotal / 7)) // Progress towards reduction
        } else if (goal.type === "smoke_free_days") {
          // For smoke-free days, count days with 0 cigarettes this week
          const smokeFreeDays = getWeeklySummary().filter((day) => day.cigarettes === 0).length
          currentValue = smokeFreeDays
        } else if (goal.type === "milestone") {
          // For milestones, count consecutive days without smoking from today backwards
          const today = new Date()
          let consecutiveDays = 0
          
          for (let i = 0; i < goal.target; i++) {
            const checkDate = new Date(today)
            checkDate.setDate(today.getDate() - i)
            const dateString = checkDate.toISOString().split("T")[0]
            
            const dayEntries = entries.filter(e => e.date.startsWith(dateString))
            const dayTotal = dayEntries.reduce((sum, e) => sum + e.count, 0)
            
            if (dayTotal === 0) {
              consecutiveDays++
            } else {
              break
            }
          }
          currentValue = consecutiveDays
        }

        // Check if goal should be completed
        const shouldComplete = currentValue >= goal.target && goal.status === "active"
        
        // Send notification for goal completion
        if (shouldComplete) {
          notificationService.scheduleGoalReminder(
            goal.title || 'Goal',
            `🎉 Amazing! You've reached your goal: ${goal.title}!`
          ).catch(console.error)
        }
        
        return { 
          ...goal, 
          currentValue,
          ...(shouldComplete && {
            status: "completed" as const,
            completedAt: new Date().toISOString()
          })
        }
      })

      // Only update if there are actual changes
      const hasChanges = updatedGoals.some((goal, index) => 
        goal.currentValue !== goals[index].currentValue || 
        goal.status !== goals[index].status
      )

      if (hasChanges) {
        setGoals(updatedGoals)
        await store.setItem(GOALS_STORAGE_KEY, JSON.stringify(updatedGoals))
      }
    } catch (error) {
      console.error("Error updating goals progress:", error)
    }
  }, [entries, goals, store, getWeeklySummary])

  // entries 변경 시 진행도 자동 업데이트
  useEffect(() => {
    if (entries.length > 0) {
      updateGoalsProgress()
    }
  }, [entries, updateGoalsProgress])

  // 개별 목표 진행도 계산(퍼센트)
  const getGoalProgress = (goal: Goal) => {
    const current = goal.currentValue || 0
    let progress = 0
    
    if (goal.target > 0) {
      switch (goal.type) {
        case "reduction":
          // For reduction goals, progress is based on staying under daily limit
          const today = new Date().toISOString().split('T')[0]
          const todayEntries = entries.filter(e => e.date.startsWith(today))
          const todayCount = todayEntries.reduce((sum, e) => sum + e.count, 0)
          if (goal.target <= 10) {
            // Daily limit goals
            progress = todayCount <= goal.target ? 100 : Math.max(0, 100 - ((todayCount - goal.target) / goal.target) * 50)
          } else {
            // Percentage reduction goals
            progress = Math.min(100, (current / goal.target) * 100)
          }
          break
        case "streak":
          // For streak goals, progress is consecutive smoke-free days
          progress = Math.min(100, (current / goal.target) * 100)
          break
        case "smoke_free_days":
        case "milestone":
        default:
          // Standard progress calculation
          progress = Math.min(100, (current / goal.target) * 100)
          break
      }
    }
    
    return {
      current,
      target: goal.target,
      progress: Math.round(progress),
    }
  }

  const contextValue: DataContextType = {
    entries,
    goals,
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
