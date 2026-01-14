import Constants from 'expo-constants';
import { Alert, Platform } from 'react-native';
import {
    SUBSCRIPTION_PRODUCTS,
    type PurchaseError,
    type SubscriptionProductId,
    type SubscriptionUpdateData
} from '../types/iapTypes';
import { isIAPAvailable, markIAPModuleLoaded, markPurchaseAPIReady } from '../utils/iapAvailability';
import { getSupabaseClient } from '../utils/supabase';

// Lazy-load IAP module to avoid top-level require() that can crash release builds
let RNIap: any = undefined;
let endConnection: any = undefined;
let finishTransaction: any = undefined;
let getAvailablePurchases: any = undefined;
let fetchProducts: any = undefined;
let initConnection: any = undefined;
let requestPurchase: any = undefined;
let purchaseErrorListener: any = undefined;
let purchaseUpdatedListener: any = undefined;
type Product = any;
type Purchase = any;
type SubscriptionPurchase = any;

/**
 * Active purchase context - tracks in-flight purchases
 */
interface ActivePurchaseContext {
  productId: SubscriptionProductId;
  userId: string;
  timestamp: number;
}

/**
 * Purchase event emitter for centralized state management
 */
type PurchaseEventHandler = (purchase: Purchase) => Promise<void>;
type PurchaseErrorHandler = (error: PurchaseError) => void;

/**
 * Lazy-load IAP module only when needed
 */
function lazyLoadIAPModule() {
  if (initConnection !== undefined) {
    return;
  }

  const isExpoGo = Constants.executionEnvironment === 'storeClient';
  if (isExpoGo) {
    console.log('ℹ️ Expo Go detected - IAP not available');
    RNIap = null;
    endConnection = null;
    finishTransaction = null;
    getAvailablePurchases = null;
    fetchProducts = null;
    initConnection = null;
    requestPurchase = null;
    purchaseErrorListener = null;
    purchaseUpdatedListener = null;
    markIAPModuleLoaded(false);
    return;
  }

  try {
    const iapModule = require('react-native-iap');
    RNIap = iapModule;
    endConnection = iapModule.endConnection;
    finishTransaction = iapModule.finishTransaction;
    getAvailablePurchases = iapModule.getAvailablePurchases;
    fetchProducts = iapModule.fetchProducts;
    initConnection = iapModule.initConnection;
    requestPurchase = iapModule.requestPurchase;
    purchaseErrorListener = iapModule.purchaseErrorListener;
    purchaseUpdatedListener = iapModule.purchaseUpdatedListener;
    
    if (requestPurchase && initConnection) {
      markIAPModuleLoaded(true);
      markPurchaseAPIReady(true);
      console.log('✅ [IAP] Module loaded successfully with purchase API ready');
    } else {
      console.warn('⚠️ [IAP] Module loaded but critical APIs missing');
      markIAPModuleLoaded(false);
      markPurchaseAPIReady(false);
    }
  } catch (error) {
    console.warn('⚠️ [IAP] Module not available:', error);
    RNIap = null;
    endConnection = null;
    finishTransaction = null;
    getAvailablePurchases = null;
    fetchProducts = null;
    initConnection = null;
    requestPurchase = null;
    purchaseErrorListener = null;
    purchaseUpdatedListener = null;
    markIAPModuleLoaded(false);
    markPurchaseAPIReady(false);
  }
}

/**
 * Check if device supports StoreKit 2 (iOS 15+)
 */
function supportsStoreKit2(): boolean {
  if (Platform.OS !== 'ios') return false;
  // react-native-iap will use StoreKit 2 automatically on iOS 15+
  // We don't need to explicitly check version here as the library handles it
  return true;
}

class IAPService {
  private purchaseUpdateSubscription: any = null;
  private purchaseErrorSubscription: any = null;
  private isInitialized = false;
  private processedTransactions: Set<string> = new Set();
  private activePurchaseContext: ActivePurchaseContext | null = null;
  private purchaseSuccessHandlers: Set<PurchaseEventHandler> = new Set();
  private purchaseErrorHandlers: Set<PurchaseErrorHandler> = new Set();
  private currentEntitlements: Map<string, SubscriptionPurchase> = new Map();
  private listenersSetup = false;

