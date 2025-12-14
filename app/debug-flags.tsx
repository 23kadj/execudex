/**
 * Debug Flags Screen
 * Toggle native module call flags for crash isolation
 */

import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import {
    getAllDebugFlags,
    resetDebugFlags,
    setDebugFlag
} from '../utils/debugFlags';

export default function DebugFlags() {
  const router = useRouter();
  const [flags, setFlags] = useState(getAllDebugFlags());

  useEffect(() => {
    // Refresh flags periodically
    const interval = setInterval(() => {
      setFlags(getAllDebugFlags());
    }, 500);

    return () => clearInterval(interval);
  }, []);

  const handleToggle = async (key: keyof typeof flags, value: boolean) => {
    await setDebugFlag(key, value);
    setFlags(getAllDebugFlags());
  };

  const handleReset = async () => {
    await resetDebugFlags();
    setFlags(getAllDebugFlags());
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Debug Flags</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Info */}
      <View style={styles.infoBar}>
        <Text style={styles.infoText}>
          Toggle flags to disable native calls for crash isolation. Settings persist across app restarts.
        </Text>
      </View>

      {/* Flags */}
      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Native Module Flags</Text>

          <FlagRow
            label="Disable Haptics"
            description="Prevents all haptics calls (selectionAsync, impactAsync, etc.)"
            value={flags.disableHaptics}
            onValueChange={(value) => handleToggle('disableHaptics', value)}
          />

          <FlagRow
            label="Disable Linking"
            description="Prevents Linking.canOpenURL and Linking.openURL calls"
            value={flags.disableLinking}
            onValueChange={(value) => handleToggle('disableLinking', value)}
          />

          <FlagRow
            label="Disable Router"
            description="Prevents router.push, router.back, and navigation calls"
            value={flags.disableRouter}
            onValueChange={(value) => handleToggle('disableRouter', value)}
          />

          <FlagRow
            label="Disable Supabase"
            description="Prevents all Supabase database queries"
            value={flags.disableSupabase}
            onValueChange={(value) => handleToggle('disableSupabase', value)}
          />
        </View>

        {/* Reset Button */}
        <TouchableOpacity onPress={handleReset} style={styles.resetButton}>
          <Text style={styles.resetButtonText}>Reset All Flags</Text>
        </TouchableOpacity>

        {/* Navigation */}
        <View style={styles.navSection}>
          <TouchableOpacity
            onPress={() => router.push('/debug-logs')}
            style={styles.navButton}
          >
            <Text style={styles.navButtonText}>View Debug Logs →</Text>
          </TouchableOpacity>
        </View>

        {/* Screen Ladder Navigation */}
        <View style={styles.navSection}>
          <Text style={styles.sectionTitle}>Screen Ladder (Crash Isolation)</Text>
          <TouchableOpacity
            onPress={() => router.push('/z1')}
            style={styles.navButton}
          >
            <Text style={styles.navButtonText}>Z1 - Minimal Safe Screen →</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push('/z2')}
            style={styles.navButton}
          >
            <Text style={styles.navButtonText}>Z2 - Module Import Test →</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push('/z3')}
            style={styles.navButton}
          >
            <Text style={styles.navButtonText}>Z3 - Native Call Test →</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

function FlagRow({
  label,
  description,
  value,
  onValueChange,
}: {
  label: string;
  description: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.flagRow}>
      <View style={styles.flagContent}>
        <Text style={styles.flagLabel}>{label}</Text>
        <Text style={styles.flagDescription}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: '#333', true: '#008610' }}
        thumbColor={value ? '#fff' : '#888'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: '#000',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  infoBar: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#0a0a0a',
  },
  infoText: {
    color: '#888',
    fontSize: 12,
    lineHeight: 18,
  },
  content: {
    flex: 1,
  },
  contentInner: {
    padding: 20,
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  flagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0a0a0a',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  flagContent: {
    flex: 1,
    marginRight: 16,
  },
  flagLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  flagDescription: {
    color: '#888',
    fontSize: 12,
    lineHeight: 16,
  },
  resetButton: {
    backgroundColor: '#3a1a1a',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  resetButtonText: {
    color: '#ff6666',
    fontSize: 16,
    fontWeight: '600',
  },
  navSection: {
    marginTop: 30,
  },
  navButton: {
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  navButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

