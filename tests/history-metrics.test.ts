import { describe, expect, it } from 'vitest'
import { historyReports, historyStats, monthBuckets } from '../lib/historyMetrics'

process.env.TZ = 'Asia/Seoul'

describe('history metrics', () => {
  it('returns zeros after all entries are removed', () => {
    expect(historyStats([], new Date(2026, 9, 14))).toEqual({ total: 0, average: 0, trend: 0, streak: 0, smokeFreeDays: 0, trackedDays: 0, smokingDays: 0 })
  })
  it('counts calendar days and completed smoke-free days, not only logged days', () => {
    const entries = [{ date: '2026-10-11T03:00:00Z', count: 2 }, { date: '2026-10-13T15:30:00Z', count: 1 }]
    const stats = historyStats(entries, new Date(2026, 9, 14))
    expect(stats).toMatchObject({ total: 3, average: 0.8, streak: 2, smokeFreeDays: 2, trackedDays: 3, smokingDays: 2 })
  })
  it('groups UTC instants by local month regardless of insertion order', () => {
    const entries = [{ date: '2026-10-31T15:30:00Z', count: 2 }, { date: '2026-10-31T10:00:00Z', count: 1 }]
    expect(monthBuckets(entries)).toEqual([{ date: '2026-10', cigarettes: 1 }, { date: '2026-11', cigarettes: 2 }])
  })
  it('aggregates local weekday, hour and trigger counts in one report', () => {
    const report = historyReports([
      { date: '2026-10-14T12:00:00Z', count: 2, notes: '[trg] e=stress; c=break; p=office' },
      { date: '2026-10-14T13:00:00Z', count: 1, notes: '[trg] e=stress' },
      { date: 'bad date', count: 5 },
    ])
    expect(report.weekdays[3]).toBe(3)
    expect(report.hours[21]).toBe(2)
    expect(report.hours[22]).toBe(1)
    expect(report.emotion).toEqual([['stress', 3]])
    expect(report.context).toEqual([['break', 2]])
    expect(report.place).toEqual([['office', 2]])
  })
})
