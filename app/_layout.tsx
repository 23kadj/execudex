import { Stack } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Image, StyleSheet } from 'react-native';
import { AuthProvider, useAuth } from '../components/AuthProvider';
import { ThemeProvider } from '../components/ThemeProvider';

function AppContent() {
  const { session, loading } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(2000),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIsLoading(false);
    });
  }, []);

  // Show splash screen while loading
  if (isLoading) {
    return (
      <Animated.View style={[styles.splashContainer, { opacity: fadeAnim }]}>
        <Image
          source={require('../assets/wordlogo1.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>
    );
  }

  // Show loading indicator while checking auth state
  if (loading) {
    return (
      <Animated.View style={[styles.splashContainer, { opacity: fadeAnim }]}>
        <Image
          source={require('../assets/wordlogo1.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>
    );
  }

  // If not authenticated, show sign-in screen
  if (!session) {
    return (
      <Stack
        screenOptions={{
          animation: 'slide_from_right',
          headerShown: false,
        }}
      >
        <Stack.Screen name="signin" />
        <Stack.Screen name="auth/callback" />
      </Stack>
    );
  }

  // If authenticated, show main app with selective gesture restrictions
  return (
    <Stack
      screenOptions={{
        animation: 'slide_from_right',
        headerShown: false,
      }}
    >
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
      <Stack.Screen name="test-ppl-data-simple" />
      <Stack.Screen name="test-ppl-data" />
      <Stack.Screen name="test-step2-data-models" />
      <Stack.Screen name="test-step3-housekeeping" />
    </Stack>
  );
}

export default function Layout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 220,
    height: 100,
  },
});
