// TEMPORARY SAFE INDEX - NO IMPORTS FROM SERVICES/AUTH
// This version removes all heavy imports to prevent crashes in preview/release builds
// Restore original code after fixing supabase.ts lazy loading

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function Onboarding() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>INDEX OK</Text>
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
