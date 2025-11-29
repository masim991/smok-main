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
  smartNotificationsEnabled: boolean;
  setSmartNotificationsEnabled: (enabled: boolean) => void;
  dailyGoalTarget: number;
  setDailyGoalTarget: (value: number) => void;
  geofenceAutoCount: boolean;
  setGeofenceAutoCount: (enabled: boolean) => void;
  wearableDetectionEnabled: boolean;
  setWearableDetectionEnabled: (enabled: boolean) => void;
  audioDetectionEnabled: boolean;
  setAudioDetectionEnabled: (enabled: boolean) => void;
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
  const [smartNotificationsEnabled, setSmartNotificationsEnabledState] = useState<boolean>(false);
  const [dailyGoalTarget, setDailyGoalTargetState] = useState<number>(0);
  const [geofenceAutoCount, setGeofenceAutoCountState] = useState<boolean>(true);
  const [wearableDetectionEnabled, setWearableDetectionEnabledState] = useState<boolean>(false);
  const [audioDetectionEnabled, setAudioDetectionEnabledState] = useState<boolean>(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const [savedReminders, savedNotifications, savedTime, savedLanguage, savedSmart, savedDailyGoal, savedGeofenceAutoCount, savedWearableEnabled, savedAudioEnabled] = await Promise.all([
        AsyncStorage.getItem('remindersPerDay'),
        AsyncStorage.getItem('notificationsEnabled'),
        AsyncStorage.getItem('notificationTime'),
        AsyncStorage.getItem('language'),
        AsyncStorage.getItem('smartNotificationsEnabled'),
        AsyncStorage.getItem('dailyGoalTarget'),
        AsyncStorage.getItem('geofenceAutoCount'),
        AsyncStorage.getItem('wearableDetectionEnabled'),
        AsyncStorage.getItem('audioDetectionEnabled')
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

      if (savedSmart != null) {
        setSmartNotificationsEnabledState(savedSmart === 'true');
      }
      if (savedDailyGoal != null && !Number.isNaN(Number(savedDailyGoal))) {
        setDailyGoalTargetState(parseInt(savedDailyGoal, 10));
      }
      if (savedGeofenceAutoCount != null) {
        setGeofenceAutoCountState(savedGeofenceAutoCount === 'true');
      }
      if (savedWearableEnabled != null) {
        setWearableDetectionEnabledState(savedWearableEnabled === 'true');
      }
      if (savedAudioEnabled != null) {
        setAudioDetectionEnabledState(savedAudioEnabled === 'true');
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

  // Added in Step 3: smart notifications toggle
  const setSmartNotificationsEnabled = async (enabled: boolean) => {
    try {
      setSmartNotificationsEnabledState(enabled);
      await AsyncStorage.setItem('smartNotificationsEnabled', String(enabled));
    } catch (error) {
      console.error('Error saving smart notifications setting:', error);
    }
  };

  // Added in Step 3: daily goal target value
  const setDailyGoalTarget = async (value: number) => {
    try {
      setDailyGoalTargetState(value);
      await AsyncStorage.setItem('dailyGoalTarget', String(value));
    } catch (error) {
      console.error('Error saving daily goal target:', error);
    }
  };

  const setGeofenceAutoCount = async (enabled: boolean) => {
    try {
      setGeofenceAutoCountState(enabled);
      await AsyncStorage.setItem('geofenceAutoCount', String(enabled));
    } catch (error) {
      console.error('Error saving geofence auto-count setting:', error);
    }
  };

  const setWearableDetectionEnabled = async (enabled: boolean) => {
    try {
      setWearableDetectionEnabledState(enabled);
      await AsyncStorage.setItem('wearableDetectionEnabled', String(enabled));
    } catch (error) {
      console.error('Error saving wearable detection setting:', error);
    }
  };

  const setAudioDetectionEnabled = async (enabled: boolean) => {
    try {
      setAudioDetectionEnabledState(enabled);
      await AsyncStorage.setItem('audioDetectionEnabled', String(enabled));
    } catch (error) {
      console.error('Error saving audio detection setting:', error);
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
      setLanguage,
      smartNotificationsEnabled,
      setSmartNotificationsEnabled,
      dailyGoalTarget,
      setDailyGoalTarget,
      geofenceAutoCount,
      setGeofenceAutoCount,
      wearableDetectionEnabled,
      setWearableDetectionEnabled,
      audioDetectionEnabled,
      setAudioDetectionEnabled
    }}>
      {children}
    </SettingsContext.Provider>
  );
};