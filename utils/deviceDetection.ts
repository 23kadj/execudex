import * as Device from 'expo-device';
import { Platform } from 'react-native';

/**
 * Detects if the current device is an iPad
 * Uses expo-device's deviceType when available, falls back to Platform check
 */
export const isIPad = (): boolean => {
  // Only check on iOS
  if (Platform.OS !== 'ios') {
    return false;
  }

  // Use expo-device's deviceType if available (most reliable)
  if (Device.deviceType === Device.DeviceType.TABLET) {
    return true;
  }

  // Fallback: Check if device model name contains "iPad"
  // This is a secondary check for cases where deviceType might not be available
  if (Device.modelName && Device.modelName.toLowerCase().includes('ipad')) {
    return true;
  }

  return false;
};

