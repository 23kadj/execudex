// ROUTER LAYOUT WITH AUTH PROVIDER
// AuthProvider is safe to import - it uses lazy-loaded getSupabaseClient() and logStartup()
// No native modules are imported at module scope

// Initialize Sentry as early as possible (before any other imports that might cause issues)
import * as Sentry from '@sentry/react-native';

// Initialize Sentry with DSN from environment variable (or use provided DSN)
const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN || "https://629881682d93034eef29bdc0f0bd4e83@o4510534342410240.ingest.us.sentry.io/4510534343458816";
Sentry.init({
  dsn: SENTRY_DSN,
  sendDefaultPii: true,
  tracesSampleRate: 1.0,
  profilesSampleRate: 1.0,
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  integrations: [Sentry.mobileReplayIntegration()],
});

import * as Application from 'expo-application';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as Updates from 'expo-updates';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { AuthProvider } from '../components/AuthProvider';
import { ErrorOverlayManager } from '../components/ErrorOverlay';
import { initDebugFlags } from '../utils/debugFlags';
import { initGlobalErrorHandler } from '../utils/globalErrorHandler';
import { persistentLogger } from '../utils/persistentLogger';

// Set Expo-specific tags and extras for Sentry (no longer added by default)
if (SENTRY_DSN) {
  try {
    Sentry.setExtras({
      manifest: Updates.manifest,
      deviceYearClass: Device.deviceYearClass,
      linkingUri: Constants.linkingUri,
    });

    Sentry.setTag('expoChannel', Updates.channel || '');
    Sentry.setTag('appVersion', Application.nativeApplicationVersion || '');
    Sentry.setTag('deviceId', Constants.sessionId || '');
    Sentry.setTag('executionEnvironment', Constants.executionEnvironment || '');
    Sentry.setTag('expoGoVersion', Constants.expoVersion || '');
    Sentry.setTag('expoRuntimeVersion', Constants.expoRuntimeVersion || '');
  } catch (error) {
    // Silently fail if Expo modules aren't available (e.g., in web builds)
    console.warn('[Sentry] Failed to set Expo tags/extras:', error);
  }
}

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

export default Sentry.wrap(function Layout() {
  const [appIsReady, setAppIsReady] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Wait a brief moment to ensure the app is fully mounted and ready
    // This prevents the white flash between native splash and app content
    const prepare = async () => {
      try {
        // Small delay to ensure smooth transition
        await new Promise(resolve => setTimeout(resolve, 100));
        setAppIsReady(true);
        // Hide splash screen after app is ready
        await SplashScreen.hideAsync();
        
        // Start fade-in animation after splash screen is hidden
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300, // Quick fade-in for smooth transition
          useNativeDriver: true,
        }).start();
      } catch (e) {
        console.warn('Error preparing app:', e);
        setAppIsReady(true);
        await SplashScreen.hideAsync();
        // Start fade-in even on error
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      }
    };

    prepare();
  }, []);

  if (!appIsReady) {
    return null; // Keep native splash visible
  }

  // Stack layout wrapped in AuthProvider for auth context with fade-in animation
  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <AuthProvider>
        <ErrorOverlayManager />
        <Stack
          screenOptions={{
            animation: 'slide_from_right',
            headerShown: false,
            contentStyle: { backgroundColor: '#000000' },
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
        <Stack.Screen name="z1" />
        <Stack.Screen name="z2" />
        <Stack.Screen name="z3" />
      </Stack>
      </AuthProvider>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
});