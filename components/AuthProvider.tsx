import AsyncStorage from '@react-native-async-storage/async-storage';
import { Session, User } from '@supabase/supabase-js';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { logStartup } from '../utils/startupLogger';
import { getSupabaseClient } from '../utils/supabase';

type AuthContextType = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<User | null>;
  signUpWithEmail: (email: string, password: string) => Promise<User | null>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Defer Supabase initialization to avoid native module crashes during mount
    // Wait a tick to ensure React has finished mounting
    let subscription: { unsubscribe: () => void } | null = null;
    const initTimeout = setTimeout(() => {
      try {
        console.log('[AuthProvider] Starting session restore...');
        logStartup('AuthProvider: Starting session restore');
        let isRestoreComplete = false;
        let initialSessionReceived = false;

        // Safely get Supabase client with error handling
        let supabaseClient;
        try {
          supabaseClient = getSupabaseClient();
        } catch (error) {
          console.error('[AuthProvider] Failed to initialize Supabase client:', error);
          logStartup(`AuthProvider: Supabase init error: ${error}`);
          setLoading(false);
          return;
        }

        // Listen for auth changes (including token refresh and INITIAL_SESSION)
        try {
          const {
            data: { subscription: sub },
          } = supabaseClient.auth.onAuthStateChange((event, session) => {
            console.log(`[AuthProvider] Auth state change: ${event}`, {
              hasSession: !!session,
              userId: session?.user?.id,
            });

            // Handle INITIAL_SESSION event - this fires when Supabase restores session from storage
            if (event === 'INITIAL_SESSION') {
              console.log('[AuthProvider] INITIAL_SESSION received, session restored from storage');
              logStartup(`AuthProvider: INITIAL_SESSION received (hasSession: ${!!session})`);
              initialSessionReceived = true;
              setSession(session);
              setUser(session?.user ?? null);
              // Don't set loading to false yet - wait for getSession() to complete
              return;
            }

            // Handle different auth events
            if (event === 'TOKEN_REFRESHED') {
              // Token was refreshed successfully - session is still valid
              console.log('[AuthProvider] Token refreshed successfully');
              setSession(session);
              setUser(session?.user ?? null);
            } else if (event === 'SIGNED_OUT') {
              // User was signed out - clear session
              console.log('[AuthProvider] User signed out');
              setSession(null);
              setUser(null);
              if (!isRestoreComplete) {
                isRestoreComplete = true;
                setLoading(false);
              }
            } else if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
              // User signed in or profile updated
              setSession(session);
              setUser(session?.user ?? null);
            }

            // Only set loading to false if restore is already complete
            // (to avoid race conditions during initial restore)
            if (isRestoreComplete) {
              setLoading(false);
            }
          });
          subscription = sub;
        } catch (error) {
          console.error('[AuthProvider] Failed to set up auth state listener:', error);
          logStartup(`AuthProvider: Auth listener error: ${error}`);
          setLoading(false);
          return;
        }

        // Get initial session - this will restore the persisted session from AsyncStorage
        // This may return the same session that INITIAL_SESSION already provided
        logStartup('AuthProvider: Calling getSession()');
        try {
          supabaseClient.auth.getSession().then(({ data: { session }, error }) => {
            console.log('[AuthProvider] getSession() completed', {
              hasSession: !!session,
              hasError: !!error,
              userId: session?.user?.id,
              errorMessage: error?.message,
            });

            if (error) {
              // Only clear session on actual auth errors, not network errors
              // Network errors during restore should not clear a valid persisted session
              if (error.message?.includes('network') || error.message?.includes('fetch')) {
                console.warn('[AuthProvider] Network error during getSession(), keeping existing session if available');
                logStartup(`AuthProvider: getSession() network error (keeping session if available)`);
                // If we already have a session from INITIAL_SESSION, keep it
                if (!initialSessionReceived) {
                  // No session was restored, and we can't fetch - clear state
                  setSession(null);
                  setUser(null);
                }
              } else if (error.message?.includes('Invalid Refresh Token') || error.message?.includes('Refresh Token Not Found')) {
                // Invalid/expired refresh token - this is expected after token expiry or revocation
                // Silently clear the session and clean up AsyncStorage
                console.log('[AuthProvider] Invalid refresh token detected, clearing session storage');
                logStartup(`AuthProvider: Invalid refresh token, clearing storage`);
                setSession(null);
                setUser(null);
                // Clear AsyncStorage to prevent this error on every restart
                AsyncStorage.removeItem('supabase.auth.token').catch((e) => 
                  console.warn('[AuthProvider] Failed to clear invalid token from storage:', e)
                );
              } else {
                console.error('[AuthProvider] Auth error getting session:', error);
                logStartup(`AuthProvider: getSession() auth error: ${error.message}`);
                // Actual auth error - clear session
                setSession(null);
                setUser(null);
              }
            } else {
              // Session retrieved successfully
              logStartup(`AuthProvider: getSession() success (hasSession: ${!!session})`);
              setSession(session);
              setUser(session?.user ?? null);
            }

            // Mark restore as complete and set loading to false
            isRestoreComplete = true;
            setLoading(false);
            logStartup(`AuthProvider: Session restore complete (hasSession: ${!!session}, loading: false)`);
            console.log('[AuthProvider] Session restore complete', {
              hasSession: !!session,
              userId: session?.user?.id,
            });
          }).catch((error) => {
            // Check if this is an invalid refresh token error (expected during token expiry)
            const isInvalidTokenError = error?.message?.includes('Invalid Refresh Token') || 
                                        error?.message?.includes('Refresh Token Not Found');
            
            if (isInvalidTokenError) {
              console.log('[AuthProvider] Invalid refresh token detected (exception), clearing session storage');
              logStartup(`AuthProvider: Invalid refresh token (exception), clearing storage`);
              // Clear AsyncStorage to prevent this error on every restart
              AsyncStorage.removeItem('supabase.auth.token').catch((e) => 
                console.warn('[AuthProvider] Failed to clear invalid token from storage:', e)
              );
            } else {
              console.error('[AuthProvider] Exception getting session:', error);
              logStartup(`AuthProvider: getSession() exception: ${error}`);
            }
            
            // On exception, only clear if we haven't received INITIAL_SESSION
            if (!initialSessionReceived) {
              setSession(null);
              setUser(null);
            }
            isRestoreComplete = true;
            setLoading(false);
            logStartup('AuthProvider: Session restore complete (exception path, loading: false)');
          });
        } catch (error) {
          console.error('[AuthProvider] Failed to call getSession():', error);
          logStartup(`AuthProvider: getSession() call error: ${error}`);
          setLoading(false);
        }
      } catch (error) {
        console.error('[AuthProvider] Unexpected error during initialization:', error);
        logStartup(`AuthProvider: Unexpected init error: ${error}`);
        setLoading(false);
      }
    }, 100); // Defer by 100ms to let React finish mounting

    return () => {
      clearTimeout(initTimeout);
      if (subscription) {
        try {
          subscription.unsubscribe();
        } catch (error) {
          console.error('[AuthProvider] Error unsubscribing:', error);
        }
      }
    };
  }, []);

  const signInWithGoogle = async () => {
    try {
      const { error } = await getSupabaseClient().auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: 'execudex://auth/callback',
        },
      });
      if (error) throw error;
    } catch (error) {
      console.error('Error signing in with Google:', error);
      throw error;
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    try {
      const { data, error } = await getSupabaseClient().auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      return data.user;
    } catch (error) {
      console.error('Error signing in with email:', error);
      throw error;
    }
  };

  const signUpWithEmail = async (email: string, password: string) => {
    try {
      const { data, error } = await getSupabaseClient().auth.signUp({
        email,
        password,
      });
      if (error) throw error;
      return data.user;
    } catch (error) {
      console.error('Error signing up with email:', error);
      throw error;
    }
  };

  const resetPassword = async (email: string) => {
    try {
      const { error } = await getSupabaseClient().auth.resetPasswordForEmail(email, {
        redirectTo: 'execudex://auth/reset-password',
      });
      if (error) throw error;
    } catch (error) {
      console.error('Error resetting password:', error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      const { error } = await getSupabaseClient().auth.signOut();
      if (error) throw error;
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  };

  const value = {
    session,
    user,
    loading,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    resetPassword,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
