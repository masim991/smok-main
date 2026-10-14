import { describe, expect, it } from 'vitest'
import { AVAILABLE_GOAL_TEMPLATES } from '../lib/goalTemplates'

describe('selectable goals', () => {
  it('does not offer goals whose baseline or schedule is missing from the stored model', () => {
    expect(AVAILABLE_GOAL_TEMPLATES.map(goal => goal.id)).toEqual([
      'daily_limit_3', 'daily_limit_1', 'week_streak', 'month_champion',
    ])
  })
})
