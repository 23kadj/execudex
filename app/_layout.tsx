// ROUTER LAYOUT WITH AUTH PROVIDER
// AuthProvider is safe to import - it uses lazy-loaded getSupabaseClient() and logStartup()
// No native modules are imported at module scope

import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect } from 'react';
import { AuthProvider } from '../components/AuthProvider';

// Keep the native splash screen visible while we're loading
SplashScreen.preventAutoHideAsync();


export default function Layout() {
  // Hide splash screen when component mounts
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  // Stack layout wrapped in AuthProvider for auth context
  return (
    <AuthProvider>
      <Stack
        screenOptions={{
          animation: 'slide_from_right',
          headerShown: false,
        }}
      >
        <Stack.Screen name="index" /> {/* Onboarding screen */}
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
        <Stack.Screen name="test-ppl-data-simple" />
        <Stack.Screen name="test-ppl-data" />
        <Stack.Screen name="test-step2-data-models" />
        <Stack.Screen name="test-step3-housekeeping" />
      </Stack>
    </AuthProvider>
  );
}
