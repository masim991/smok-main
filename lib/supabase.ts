import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { localTestMode } from './localTest';

const getExtra = (): any => {
  const ec = (Constants as any)?.expoConfig?.extra;
  const me = (Constants as any)?.manifestExtra;
  const legacy = (Constants as any)?.manifest?.extra;
  return ec || me || legacy || {};
};

const extra = getExtra();
const supabaseUrl: string = process.env.EXPO_PUBLIC_SUPABASE_URL || extra.supabaseUrl;
const supabaseAnonKey: string = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || extra.supabaseAnonKey;
export const isSupabaseConfigured = !!supabaseUrl && /^https:\/\//.test(supabaseUrl) && !!supabaseAnonKey;

if (!supabaseUrl || !supabaseAnonKey) {
  // Avoid throwing at import time; log to help diagnose missing config
  console.warn('[Supabase] Missing supabaseUrl or supabaseAnonKey in app.json extra');
}

export const supabase = createClient(isSupabaseConfigured ? supabaseUrl : 'https://unconfigured.invalid', supabaseAnonKey || 'unconfigured', {
  global: localTestMode ? { fetch: async () => { throw new Error('서버 요청은 로컬 테스트 모드에서 비활성화됩니다.'); } } : undefined,
  auth: {
    persistSession: !localTestMode,
    autoRefreshToken: !localTestMode,
    storage: AsyncStorage,
    detectSessionInUrl: false,
    storageKey: localTestMode ? '@SmokeTracker:local-test-auth' : '@SmokeTracker:supabase-auth',
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
