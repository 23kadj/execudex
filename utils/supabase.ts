// Supabase client configured with persistent storage for React Native
// Sessions are persisted to AsyncStorage and automatically restored on app restart
// LAZY-LOADED: AsyncStorage and client creation happen only when getSupabaseClient() is called

import { createClient, processLock } from '@supabase/supabase-js'
import 'react-native-url-polyfill/auto'

// Validate required environment variables (safe - no native modules)
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_KEY

export const hasValidSupabaseConfig = !!(SUPABASE_URL && SUPABASE_KEY)

// Lazy-loaded client instance
let supabaseClient: ReturnType<typeof createClient> | null = null

/**
 * Get Supabase client instance (lazy-loaded)
 * AsyncStorage and client are only initialized when this function is called
 */
export function getSupabaseClient() {
  if (supabaseClient) {
    return supabaseClient
  }

  // Lazy-load AsyncStorage only when needed
  const AsyncStorage = require('@react-native-async-storage/async-storage').default

  // Create client with lazy-loaded AsyncStorage
  supabaseClient = hasValidSupabaseConfig
    ? createClient(SUPABASE_URL!, SUPABASE_KEY!, {
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

  return supabaseClient
}

/**
 * Legacy export for backward compatibility
 * @deprecated Use getSupabaseClient() instead
 */
export const supabase = new Proxy({} as ReturnType<typeof createClient>, {
  get(_target, prop) {
    return getSupabaseClient()[prop as keyof ReturnType<typeof createClient>]
  },
})
