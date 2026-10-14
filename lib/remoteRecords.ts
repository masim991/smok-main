import type { Goal, SmokeEntry } from '@/components/contexts/DataContext'

export const entryToRemote = (entry: SmokeEntry, userId: string) => ({
  id: entry.id, user_id: userId, date: entry.date, count: entry.count, notes: entry.notes ?? null,
})
export const goalToRemote = (goal: Goal, userId: string) => ({
  id: goal.id, user_id: userId, type: goal.type, target: goal.target, start_date: goal.startDate,
  status: goal.status, current_value: goal.currentValue, title: goal.title, description: goal.description,
  completed_at: goal.completedAt ?? null, difficulty: goal.difficulty, icon: goal.icon,
  red_mean_title: goal.redMeanTitle ?? null, red_mean_description: goal.redMeanDescription ?? null,
})

export const remoteToGoal = (g: any): Goal => ({
  id: g.id, type: g.type, target: g.target, startDate: g.start_date, status: g.status,
  currentValue: g.current_value, title: g.title, description: g.description,
  completedAt: g.completed_at ?? undefined, difficulty: g.difficulty, icon: g.icon,
  redMeanTitle: g.red_mean_title ?? undefined, redMeanDescription: g.red_mean_description ?? undefined,
})

// 앱 전역에서 기록/목표 데이터를 제공하고 로컬/원격(Supabase) 동기화를 담당
