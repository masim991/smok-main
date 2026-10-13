import { Alert, Platform, type AlertButton } from 'react-native';
export type AppAlert = { title: string; message?: string; buttons?: AlertButton[] };
const queue: AppAlert[] = [];
let listener: ((alert: AppAlert | null) => void) | undefined;
export function subscribeAlerts(callback: (alert: AppAlert | null) => void) { listener = callback; callback(queue[0] ?? null); return () => { if (listener === callback) listener = undefined; }; }
export function dismissAppAlert() { queue.shift(); listener?.(queue[0] ?? null); }
export function appAlert(title: string, message?: string, buttons?: AlertButton[]) {
  if (Platform.OS !== 'web') { Alert.alert(title, message, buttons); return; }
  queue.push({ title, message, buttons }); listener?.(queue[0]);
}
