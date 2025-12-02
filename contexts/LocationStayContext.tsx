import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, AppStateStatus, Platform, Alert } from 'react-native';
import { isInsideRadius, LatLng } from '@/utils/location';
import { useData } from '@/components/contexts/DataContext';

export const LOCATION_STAY_TASK = 'location-stay-monitor-task';

type StaySettings = {
  latitude: number | null;
  longitude: number | null;
  radius: number; // meters
};

type PermissionState = {
  locationGranted: boolean;
  backgroundLocationGranted: boolean;
  notificationGranted: boolean;
};

type RuntimeState = {
  inside: boolean;
  elapsedMs: number;
  hasNotifiedForCurrentStay: boolean;
  startTime: number | null;
  lastCountedIndex?: number; // minutes blocks counted since threshold
  lastNotifiedIndex?: number; // minutes blocks notified since threshold
};

const DEFAULT_SETTINGS: StaySettings = {
  latitude: null,
  longitude: null,
  radius: 50,
};

const DEFAULT_RUNTIME: RuntimeState = {
  inside: false,
  elapsedMs: 0,
  hasNotifiedForCurrentStay: false,
  startTime: null,
};

const STORAGE_KEYS = {
  settings: 'stay_monitor_settings',
  runtime: 'stay_monitor_runtime',
  enabled: 'stay_monitor_enabled',
  pendingCount: 'stay_monitor_pending_count',
} as const;

export type LocationStayContextValue = {
  settings: StaySettings;
  setSettings: (s: Partial<StaySettings>) => Promise<void>;
  enabled: boolean;
  toggleEnabled: (on: boolean) => Promise<void>;
  permissions: PermissionState;
  runtime: RuntimeState;
  setFromCurrentLocation: () => Promise<void>;
  requestAllPermissions: () => Promise<boolean>;
};

const LocationStayContext = createContext<LocationStayContextValue | undefined>(undefined);

// Define background task once
TaskManager.defineTask(LOCATION_STAY_TASK, async ({ data, error }) => {
  if (error) {
    console.error('Location task error', error);
    return;
  }
  const { locations } = (data || {}) as any;
  if (!locations || locations.length === 0) return;

  const rawSettings = await AsyncStorage.getItem(STORAGE_KEYS.settings);
  const rawRuntime = await AsyncStorage.getItem(STORAGE_KEYS.runtime);

  const settings: StaySettings = rawSettings ? JSON.parse(rawSettings) : DEFAULT_SETTINGS;
  let runtime: RuntimeState = rawRuntime ? JSON.parse(rawRuntime) : DEFAULT_RUNTIME;

  const targetSet = settings.latitude != null && settings.longitude != null;
  if (!targetSet) {
    return;
  }

  const center: LatLng = { latitude: settings.latitude as number, longitude: settings.longitude as number };
  const radius = settings.radius ?? 50;
  // Load configurable behavior from SettingsContext storage
  const savedStayMinutes = await AsyncStorage.getItem('stayMinutes');
  const savedNotifMode = await AsyncStorage.getItem('stayNotificationMode');
  const savedAutoCount = await AsyncStorage.getItem('geofenceAutoCount');
  const stayMinutes = Math.max(1, parseInt(savedStayMinutes || '2', 10));
  const notificationMode: 'once' | 'every_block' = savedNotifMode === 'every_block' ? 'every_block' : 'once';
  const autoCountEnabled = savedAutoCount === 'true';

  for (const loc of locations) {
    const current: LatLng = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
    const inside = isInsideRadius(current, center, radius);

    if (inside) {
      if (!runtime.inside) {
        runtime.inside = true;
        runtime.startTime = (loc.timestamp as number) ?? Date.now();
        runtime.elapsedMs = 0;
        runtime.hasNotifiedForCurrentStay = false;
      } else {
        const start = runtime.startTime ?? Date.now();
        runtime.elapsedMs = Math.max(runtime.elapsedMs, ((loc.timestamp as number) ?? Date.now()) - start);
      }

      const thresholdMs = stayMinutes * 60 * 1000;
      if (runtime.elapsedMs >= thresholdMs) {
        // Count per threshold block: floor(elapsed / threshold)
        const blocks = Math.floor(runtime.elapsedMs / thresholdMs); // 1..N
        if (autoCountEnabled) {
          const lastIdx = runtime.lastCountedIndex ?? 0;
          const newBlocks = Math.max(0, blocks - lastIdx);
          if (newBlocks > 0) {
            const rawPending = await AsyncStorage.getItem(STORAGE_KEYS.pendingCount);
            const pending = rawPending ? parseInt(rawPending, 10) : 0;
            await AsyncStorage.setItem(STORAGE_KEYS.pendingCount, String(pending + newBlocks));
            runtime.lastCountedIndex = blocks;
          }
        }

        // Notifications
        if (notificationMode === 'once') {
          if (!runtime.hasNotifiedForCurrentStay) {
            try {
              await Notifications.scheduleNotificationAsync({
                content: {
                  title: '흡연 구역에 오래 머무르고 있어요',
                  body: '설정한 시간 이상 같은 위치에 머무르고 있습니다. 흡연을 줄이는 데 도움이 되도록 잠시 자리를 옮겨보는 건 어떨까요?',
                  sound: true,
                },
                trigger: null,
              });
              runtime.hasNotifiedForCurrentStay = true;
            } catch (e) {
              console.error('Failed to schedule notification', e);
            }
          }
        } else {
          // every_block: notify once per block
          const lastN = runtime.lastNotifiedIndex ?? 0;
          if (blocks > lastN) {
            try {
              await Notifications.scheduleNotificationAsync({
                content: {
                  title: '흡연 구역 체류 중 알림',
                  body: `${stayMinutes}분 단위 ${blocks}번째 체류 구간입니다. 잠시 자리를 옮겨보는 건 어떨까요?`,
                  sound: false,
                },
                trigger: null,
              });
              runtime.lastNotifiedIndex = blocks;
            } catch (e) {
              console.error('Failed to schedule per-block notification', e);
            }
          }
        }
      }
    } else {
      runtime.inside = false;
      runtime.startTime = null;
      runtime.elapsedMs = 0;
      runtime.hasNotifiedForCurrentStay = false;
      runtime.lastCountedIndex = 0;
      runtime.lastNotifiedIndex = 0;
    }
  }

  await AsyncStorage.setItem(STORAGE_KEYS.runtime, JSON.stringify(runtime));
});

