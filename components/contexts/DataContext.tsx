import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef, type ReactNode } from 'react';
import { AppState } from 'react-native';
import type { IStorage } from '@/components/services/storage/Storage';
import { localMemoryStorage } from '@/components/services/storage/LocalMemoryStorage';
import { TrackingRepository, enqueueChange, acknowledgeChanges, reconcileRows, validGoal, type TrackingSnapshot, type PendingChange } from '@/components/services/storage/TrackingRepository';
import { validEntry, localDay, totalOnDay, weeklySummary, monthlyTrend, completedSmokeFreeDays, isSmokeFreeCheckin } from '@/utils/tracking';
import { fetchAllRows } from '@/utils/remoteRows';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { LOCAL_TEST_USER_ID } from '@/lib/localTest';
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
  reductionMode?: 'daily_limit' | 'percentage'
  baselineDaily?: number
  completedAt?: string
  difficulty: 'easy' | 'medium' | 'hard' | 'extreme'
  icon: string
  redMeanTitle?: string
  redMeanDescription?: string
}

// 전역 데이터 컨텍스트에서 제공하는 기능 정의
interface DataContextType {
  isLoading: boolean
  error: string | null
  syncStatus: 'local' | 'syncing' | 'synced' | 'offline'
  retrySync: () => Promise<void>
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


const DataContext = createContext<DataContextType | undefined>(undefined);
interface DataProviderProps { children: ReactNode; storage?: IStorage }
function rowForGoal(g: Goal): Record<string, unknown> {
  return { id: g.id, type: g.type, target: g.target, start_date: g.startDate, status: g.status, current_value: g.currentValue, title: g.title, description: g.description, completed_at: g.completedAt ?? null, difficulty: g.difficulty, icon: g.icon, red_mean_title: g.redMeanTitle ?? null, red_mean_description: g.redMeanDescription ?? null, reduction_mode: g.reductionMode ?? null, baseline_daily: g.baselineDaily ?? null };
}
function mapGoal(g: any): Goal {
  return { id: g.id, type: g.type, target: g.target, startDate: g.start_date, status: g.status, currentValue: g.current_value, title: g.title, description: g.description, completedAt: g.completed_at ?? undefined, difficulty: g.difficulty, icon: g.icon, redMeanTitle: g.red_mean_title ?? undefined, redMeanDescription: g.red_mean_description ?? undefined, reductionMode: g.reduction_mode ?? undefined, baselineDaily: g.baseline_daily ?? undefined };
}
function goalValue(goal: Goal, entries: SmokeEntry[], now = new Date()): number {
  if (goal.type !== 'reduction') return completedSmokeFreeDays(entries, goal.startDate, goal.type !== 'smoke_free_days', now);
  const today = totalOnDay(entries, now);
  if (goal.reductionMode === 'percentage' || (!goal.reductionMode && goal.target > 10)) {
    let baseline = goal.baselineDaily;
    if (!baseline) {
      const start = new Date(goal.startDate); let total = 0;
      for (let i = 1; i <= 7; i++) { const day = new Date(start); day.setDate(day.getDate() - i); total += totalOnDay(entries, day); }
      baseline = total / 7;
    }
    return baseline > 0 ? Math.max(0, Math.min(100, (1 - today / baseline) * 100)) : 0;
  }
  return today;
}
function refreshGoals(snapshot: TrackingSnapshot): TrackingSnapshot {
  let pending = snapshot.pending;
  const goals = snapshot.goals.map(goal => {
    if (goal.status !== 'active') return goal;
    const currentValue = goalValue(goal, snapshot.entries);
    const complete = goal.type !== 'reduction' && currentValue >= goal.target;
    if (currentValue === goal.currentValue && !complete) return goal;
    const next = { ...goal, currentValue, ...(complete ? { status: 'completed' as const, completedAt: new Date().toISOString() } : {}) };
    pending = enqueueChange(pending, { table: 'goals', id: next.id, row: rowForGoal(next) });
    return next;
  });
  return { ...snapshot, goals, pending };
}
let idSequence = 0;
const makeId = () => Date.now().toString() + '-' + (++idSequence).toString(36) + '-' + Math.random().toString(36).slice(2, 10);
export const DataProvider: React.FC<DataProviderProps> = ({ children, storage }) => {
  const store = storage ?? localMemoryStorage;
  const { user, loading: authLoading } = useAuth();
  const owner = user?.id ?? 'guest';
  const repository = useMemo(() => new TrackingRepository(store, owner), [store, owner]);
  const currentRepository = useRef(repository); currentRepository.current = repository;
  const [view, setView] = useState<{ repository: TrackingRepository; snapshot: TrackingSnapshot } | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<DataContextType['syncStatus']>('local');
  const ready = useRef<TrackingRepository | null>(null);
  const syncing = useRef(new Set<TrackingRepository>());
  const publish = useCallback(() => { if (currentRepository.current === repository) setView({ repository, snapshot: repository.snapshot }); }, [repository]);
  const sync = useCallback(async () => {
    if (owner === 'guest' || owner === LOCAL_TEST_USER_ID || ready.current !== repository || currentRepository.current !== repository || syncing.current.has(repository)) return;
    syncing.current.add(repository);
    let failed = false;
    setSyncStatus('syncing');
    try {
        // Network work must not hold the local mutation queue: offline recording remains immediate.
        const snapshot = repository.snapshot;
        const acknowledged = new Set<PendingChange>();
        for (const p of snapshot.pending) {
          if (currentRepository.current !== repository || repository.isRetired) return;
          const response = p.deleted
            ? await supabase.from(p.table).delete().eq('user_id', owner).eq('id', p.id)
            : await supabase.from(p.table).upsert({ ...p.row, user_id: owner });
          if (response.error) { failed = true; break; }
          acknowledged.add(p);
        }
        const [remoteEntries, remoteGoals] = await Promise.all([
          fetchAllRows<SmokeEntry>((start, end) => supabase.from('entries').select('id,date,count,notes').eq('user_id', owner).order('id').range(start, end)),
          fetchAllRows<any>((start, end) => supabase.from('goals').select('*').eq('user_id', owner).order('id').range(start, end)),
        ]);
        if (!remoteEntries.every(validEntry) || !remoteGoals.map(mapGoal).every(validGoal)) {
          throw new Error('원격 데이터 형식이 올바르지 않습니다.');
        }
        if (currentRepository.current !== repository || repository.isRetired) return;
        await repository.transact(current => {
        // A newer local edit produces a new change object and cannot be removed by an old acknowledgement.
        const pending = acknowledgeChanges(current.pending, acknowledged);
        // Pending local changes override remote values; tombstones prevent deleted rows reappearing.
        return { next: refreshGoals({ version: 1, entries: reconcileRows<SmokeEntry>(remoteEntries.map(entry => ({ ...entry, notes: entry.notes ?? undefined })), current.entries, 'entries', pending), goals: reconcileRows<Goal>(remoteGoals.map(mapGoal), current.goals, 'goals', pending), pending }), result: undefined };
      });
      if (currentRepository.current === repository) { publish(); setSyncStatus(failed || repository.snapshot.pending.length ? 'offline' : 'synced'); }
    } catch { if (currentRepository.current === repository) setSyncStatus('offline'); }
    finally { syncing.current.delete(repository); }
  }, [repository, owner, publish]);
  useEffect(() => {
    let active = true; ready.current = null; setLoading(true); setError(null); setView(null); setSyncStatus('local');
    if (!authLoading) repository.load().then(() => {
      if (!active) return; ready.current = repository; publish(); setLoading(false); void sync();
    }).catch(() => { if (active) { setError('데이터를 불러오지 못했습니다. 저장된 원본은 보존됩니다.'); setLoading(false); } });
    return () => { active = false; };
  }, [repository, authLoading, publish, sync]);
  useEffect(() => {
    const listener = AppState.addEventListener('change', state => { if (state === 'active') void sync(); });
    const timer = setInterval(() => void sync(), 60_000);
    return () => { listener.remove(); clearInterval(timer); };
  }, [sync]);
  const retrySync = async (): Promise<void> => {
    if (authLoading || currentRepository.current !== repository) return;
    if (ready.current !== repository) {
      setLoading(true); setError(null);
      try {
        store.clearCache?.();
        await repository.load();
        if (currentRepository.current !== repository) return;
        ready.current = repository; publish();
      } catch {
        if (currentRepository.current === repository) setError('데이터를 불러오지 못했습니다. 저장된 원본은 보존됩니다.');
        return;
      } finally { if (currentRepository.current === repository) setLoading(false); }
    }
    await sync();
  };
  const mutate = async <T,>(operation: (snapshot: TrackingSnapshot) => { next: TrackingSnapshot; result: T }) => {
    if (ready.current !== repository || currentRepository.current !== repository) throw new Error('데이터 준비 후 다시 시도해주세요.');
    const result = await repository.transact(snapshot => {
      if (currentRepository.current !== repository) throw new Error('계정이 변경되었습니다. 다시 시도해주세요.');
      const change = operation(snapshot); return { ...change, next: refreshGoals(change.next) };
    });
    publish(); void sync(); return result;
  };
  const entries = view?.repository === repository ? view.snapshot.entries : [];
  const goals = view?.repository === repository ? view.snapshot.goals : [];
  const addEntry = async (count: number, notes?: string) => {
    const entry: SmokeEntry = { id: makeId(), date: new Date().toISOString(), count, notes: notes?.trim().slice(0, 2000) };
    if (!validEntry(entry)) throw new Error('흡연 개수는 1~1000 사이 정수여야 합니다. 금연 확인은 전용 버튼을 사용해주세요.');
    await mutate(s => {
      if (isSmokeFreeCheckin(entry) && s.entries.some(existing => isSmokeFreeCheckin(existing) && localDay(new Date(existing.date)) === localDay(new Date(entry.date)))) return { next: s, result: undefined };
      return { next: { ...s, entries: [...s.entries, entry], pending: enqueueChange(s.pending, { table: 'entries', id: entry.id, row: { ...entry, notes: entry.notes ?? null } }) }, result: undefined };
    });
  };
  const removeEntry = async (id: string) => { await mutate(s => ({ next: { ...s, entries: s.entries.filter(e => e.id !== id), pending: enqueueChange(s.pending, { table: 'entries', id, deleted: true }) }, result: undefined })); };
  const addGoal = async (input: Omit<Goal, 'id' | 'status' | 'startDate' | 'completedAt'>) => {
    const target = input.target === 0 && input.type === 'reduction' ? Math.max(1, Math.floor(weeklySummary(entries).reduce((a, b) => a + b.cigarettes, 0) / 14)) : input.target;
    const goal: Goal = { ...input, id: makeId(), target, startDate: new Date().toISOString(), status: 'active', currentValue: 0 };
    if (!validGoal(goal)) throw new Error('목표 형식을 확인해주세요.');
    return mutate(s => ({ next: { ...s, goals: [...s.goals, goal], pending: enqueueChange(s.pending, { table: 'goals', id: goal.id, row: rowForGoal(goal) }) }, result: goal }));
  };
  const updateGoal = async (id: string, updates: Partial<Goal>) => mutate(s => {
    const old = s.goals.find(g => g.id === id); if (!old) return { next: s, result: undefined };
    const goal = { ...old, ...updates, id: old.id, startDate: old.startDate };
    if (!validGoal(goal)) throw new Error('목표 형식을 확인해주세요.');
    return { next: { ...s, goals: s.goals.map(g => g.id === id ? goal : g), pending: enqueueChange(s.pending, { table: 'goals', id, row: rowForGoal(goal) }) }, result: goal };
  });
  const removeGoal = async (id: string) => { await mutate(s => ({ next: { ...s, goals: s.goals.filter(g => g.id !== id), pending: enqueueChange(s.pending, { table: 'goals', id, deleted: true }) }, result: undefined })); };
  const getGoalProgress = (goal: Goal) => {
    const current = goalValue(goal, entries);
    const daily = goal.type === 'reduction' && (goal.reductionMode === 'daily_limit' || (!goal.reductionMode && goal.target <= 10));
    const progress = daily ? (current <= goal.target ? 100 : Math.max(0, 100 - ((current - goal.target) / goal.target) * 100)) : Math.min(100, current / goal.target * 100);
    return { current, target: goal.target, progress: Math.round(progress) };
  };
  return <DataContext.Provider value={{ entries, goals, isLoading: isLoading || authLoading, error, syncStatus, retrySync, addEntry, removeEntry, addGoal, updateGoal, removeGoal,
    getEntriesByDate: date => entries.filter(e => localDay(new Date(e.date)) === localDay(date)),
    getWeeklySummary: () => weeklySummary(entries), getMonthlyTrend: () => monthlyTrend(entries), getGoalProgress,
    getActiveGoals: () => goals.filter(g => g.status === 'active'), getCompletedGoals: () => goals.filter(g => g.status === 'completed'),
    updateGoalProgress: async (id, progress) => { await updateGoal(id, { currentValue: progress }); },
    completeGoal: async id => { await updateGoal(id, { status: 'completed', completedAt: new Date().toISOString() }); },
  }}>{children}</DataContext.Provider>;
};
export const useData = () => { const context = useContext(DataContext); if (!context) throw new Error('useData must be used within a DataProvider'); return context; };
