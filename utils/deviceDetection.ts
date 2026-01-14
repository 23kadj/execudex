import * as Device from 'expo-device';
import { Platform } from 'react-native';

/**
 * Detects if the current device is an iPad
 * Uses expo-device's deviceType when available, falls back to Platform check
 */
export const isIPad = (): boolean => {
  try {
    // Only check on iOS
    if (Platform.OS !== 'ios') {
      return false;
    }

    // Use expo-device's deviceType if available (most reliable)
    // Safely check if DeviceType enum exists before accessing
    if (Device.DeviceType && Device.deviceType === Device.DeviceType.TABLET) {
      return true;
    }

    // Fallback: Check if device model name contains "iPad"
    // This is a secondary check for cases where deviceType might not be available
    if (Device.modelName && typeof Device.modelName === 'string' && Device.modelName.toLowerCase().includes('ipad')) {
      return true;
    }

    return false;
  } catch (error) {
    // If any error occurs during device detection, default to false (not iPad)
    // This prevents build failures
    console.warn('[deviceDetection] Error detecting iPad:', error);
    return false;
  }
};

