// Screen shown when required environment variables are missing
// Prevents hard crash and provides clear feedback
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export function EnvErrorScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Configuration Error</Text>
        <Text style={styles.message}>
          Required environment variables are missing. The app cannot start without proper configuration.
        </Text>
        <View style={styles.requirementsContainer}>
          <Text style={styles.requirementsTitle}>Required variables:</Text>
          <Text style={styles.requirement}>• EXPO_PUBLIC_SUPABASE_URL</Text>
          <Text style={styles.requirement}>• EXPO_PUBLIC_SUPABASE_KEY</Text>
        </View>
        <Text style={styles.helpText}>
          Please ensure these environment variables are set in your build configuration.
        </Text>
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
    padding: 20,
  },
  content: {
    width: '100%',
    maxWidth: 600,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: '#ccc',
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 24,
  },
  requirementsContainer: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
  },
  requirementsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ff6b6b',
    marginBottom: 12,
  },
  requirement: {
    fontSize: 14,
    color: '#999',
    marginBottom: 8,
    fontFamily: 'monospace',
  },
  helpText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

