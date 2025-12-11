import Constants from 'expo-constants';

/**
 * Check if IAP is available in the current environment
 * IAP only works in EAS builds, not in Expo Go
 */
export const isIAPAvailable = (): boolean => {
  // Check if we're in Expo Go (which doesn't support native modules)
  const isExpoGo = Constants.executionEnvironment === 'storeClient';
  
  // IAP is only available in standalone builds (EAS builds)
  // In Expo Go, we return false to prevent crashes
  return !isExpoGo;
};

/**
 * Safely check if IAP module can be imported
 * This prevents crashes when react-native-iap is not available
 */
export const canImportIAP = (): boolean => {
  try {
    // Try to check if the module exists without actually importing it
    // In Expo Go, this will fail gracefully
    return isIAPAvailable();
  } catch {
    return false;
  }
};