export function LocationStayProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettingsState] = useState<StaySettings>(DEFAULT_SETTINGS);
  const [enabled, setEnabled] = useState<boolean>(false);
  const [permissions, setPermissions] = useState<PermissionState>({
    locationGranted: false,
    backgroundLocationGranted: false,
    notificationGranted: false,
  });
  const [runtime, setRuntime] = useState<RuntimeState>(DEFAULT_RUNTIME);
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const { addEntry } = useData();

  // Load persisted state
  useEffect(() => {
    (async () => {
      try {
        const [rawS, rawE, rawR] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.settings),
          AsyncStorage.getItem(STORAGE_KEYS.enabled),
          AsyncStorage.getItem(STORAGE_KEYS.runtime),
        ]);
        if (rawS) setSettingsState(JSON.parse(rawS));
        if (rawE) setEnabled(JSON.parse(rawE));
        if (rawR) setRuntime(JSON.parse(rawR));
      } catch (e) {
        console.error('Failed to load stay monitor state', e);
      }
    })();
  }, []);

  // Sync runtime from storage periodically (so UI reflects background updates)
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (next) => {
      appState.current = next;
      if (next === 'active') {
        try {
          const rawR = await AsyncStorage.getItem(STORAGE_KEYS.runtime);
          if (rawR) setRuntime(JSON.parse(rawR));
        } catch {}
      }
    });
    const id = setInterval(async () => {
      try {
        const rawR = await AsyncStorage.getItem(STORAGE_KEYS.runtime);
        if (rawR) setRuntime(JSON.parse(rawR));
        // Flush pending auto-counts directly into entries
        const rawP = await AsyncStorage.getItem(STORAGE_KEYS.pendingCount);
        const pending = rawP ? parseInt(rawP, 10) : 0;
        if (pending > 0) {
          await AsyncStorage.setItem(STORAGE_KEYS.pendingCount, '0');
          try {
            await addEntry(pending, '[#geofence] dwell');
          } catch (e) {
            console.error('Failed to add geofence auto-count entries', e);
          }
        }
      } catch {}
    }, 5000);
    return () => {
      sub.remove();
      clearInterval(id);
    };
  }, []);

  const setSettings = useCallback(async (patch: Partial<StaySettings>) => {
    setSettingsState((prev) => {
      const next = { ...prev, ...patch };
      AsyncStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const requestAllPermissions = useCallback(async (): Promise<boolean> => {
    try {
      const { status: fg } = await Location.requestForegroundPermissionsAsync();
      const locationGranted = fg === Location.PermissionStatus.GRANTED;

      let backgroundLocationGranted = false;
      if (locationGranted) {
        const bg = await Location.requestBackgroundPermissionsAsync();
        backgroundLocationGranted = bg.status === Location.PermissionStatus.GRANTED;
      }

      const notif = await Notifications.requestPermissionsAsync();
      const notificationGranted = !!notif.granted;

      setPermissions({ locationGranted, backgroundLocationGranted, notificationGranted });

      if (!locationGranted || !notificationGranted) {
        return false;
      }
      return true;
    } catch (e) {
      console.error('Permission request failed', e);
      return false;
    }
  }, []);

  const startBackgroundUpdates = useCallback(async () => {
    const targetSet = settings.latitude != null && settings.longitude != null;
    if (!targetSet) return;
    const has = await Location.hasStartedLocationUpdatesAsync(LOCATION_STAY_TASK);
    if (has) return;

    await Location.startLocationUpdatesAsync(LOCATION_STAY_TASK, {
      accuracy: Location.Accuracy.Balanced,
      // Reduce battery: either time or distance interval triggers updates
      timeInterval: 30_000,
      distanceInterval: 30,
      pausesUpdatesAutomatically: true,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: '흡연 구역 체류 감지 중',
        notificationBody: '설정된 영역 체류 시간을 측정하고 있어요.',
      },
      activityType: Location.ActivityType.Other,
      deferredUpdatesInterval: 60_000,
      deferredUpdatesDistance: 50,
      mayShowUserSettingsDialog: true,
    });
  }, [settings.latitude, settings.longitude]);

  const stopBackgroundUpdates = useCallback(async () => {
    const has = await Location.hasStartedLocationUpdatesAsync(LOCATION_STAY_TASK);
    if (has) await Location.stopLocationUpdatesAsync(LOCATION_STAY_TASK);
  }, []);

  const toggleEnabled = useCallback(async (on: boolean) => {
    if (on) {
      const ok = await requestAllPermissions();
      if (!ok) {
        Alert.alert('권한 필요', '앱 설정에서 위치/알림 권한을 허용해야 기능을 사용할 수 있습니다.');
        setEnabled(false);
        await AsyncStorage.setItem(STORAGE_KEYS.enabled, JSON.stringify(false));
        return;
      }
      setEnabled(true);
      await AsyncStorage.setItem(STORAGE_KEYS.enabled, JSON.stringify(true));
      await startBackgroundUpdates();
    } else {
      setEnabled(false);
      await AsyncStorage.setItem(STORAGE_KEYS.enabled, JSON.stringify(false));
      await stopBackgroundUpdates();
    }
  }, [requestAllPermissions, startBackgroundUpdates, stopBackgroundUpdates]);

  const setFromCurrentLocation = useCallback(async () => {
    try {
      const perm = await Location.getForegroundPermissionsAsync();
      if (perm.status !== Location.PermissionStatus.GRANTED) {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== Location.PermissionStatus.GRANTED) return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      await setSettings({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
    } catch (e) {
      console.error('Failed to get current location', e);
    }
  }, [setSettings]);

  // Auto-start updates if enabled and permissions ok
  useEffect(() => {
    (async () => {
      if (!enabled) return;
      const ok = await requestAllPermissions();
      if (!ok) {
        setEnabled(false);
        await AsyncStorage.setItem(STORAGE_KEYS.enabled, JSON.stringify(false));
        return;
      }
      await startBackgroundUpdates();
    })();
  }, [enabled, startBackgroundUpdates, requestAllPermissions]);

  const value = useMemo<LocationStayContextValue>(() => ({
    settings,
    setSettings,
    enabled,
    toggleEnabled,
    permissions,
    runtime,
    setFromCurrentLocation,
    requestAllPermissions,
  }), [enabled, permissions, requestAllPermissions, runtime, setFromCurrentLocation, setSettings, settings, toggleEnabled]);

  return <LocationStayContext.Provider value={value}>{children}</LocationStayContext.Provider>;
}

export function useLocationStay() {
  const ctx = useContext(LocationStayContext);
  if (!ctx) throw new Error('useLocationStay must be used within LocationStayProvider');
  return ctx;
}
