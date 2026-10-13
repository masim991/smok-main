import 'react-native-url-polyfill/auto';
import 'intl-pluralrules';
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { DataProvider } from '@/components/contexts/DataContext';
import '@/i18n';
import * as Notifications from 'expo-notifications';
import { AppState, Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import { localTestMode } from '@/lib/localTest';
import { AppAlerts } from '@/components/ui/AppAlerts';
import { LocationStayProvider } from '@/contexts/LocationStayContext';

export default function RootLayout() {
  useFrameworkReady();
  useEffect(() => {
    if (Platform.OS === 'web' || localTestMode) return;
    const refresh = (state: string) => state === 'active' ? supabase.auth.startAutoRefresh() : supabase.auth.stopAutoRefresh();
    refresh(AppState.currentState);
    const subscription = AppState.addEventListener('change', refresh);
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
    return () => { subscription.remove(); supabase.auth.stopAutoRefresh(); };
  }, []);

  return (
    <ThemeProvider>
      <AuthProvider>
        <SettingsProvider>
          <DataProvider>
            <LocationStayProvider>
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="index" />
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="+not-found" />
              </Stack>
              <StatusBar style="auto" />
              <AppAlerts />
            </LocationStayProvider>
          </DataProvider>
        </SettingsProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
