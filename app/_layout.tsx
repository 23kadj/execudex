// TEMPORARY MINIMAL BOOT SCREEN - ISOLATING NATIVE CRASHES
// This version removes all heavy imports to test if native modules are causing splash screen hang
// Restore original code after testing

import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';

// Keep the native splash screen visible while we're loading
SplashScreen.preventAutoHideAsync();

// ============================================================================
// TEMPORARILY COMMENTED OUT - HEAVY IMPORTS THAT EXECUTE AT MODULE SCOPE
// ============================================================================

// import { Stack, useRouter, useSegments } from 'expo-router';
// import { useEffect, useRef, useState } from 'react';
// import { Animated, StyleSheet } from 'react-native';
// import * as SplashScreen from 'expo-splash-screen';
// import { AuthProvider, useAuth } from '../components/AuthProvider';
// import { ThemeProvider } from '../components/ThemeProvider';
// import { ErrorBoundary } from '../components/ErrorBoundary';
// import { EnvErrorScreen } from '../components/EnvErrorScreen';
// import { hasValidSupabaseConfig } from '../utils/supabase'; // ⚠️ CRITICAL: This imports AsyncStorage at top level
// import { logStartup } from '../utils/startupLogger'; // ⚠️ This imports AsyncStorage at top level

// Keep the native splash screen visible while we're loading
// SplashScreen.preventAutoHideAsync();

// function AppContent() {
//   const { session, loading } = useAuth();
//   const router = useRouter();
//   const segments = useSegments();
//   const hasNavigatedRef = useRef(false);
//   const fadeAnim = useRef(new Animated.Value(0)).current;
//   const [shouldFadeIn, setShouldFadeIn] = useState(false);
//   const splashHiddenRef = useRef(false);
//   const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

//   // Log app mounted
//   useEffect(() => {
//     logStartup('AppContent mounted');
//   }, []);

//   // Failsafe timeout: hide splash screen after 5 seconds if not already hidden
//   useEffect(() => {
//     logStartup('Failsafe timeout started (5 seconds)');
    
//     timeoutRef.current = setTimeout(async () => {
//       if (!splashHiddenRef.current) {
//         try {
//           logStartup('Failsafe timeout triggered - forcing splash hide');
//           await SplashScreen.hideAsync();
//           splashHiddenRef.current = true;
//           logStartup('Failsafe splash hide successful');
//         } catch (error) {
//           logStartup(`Failsafe splash hide failed: ${error}`);
//           console.error('[AppContent] Failsafe splash hide error:', error);
//         }
//       }
//     }, 5000);

//     return () => {
//       if (timeoutRef.current) {
//         clearTimeout(timeoutRef.current);
//       }
//     };
//   }, []);

//   // Reset navigation flag and navigate to onboarding when session is cleared
//   useEffect(() => {
//     if (!session && !loading) {
//       hasNavigatedRef.current = false;
//       console.log('[AppContent] Session cleared, navigating to onboarding');
//       // Navigate to onboarding screen when user signs out
//       router.replace('/');
//     }
//   }, [session, loading, router]);

//   // Hide native splash screen, navigate, and trigger fade-in when ready
//   useEffect(() => {
//     // Wait for auth loading to complete
//     if (!loading) {
//       logStartup('Auth loading complete');
      
//       // Hide splash screen in a finally-like pattern to ensure it always runs
//       const hideSplash = async () => {
//         try {
//           logStartup('About to call SplashScreen.hideAsync()');
//           await SplashScreen.hideAsync();
//           splashHiddenRef.current = true;
//           logStartup('SplashScreen.hideAsync() successful');
//         } catch (error) {
//           logStartup(`SplashScreen.hideAsync() failed: ${error}`);
//           console.error('[AppContent] Error hiding splash screen:', error);
//           // Still mark as hidden to prevent retries
//           splashHiddenRef.current = true;
//         }
//       };

//       // Execute splash hide
//       hideSplash();
      
