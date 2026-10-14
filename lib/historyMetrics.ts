import { dailyCounts, localDayKey, type DatedEntry } from './recordMetrics'

const day = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate())
const shifted = (date: Date, offset: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + offset)

export function historyStats(entries: readonly DatedEntry[], now: Date) {
  const counts = dailyCounts(entries)
  if (counts.size === 0) return { total: 0, average: 0, trend: 0, streak: 0, smokeFreeDays: 0, trackedDays: 0, smokingDays: 0 }
  const today = day(now)
  const firstKey = [...counts.keys()].sort()[0]
  const first = new Date(`${firstKey}T12:00:00`)
  let trackedDays = 0
  let smokeFreeDays = 0
  let smokingDays = 0
  let calendarDays = 0
  for (let current = day(first); current <= today; current = shifted(current, 1)) {
    const cigarettes = counts.get(localDayKey(current)) ?? 0
    calendarDays++
    if (current < today) {
      trackedDays++
      if (cigarettes === 0) smokeFreeDays++
    }
    if (cigarettes > 0) smokingDays++
  }
  const total = [...counts.values()].reduce((sum, count) => sum + count, 0)
  let streak = 0
  for (let current = shifted(today, -1); current >= day(first); current = shifted(current, -1)) {
    if ((counts.get(localDayKey(current)) ?? 0) > 0) break
    streak++
  }
  let recent = 0
  let previous = 0
  for (let offset = 1; offset <= 28; offset++) {
    const count = counts.get(localDayKey(shifted(today, -offset))) ?? 0
    if (offset <= 14) recent += count
    else previous += count
  }
  return {
    total,
    average: Math.round(total / calendarDays * 10) / 10,
    trend: previous > 0 ? Math.round((recent - previous) / previous * 1000) / 10 : 0,
    streak, smokeFreeDays, trackedDays, smokingDays,
  }
}

export function monthBuckets(entries: readonly DatedEntry[]) {
  const buckets = new Map<string, number>()
  for (const [key, count] of dailyCounts(entries)) {
    const month = key.slice(0, 7)
    buckets.set(month, (buckets.get(month) ?? 0) + count)
  }
  return [...buckets].sort(([a], [b]) => a.localeCompare(b)).map(([date, cigarettes]) => ({ date, cigarettes }))
}
