/**
 * Z3 - Native Call Test Screen
 * Same UI as Z1/Z2, with test actions for suspected native areas.
 * Each action is triggered only by pressing a button (no auto-running).
 * Used to test if crashes are caused by specific native calls.
 */

import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getSupabaseClient } from '../utils/supabase';

export default function Z3() {
  const router = useRouter();
  const [testResults, setTestResults] = useState<Record<string, string>>({});

  const updateResult = (testName: string, result: string) => {
    setTestResults(prev => ({ ...prev, [testName]: result }));
  };

  // Test 1: Router Action
  const testRouter = () => {
    try {
      updateResult('router', 'Testing...');
      // Just test router object exists, don't actually navigate
      if (router) {
        updateResult('router', '✓ Router object accessible');
      } else {
        updateResult('router', '✗ Router object not accessible');
      }
    } catch (error: any) {
      updateResult('router', `✗ Error: ${error?.message || 'Unknown'}`);
    }
  };

  // Test 2: Haptics
  const testHaptics = async () => {
    try {
      updateResult('haptics', 'Testing...');
      await Haptics.selectionAsync();
      updateResult('haptics', '✓ Haptics.selectionAsync() succeeded');
    } catch (error: any) {
      updateResult('haptics', `✗ Error: ${error?.message || 'Unknown'}`);
    }
  };

  // Test 3: Linking - canOpenURL
  const testLinkingCanOpen = async () => {
    try {
      updateResult('linking', 'Testing...');
      const testUrl = 'https://www.google.com';
      const supported = await Linking.canOpenURL(testUrl);
      updateResult('linking', supported ? '✓ Linking.canOpenURL() succeeded' : '✗ URL not supported');
    } catch (error: any) {
      updateResult('linking', `✗ Error: ${error?.message || 'Unknown'}`);
    }
  };

  // Test 4: AsyncStorage (via getSupabaseClient)
  const testAsyncStorage = async () => {
    try {
      updateResult('asyncStorage', 'Testing...');
      // Just test if we can get the client (which uses AsyncStorage)
      const client = getSupabaseClient();
      if (client) {
        updateResult('asyncStorage', '✓ getSupabaseClient() succeeded (AsyncStorage accessible)');
      } else {
        updateResult('asyncStorage', '✗ getSupabaseClient() returned null');
      }
    } catch (error: any) {
      updateResult('asyncStorage', `✗ Error: ${error?.message || 'Unknown'}`);
    }
  };

  // Test 5: Router Navigation (actual navigation)
  const testRouterNavigation = () => {
    try {
      updateResult('routerNav', 'Testing...');
      // Navigate to z1 and back
      router.push('/z1');
      setTimeout(() => {
        router.back();
        updateResult('routerNav', '✓ Router navigation succeeded');
      }, 100);
    } catch (error: any) {
      updateResult('routerNav', `✗ Error: ${error?.message || 'Unknown'}`);
    }
  };

  // Test 6: Linking - openURL
  const testLinkingOpen = async () => {
    try {
      updateResult('linkingOpen', 'Testing...');
      const testUrl = 'https://www.google.com';
      await Linking.openURL(testUrl);
      updateResult('linkingOpen', '✓ Linking.openURL() succeeded');
    } catch (error: any) {
      updateResult('linkingOpen', `✗ Error: ${error?.message || 'Unknown'}`);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Z3 - Native Call Test</Text>
      <Text style={styles.description}>
        Press buttons to test specific native calls. Each action is triggered only by button press.
      </Text>

      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.button} onPress={testRouter}>
          <Text style={styles.buttonText}>Test Router Object</Text>
        </TouchableOpacity>
        {testResults.router && (
          <Text style={styles.result}>{testResults.router}</Text>
        )}

        <TouchableOpacity style={styles.button} onPress={testHaptics}>
          <Text style={styles.buttonText}>Test Haptics</Text>
        </TouchableOpacity>
        {testResults.haptics && (
          <Text style={styles.result}>{testResults.haptics}</Text>
        )}

        <TouchableOpacity style={styles.button} onPress={testLinkingCanOpen}>
          <Text style={styles.buttonText}>Test Linking.canOpenURL</Text>
        </TouchableOpacity>
        {testResults.linking && (
          <Text style={styles.result}>{testResults.linking}</Text>
        )}

        <TouchableOpacity style={styles.button} onPress={testAsyncStorage}>
          <Text style={styles.buttonText}>Test AsyncStorage (via Supabase)</Text>
        </TouchableOpacity>
        {testResults.asyncStorage && (
          <Text style={styles.result}>{testResults.asyncStorage}</Text>
        )}

        <TouchableOpacity style={styles.button} onPress={testRouterNavigation}>
          <Text style={styles.buttonText}>Test Router Navigation</Text>
        </TouchableOpacity>
        {testResults.routerNav && (
          <Text style={styles.result}>{testResults.routerNav}</Text>
        )}

        <TouchableOpacity style={styles.button} onPress={testLinkingOpen}>
          <Text style={styles.buttonText}>Test Linking.openURL</Text>
        </TouchableOpacity>
        {testResults.linkingOpen && (
          <Text style={styles.result}>{testResults.linkingOpen}</Text>
        )}
      </View>

      <Text style={styles.purpose}>
        Purpose: Test if crashes are caused by specific native calls.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    padding: 20,
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
    marginBottom: 20,
    lineHeight: 24,
    textAlign: 'center',
  },
  buttonContainer: {
    flex: 1,
  },
  button: {
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  result: {
    color: '#008610',
    fontSize: 12,
    marginBottom: 16,
    paddingLeft: 8,
  },
  purpose: {
    color: '#008610',
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 20,
  },
});