//       // Navigate to home if session exists
//       if (session && !hasNavigatedRef.current) {
//         logStartup('Session restored, navigating to /(tabs)/home');
//         console.log('[AppContent] Session restored, immediately navigating to /(tabs)/home');
//         console.log('[AppContent] Current segments:', segments);
        
//         // Always navigate to home when session is restored
//         // Use replace to ensure it's the root of the navigation stack
//         router.replace('/(tabs)/home');
//         hasNavigatedRef.current = true;
//       } else if (!session) {
//         logStartup('No session found, staying on onboarding');
//       }

//       // Trigger fade-in animation
//       setShouldFadeIn(true);
//       Animated.timing(fadeAnim, {
//         toValue: 1,
//         duration: 250, // Quick fade-in (250ms)
//         useNativeDriver: true,
//       }).start();
//     } else {
//       logStartup('Auth still loading...');
//     }
//   }, [session, loading, router, segments, fadeAnim]);

//   // Show nothing while loading - native splash screen handles this
//   if (loading) {
//     return null;
//   }

//   // If not authenticated, show onboarding screen (index route)
//   const unauthenticatedStack = (
//     <Stack
//       screenOptions={{
//         animation: 'slide_from_right',
//         headerShown: false,
//       }}
//     >
//       <Stack.Screen name="index" /> {/* Onboarding screen */}
//       <Stack.Screen name="signin" />
//       <Stack.Screen name="auth/callback" />
//     </Stack>
//   );

//   // If authenticated, show main app with selective gesture restrictions
//   const mainAppStack = (
//     <Stack
//       screenOptions={{
//         animation: 'slide_from_right',
//         headerShown: false,
//       }}
//     >
//       <Stack.Screen name="(tabs)" options={{ gestureEnabled: false }} />
//       <Stack.Screen name="index1" />
//       <Stack.Screen name="index2" />
//       <Stack.Screen name="index3" />
//       <Stack.Screen name="results" />
//       <Stack.Screen name="bookmarks" />
//       <Stack.Screen name="feedback" />
//       <Stack.Screen name="legislation" />
//       <Stack.Screen name="profile" />
//       <Stack.Screen name="debug-supabase" />
//       <Stack.Screen name="debug-crash-log" />
//       <Stack.Screen name="debug-startup-log" />
//       <Stack.Screen name="test-ppl-data-simple" />
//       <Stack.Screen name="test-ppl-data" />
//       <Stack.Screen name="test-step2-data-models" />
//       <Stack.Screen name="test-step3-housekeeping" />
//     </Stack>
//   );

//   // Wrap content in fade-in animation
//   return (
//     <Animated.View style={[styles.fadeContainer, { opacity: fadeAnim }]}>
//       {!session ? unauthenticatedStack : mainAppStack}
//     </Animated.View>
//   );
// }

export default function Layout() {
  // Hide splash screen when component mounts
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  // MINIMAL BOOT SCREEN - Tests if React can render without native module crashes
  return (
    <View style={styles.container}>
      <Text style={styles.bootText}>BOOT</Text>
    </View>
  );

  // ============================================================================
  // ORIGINAL CODE - TEMPORARILY COMMENTED OUT
  // ============================================================================

  // // Log layout mount and config check
  // useEffect(() => {
  //   logStartup('Layout component mounted');
  //   if (!hasValidSupabaseConfig) {
  //     logStartup('Supabase config check failed - showing error screen');
  //   } else {
  //     logStartup('Supabase config check passed');
  //   }
  // }, []);

  // // Check environment variables early - show error screen if missing
  // if (!hasValidSupabaseConfig) {
  //   return (
  //     <ErrorBoundary>
  //       <EnvErrorScreen />
  //     </ErrorBoundary>
  //   );
  // }

  // return (
  //   <ErrorBoundary>
  //     <ThemeProvider>
  //       <AuthProvider>
  //         <AppContent />
  //       </AuthProvider>
  //     </ThemeProvider>
  //   </ErrorBoundary>
  // );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bootText: {
    color: '#fff',
    fontSize: 48,
    fontWeight: 'bold',
  },
  // fadeContainer: {
  //   flex: 1,
  //   backgroundColor: '#000', // Start from black
  // },
});
