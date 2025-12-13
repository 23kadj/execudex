// Supabase client configured with persistent storage for React Native
// Sessions are persisted to AsyncStorage and automatically restored on app restart
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient, processLock } from '@supabase/supabase-js'
import 'react-native-url-polyfill/auto'

// Validate required environment variables
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_KEY

export const hasValidSupabaseConfig = !!(SUPABASE_URL && SUPABASE_KEY)

// Create a safe Supabase client (will use placeholder values if env vars are missing)
// This prevents crashes during initialization, but the app should check hasValidSupabaseConfig
// before using the client
export const supabase = hasValidSupabaseConfig
  ? createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        storage: AsyncStorage, // Persists session to AsyncStorage
        autoRefreshToken: true, // Automatically refreshes expired tokens
        persistSession: true, // Enables session persistence across app restarts
        detectSessionInUrl: false, // Not needed for React Native
        lock: processLock, // Prevents concurrent auth operations
      },
    })
  : createClient('https://placeholder.supabase.co', 'placeholder-key', {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
        lock: processLock,
      },
    })
        