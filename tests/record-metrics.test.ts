import { describe, expect, it } from 'vitest'
import { entriesOnDay, goalCurrent, localDayKey, monthTrend, weekSummary } from '../lib/recordMetrics'

process.env.TZ = 'Asia/Seoul'

describe('local calendar metrics from UTC timestamps', () => {
  it('keeps adjacent UTC dates on their Korean calendar days', () => {
    const entries = [
      { date: '2026-10-13T05:00:00Z', count: 1 },
      { date: '2026-10-13T15:30:00Z', count: 2 },
    ]
    expect(localDayKey(new Date('2026-10-13T15:30:00Z'))).toBe('2026-10-14')
    expect(entriesOnDay(entries, new Date(2026, 9, 14))).toEqual([entries[1]])
  })

  it('includes the final calendar day of a month in its average', () => {
    const trend = monthTrend([{ date: '2026-10-31T12:00:00Z', count: 5 }], new Date(2026, 9, 31))
    expect(trend.at(-1)).toMatchObject({ endDate: '2026-10-31', average: 5 / 3 })
  })

  it('keeps empty weeks at zero and never includes future days in completed smoke-free days', () => {
    const now = new Date(2026, 9, 14)
    expect(weekSummary([], now).map(day => day.cigarettes)).toEqual([0, 0, 0, 0, 0, 0, 0])
    expect(goalCurrent({ type: 'smoke_free_days', target: 7, startDate: '2026-10-11T00:00:00Z', currentValue: 0 }, [], now)).toBe(3)
  })

  it('counts only completed consecutive days for a streak', () => {
    const now = new Date(2026, 9, 14)
    const goal = { type: 'streak' as const, target: 7, startDate: '2026-10-10T00:00:00Z', currentValue: 0 }
    expect(goalCurrent(goal, [{ date: '2026-10-11T03:00:00Z', count: 1 }], now)).toBe(2)
  })
})
