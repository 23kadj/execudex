import { Alert } from 'react-native';
import {
    SUBSCRIPTION_PRODUCTS,
    type PurchaseError,
    type SubscriptionProductId,
    type SubscriptionUpdateData
} from '../types/iapTypes';
import { isIAPAvailable } from '../utils/iapAvailability';
import { getSupabaseClient } from '../utils/supabase';

// Lazy-load IAP module to avoid top-level require() that can crash release builds
// Only load when actually needed, not at module import time
let RNIap: any = undefined;
let endConnection: any = undefined;
let finishTransaction: any = undefined;
let getAvailablePurchases: any = undefined;
let getSubscriptions: any = undefined;
let initConnection: any = undefined;
let purchaseErrorListener: any = undefined;
let purchaseUpdatedListener: any = undefined;
type Product = any;
type Purchase = any;
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
    RNIap = null;
    endConnection = null;
    finishTransaction = null;
    getAvailablePurchases = null;
    getSubscriptions = null;
    initConnection = null;
    purchaseErrorListener = null;
    purchaseUpdatedListener = null;
    return;
  }

  try {
    const iapModule = require('react-native-iap');
    RNIap = iapModule.default;
    endConnection = iapModule.endConnection;
    finishTransaction = iapModule.finishTransaction;
    getAvailablePurchases = iapModule.getAvailablePurchases;
    getSubscriptions = iapModule.getSubscriptions;
    initConnection = iapModule.initConnection;
    purchaseErrorListener = iapModule.purchaseErrorListener;
    purchaseUpdatedListener = iapModule.purchaseUpdatedListener;
  } catch (error) {
    console.warn('⚠️ IAP module not available (likely Expo Go):', error);
    RNIap = null;
    endConnection = null;
    finishTransaction = null;
    getAvailablePurchases = null;
    getSubscriptions = null;
    initConnection = null;
    purchaseErrorListener = null;
    purchaseUpdatedListener = null;
  }
}

class IAPService {
  private purchaseUpdateSubscription: any = null;
  private purchaseErrorSubscription: any = null;
  private isInitialized = false;

  /**
   * Initialize the IAP service
   * Safe to call in Expo Go - will silently fail
   * Only loads IAP module when this function is called (lazy loading)
   */
  async initialize(): Promise<void> {
    // Lazy-load IAP module only when this function is called
    lazyLoadIAPModule();
    
    if (!isIAPAvailable() || !initConnection) {
      console.log('ℹ️ IAP not available (Expo Go mode)');
      return;
    }

    try {
      if (this.isInitialized) return;

      const result = await initConnection();
      console.log('IAP connection result:', result);
      
      this.isInitialized = true;
      console.log('✅ IAP service initialized successfully');
    } catch (error) {
      console.warn('⚠️ Failed to initialize IAP service (may be Expo Go):', error);
      // Don't throw - allow app to continue in Expo Go
    }
  }

  /**
   * Get available subscription products
   * Safe to call in Expo Go - returns empty array
   * Only loads IAP module when this function is called (lazy loading)
   */
  async getAvailableSubscriptions(): Promise<Product[]> {
    // Lazy-load IAP module only when this function is called
    lazyLoadIAPModule();
    
    if (!isIAPAvailable() || !getSubscriptions) {
      console.log('ℹ️ IAP not available (Expo Go mode) - returning empty subscriptions');
      return [];
    }

    try {
      const productIds = Object.values(SUBSCRIPTION_PRODUCTS);
      console.log('Fetching subscriptions for product IDs:', productIds);
      
      const subscriptions = await getSubscriptions({ skus: productIds });
      console.log('Available subscriptions:', subscriptions);
      
      return subscriptions;
    } catch (error) {
      console.warn('⚠️ Failed to get subscriptions (may be Expo Go):', error);
      return [];
    }
  }

  /**
   * Purchase a subscription
   * In Expo Go, shows alert that IAP is not available
   * Only loads IAP module when this function is called (lazy loading)
   */
  async purchaseSubscription(productId: SubscriptionProductId): Promise<void> {
    // Lazy-load IAP module only when this function is called
    lazyLoadIAPModule();
    
    if (!isIAPAvailable() || !RNIap) {
      return;
    }

    try {
      console.log('Starting purchase for product:', productId);
      
      const result = await RNIap.requestSubscription({ sku: productId });
      console.log('Purchase result:', result);
      
    } catch (error: any) {
      console.error('❌ Purchase failed:', error);
      
      if (error.code === 'E_USER_CANCELLED') {
        throw new Error('Purchase was cancelled by user');
      }
      
      throw new Error(error.message || 'Purchase failed');
    }
  }

