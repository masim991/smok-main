import type { GoalType } from '@/components/contexts/DataContext';

export interface GoalTemplate {
  id: string;
  title: string;
  redMeanTitle: string;
  description: string;
  redMeanDescription: string;
  type: GoalType;
  target: number;
  difficulty: 'easy' | 'medium' | 'hard' | 'extreme';
  icon: string;
}

export const GOAL_TEMPLATES: GoalTemplate[] = [
  {
    id: 'reduce_half',
    title: 'Cut in Half',
    redMeanTitle: 'REDUCE WEAKNESS',
    description: 'Reduce your daily cigarettes by 50%',
    redMeanDescription: 'PROVE YOU CAN CONTROL YOUR PATHETIC ADDICTION',
    type: 'reduction',
    target: 50, // percentage
    difficulty: 'easy',
    icon: '📉'
  },
  {
    id: 'daily_limit_3',
    title: 'Daily Limit: 3',
    redMeanTitle: 'STRICT DISCIPLINE',
    description: 'Maximum 3 cigarettes per day',
    redMeanDescription: 'THREE FAILURES MAXIMUM. NO EXCUSES.',
    type: 'reduction',
    target: 3,
    difficulty: 'medium',
    icon: '🎯'
  },
  {
    id: 'daily_limit_1',
    title: 'Single Smoke',
    redMeanTitle: 'ONE WEAKNESS ONLY',
    description: 'Only 1 cigarette per day',
    redMeanDescription: 'ONE PATHETIC CIGARETTE. THAT\'S ALL YOU GET.',
    type: 'reduction',
    target: 1,
    difficulty: 'hard',
    icon: '🚬'
  },
  {
    id: 'weekend_warrior',
    title: 'Smoke-Free Weekends',
    redMeanTitle: 'WEEKEND STRENGTH',
    description: 'Keep weekends completely smoke-free',
    redMeanDescription: 'SHOW STRENGTH WHEN IT MATTERS MOST',
    type: 'smoke_free_days',
    target: 2,
    difficulty: 'medium',
    icon: '🏖️'
  },
  {
    id: 'workday_clean',
    title: 'Clean Workdays',
    redMeanTitle: 'PROFESSIONAL POWER',
    description: 'No smoking during work hours',
    redMeanDescription: 'BE STRONG AT WORK. NO WEAKNESS ALLOWED.',
    type: 'smoke_free_days',
    target: 5,
    difficulty: 'hard',
    icon: '💼'
  },
  {
    id: 'week_streak',
    title: '7-Day Streak',
    redMeanTitle: 'SEVEN DAY BATTLE',
    description: 'Go 7 consecutive days smoke-free',
    redMeanDescription: 'ONE WEEK WITHOUT FAILURE. PROVE YOUR WORTH.',
    type: 'streak',
    target: 7,
    difficulty: 'hard',
    icon: '🔥'
  },
  {
    id: 'month_champion',
    title: '30-Day Champion',
    redMeanTitle: 'MONTH OF POWER',
    description: 'Complete 30 days without smoking',
    redMeanDescription: 'THIRTY DAYS OF PURE DISCIPLINE AND STRENGTH',
    type: 'streak',
    target: 30,
    difficulty: 'extreme',
    icon: '🏆'
  },
  {
    id: 'morning_control',
    title: 'Morning Control',
    redMeanTitle: 'MORNING DISCIPLINE',
    description: 'No cigarettes before 12 PM',
    redMeanDescription: 'CONTROL YOUR MORNING WEAKNESS',
    type: 'milestone',
    target: 12, // hour
    difficulty: 'easy',
    icon: '🌅'
  }
];

export const AVAILABLE_GOAL_TEMPLATES = GOAL_TEMPLATES.filter(template =>
  !['reduce_half', 'weekend_warrior', 'workday_clean', 'morning_control'].includes(template.id)
);
