// Debug screen to view last stored crash log (works in release builds)
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { getLastCrashLog, clearCrashLog } from '../components/ErrorBoundary';

export default function DebugCrashLog() {
  const router = useRouter();
  const [crashLog, setCrashLog] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCrashLog();
  }, []);

  const loadCrashLog = async () => {
    try {
      const log = await getLastCrashLog();
      setCrashLog(log);
    } catch (error) {
      console.error('Failed to load crash log:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = async () => {
    try {
      await clearCrashLog();
      setCrashLog(null);
    } catch (error) {
      console.error('Failed to clear crash log:', error);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Crash Log Viewer</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content}>
        {crashLog ? (
          <>
            <View style={styles.actions}>
              <TouchableOpacity onPress={handleClear} style={styles.clearButton}>
                <Text style={styles.clearButtonText}>Clear Log</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={loadCrashLog} style={styles.refreshButton}>
                <Text style={styles.refreshButtonText}>Refresh</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.logContainer}>
              <Text style={styles.logText}>{crashLog}</Text>
            </View>
          </>
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No crash log found.</Text>
            <Text style={styles.emptySubtext}>
              Crash logs are automatically saved when the app encounters an uncaught error.
            </Text>
          </View>
        )}
      </ScrollView>
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
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  placeholder: {
    width: 60,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  clearButton: {
    backgroundColor: '#ff6b6b',
    borderRadius: 8,
    padding: 12,
    flex: 1,
    alignItems: 'center',
  },
  clearButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  refreshButton: {
    backgroundColor: '#333',
    borderRadius: 8,
    padding: 12,
    flex: 1,
    alignItems: 'center',
  },
  refreshButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  logContainer: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 16,
  },
  logText: {
    color: '#999',
    fontSize: 12,
    fontFamily: 'monospace',
    lineHeight: 18,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    color: '#fff',
    marginBottom: 12,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});