  /**
   * Initialize the IAP service and set up global listeners
   */
  async initialize(): Promise<void> {
    lazyLoadIAPModule();
    
    if (!isIAPAvailable() || !initConnection) {
      console.log('ℹ️ [IAP] Not available (Expo Go mode)');
      markPurchaseAPIReady(false);
      return;
    }

    try {
      if (this.isInitialized) {
        console.log('🔵 [IAP] Already initialized, skipping');
        return;
      }

      console.log('🔵 [IAP] Initializing IAP connection...');
      const result = await initConnection();
      console.log('🔵 [IAP] Connection result:', result);
      
      if (!requestPurchase) {
        console.error('❌ [IAP] requestPurchase not available after initialization');
        markPurchaseAPIReady(false);
        throw new Error('IAP purchase API not available after initialization');
      }
      
      this.isInitialized = true;
      markPurchaseAPIReady(true);
      console.log('✅ [IAP] Service initialized successfully', {
        hasRequestPurchase: !!requestPurchase,
        hasFetchProducts: !!fetchProducts,
        hasFinishTransaction: !!finishTransaction,
        supportsStoreKit2: supportsStoreKit2()
      });

      // Set up global listeners if not already set up
      if (!this.listenersSetup) {
        this.setupGlobalListeners();
      }

      // Refresh entitlements on initialization
      await this.refreshEntitlements();
    } catch (error: any) {
      console.error('❌ [IAP] Failed to initialize:', {
        error: error.message,
        stack: error.stack,
        isExpoGo: Constants.executionEnvironment === 'storeClient'
      });
      markPurchaseAPIReady(false);
      this.isInitialized = false;
      if (Constants.executionEnvironment !== 'storeClient') {
        throw error;
      }
    }
  }

  /**
   * Set up global purchase listeners (called once during initialization)
   * These listeners are always active and dispatch to registered handlers
   */
  private setupGlobalListeners(): void {
    if (this.listenersSetup) {
      console.log('🔵 [IAP] Global listeners already set up');
      return;
    }

    if (!isIAPAvailable() || !purchaseUpdatedListener || !purchaseErrorListener) {
      console.log('ℹ️ [IAP] Not available - global listeners not set up');
      return;
    }

    console.log('🔵 [IAP] Setting up global purchase listeners');

    // Purchase update listener - handles successful purchases
    this.purchaseUpdateSubscription = purchaseUpdatedListener(
      async (purchase: Purchase) => {
        try {
          const transactionId = purchase.originalTransactionId || purchase.transactionId;
          console.log('🔵 [IAP] Global listener received purchase update', {
            transactionId,
            productId: purchase.productId,
            hasActiveContext: !!this.activePurchaseContext
          });

          if (!transactionId) {
            console.error('❌ [IAP] No transaction ID found in purchase');
            this.notifyErrorHandlers({
              code: 'MISSING_TRANSACTION_ID',
              message: 'Purchase missing transaction ID'
            });
            return;
          }

          // De-duplicate: check if we've already processed this transaction
          if (this.processedTransactions.has(transactionId)) {
            console.log('⚠️ [IAP] Transaction already processed, ignoring duplicate:', transactionId);
            return;
          }

          // Mark as processed
          this.processedTransactions.add(transactionId);
          setTimeout(() => {
            this.processedTransactions.delete(transactionId);
          }, 30000);

          // Finish the transaction (StoreKit 1 compatibility)
          if (finishTransaction && purchase.transactionReceipt) {
            try {
              await finishTransaction({ purchase, isConsumable: false });
            } catch (finishError) {
              console.warn('⚠️ [IAP] Error finishing transaction:', finishError);
            }
          }

          // Update entitlements cache
          this.currentEntitlements.set(purchase.productId, purchase);

          // Check if this purchase matches an active purchase context
          const shouldProcess = this.shouldProcessPurchase(purchase);

          if (shouldProcess) {
            console.log('✅ [IAP] Processing purchase - matches active context');
            // Notify all registered success handlers
            await this.notifySuccessHandlers(purchase);
            // Clear active context after processing
            this.clearActivePurchaseContext();
          } else {
            console.log('ℹ️ [IAP] Purchase received but no matching active context - may be restore or background update');
            // Still notify handlers but with context that it's not user-initiated
            // This allows screens to handle restores/background updates
            await this.notifySuccessHandlers(purchase);
          }

        } catch (error: any) {
          console.error('❌ [IAP] Error handling purchase update:', error);
          this.notifyErrorHandlers({
            code: 'PURCHASE_HANDLE_ERROR',
            message: error.message || 'Failed to process purchase'
          });
        }
      }
    );

    // Purchase error listener
    this.purchaseErrorSubscription = purchaseErrorListener(
      (error: any) => {
        console.error('❌ [IAP] Global listener received purchase error:', error);

        const isAlreadyOwned =
          error.code === 'E_ALREADY_OWNED' ||
          error.code === 'E_ITEM_UNAVAILABLE' ||
          error.code === 'SKErrorPaymentInvalid' ||
          error.message?.toLowerCase().includes('already owned') ||
          error.message?.toLowerCase().includes('already purchased') ||
          error.message?.toLowerCase().includes('item already owned') ||
          error.message?.toLowerCase().includes('this in-app purchase has already been bought');

        const purchaseError: PurchaseError = {
          code: error.code || 'UNKNOWN_ERROR',
          message: error.message || 'An unknown error occurred',
          userCancelled: error.code === 'E_USER_CANCELLED',
          alreadyOwned: isAlreadyOwned
        };

        this.notifyErrorHandlers(purchaseError);
        this.clearActivePurchaseContext();
      }
    );

    this.listenersSetup = true;
    console.log('✅ [IAP] Global listeners set up successfully');
  }

