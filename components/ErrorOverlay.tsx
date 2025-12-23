import React, { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { globalErrorHandler } from '../utils/globalErrorHandler';

interface ErrorOverlayProps {
  visible: boolean;
  onDismiss: () => void;
  error: {
    timestamp: number;
    type: 'error' | 'promiseRejection';
    error: any;
    stack?: string;
  } | null;
}

export function ErrorOverlay({ visible, onDismiss, error }: ErrorOverlayProps) {
  if (!error) return null;

  const formatError = () => {
    if (error.error?.message) {
      return error.error.message;
    }
    if (typeof error.error === 'string') {
      return error.error;
    }
    return JSON.stringify(error.error, null, 2);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>⚠️ Error Detected</Text>
            <TouchableOpacity onPress={onDismiss} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.content}>
            <View style={styles.section}>
              <Text style={styles.label}>Type:</Text>
              <Text style={styles.value}>{error.type}</Text>
            </View>
            
            <View style={styles.section}>
              <Text style={styles.label}>Timestamp:</Text>
              <Text style={styles.value}>
                {new Date(error.timestamp).toLocaleString()}
              </Text>
            </View>
            
            <View style={styles.section}>
              <Text style={styles.label}>Error:</Text>
              <Text style={styles.errorText}>{formatError()}</Text>
            </View>
            
            {error.stack && (
              <View style={styles.section}>
                <Text style={styles.label}>Stack:</Text>
                <ScrollView style={styles.stackContainer}>
                  <Text style={styles.stackText}>{error.stack}</Text>
                </ScrollView>
              </View>
            )}
          </ScrollView>
          
          <TouchableOpacity onPress={onDismiss} style={styles.dismissButton}>
            <Text style={styles.dismissButtonText}>Dismiss</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export function ErrorOverlayManager() {
  const [error, setError] = useState<ErrorOverlayProps['error']>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Set up callback for error overlay
    globalErrorHandler.setOnScreenOverlay((errorLog) => {
      setError(errorLog);
      setVisible(true);
    });

    // Check for existing errors
    const lastError = globalErrorHandler.getLastError();
    if (lastError) {
      setError(lastError);
      setVisible(true);
    }
  }, []);

  const handleDismiss = () => {
    setVisible(false);
    // Keep error in state for reference, but hide overlay
  };

  return (
    <ErrorOverlay
      visible={visible}
      onDismiss={handleDismiss}
      error={error}
    />
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: '#ff4444',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ff4444',
  },
  closeButton: {
    padding: 4,
  },
  closeButtonText: {
    fontSize: 20,
    color: '#fff',
    fontWeight: 'bold',
  },
  content: {
    padding: 16,
  },
  section: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#888',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  value: {
    fontSize: 14,
    color: '#fff',
  },
  errorText: {
    fontSize: 14,
    color: '#ff6666',
    fontFamily: 'monospace',
  },
  stackContainer: {
    maxHeight: 200,
    backgroundColor: '#0a0a0a',
    borderRadius: 4,
    padding: 8,
  },
  stackText: {
    fontSize: 11,
    color: '#aaa',
    fontFamily: 'monospace',
  },
  dismissButton: {
    backgroundColor: '#333',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    margin: 16,
  },
  dismissButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});









