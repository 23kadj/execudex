import Constants from 'expo-constants';

// Track if IAP module has been successfully loaded
let iapModuleLoaded = false;
let iapModuleLoadAttempted = false;

/**
 * Check if IAP is available in the current environment
 * IAP only works in EAS builds, not in Expo Go
 */
export const isIAPAvailable = (): boolean => {
  // Check if we're in Expo Go (which doesn't support native modules)
  const isExpoGo = Constants.executionEnvironment === 'storeClient';
  
  // If we're in Expo Go, IAP is definitely not available
  if (isExpoGo) {
    return false;
  }
  
  // If module has been loaded successfully, it's available
  if (iapModuleLoaded) {
    return true;
  }
  
  // If we haven't tried loading yet, assume it might be available
  // (the actual load attempt will happen in lazyLoadIAPModule)
  if (!iapModuleLoadAttempted) {
    return true; // Optimistically return true, let the actual load determine availability
  }
  
  // If we tried and failed, it's not available
  return false;
};

/**
 * Mark IAP module as successfully loaded
 * Called by lazyLoadIAPModule when module loads successfully
 */
export const markIAPModuleLoaded = (loaded: boolean): void => {
  iapModuleLoaded = loaded;
  iapModuleLoadAttempted = true;
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

