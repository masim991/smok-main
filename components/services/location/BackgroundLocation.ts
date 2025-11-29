import * as Location from 'expo-location';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

export const BG_LOCATION_TASK = 'bg-location-task';

let taskRegistered = false;

export async function registerBackgroundLocationTask(): Promise<boolean> {
  try {
    if (taskRegistered) return true;
    // Dynamically import to avoid hard dependency if package not installed at build time
    const TaskManager = await import('expo-task-manager');
    TaskManager.defineTask(BG_LOCATION_TASK, async (event: { data?: unknown; error?: unknown }) => {
      const { data, error } = event || {};
      if (error) {
        console.error('[BG Location] Task error:', error);
        return;
      }
      const payload = (data as { locations?: Location.LocationObject[] }) || {};
      const locations = payload.locations || [];
      if (locations.length > 0) {
        const last = locations[locations.length - 1];
        // Keep it light to avoid perf issues
        // eslint-disable-next-line no-console
        console.log('[BG Location] update:', last.coords.latitude, last.coords.longitude, 'acc', last.coords.accuracy);
      }
      return;
    });
    taskRegistered = true;
    return true;
  } catch (e) {
    console.error('[BG Location] register error (is expo-task-manager installed?)', e);
    return false;
  }
}

export async function startBackgroundLocation(): Promise<boolean> {
  try {
    const ownership = Constants?.appOwnership;
    if (ownership === 'expo') {
      // Expo Go에서는 백그라운드 위치 업데이트가 지원되지 않으므로 포그라운드만 요청
      const fgOnly = await Location.requestForegroundPermissionsAsync();
      return fgOnly.status === 'granted';
    }
    const ok = await registerBackgroundLocationTask();
    if (!ok) return false;

    const fg = await Location.requestForegroundPermissionsAsync();
    if (fg.status !== 'granted') return false;

    const bg = await Location.requestBackgroundPermissionsAsync();
    if (bg.status !== 'granted') return false;

    const started = await Location.hasStartedLocationUpdatesAsync(BG_LOCATION_TASK);
    if (!started) {
      await Location.startLocationUpdatesAsync(BG_LOCATION_TASK, {
        accuracy: Location.Accuracy.Highest,
        distanceInterval: 10,
        timeInterval: 5000,
        pausesUpdatesAutomatically: false,
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: 'Location Tracking',
          notificationBody: 'Tracking location in the background',
          notificationColor: '#007AFF',
        },
      } as Location.LocationTaskOptions);
    }
    return true;
  } catch (e) {
    console.error('[BG Location] start error:', e);
    return false;
  }
}

export async function stopBackgroundLocation(): Promise<void> {
  try {
    const started = await Location.hasStartedLocationUpdatesAsync(BG_LOCATION_TASK);
    if (started) {
      await Location.stopLocationUpdatesAsync(BG_LOCATION_TASK);
    }
  } catch (e) {
    console.error('[BG Location] stop error:', e);
  }
}

export async function isBackgroundLocationStarted(): Promise<boolean> {
  try {
    return await Location.hasStartedLocationUpdatesAsync(BG_LOCATION_TASK);
  } catch {
    return false;
  }
}
