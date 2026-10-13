import * as Notifications from 'expo-notifications';
import i18n from '@/i18n';
import { Platform } from 'react-native';

// Configure notification behavior for local notifications only
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export interface NotificationSettings {
  enabled: boolean;
  reminderTime: string;
  remindersPerDay: number;
}

export class LocalNotificationService {
  private static instance: LocalNotificationService;
  
  public static getInstance(): LocalNotificationService {
    if (!LocalNotificationService.instance) {
      LocalNotificationService.instance = new LocalNotificationService();
    }
    return LocalNotificationService.instance;
  }

  // Schedule daily notifications at specific times (HH:MM)
  async scheduleSmartReminders(times: string[], message?: string): Promise<void> {
    try {
      if (Platform.OS === 'web') return;
      if (!times.every(t => /^([01]\d|2[0-3]):[0-5]\d$/.test(t))) throw new Error('알림 시간은 HH:MM 형식이어야 합니다.');
      if (!times || times.length === 0) return;
      // Cancel existing to avoid duplicates
      await this.cancelAllNotifications();
      for (const t of [...new Set(times)]) {
        const [hours, minutes] = t.split(':').map(Number);
        await Notifications.scheduleNotificationAsync({
          content: {
            title: i18n.t('notifications.reminderTitle') || 'Reminder',
            body: message || (i18n.t('notifications.encouragementTitle') as string),
            sound: 'default',
            data: { category: 'smok-reminder' },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            hour: hours,
            minute: minutes,
          },
        });
      }
    } catch (error) {
      console.error('Error scheduling smart reminders:', error);
      throw error;
    }
  }

  async requestPermissions(): Promise<boolean> {
    try {
      if (Platform.OS === 'web') return false;
      if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('default', { name: '리마인더', importance: Notifications.AndroidImportance.DEFAULT });
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync({
          ios: {
            allowAlert: true,
            allowBadge: false,
            allowSound: true,
          },
        });
        finalStatus = status;
      }
      
      return finalStatus === 'granted';
    } catch (error) {
      console.error('Error requesting local notification permissions:', error);
      return false;
    }
  }

  async scheduleMotivationalReminders(settings: NotificationSettings): Promise<void> {
    try {
      if (Platform.OS === 'web') return;
      if (!Number.isInteger(settings.remindersPerDay) || settings.remindersPerDay < 0 || settings.remindersPerDay > 12 || !/^([01]\d|2[0-3]):[0-5]\d$/.test(settings.reminderTime)) throw new Error('알림 시간과 횟수를 확인해주세요.');
      // Cancel existing notifications
      await this.cancelAllNotifications();
      
      if (!settings.enabled || settings.remindersPerDay === 0) {
        return;
      }

      const messages = this.getMotivationalMessages();
      const [hours, minutes] = settings.reminderTime.split(':').map(Number);
      
      // Calculate intervals between reminders
      const intervalHours = Math.max(1, Math.floor(12 / settings.remindersPerDay));
      
      for (let i = 0; i < settings.remindersPerDay; i++) {
        const reminderHour = (hours + (i * intervalHours)) % 24;
        const message = messages[i % messages.length];
        
        await Notifications.scheduleNotificationAsync({
          content: {
            title: i18n.t('notifications.reminderTitle'),
            body: message,
            sound: 'default',
            data: { category: 'smok-reminder' },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            hour: reminderHour,
            minute: minutes,
          },
        });
      }
    } catch (error) {
      console.error('Error scheduling notifications:', error);
      throw error;
    }
  }

  async scheduleGoalReminder(goalTitle: string, message: string): Promise<void> {
    try {
      if (Platform.OS === 'web') return;
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `${i18n.t('notifications.goalTitlePrefix')}${goalTitle}`,
          body: message,
          sound: 'default',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: 2,
          repeats: false,
        },
      });
    } catch (error) {
      console.error('Error scheduling goal reminder:', error);
    }
  }

  async scheduleEncouragementNotification(message: string, delayMinutes: number = 30): Promise<void> {
    try {
      if (Platform.OS === 'web') return;
      if (!Number.isFinite(delayMinutes) || delayMinutes <= 0) throw new Error('알림 지연 시간을 확인해주세요.');
      await Notifications.scheduleNotificationAsync({
        content: {
          title: i18n.t('notifications.encouragementTitle'),
          body: message,
          sound: 'default',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: delayMinutes * 60,
          repeats: false,
        },
      });
    } catch (error) {
      console.error('Error scheduling encouragement notification:', error);
    }
  }

  async cancelAllNotifications(): Promise<void> {
    try {
      if (Platform.OS === 'web') return;
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      for (const notification of scheduled) {
        if (notification.content.data?.category === 'smok-reminder') await Notifications.cancelScheduledNotificationAsync(notification.identifier);
      }
    } catch (error) {
      console.error('Error canceling notifications:', error);
      throw error;
    }
  }

  private getMotivationalMessages(): string[] {
    const msgs = i18n.t('notifications.messages', { returnObjects: true }) as string[];
    return Array.isArray(msgs) && msgs.length > 0 ? msgs : [i18n.t('notifications.encouragementTitle')];
  }

  private getRedMeanMessages(): string[] {
    const msgs = i18n.t('notifications.redMeanMessages', { returnObjects: true }) as string[];
    return Array.isArray(msgs) && msgs.length > 0 ? msgs : [i18n.t('notifications.encouragementTitle')];
  }

  getMessagesForTheme(theme: string): string[] {
    return theme === 'redMean' ? this.getRedMeanMessages() : this.getMotivationalMessages();
  }
}

export const notificationService = LocalNotificationService.getInstance();
