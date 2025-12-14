// ROUTER LAYOUT WITH AUTH PROVIDER
// AuthProvider is safe to import - it uses lazy-loaded getSupabaseClient() and logStartup()
// No native modules are imported at module scope

import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect } from 'react';
import { AuthProvider } from '../components/AuthProvider';
import { ErrorOverlayManager } from '../components/ErrorOverlay';
import { initDebugFlags } from '../utils/debugFlags';
import { initGlobalErrorHandler } from '../utils/globalErrorHandler';
import { persistentLogger } from '../utils/persistentLogger';

// Keep the native splash screen visible while we're loading
SplashScreen.preventAutoHideAsync();

// Initialize global error handler as early as possible
initGlobalErrorHandler();

// Initialize debug flags and persistent logger on app startup
(async () => {
  await initDebugFlags();
  await persistentLogger.init();
  persistentLogger.log('app', { action: 'startup', timestamp: Date.now() });
})();

export default function Layout() {
  // Hide splash screen when component mounts
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  // Stack layout wrapped in AuthProvider for auth context
  return (
    <AuthProvider>
      <ErrorOverlayManager />
      <Stack
        screenOptions={{
          animation: 'slide_from_right',
          headerShown: false,
        }}
      >
        <Stack.Screen 
          name="index" 
          options={{
            animation: 'slide_from_left', // Backward animation for onboarding
          }}
        /> {/* Onboarding screen */}
        <Stack.Screen name="signin" />
        <Stack.Screen name="auth/callback" />
        <Stack.Screen name="(tabs)" options={{ gestureEnabled: false }} />
        <Stack.Screen name="index1" />
        <Stack.Screen name="index2" />
        <Stack.Screen name="index3" />
        <Stack.Screen name="results" />
        <Stack.Screen name="bookmarks" />
        <Stack.Screen name="feedback" />
        <Stack.Screen name="legislation" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="debug-supabase" />
        <Stack.Screen name="debug-crash-log" />
        <Stack.Screen name="debug-startup-log" />
        <Stack.Screen name="debug-logs" />
        <Stack.Screen name="debug-flags" />
        <Stack.Screen name="test-ppl-data-simple" />
        <Stack.Screen name="test-ppl-data" />
        <Stack.Screen name="test-step2-data-models" />
        <Stack.Screen name="test-step3-housekeeping" />
      </Stack>
    </AuthProvider>
  );
}
