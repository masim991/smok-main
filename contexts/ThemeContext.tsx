import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeMode = 'light' | 'dark' | 'redMean';

export type TrackingGoal = {
  id: string;
  name: string;
  description: string;
  theme: ThemeMode;
  target: number;
  unit: string;
  icon: string;
};

export const TRACKING_GOALS: TrackingGoal[] = [
  {
    id: 'reduce',
    name: 'Reduce Smoking',
    description: 'Gradually reduce cigarette intake',
    theme: 'light',
    target: 5,
    unit: 'cigarettes/day',
    icon: 'trending-down',
  },
  {
    id: 'quit',
    name: 'Quit Smoking',
    description: 'Become completely smoke-free',
    theme: 'dark',
    target: 0,
    unit: 'cigarettes/day',
    icon: 'no-smoking',
  },
  {
    id: 'maintain',
    name: 'Maintain Progress',
    description: 'Keep up your smoke-free streak',
    theme: 'light',
    target: 0,
    unit: 'days',
    icon: 'calendar-check',
  },
  {
    id: 'challenge',
    name: '7-Day Challenge',
    description: 'Go 7 days without smoking',
    theme: 'redMean',
    target: 7,
    unit: 'days',
    icon: 'award',
  },
];

interface ThemeColors {
  background: string;
  surface: string;
  primary: string;
  secondary: string;
  text: string;
  textSecondary: string;
  border: string;
  success: string;
  warning: string;
  error: string;
  tabBarBackground: string;
  tabBarActive: string;
  tabBarInactive: string;
}

const lightTheme: ThemeColors = {
  background: '#FFFFFF',
  surface: '#F8FAFC',
  primary: '#3B82F6',
  secondary: '#64748B',
  text: '#1E293B',
  textSecondary: '#64748B',
  border: '#E2E8F0',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  tabBarBackground: '#FFFFFF',
  tabBarActive: '#3B82F6',
  tabBarInactive: '#94A3B8',
};

const darkTheme: ThemeColors = {
  background: '#0F172A',
  surface: '#1E293B',
  primary: '#60A5FA',
  secondary: '#94A3B8',
  text: '#F1F5F9',
  textSecondary: '#94A3B8',
  border: '#334155',
  success: '#34D399',
  warning: '#FBBF24',
  error: '#F87171',
  tabBarBackground: '#1E293B',
  tabBarActive: '#60A5FA',
  tabBarInactive: '#64748B',
};

const redMeanTheme: ThemeColors = {
  background: '#1A0000',
  surface: '#450A0A',
  primary: '#FF0000',
  secondary: '#DC2626',
  text: '#FFFFFF',
  textSecondary: '#FFAAAA',
  border: '#7F1D1D',
  success: '#FF0000',
  warning: '#FF6600',
  error: '#FFFFFF',
  tabBarBackground: '#450A0A',
  tabBarActive: '#FFFFFF',
  tabBarInactive: '#FFAAAA',
};

interface ThemeContextType {
  theme: ThemeMode;
  colors: ThemeColors;
  trackingGoal: TrackingGoal | null;
  setTheme: (theme: ThemeMode) => void;
  isRedMeanUnlocked: boolean;
  unlockRedMean: () => void;
  setTrackingGoal: (goalId: string) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>('light');
  const [trackingGoal, setTrackingGoalState] = useState<TrackingGoal | null>(null);
  const [isRedMeanUnlocked, setIsRedMeanUnlocked] = useState(false);

  useEffect(() => {
    const loadThemeAndGoal = async () => {
      try {
        const [savedTheme, savedGoal] = await Promise.all([
          AsyncStorage.getItem('@theme'),
          AsyncStorage.getItem('@trackingGoal')
        ]);

        if (savedTheme) {
          setThemeState(savedTheme as ThemeMode);
        }

        if (savedGoal) {
          const parsedGoal = JSON.parse(savedGoal);
          setTrackingGoalState(parsedGoal);
        } else {
          // Set default goal if none is selected
          setTrackingGoalState(TRACKING_GOALS[0]);
        }
      } catch (error) {
        console.error('Failed to load theme or goal', error);
      }
    };

    loadThemeAndGoal();
  }, []);

  const setTheme = (newTheme: ThemeMode) => {
    if (newTheme === 'redMean' && !isRedMeanUnlocked) return;
    setThemeState(newTheme);
    AsyncStorage.setItem('@theme', newTheme);
  };

  const setTrackingGoal = (goalId: string) => {
    const goal = TRACKING_GOALS.find(g => g.id === goalId) || null;
    setTrackingGoalState(goal);
    if (goal) {
      setTheme(goal.theme);
      AsyncStorage.setItem('@trackingGoal', JSON.stringify(goal));
    }
  };

  const unlockRedMean = async () => {
    try {
      setIsRedMeanUnlocked(true);
      await AsyncStorage.setItem('@redMeanUnlocked', 'true');
    } catch (error) {
      console.error('Error unlocking red mean mode:', error);
    }
  };

  const currentColors = theme === 'dark' ? darkTheme : theme === 'redMean' ? redMeanTheme : lightTheme;

  const value = {
    theme,
    colors: currentColors,
    trackingGoal,
    setTheme,
    isRedMeanUnlocked,
    unlockRedMean,
    setTrackingGoal,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};