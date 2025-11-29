import * as Notifications from 'expo-notifications';
import i18n from '@/i18n';

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
      if (!times || times.length === 0) return;
      // Cancel existing to avoid duplicates
      await this.cancelAllNotifications();
      for (const t of times) {
        const [hours, minutes] = t.split(':').map(Number);
        await Notifications.scheduleNotificationAsync({
          content: {
            title: i18n.t('notifications.reminderTitle') || 'Reminder',
            body: message || (i18n.t('notifications.encouragementTitle') as string),
            sound: 'default',
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
            hour: hours,
            minute: minutes,
            repeats: true,
          },
        });
      }
    } catch (error) {
      console.error('Error scheduling smart reminders:', error);
    }
  }

  async requestPermissions(): Promise<boolean> {
    try {
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
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
            hour: reminderHour,
            minute: minutes,
            repeats: true,
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
      await Notifications.cancelAllScheduledNotificationsAsync();
    } catch (error) {
      console.error('Error canceling notifications:', error);
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