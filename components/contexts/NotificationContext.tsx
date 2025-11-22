import React, { createContext, useContext, useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

interface NotificationContextType {
  scheduleGoalReminder: (message: string, seconds: number) => Promise<void>;
  scheduleEncouragement: (message: string, seconds: number) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useEffect(() => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    (async () => {
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') {
        await Notifications.requestPermissionsAsync();
      }
    })();
  }, []);

  const scheduleGoalReminder = async (message: string, seconds: number) => {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Goal Reminder',
        body: message,
      },
      trigger: { seconds, repeats: false } as any,
    });
  };

  const scheduleEncouragement = async (message: string, seconds: number) => {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Encouragement',
        body: message,
      },
      trigger: { seconds, repeats: false } as any,
    });
  };

  return (
    <NotificationContext.Provider value={{ scheduleGoalReminder, scheduleEncouragement }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotification must be used within a NotificationProvider');
  return ctx;
};