  /**
   * Restore previous purchases
   * Safe to call in Expo Go - returns empty array
   * Only loads IAP module when this function is called (lazy loading)
   */
  async restorePurchases(): Promise<SubscriptionPurchase[]> {
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
   * Set up purchase listeners
   * In Expo Go, returns a no-op cleanup function
   * Only loads IAP module when this function is called (lazy loading)
   */
  setupPurchaseListeners(
    onPurchaseSuccess: (purchase: Purchase) => Promise<void>,
    onPurchaseError: (error: PurchaseError) => void
  ): () => void {
    // Lazy-load IAP module only when this function is called
    lazyLoadIAPModule();
    
    if (!isIAPAvailable() || !purchaseUpdatedListener || !purchaseErrorListener) {
      console.log('ℹ️ IAP not available (Expo Go mode) - listeners not set up');
      // Return a no-op cleanup function
      return () => {};
    }

    // Purchase update listener
    this.purchaseUpdateSubscription = purchaseUpdatedListener(
      async (purchase: Purchase) => {
        try {
          console.log('Purchase updated:', purchase);
          
          // Finish the transaction
          const receipt = purchase.transactionReceipt;
          if (receipt) {
            await finishTransaction({ purchase, isConsumable: false });
          }
          
          // Call success handler
          await onPurchaseSuccess(purchase);
          
        } catch (error) {
          console.error('❌ Error handling purchase update:', error);
          onPurchaseError({
            code: 'PURCHASE_HANDLE_ERROR',
            message: 'Failed to process purchase'
          });
        }
      }
    );

    // Purchase error listener
    this.purchaseErrorSubscription = purchaseErrorListener(
      (error: any) => {
        console.error('Purchase error:', error);
        
        const purchaseError: PurchaseError = {
          code: error.code || 'UNKNOWN_ERROR',
          message: error.message || 'An unknown error occurred',
          userCancelled: error.code === 'E_USER_CANCELLED'
        };
        
        onPurchaseError(purchaseError);
      }
    );

    // Return cleanup function
    return () => {
      if (this.purchaseUpdateSubscription) {
        this.purchaseUpdateSubscription.remove();
        this.purchaseUpdateSubscription = null;
      }
      if (this.purchaseErrorSubscription) {
        this.purchaseErrorSubscription.remove();
        this.purchaseErrorSubscription = null;
      }
    };
  }

  /**
   * Update user subscription in Supabase
   */
  async updateUserSubscription(
    userId: string, 
    subscriptionData: SubscriptionUpdateData
  ): Promise<void> {
    try {
      console.log('Updating user subscription:', { userId, subscriptionData });
      
      // Call the new update_subscription_status function
      const { data, error } = await getSupabaseClient().functions.invoke('update_subscription_status', {
        body: {
          userId: userId,
          plan: subscriptionData.plan,
          cycle: subscriptionData.cycle,
          transactionId: subscriptionData.transactionId,
          purchaseDate: subscriptionData.purchaseDate
        }
      });

      if (error) {
        console.error('❌ Failed to update user subscription:', error);
        throw error;
      }

      console.log('✅ User subscription updated successfully:', data);
    } catch (error) {
      console.error('❌ Error updating user subscription:', error);
      throw error;
    }
  }

  /**
   * Check if user has active subscription
   */
  async checkActiveSubscription(): Promise<SubscriptionPurchase | null> {
    try {
      const purchases = await this.restorePurchases();
      
      // Look for active Plus subscriptions
      const activePurchase = purchases.find(purchase => 
        (purchase.productId === SUBSCRIPTION_PRODUCTS.PLUS_MONTHLY || 
         purchase.productId === SUBSCRIPTION_PRODUCTS.PLUS_QUARTERLY) &&
        purchase.isAcknowledged !== false
      );
      
      return activePurchase || null;
    } catch (error) {
      console.error('❌ Error checking active subscription:', error);
      return null;
    }
  }

  /**
   * Show purchase error alert
   */
  showPurchaseError(error: PurchaseError): void {
    if (error.userCancelled) {
      // Don't show alert for user cancellation
      return;
    }

    Alert.alert(
      'Purchase Error',
      error.message || 'An error occurred during purchase. Please try again.',
      [{ text: 'OK' }]
    );
  }

  /**
   * Show purchase success alert
   */
  showPurchaseSuccess(): void {
    Alert.alert(
      'Purchase Successful',
      'Your subscription has been activated! You now have access to unlimited profiles.',
      [{ text: 'OK' }]
    );
  }

  /**
   * Clean up and disconnect
   * Only loads IAP module when this function is called (lazy loading)
   */
  async cleanup(): Promise<void> {
    // Lazy-load IAP module only when this function is called
    lazyLoadIAPModule();
    
    try {
      if (this.purchaseUpdateSubscription) {
        this.purchaseUpdateSubscription.remove();
        this.purchaseUpdateSubscription = null;
      }
      if (this.purchaseErrorSubscription) {
        this.purchaseErrorSubscription.remove();
        this.purchaseErrorSubscription = null;
      }
      
      if (endConnection) {
        await endConnection();
      }
      this.isInitialized = false;
      console.log('✅ IAP service cleaned up');
    } catch (error) {
      console.error('❌ Error cleaning up IAP service:', error);
    }
  }
}

// Export singleton instance
export const iapService = new IAPService();
