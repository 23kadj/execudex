/**
 * Debug Logs Screen
 * Shows persistent logs with copy/clear functionality
 */

import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    Clipboard,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { persistentLogger } from '../utils/persistentLogger';

export default function DebugLogs() {
  const router = useRouter();
  const [logs, setLogs] = useState(persistentLogger.getLogs());
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    // Refresh logs periodically
    const interval = setInterval(() => {
      setLogs(persistentLogger.getLogs());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleCopy = async () => {
    try {
      const text = persistentLogger.exportAsText();
      Clipboard.setString(text);
      Alert.alert('Success', 'Logs copied to clipboard');
    } catch (error) {
      Alert.alert('Error', 'Failed to copy logs');
      console.error('Copy error:', error);
    }
  };

  const handleClear = () => {
    Alert.alert(
      'Clear Logs',
      'Are you sure you want to clear all logs?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await persistentLogger.clear();
            setLogs([]);
          },
        },
      ]
    );
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const getLevelColor = (level?: string) => {
    switch (level) {
      case 'error':
        return '#ff4444';
      case 'warn':
        return '#ffaa00';
      case 'checkpoint':
        return '#00aaff';
      default:
        return '#888';
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Debug Logs</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity onPress={handleCopy} style={styles.button}>
          <Text style={styles.buttonText}>Copy to Clipboard</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleClear} style={[styles.button, styles.clearButton]}>
          <Text style={[styles.buttonText, styles.clearButtonText]}>Clear Logs</Text>
        </TouchableOpacity>
      </View>

      {/* Logs Count */}
      <View style={styles.infoBar}>
        <Text style={styles.infoText}>
          {logs.length} entries (max 200)
        </Text>
      </View>

      {/* Logs List */}
      <ScrollView style={styles.logsContainer} contentContainerStyle={styles.logsContent}>
        {logs.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No logs yet</Text>
          </View>
        ) : (
          logs.map((log, index) => (
            <View key={index} style={styles.logEntry}>
              <View style={styles.logHeader}>
                <Text style={[styles.levelBadge, { color: getLevelColor(log.level) }]}>
                  {log.level?.toUpperCase() || 'INFO'}
                </Text>
                <Text style={styles.timestamp}>{formatTimestamp(log.timestamp)}</Text>
              </View>
              <Text style={styles.eventName}>{log.eventName}</Text>
              {log.data && (
                <View style={styles.dataContainer}>
                  <Text style={styles.dataText}>
                    {typeof log.data === 'string'
                      ? log.data
                      : JSON.stringify(log.data, null, 2)}
                  </Text>
                </View>
              )}
            </View>
          ))
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
  actions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 10,
    gap: 10,
  },
  button: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  clearButton: {
    backgroundColor: '#3a1a1a',
  },
  clearButtonText: {
    color: '#ff6666',
  },
  infoBar: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: '#0a0a0a',
  },
  infoText: {
    color: '#888',
    fontSize: 12,
  },
  logsContainer: {
    flex: 1,
  },
  logsContent: {
    padding: 20,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#666',
    fontSize: 16,
  },
  logEntry: {
    backgroundColor: '#0a0a0a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#333',
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  levelBadge: {
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  timestamp: {
    color: '#666',
    fontSize: 11,
  },
  eventName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  dataContainer: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#050505',
    borderRadius: 4,
  },
  dataText: {
    color: '#aaa',
    fontSize: 12,
    fontFamily: 'monospace',
  },
});
