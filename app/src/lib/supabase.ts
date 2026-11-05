import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error('EXPO_PUBLIC_SUPABASE_URL ja EXPO_PUBLIC_SUPABASE_ANON_KEY puuttuvat. Kopioi .env.example tiedostoksi .env.');
}

export const supabase = createClient(url, anonKey, {
  auth: {
    // The browser has localStorage; native apps persist the session in AsyncStorage.
    storage: Platform.OS === 'web' ? undefined : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Refresh tokens only while the app is in the foreground (recommended for React Native).
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

/** Pins the in-app clock for demos, e.g. EXPO_PUBLIC_DEMO_NOW=2027-02-15T10:40 */
export const DEMO_NOW = process.env.EXPO_PUBLIC_DEMO_NOW || undefined;
