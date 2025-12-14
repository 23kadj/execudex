/**
 * Z1 - Minimal Safe Screen
 * Renders only a safe <View><Text> screen with no special imports.
 * Used to test if crashes are caused by navigation/router itself.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function Z1() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Z1 - Minimal Safe Screen</Text>
      <Text style={styles.description}>
        This screen uses only basic React Native components (View, Text).
        No router hooks, no native modules, no special imports.
      </Text>
      <Text style={styles.purpose}>
        Purpose: Test if crashes are caused by navigation/router itself.
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
    alignItems: 'center',
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  description: {
    color: '#888',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 24,
  },
  purpose: {
    color: '#008610',
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

