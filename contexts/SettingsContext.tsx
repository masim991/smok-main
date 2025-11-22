import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from '@/i18n';
import * as Localization from 'expo-localization';

interface SettingsContextType {
  remindersPerDay: number;
  setRemindersPerDay: (count: number) => void;
  notificationsEnabled: boolean;
  setNotificationsEnabled: (enabled: boolean) => void;
  notificationTime: string;
  setNotificationTime: (time: string) => void;
  language: string;
  setLanguage: (lng: string) => void;
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
  const [notificationsEnabled, setNotificationsEnabledState] = useState(false);
  const [notificationTime, setNotificationTimeState] = useState('09:00');
  const [language, setLanguageState] = useState<string>('en');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const [savedReminders, savedNotifications, savedTime, savedLanguage] = await Promise.all([
        AsyncStorage.getItem('remindersPerDay'),
        AsyncStorage.getItem('notificationsEnabled'),
        AsyncStorage.getItem('notificationTime'),
        AsyncStorage.getItem('language')
      ]);
      
      if (savedReminders) {
        setRemindersPerDayState(parseInt(savedReminders, 10));
      }
      if (savedNotifications) {
        setNotificationsEnabledState(savedNotifications === 'true');
      }
      if (savedTime) {
        setNotificationTimeState(savedTime);
      }
      const deviceLng = Localization.getLocales()[0]?.languageCode ?? 'en';
      const lngToUse = savedLanguage || deviceLng;
      setLanguageState(lngToUse);
      i18n.changeLanguage(lngToUse);
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

  const setNotificationsEnabled = async (enabled: boolean) => {
    try {
      setNotificationsEnabledState(enabled);
      await AsyncStorage.setItem('notificationsEnabled', enabled.toString());
    } catch (error) {
      console.error('Error saving notifications setting:', error);
    }
  };

  const setNotificationTime = async (time: string) => {
    try {
      setNotificationTimeState(time);
      await AsyncStorage.setItem('notificationTime', time);
    } catch (error) {
      console.error('Error saving notification time:', error);
    }
  };

  const setLanguage = async (lng: string) => {
    try {
      setLanguageState(lng);
      await AsyncStorage.setItem('language', lng);
      i18n.changeLanguage(lng);
    } catch (error) {
      console.error('Error saving language:', error);
    }
  };

  return (
    <SettingsContext.Provider value={{ 
      remindersPerDay, 
      setRemindersPerDay,
      notificationsEnabled,
      setNotificationsEnabled,
      notificationTime,
      setNotificationTime,
      language,
      setLanguage
    }}>
      {children}
    </SettingsContext.Provider>
  );
};