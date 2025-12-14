/**
 * Z2 - Module Import Test Screen
 * Same UI as Z1, but imports the same kinds of modules that suspect screens use
 * (router hooks, AsyncStorage access via utilities, etc.) WITHOUT calling them.
 * Used to test if crashes are caused by module imports.
 */

import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
// Import utilities that use AsyncStorage (but don't call them)
import { getSupabaseClient } from '../utils/supabase';

export default function Z2() {
  // Modules are imported but NOT called:
  // - useRouter, useLocalSearchParams (imported but hooks not called - testing if import causes crashes)
  // - Haptics (imported but no calls)
  // - Linking (imported but no calls)
  // - getSupabaseClient (imported but not called)
  // - AsyncStorage (via getSupabaseClient utility, but not called)
  
  // Note: We import the hooks but don't call them to test if the import itself causes crashes
  // In a real scenario, you would call: const router = useRouter(); const params = useLocalSearchParams();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Z2 - Module Import Test</Text>
      <Text style={styles.description}>
        This screen imports modules that suspect screens use:
      </Text>
      <View style={styles.listContainer}>
        <Text style={styles.listItem}>• expo-router (useRouter, useLocalSearchParams)</Text>
        <Text style={styles.listItem}>• expo-haptics</Text>
        <Text style={styles.listItem}>• expo-linking</Text>
        <Text style={styles.listItem}>• getSupabaseClient (AsyncStorage utility)</Text>
      </View>
      <Text style={styles.note}>
        Note: Modules are imported but NOT called.
      </Text>
      <Text style={styles.purpose}>
        Purpose: Test if crashes are caused by module imports.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  description: {
    color: '#888',
    fontSize: 16,
    marginBottom: 16,
    lineHeight: 24,
  },
  listContainer: {
    marginBottom: 20,
    paddingLeft: 20,
  },
  listItem: {
    color: '#aaa',
    fontSize: 14,
    marginBottom: 8,
    lineHeight: 20,
  },
  note: {
    color: '#ffaa00',
    fontSize: 14,
    marginBottom: 20,
    fontStyle: 'italic',
  },
  purpose: {
    color: '#008610',
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