  /**
   * Check if purchase should be processed based on active context
   */
  private shouldProcessPurchase(purchase: Purchase): boolean {
    if (!this.activePurchaseContext) {
      return false; // No active purchase context
    }

    const context = this.activePurchaseContext;
    const matchesProduct = purchase.productId === context.productId;
    const isRecent = Date.now() - context.timestamp < 60000; // Within 60 seconds

    return matchesProduct && isRecent;
  }

  /**
   * Notify all registered success handlers
   */
  private async notifySuccessHandlers(purchase: Purchase): Promise<void> {
    const handlers = Array.from(this.purchaseSuccessHandlers);
    if (handlers.length === 0) {
      console.warn('⚠️ [IAP] No success handlers registered');
      return;
    }

    for (const handler of handlers) {
      try {
        await handler(purchase);
      } catch (error) {
        console.error('❌ [IAP] Error in success handler:', error);
      }
    }
  }

  /**
   * Notify all registered error handlers
   */
  private notifyErrorHandlers(error: PurchaseError): void {
    const handlers = Array.from(this.purchaseErrorHandlers);
    if (handlers.length === 0) {
      console.warn('⚠️ [IAP] No error handlers registered');
      return;
    }

    for (const handler of handlers) {
      try {
        handler(error);
      } catch (err) {
        console.error('❌ [IAP] Error in error handler:', err);
      }
    }
  }

  /**
   * Register a purchase success handler
   * Returns cleanup function to unregister
   */
  onPurchaseSuccess(handler: PurchaseEventHandler): () => void {
    this.purchaseSuccessHandlers.add(handler);
    console.log('🔵 [IAP] Success handler registered, total handlers:', this.purchaseSuccessHandlers.size);
    return () => {
      this.purchaseSuccessHandlers.delete(handler);
      console.log('🔵 [IAP] Success handler unregistered');
    };
  }

  /**
   * Register a purchase error handler
   * Returns cleanup function to unregister
   */
  onPurchaseError(handler: PurchaseErrorHandler): () => void {
    this.purchaseErrorHandlers.add(handler);
    console.log('🔵 [IAP] Error handler registered, total handlers:', this.purchaseErrorHandlers.size);
    return () => {
      this.purchaseErrorHandlers.delete(handler);
      console.log('🔵 [IAP] Error handler unregistered');
    };
  }

