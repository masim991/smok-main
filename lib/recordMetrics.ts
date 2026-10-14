// Stored entry timestamps are UTC instants. Calendar reports use the device's local day.
export interface DatedEntry { date: string; count: number }
export interface TrackedGoal {
  type: 'reduction' | 'smoke_free_days' | 'milestone' | 'streak'
  target: number
  startDate: string
  currentValue: number
}

export function localDayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function entryDayKey(value: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : localDayKey(date)
}

export function dailyCounts(entries: readonly DatedEntry[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const entry of entries) {
    const key = entryDayKey(entry.date)
    if (key && Number.isFinite(entry.count)) counts.set(key, (counts.get(key) ?? 0) + entry.count)
  }
  return counts
}

export function entriesOnDay<T extends DatedEntry>(entries: readonly T[], day: Date): T[] {
  const key = localDayKey(day)
  return entries.filter(entry => entryDayKey(entry.date) === key)
}

export function weekSummary(entries: readonly DatedEntry[], now: Date) {
  const totals = dailyCounts(entries)
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay())
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  return days.map((day, index) => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index)
    const key = localDayKey(date)
    return { day, date: key, cigarettes: totals.get(key) ?? 0 }
  })
}

export function monthTrend(entries: readonly DatedEntry[], now: Date) {
  const totals = dailyCounts(entries)
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const result: { week: number; average: number; startDate: string; endDate: string }[] = []
  for (let first = 1, week = 1; first <= last; first += 7, week++) {
    const end = Math.min(first + 6, last)
    let sum = 0
    for (let day = first; day <= end; day++) {
      sum += totals.get(localDayKey(new Date(now.getFullYear(), now.getMonth(), day))) ?? 0
    }
    result.push({
      week, average: sum / (end - first + 1),
      startDate: localDayKey(new Date(now.getFullYear(), now.getMonth(), first)),
      endDate: localDayKey(new Date(now.getFullYear(), now.getMonth(), end)),
    })
  }
  return result
}

export function goalCurrent(goal: TrackedGoal, entries: readonly DatedEntry[], now: Date): number {
  const totals = dailyCounts(entries)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const start = entryDayKey(goal.startDate)
  if (!start) return goal.currentValue
  if (goal.type === 'reduction') {
    if (goal.target > 10) return goal.currentValue // A percentage target needs a stored baseline.
    return Math.max(0, goal.target - (totals.get(localDayKey(today)) ?? 0))
  }
  if (goal.type === 'smoke_free_days') {
    const weekStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay())
    let count = 0
    for (const day = new Date(weekStart); day < today; day.setDate(day.getDate() + 1)) {
      const key = localDayKey(day)
      if (key >= start && (totals.get(key) ?? 0) === 0) count++
    }
    return count
  }
  let count = 0
  for (const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1); localDayKey(day) >= start; day.setDate(day.getDate() - 1)) {
    if ((totals.get(localDayKey(day)) ?? 0) !== 0) break
    count++
  }
  return count
}

export function goalProgress(goal: TrackedGoal, entries: readonly DatedEntry[], now: Date) {
  const current = goalCurrent(goal, entries, now)
  const target = goal.target
  if (target <= 0) return { current, target, progress: 0 }
  if (goal.type === 'reduction' && target <= 10) {
    const count = dailyCounts(entries).get(localDayKey(now)) ?? 0
    return { current, target, progress: count <= target ? 100 : 0 }
  }
  return { current, target, progress: Math.round(Math.min(100, Math.max(0, current / target * 100))) }
}
