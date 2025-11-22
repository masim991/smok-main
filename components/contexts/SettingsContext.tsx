import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SettingsContextType {
  remindersPerDay: number;
  setRemindersPerDay: (count: number) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};

interface SettingsProviderProps {
  children: ReactNode;
}

export const SettingsProvider: React.FC<SettingsProviderProps> = ({ children }) => {
  const [remindersPerDay, setRemindersPerDayState] = useState(3);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const savedReminders = await AsyncStorage.getItem('remindersPerDay');
      if (savedReminders) {
        setRemindersPerDayState(parseInt(savedReminders, 10));
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const setRemindersPerDay = async (count: number) => {
    try {
      setRemindersPerDayState(count);
      await AsyncStorage.setItem('remindersPerDay', count.toString());
    } catch (error) {
      console.error('Error saving reminders setting:', error);
    }
  };

  return (
    <SettingsContext.Provider value={{ remindersPerDay, setRemindersPerDay }}>
      {children}
    </SettingsContext.Provider>
  );
};