  /**
   * Set active purchase context (replaces purchaseInitiated flag)
   */
  private setActivePurchaseContext(productId: SubscriptionProductId, userId: string): void {
    this.activePurchaseContext = {
      productId,
      userId,
      timestamp: Date.now()
    };
    console.log('🔵 [IAP] Active purchase context set', { productId, userId });
  }

  /**
   * Clear active purchase context
   */
  private clearActivePurchaseContext(): void {
    if (this.activePurchaseContext) {
      console.log('🔵 [IAP] Clearing active purchase context');
      this.activePurchaseContext = null;
    }
  }

  /**
   * Get available subscription products
   */
  async getAvailableSubscriptions(): Promise<Product[]> {
    lazyLoadIAPModule();
    
    if (!isIAPAvailable() || !fetchProducts) {
      console.log('ℹ️ [IAP] Not available - returning empty subscriptions');
      return [];
    }

    try {
      const productIds = Object.values(SUBSCRIPTION_PRODUCTS);
      console.log('🔵 [IAP] Fetching subscriptions for product IDs:', productIds);
      
      const subscriptions = await fetchProducts({ skus: productIds, type: 'subs' });
      console.log('✅ [IAP] Available subscriptions:', subscriptions?.length || 0);
      
      return subscriptions || [];
    } catch (error) {
      console.warn('⚠️ [IAP] Failed to get subscriptions:', error);
      return [];
    }
  }

