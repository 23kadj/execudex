import React from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface ProfileLoadingIndicatorProps {
  visible: boolean;
  progress?: number;
  /**
   * Optional custom title; defaults to "Processing Profile"
   */
  title?: string;
  /**
   * Optional custom subtitle; defaults to the profile update message
   */
  subtitle?: string;
  error?: string | null;
  onCancel?: () => void;
}

export function ProfileLoadingIndicator({ 
  visible, 
  progress,
  title,
  subtitle,
  error,
  onCancel
}: ProfileLoadingIndicatorProps) {

  if (!visible) return null;

  return (
    <Modal
      transparent={true}
      animationType="fade"
      visible={visible}
      statusBarTranslucent={true}
    >
      <View style={styles.overlay}>
        <View style={[styles.container, {
          borderRadius: 24,
          padding: 18,
          backgroundColor: '#050505',
          borderWidth: 1.5,
          borderColor: '#333',
        }]}>
          {/* Cancel button */}
          {onCancel && (
            <TouchableOpacity 
              style={styles.cancelButton}
              onPress={onCancel}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.cancelIcon}>✕</Text>
            </TouchableOpacity>
          )}
          
          {!error && (
            <ActivityIndicator 
              size="small" 
              color="#ffffff" 
              style={styles.spinner}
            />
          )}
          
          <Text style={styles.title}>
            {error || title || 'Processing Profile'}
          </Text>
          
          <Text style={styles.subtitle}>
            {error ? '' : (subtitle || 'Please wait while we update the profile data...')}
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    margin: 20,
    borderRadius: 24,
    padding: 18,
    alignItems: 'center',
    minWidth: 200,
    maxWidth: 250,
    backgroundColor: '#050505',
    borderWidth: 1.5,
    borderColor: '#000',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  cancelButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  cancelIcon: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 18,
  },
  spinner: {
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
    color: '#ffffff',
  },
  subtitle: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
    color: '#ffffff',
  },
});
