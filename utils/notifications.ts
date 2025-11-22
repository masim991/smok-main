import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

const isExpoGo = Constants.appOwnership === 'expo';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Encouraging messages
const ENCOURAGING_MESSAGES = [
  "You're doing great! Keep up the good work! 💪",
  "Every smoke-free moment is a victory! 🎉",
  "Your future self will thank you for staying strong! 🌟",
  "One step at a time - you've got this! 👏",
  "Your willpower is stronger than you think! 💫",
  "Every time you resist, you grow stronger! 🔥",
  "You're building a healthier future with every choice! 🌱",
  "Stay focused on your goals - you're amazing! ✨"
];

// Get a random encouraging message
const getRandomMessage = () => {
  const randomIndex = Math.floor(Math.random() * ENCOURAGING_MESSAGES.length);
  return ENCOURAGING_MESSAGES[randomIndex];
};

// Schedule a random encouraging notification
const scheduleEncouragingNotification = async () => {
  if (isExpoGo || !Device.isDevice) return;
  
  try {
    // Cancel any existing encouraging notifications
    await Notifications.cancelAllScheduledNotificationsAsync();
    
    // Schedule a few random notifications throughout the day
    const hours = [10, 14, 18, 21]; // 10 AM, 2 PM, 6 PM, 9 PM
    
    for (const hour of hours) {
      const minutes = Math.floor(Math.random() * 60); // Random minute in the hour
      
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Stay Strong! 💪',
          body: getRandomMessage(),
          sound: 'default',
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: {
          type: 'daily',
          hour,
          minute: minutes,
          repeats: true,
        } as Notifications.DailyTriggerInput,
      });
    }
  } catch (error) {
    console.log('Error scheduling notifications:', error);
  }
};

// Request notification permissions
const requestPermissions = async () => {
  if (isExpoGo) return false;
  
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  
  return finalStatus === 'granted';
};

export {
  scheduleEncouragingNotification,
  requestPermissions,
  isExpoGo
};
