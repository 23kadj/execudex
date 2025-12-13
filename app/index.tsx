// TEMPORARY SAFE INDEX - NO IMPORTS FROM SERVICES/AUTH
// This version removes all heavy imports to prevent crashes in preview/release builds
// Restore original code after fixing supabase.ts lazy loading

import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function Onboarding() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.text}>INDEX OK</Text>
      
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.button}
          onPress={() => router.push('/signin')}
        >
          <Text style={styles.buttonText}>Go to Sign In</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.button}
          onPress={() => router.push('/(tabs)')}
        >
          <Text style={styles.buttonText}>Go to Tabs</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 40,
  },
  buttonContainer: {
    gap: 20,
    width: '80%',
  },
  button: {
    backgroundColor: '#090909',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

// ============================================================================
// ORIGINAL CODE - TEMPORARILY COMMENTED OUT
// Restore after fixing supabase.ts lazy loading
// ============================================================================

// // app/index.tsx
// import * as Haptics from 'expo-haptics';
// import { useRouter } from 'expo-router';
// import { StatusBar } from 'expo-status-bar';
// import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
// import {
//   ActivityIndicator,
//   Alert,
//   Animated,
//   Easing,
//   Image,
//   Keyboard,
//   Linking,
//   Platform,
//   Pressable,
//   StyleSheet,
//   Text,
//   TextInput,
//   TouchableWithoutFeedback,
//   View
// } from 'react-native';
// import { SafeAreaView } from 'react-native-safe-area-context';
// import { useAuth } from '../components/AuthProvider';
// import { ProfileLoadingIndicator } from '../components/ProfileLoadingIndicator';
// import { iapService } from '../services/iapService';
// import { SUBSCRIPTION_PRODUCTS } from '../types/iapTypes';
// import { isIAPAvailable } from '../utils/iapAvailability';
// import { supabase } from '../utils/supabase';
// ... (rest of original code)
