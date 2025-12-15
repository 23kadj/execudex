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
  // Limit string value length to prevent excessively large payloads
  // that can cause native bridge crashes when serializing large error stacks
  maxValueLength: 1000,
});

import * as Application from 'expo-application';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Stack, useLocalSearchParams, usePathname, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as Updates from 'expo-updates';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { AuthProvider, useAuth } from '../components/AuthProvider';
import { ErrorOverlayManager } from '../components/ErrorOverlay';
import { initDebugFlags } from '../utils/debugFlags';
import { initGlobalErrorHandler } from '../utils/globalErrorHandler';
import { persistentLogger } from '../utils/persistentLogger';
import { getSupabaseClient } from '../utils/supabase';

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

// Component to handle initial route based on auth state
// This runs inside AuthProvider, so it has access to auth context
function InitialRouteHandler({ children, onRouteChecked }: { children: React.ReactNode; onRouteChecked: () => void }) {
  const { session, loading: authLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const params = useLocalSearchParams();
  const [hasCheckedRoute, setHasCheckedRoute] = useState(false);
  const hasRedirectedRef = useRef(false);
  const onRouteCheckedRef = useRef(onRouteChecked);
  const hasCalledCallbackRef = useRef(false);

  // Update ref when callback changes
  useEffect(() => {
    onRouteCheckedRef.current = onRouteChecked;
  }, [onRouteChecked]);

  useEffect(() => {
    // Wait for auth to finish loading before checking route
    if (authLoading) {
      return;
    }

    // CHECK FOR LOGOUT FLAG FIRST - this check must run even if we've already checked the route
    // If we just came from the profile screen after logout, skip redirect logic
    if (params.logout === 'true') {
      console.log('[InitialRouteHandler] Explicit logout detected. Skipping auto-redirect.');
      // Reset redirect flags to allow onboarding to show
      hasRedirectedRef.current = false;
      setHasCheckedRoute(true);
      if (!hasCalledCallbackRef.current) {
        hasCalledCallbackRef.current = true;
        onRouteCheckedRef.current();
      }
      return; // Skip all redirect logic
    }

    // Only check once on initial load
    if (hasCheckedRoute || hasRedirectedRef.current) {
      return;
    }

    const checkInitialRoute = async () => {
      try {

        // Check if user is logged in
        const hasSession = !!session?.user?.id;

        if (hasSession) {
          // Check if user has completed onboarding (has a plan)
          try {
            const supabase = getSupabaseClient();
            const { data, error } = await supabase
              .from('users')
              .select('plan')
              .eq('uuid', session.user.id)
              .maybeSingle();

            if (error) {
              console.error('[InitialRouteHandler] Error checking user plan:', error);
              // On error, let the default route (onboarding) show
              setHasCheckedRoute(true);
              if (!hasCalledCallbackRef.current) {
                hasCalledCallbackRef.current = true;
                onRouteCheckedRef.current();
              }
              return;
            }

            // If user has a plan, redirect to home
            const userData = data as { plan?: string } | null;
            if (userData?.plan && userData.plan.trim() !== '') {
              console.log('[InitialRouteHandler] User has plan, redirecting to home');
              hasRedirectedRef.current = true;
              // Only redirect if we're on the index (onboarding) route or root
              if (!pathname || pathname === '/' || pathname === '/index') {
                router.replace('/(tabs)/home');
              }
            } else {
              console.log('[InitialRouteHandler] User authenticated but no plan - staying on onboarding');
            }
          } catch (error) {
            console.error('[InitialRouteHandler] Exception checking user plan:', error);
            // On exception, let the default route show
          }
        } else {
          console.log('[InitialRouteHandler] No session - staying on onboarding');
        }

        setHasCheckedRoute(true);
        if (!hasCalledCallbackRef.current) {
          hasCalledCallbackRef.current = true;
          onRouteCheckedRef.current();
        }
      } catch (error) {
        console.error('[InitialRouteHandler] Error in checkInitialRoute:', error);
        setHasCheckedRoute(true);
        if (!hasCalledCallbackRef.current) {
          hasCalledCallbackRef.current = true;
          onRouteCheckedRef.current();
        }
      }
    };

    checkInitialRoute();
  }, [authLoading, session, router, pathname, hasCheckedRoute, params.logout]);

  // Don't render children until we've checked the route (prevents flash)
  // But only wait if we're on the index route and haven't redirected yet
  const shouldWait = !hasCheckedRoute && (!pathname || pathname === '/' || pathname === '/index') && !hasRedirectedRef.current;

  if (shouldWait) {
    return null; // Keep splash screen visible
  }

  return <>{children}</>;
}

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
        // Note: We'll hide splash screen in InitialRouteHandler after route check
      } catch (e) {
        console.warn('Error preparing app:', e);
        setAppIsReady(true);
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
        <InitialRouteHandler onRouteChecked={() => {
          // Start fade-in animation first so it overlaps with splash screen
          // This prevents the black gap between splash and app content
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }).start();
          
          // Hide splash screen after fade-in has partially started
          // This ensures app content is visible when splash disappears, eliminating black gap
          setTimeout(() => {
            SplashScreen.hideAsync().catch((e) => {
              console.warn('Error hiding splash screen:', e);
            });
          }, 150); // Hide splash when app is ~50% visible for smooth transition
        }}>
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
              // Onboarding should slide in from the left and block back-swipe
              animation: 'slide_from_left',
              gestureEnabled: false,
            }}
          /> {/* Onboarding screen */}
          <Stack.Screen 
            name="signin" 
            options={({ route }) => {
              const params = route.params as { fromSignOut?: string } | undefined;
              // Slide from left when coming from sign out, otherwise default (right)
              return {
                animation: params?.fromSignOut === 'true' ? 'slide_from_left' : 'slide_from_right',
              };
            }}
          />
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
        </InitialRouteHandler>
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