  /**
   * Purchase a subscription
   * Sets active purchase context before calling Apple
   */
  async purchaseSubscription(
    productId: SubscriptionProductId,
    userId: string
  ): Promise<void> {
    lazyLoadIAPModule();
    
    if (!RNIap || !initConnection) {
      const isExpoGo = Constants.executionEnvironment === 'storeClient';
      if (isExpoGo) {
        throw new Error('In-app purchases are not available in Expo Go. Please use a TestFlight or App Store build.');
      } else {
        throw new Error('In-app purchases module failed to load. Please ensure you are using a TestFlight or App Store build with react-native-iap properly configured.');
      }
    }

    try {
      console.log('🔵 [IAP] Starting purchase for product:', productId);
      console.log('🔵 [IAP] Module loaded:', !!RNIap, 'initConnection:', !!initConnection, 'requestPurchase:', !!requestPurchase);
      
      // Ensure initialization
      if (!this.isInitialized) {
        console.log('🔵 [IAP] Not initialized, initializing now...');
        await this.initialize();
      }

      if (!this.isInitialized) {
        throw new Error('IAP service failed to initialize. Please try again.');
      }

      if (!requestPurchase) {
        console.error('❌ [IAP] requestPurchase API is null after initialization');
        throw new Error('In-app purchase request API is unavailable. Please ensure react-native-iap is configured correctly.');
      }

      // Set active purchase context BEFORE calling Apple
      this.setActivePurchaseContext(productId, userId);

      // Optional product validation (non-blocking)
      if (fetchProducts) {
        try {
          console.log('🔵 [IAP] Validating product availability', { productId });
          const products = await fetchProducts({ skus: [productId], type: 'subs' });
          const found = products?.find((p: any) => p?.id === productId || p?.productId === productId) ?? products?.[0];
          console.log('🔵 [IAP] Product validation result', { 
            found: !!found, 
            productId: found?.id || found?.productId,
            totalProducts: products?.length || 0
          });
          if (!found) {
            console.warn('⚠️ [IAP] Product not found in fetch, but continuing with purchase attempt');
          }
        } catch (fetchError: any) {
          console.warn('⚠️ [IAP] Product fetch failed, but continuing with purchase:', fetchError.message);
        }
      }

      // Call requestPurchase with timeout
      console.log('🔵 [IAP] Calling requestPurchase', { 
        productId, 
        type: 'subs',
        isInitialized: this.isInitialized,
        hasRequestPurchase: !!requestPurchase,
        supportsStoreKit2: supportsStoreKit2()
      });

      const purchasePromise = requestPurchase({
        type: 'subs',
        request: {
          ios: { sku: productId },
          android: { skus: [productId], subscriptionOffers: [] },
        },
      });

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error('Purchase request timed out. The purchase dialog did not appear. Please try again.'));
        }, 30000);
      });

      await Promise.race([purchasePromise, timeoutPromise]);
      
      console.log('🔵 [IAP] requestPurchase promise resolved successfully');
      
    } catch (error: any) {
      console.error('❌ [IAP] Purchase failed:', {
        error: error.message,
        code: error.code,
        stack: error.stack
      });
      
      this.clearActivePurchaseContext();
      
      if (error.code === 'E_USER_CANCELLED') {
        throw new Error('Purchase was cancelled by user');
      }
      
      if (error.message?.includes('timed out')) {
        throw new Error('Purchase request timed out. Please check your connection and try again.');
      }
      
      if (error.message?.includes('not available') || error.message?.includes('unavailable')) {
        throw new Error('This subscription is not available. Please check your App Store connection and try again.');
      }
      
      throw new Error(error.message || 'Purchase failed. Please try again.');
    }
  }

  /**
   * Restore previous purchases and refresh entitlements
   */
  async restorePurchases(): Promise<SubscriptionPurchase[]> {
    lazyLoadIAPModule();
    
    if (!isIAPAvailable() || !getAvailablePurchases) {
      console.log('ℹ️ [IAP] Not available - returning empty purchases');
      return [];
    }

    try {
      console.log('🔵 [IAP] Restoring purchases...');
      const purchases = await getAvailablePurchases();
      console.log('✅ [IAP] Restored purchases:', purchases?.length || 0);
      
      // Update entitlements cache
      if (purchases && purchases.length > 0) {
        purchases.forEach((purchase: Purchase) => {
          this.currentEntitlements.set(purchase.productId, purchase);
        });
      }
      
      return purchases || [];
    } catch (error) {
      console.warn('⚠️ [IAP] Failed to restore purchases:', error);
      return [];
    }
  }

  /**
   * Refresh current entitlements from App Store
   * This is the StoreKit 2-style approach - check current subscription status
   */
  async refreshEntitlements(): Promise<void> {
    try {
      console.log('🔵 [IAP] Refreshing entitlements...');
      const purchases = await this.restorePurchases();
      
      // Update entitlements cache
      this.currentEntitlements.clear();
      purchases.forEach((purchase: Purchase) => {
        this.currentEntitlements.set(purchase.productId, purchase);
      });
      
      console.log('✅ [IAP] Entitlements refreshed', {
        count: this.currentEntitlements.size,
        products: Array.from(this.currentEntitlements.keys())
      });
    } catch (error) {
      console.error('❌ [IAP] Error refreshing entitlements:', error);
    }
  }

  /**
   * Get current subscription status (entitlement-based)
   * This is the source of truth for UI gating
   */
  async getCurrentSubscriptionStatus(): Promise<{
    hasActiveSubscription: boolean;
    plan: 'basic' | 'plus' | null;
    cycle: 'monthly' | 'quarterly' | null;
    productId: string | null;
  }> {
    try {
      // Refresh entitlements first
      await this.refreshEntitlements();
      
      // Check for Plus subscriptions first (higher tier)
      const plusMonthly = this.currentEntitlements.get(SUBSCRIPTION_PRODUCTS.PLUS_MONTHLY);
      const plusQuarterly = this.currentEntitlements.get(SUBSCRIPTION_PRODUCTS.PLUS_QUARTERLY);
      const basic = this.currentEntitlements.get(SUBSCRIPTION_PRODUCTS.BASIC_MONTHLY);
      
      if (plusMonthly || plusQuarterly) {
        return {
          hasActiveSubscription: true,
          plan: 'plus',
          cycle: plusQuarterly ? 'quarterly' : 'monthly',
          productId: plusQuarterly ? SUBSCRIPTION_PRODUCTS.PLUS_QUARTERLY : SUBSCRIPTION_PRODUCTS.PLUS_MONTHLY
        };
      }
      
      if (basic) {
        return {
          hasActiveSubscription: true,
          plan: 'basic',
          cycle: 'monthly',
          productId: SUBSCRIPTION_PRODUCTS.BASIC_MONTHLY
        };
      }
      
      return {
        hasActiveSubscription: false,
        plan: null,
        cycle: null,
        productId: null
      };
    } catch (error) {
      console.error('❌ [IAP] Error getting subscription status:', error);
      return {
        hasActiveSubscription: false,
        plan: null,
        cycle: null,
        productId: null
      };
    }
  }

  /**
   * Update user subscription in Supabase
   */
  async updateUserSubscription(
    userId: string, 
    subscriptionData: SubscriptionUpdateData
  ): Promise<void> {
    try {
      console.log('🔵 [IAP] Updating user subscription:', { userId, subscriptionData });
      
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
        console.error('❌ [IAP] Failed to update user subscription:', error);
        throw error;
      }

      console.log('✅ [IAP] User subscription updated successfully:', data);
    } catch (error) {
      console.error('❌ [IAP] Error updating user subscription:', error);
      throw error;
    }
  }

  /**
   * Verify receipt with Apple (legacy StoreKit 1 - kept for backward compatibility)
   * Note: In StoreKit 2 flow, we primarily rely on entitlements, but receipt verification
   * can still be used for server-side validation
   */
  async verifyReceiptAndUpdateSubscription(
    userId: string,
    receiptData: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('🔵 [IAP] Receipt verification started', { userId, receiptLength: receiptData.length });
      
      const timeoutPromise = new Promise<{ success: false; error: string }>((resolve) => {
        setTimeout(() => {
          console.error('⏱️ [IAP] Receipt verification timed out after 10 seconds');
          resolve({ success: false, error: 'Receipt verification timed out. Please try again.' });
        }, 10000);
      });

      const verificationPromise = getSupabaseClient().functions.invoke('verify_receipt', {
        body: {
          receiptData,
          userId
        }
      });

      const result = await Promise.race([verificationPromise, timeoutPromise]);

      if ('success' in result && !('data' in result) && result.success === false) {
        return result as { success: false; error: string };
      }

      const { data, error } = result as { data: any; error: any };

      if (error) {
        console.error('❌ [IAP] Receipt verification failed:', error);
        return { success: false, error: error.message || 'Receipt verification failed' };
      }

      if (!data?.success) {
        console.error('❌ [IAP] Receipt verification returned failure:', data);
        return { success: false, error: data?.error || 'Receipt verification failed' };
      }

      console.log('✅ [IAP] Receipt verified successfully');
      return { success: true };
    } catch (error: any) {
      console.error('❌ [IAP] Error verifying receipt:', error);
      return { success: false, error: error.message || 'Failed to verify receipt' };
    }
  }

  /**
   * Show purchase error alert
   */
  showPurchaseError(error: PurchaseError): void {
    if (error.userCancelled) {
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
   */
  async cleanup(): Promise<void> {
    lazyLoadIAPModule();

    try {
      this.cleanupExistingListeners();
      this.purchaseSuccessHandlers.clear();
      this.purchaseErrorHandlers.clear();
      this.currentEntitlements.clear();
      this.clearActivePurchaseContext();
      this.listenersSetup = false;

      if (endConnection) {
        await endConnection();
      }
      this.isInitialized = false;
      console.log('✅ [IAP] Service cleaned up');
    } catch (error) {
      console.error('❌ [IAP] Error cleaning up:', error);
    }
  }

  /**
   * Clean up existing listeners
   */
  private cleanupExistingListeners(): void {
    if (this.purchaseUpdateSubscription) {
      this.purchaseUpdateSubscription.remove();
      this.purchaseUpdateSubscription = null;
    }
    if (this.purchaseErrorSubscription) {
      this.purchaseErrorSubscription.remove();
      this.purchaseErrorSubscription = null;
    }
  }
}

// Export singleton instance
export const iapService = new IAPService();
