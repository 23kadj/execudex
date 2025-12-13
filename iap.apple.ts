import { isIAPAvailable } from './utils/iapAvailability';

// Lazy-load IAP module to avoid top-level require() that can crash release builds
// Only load when actually needed, not at module import time
let initConnection: any = null;
let getAvailablePurchases: any = null;
let endConnection: any = null;
type SubscriptionPurchase = any;

/**
 * Lazy-load IAP module only when needed
 * This prevents crashes in release builds from top-level require()
 */
function lazyLoadIAPModule() {
  if (initConnection !== undefined) {
    // Already attempted to load (null means failed, function means success)
    return;
  }

  if (!isIAPAvailable()) {
    initConnection = null;
    getAvailablePurchases = null;
    endConnection = null;
    return;
  }

  try {
    const iapModule = require('react-native-iap');
    initConnection = iapModule.initConnection;
    getAvailablePurchases = iapModule.getAvailablePurchases;
    endConnection = iapModule.endConnection;
  } catch (error) {
    console.warn('⚠️ IAP module not available (likely Expo Go):', error);
    initConnection = null;
    getAvailablePurchases = null;
    endConnection = null;
  }
}

const SUBSCRIPTION_PRODUCTS = ['execudex.plus.monthly', 'execudex.plus.quarterly'];

/**
 * Initialize IAP connection
 * Safe to call in Expo Go - will silently fail
 * Only loads IAP module when this function is called (lazy loading)
 */
export async function initIap(): Promise<void> {
  // Lazy-load IAP module only when this function is called
  lazyLoadIAPModule();
  
  if (!isIAPAvailable() || !initConnection) {
    console.log('ℹ️ IAP not available (Expo Go mode)');
    return;
  }
  
  try {
    await initConnection();
    console.log('✅ IAP connection initialized');
  } catch (error) {
    console.warn('⚠️ Failed to initialize IAP connection (may be Expo Go):', error);
    // Don't throw - allow app to continue in Expo Go
  }
}

/**
 * Restore previous purchases (simplified MVP approach)
 * Safe to call in Expo Go - returns empty array
 * Only loads IAP module when this function is called (lazy loading)
 */
export async function restorePurchases(): Promise<SubscriptionPurchase[]> {
  // Lazy-load IAP module only when this function is called
  lazyLoadIAPModule();
  
  if (!isIAPAvailable() || !getAvailablePurchases) {
    console.log('ℹ️ IAP not available (Expo Go mode) - returning empty purchases');
    return [];
  }
  
  try {
    console.log('Restoring purchases...');
    const purchases = await getAvailablePurchases();
    console.log('Restored purchases:', purchases);
    return purchases;
  } catch (error) {
    console.warn('⚠️ Failed to restore purchases (may be Expo Go):', error);
    return [];
  }
}

/**
 * Clean up IAP connection
 * Safe to call in Expo Go - will silently fail
 * Only loads IAP module when this function is called (lazy loading)
 */
export async function cleanupIap(): Promise<void> {
  // Lazy-load IAP module only when this function is called
  lazyLoadIAPModule();
  
  if (!isIAPAvailable() || !endConnection) {
    return;
  }
  
  try {
    await endConnection();
    console.log('✅ IAP connection cleaned up');
  } catch (error) {
    console.warn('⚠️ Failed to cleanup IAP connection:', error);
  }
}