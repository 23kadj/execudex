import { isIAPAvailable } from './utils/iapAvailability';

// Conditionally import IAP only if available (not in Expo Go)
let initConnection: any = null;
let getAvailablePurchases: any = null;
let endConnection: any = null;
type SubscriptionPurchase = any;

if (isIAPAvailable()) {
  try {
    const iapModule = require('react-native-iap');
    initConnection = iapModule.initConnection;
    getAvailablePurchases = iapModule.getAvailablePurchases;
    endConnection = iapModule.endConnection;
  } catch (error) {
    console.warn('⚠️ IAP module not available (likely Expo Go):', error);
  }
}

const SUBSCRIPTION_PRODUCTS = ['execudex.plus.monthly', 'execudex.plus.quarterly'];

/**
 * Initialize IAP connection
 * Safe to call in Expo Go - will silently fail
 */
export async function initIap(): Promise<void> {
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
 */
export async function restorePurchases(): Promise<SubscriptionPurchase[]> {
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
 */
export async function cleanupIap(): Promise<void> {
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