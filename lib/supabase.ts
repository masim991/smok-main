import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

const getExtra = (): any => {
  const ec = (Constants as any)?.expoConfig?.extra;
  const me = (Constants as any)?.manifestExtra;
  const legacy = (Constants as any)?.manifest?.extra;
  return ec || me || legacy || {};
};

const extra = getExtra();
const supabaseUrl: string = extra.supabaseUrl || (process.env as any)?.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey: string = extra.supabaseAnonKey || (process.env as any)?.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Avoid throwing at import time; log to help diagnose missing config
  console.warn('[Supabase] Missing supabaseUrl or supabaseAnonKey in app.json extra');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storage: AsyncStorage as any,
    storageKey: '@SmokeTracker:supabase-auth',
  },
});

export type SmokingZone = {
  id: string;
  title: string;
  description?: string | null;
  latitude: number;
  longitude: number;
  created_at: string;
  created_by?: string | null;
};
