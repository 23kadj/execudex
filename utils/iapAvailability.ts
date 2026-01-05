import Constants from 'expo-constants';

// Track if IAP module has been successfully loaded
let iapModuleLoaded = false;
let iapModuleLoadAttempted = false;
// Track if critical purchase API is available
let purchaseAPIReady = false;

/**
 * Check if IAP is available in the current environment
 * IAP only works in EAS builds, not in Expo Go
 * Only returns true if module is loaded AND purchase API is ready
 */
export const isIAPAvailable = (): boolean => {
  // Check if we're in Expo Go (which doesn't support native modules)
  const isExpoGo = Constants.executionEnvironment === 'storeClient';
  
  // If we're in Expo Go, IAP is definitely not available
  if (isExpoGo) {
    return false;
  }
  
  // Only return true if module is loaded AND purchase API is ready
  // This prevents optimistic "true" when module hasn't been attempted yet
  if (iapModuleLoaded && purchaseAPIReady) {
    return true;
  }
  
  // If we haven't tried loading yet, return false (not optimistic)
  if (!iapModuleLoadAttempted) {
    return false;
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
  // Reset purchase API ready state when module load status changes
  if (!loaded) {
    purchaseAPIReady = false;
  }
};

/**
 * Mark purchase API as ready (requestPurchase is available)
 * Called after module loads and critical APIs are verified
 */
export const markPurchaseAPIReady = (ready: boolean): void => {
  purchaseAPIReady = ready;
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

