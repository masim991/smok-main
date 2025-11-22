import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeMode = 'light' | 'dark' | 'redMean';

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
  background: '#7F1D1D',
  surface: '#991B1B',
  primary: '#DC2626',
  secondary: '#B91C1C',
  text: '#FFFFFF',
  textSecondary: '#FCA5A5',
  border: '#B91C1C',
  success: '#DC2626',
  warning: '#DC2626',
  error: '#FFFFFF',
  tabBarBackground: '#991B1B',
  tabBarActive: '#FFFFFF',
  tabBarInactive: '#FCA5A5',
};

interface ThemeContextType {
  theme: ThemeMode;
  colors: ThemeColors;
  setTheme: (theme: ThemeMode) => void;
  isRedMeanUnlocked: boolean;
  unlockRedMean: () => void;
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
  const [isRedMeanUnlocked, setIsRedMeanUnlocked] = useState(false);

  useEffect(() => {
    loadTheme();
  }, []);

  const loadTheme = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem('theme');
      const redMeanUnlocked = await AsyncStorage.getItem('redMeanUnlocked');
      
      if (savedTheme && ['light', 'dark', 'redMean'].includes(savedTheme)) {
        setThemeState(savedTheme as ThemeMode);
      }
      
      if (redMeanUnlocked === 'true') {
        setIsRedMeanUnlocked(true);
      }
    } catch (error) {
      console.error('Error loading theme:', error);
    }
  };

  const setTheme = async (newTheme: ThemeMode) => {
    try {
      setThemeState(newTheme);
      await AsyncStorage.setItem('theme', newTheme);
    } catch (error) {
      console.error('Error saving theme:', error);
    }
  };

  const unlockRedMean = async () => {
    try {
      setIsRedMeanUnlocked(true);
      await AsyncStorage.setItem('redMeanUnlocked', 'true');
    } catch (error) {
      console.error('Error unlocking red mean mode:', error);
    }
  };

  const getColors = (): ThemeColors => {
    switch (theme) {
      case 'dark':
        return darkTheme;
      case 'redMean':
        return redMeanTheme;
      default:
        return lightTheme;
    }
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        colors: getColors(),
        setTheme,
        isRedMeanUnlocked,
        unlockRedMean,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};