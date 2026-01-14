# Apple In-App Purchase Flow - Complete Technical Outline

## Overview

This document explains the complete flow of how subscription purchases work in the Execudex app, from user tap to subscription activation. The system uses **StoreKit 1** (deprecated but still functional) via the `react-native-iap` library version 14.4.16.

---

## Architecture Overview

### Key Components

1. **Three Purchase Entry Points:**
   - `app/index.tsx` - Onboarding screen (first-time subscription)
   - `app/subscription.tsx` - Subscription management screen
   - `app/subs.tsx` - Alternative subscription screen

2. **Core Service:**
   - `services/iapService.ts` - Singleton service that wraps `react-native-iap` library

3. **Backend Verification:**
   - `supabase/functions/verify_receipt/index.ts` - Validates receipts with Apple
   - `supabase/functions/apple_webhook/index.ts` - Handles Apple server-to-server notifications

4. **State Management:**
   - React state variables track purchase status
   - `purchaseInitiated` flag prevents processing unintended purchases
   - `isPurchasing` flag controls loading UI

---

## Complete Purchase Flow (Step-by-Step)

### Phase 1: User Interaction

#### Location: Any of the three purchase screens

**User Action:**
- User selects a subscription plan (Basic or Plus)
- User selects billing cycle (monthly or quarterly)
- User taps "Continue" or "Purchase Subscription" button

**Code Flow:**
```typescript
// Example from app/subscription.tsx line 558
handlePurchaseButtonPress = async () => {
  // 1. Validation checks
  if (!selectedPlan || !selectedCycle || !user?.id) return;
  
  // 2. Check subscription restrictions
  // (prevents downgrades, duplicate purchases, etc.)
  
  // 3. Check IAP availability
  if (!isIAPAvailable() || iapStatus === 'unavailable') {
    Alert.alert('In-App Purchases Unavailable');
    return;
  }
  
  // 4. Set loading state
  setIsPurchasing(true);
  setPurchaseInitiated(false); // Reset flag
  
  // 5. Determine product ID
  const productId = selectedCycle === 'quarterly'
    ? 'execudex.plus.quarterly'
    : 'execudex.plus.monthly';
  
  // 6. CRITICAL: Set flag BEFORE calling Apple
  setPurchaseInitiated(true);
  
  // 7. Call purchase service
  await iapService.purchaseSubscription(productId);
}
```

**Key Points:**
- `purchaseInitiated` flag is set **BEFORE** calling `purchaseSubscription()` to prevent race conditions
- Product ID is determined from user's plan/cycle selection
- All validation happens before any IAP calls

---

### Phase 2: IAP Service Initialization

#### Location: `services/iapService.ts` - `purchaseSubscription()` method

**Step 1: Lazy Module Loading**
```typescript
// Line 175: Lazy-load IAP module
lazyLoadIAPModule();

// This function:
// - Checks if module already loaded
// - Detects Expo Go environment (IAP not available)
// - Requires 'react-native-iap' module
// - Extracts functions: initConnection, requestPurchase, fetchProducts, etc.
```

**Step 2: Module Availability Check**
```typescript
// Line 178: Verify module loaded successfully
if (!RNIap || !initConnection) {
  throw new Error('IAP module failed to load');
}
```

**Step 3: Service Initialization**
```typescript
// Line 192-194: Ensure service is initialized
if (!this.isInitialized) {
  await this.initialize();
}

// initialize() does:
// 1. Calls initConnection() - connects to App Store
// 2. Verifies requestPurchase API is available
// 3. Sets this.isInitialized = true
// 4. Marks purchase API as ready
```

**Step 4: Product Validation (Non-Blocking)**
```typescript
// Line 201-225: Try to validate product exists
if (fetchProducts) {
  try {
    const products = await fetchProducts({ skus: [productId], type: 'subs' });
    // Check if product found
    // If not found, log warning but CONTINUE (don't block)
  } catch (fetchError) {
    // Log warning but CONTINUE (don't block purchase)
    // Apple will handle error if product doesn't exist
  }
}
```

**Key Points:**
- Product fetch is **non-blocking** - won't prevent purchase if it fails
- This prevents production issues where product fetch might timeout
- Apple will show error if product doesn't exist

---

### Phase 3: Apple Purchase Dialog

#### Location: `services/iapService.ts` - `requestPurchase()` call

**The Critical Call:**
```typescript
// Line 230-240: Call Apple's purchase API
const purchasePromise = requestPurchase({
  type: 'subs',
  request: {
    ios: { sku: productId },
    android: { skus: [productId], subscriptionOffers: [] },
  },
});

// Add 30-second timeout to prevent infinite hanging
const timeoutPromise = new Promise((_, reject) => {
  setTimeout(() => {
    reject(new Error('Purchase request timed out'));
  }, 30000);
});

await Promise.race([purchasePromise, timeoutPromise]);
```

**What Happens:**
1. `requestPurchase()` is called with product ID
2. This triggers Apple's native StoreKit API
3. **Apple's purchase sheet should appear** (this is what's failing in production)
4. User sees subscription details, price, terms
5. User confirms or cancels
6. Promise resolves when user completes action

**If Timeout Occurs:**
- After 30 seconds, timeout promise rejects
- Error thrown: "Purchase request timed out"
- This indicates Apple's dialog never appeared

**Common Failure Points:**
- Product ID doesn't exist in App Store Connect
- App not properly signed/provisioned
- IAP capability not enabled in Xcode
- Network issues preventing connection to App Store
- Sandbox account issues (in TestFlight)

---

### Phase 4: Purchase Listener Receives Result

#### Location: Purchase listeners set up in each screen's `useEffect`

**Listener Setup:**
```typescript
// Example from app/subscription.tsx line 176
const cleanup = iapService.setupPurchaseListeners(
  async (purchase) => {
    // SUCCESS handler - called when purchase completes
  },
  async (error) => {
    // ERROR handler - called when purchase fails
  }
);
```

**Success Handler Flow:**
```typescript
// Line 177-211: Purchase success handler
async (purchase) => {
  // 1. Check purchaseInitiated flag
  if (!purchaseInitiated) {
    console.log('⚠️ Ignoring purchase - not initiated by user');
    return; // Exit early - prevents processing unintended purchases
  }
  
  // 2. Extract transaction data
  const transactionId = purchase.originalTransactionId || purchase.transactionId;
  const receiptData = purchase.transactionReceipt; // Base64 encoded receipt
  
  // 3. Verify receipt with Apple servers
  const verificationResult = await iapService.verifyReceiptAndUpdateSubscription(
    user.id,
    receiptData
  );
  
  // 4. Update Supabase with subscription info
  await updateSubscriptionInSupabase(plan, cycle, transactionId, purchase);
  
  // 5. Reset UI state
  setIsPurchasing(false);
  setPurchaseInitiated(false);
}
```

**Error Handler Flow:**
```typescript
// Line 212-235: Purchase error handler
async (error) => {
  // Check error codes:
  // - E_USER_CANCELLED: User tapped cancel
  // - E_ALREADY_OWNED: Subscription already purchased
  // - Other codes: Various purchase failures
  
  // Show appropriate error message
  // Reset UI state
}
```

**Key Points:**
- `purchaseInitiated` flag prevents processing purchases not initiated by current user
- Receipt verification happens **before** updating database
- Transaction ID is extracted (prioritizes `originalTransactionId` for renewals)

---

### Phase 5: Receipt Verification

#### Location: `services/iapService.ts` - `verifyReceiptAndUpdateSubscription()`

**Verification Flow:**
```typescript
// Line 445-497: Receipt verification
async verifyReceiptAndUpdateSubscription(userId, receiptData) {
  // 1. Create timeout (10 seconds)
  const timeoutPromise = new Promise((resolve) => {
    setTimeout(() => {
      resolve({ success: false, error: 'Verification timed out' });
    }, 10000);
  });
  
  // 2. Call backend verification function
  const verificationPromise = getSupabaseClient().functions.invoke('verify_receipt', {
    body: { receiptData, userId }
  });
  
  // 3. Race against timeout
  const result = await Promise.race([verificationPromise, timeoutPromise]);
  
  // 4. Return success/failure
  return { success: true/false, error?: string };
}
```

**Backend Verification:**
```typescript
// Location: supabase/functions/verify_receipt/index.ts

// 1. Receives receiptData (base64 string) and userId
// 2. Calls Apple's verifyReceipt API:
//    - Production: https://buy.itunes.apple.com/verifyReceipt
//    - Sandbox: https://sandbox.itunes.apple.com/verifyReceipt
// 3. Apple returns receipt validation response
// 4. Extracts subscription info from receipt
// 5. Updates user record in Supabase:
//    - plan: 'basic' | 'plus'
//    - cycle: 'monthly' | 'quarterly'
//    - last_transaction_id: originalTransactionId
//    - last_purchase_date: purchase timestamp
//    - receipt_validated: true
```

**Receipt Structure (StoreKit 1):**
```json
{
  "status": 0,
  "receipt": {
    "in_app": [
      {
        "product_id": "execudex.plus.monthly",
        "transaction_id": "1000000123456789",
        "original_transaction_id": "1000000123456789",
        "purchase_date_ms": "1234567890000",
        "expires_date_ms": "1234567890000"
      }
    ]
  }
}
```

**Key Points:**
- Verification happens server-side for security
- Uses Apple's official verifyReceipt API (StoreKit 1)
- Automatically detects sandbox vs production receipts
- Extracts transaction IDs for tracking renewals

---

### Phase 6: Database Update

#### Location: Each screen's `updateSubscriptionInSupabase()` function

**Update Flow:**
```typescript
// Example from app/subscription.tsx line 486
async updateSubscriptionInSupabase(plan, cycle, transactionId, purchase) {
  // 1. Update user record
  const { error } = await supabase
    .from('users')
    .update({
      plan: plan,
      cycle: cycle,
      last_transaction_id: transactionId,
      last_purchase_date: purchaseDate,
      plus_til: expiryDate, // Calculated from cycle
      receipt_validated: true
    })
    .eq('uuid', user.id);
  
  // 2. Log subscription change
  await supabase
    .from('users')
    .update({
      sub_logs: `${new Date().toISOString()} | PURCHASE | ${plan} ${cycle} | TxnID: ${transactionId}`
    });
  
  // 3. Handle errors with retry logic
  if (error) {
    // Retry up to 3 times
  }
}
```

**Database Fields Updated:**
- `plan`: 'basic' | 'plus'
- `cycle`: 'monthly' | 'quarterly'
- `last_transaction_id`: Apple's originalTransactionId (stays constant across renewals)
- `last_purchase_date`: Timestamp of purchase
- `plus_til`: Calculated expiry date based on cycle
- `receipt_validated`: Boolean flag
- `sub_logs`: Audit trail of subscription changes

---

## State Management

### React State Variables

**In Each Purchase Screen:**
```typescript
const [isPurchasing, setIsPurchasing] = useState(false);
const [purchaseInitiated, setPurchaseInitiated] = useState(false);
const [iapStatus, setIapStatus] = useState<'loading' | 'available' | 'unavailable'>('loading');
const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
const [selectedCycle, setSelectedCycle] = useState<string | null>(null);
```

**State Flow:**
1. **Initial:** `isPurchasing = false`, `purchaseInitiated = false`
2. **Button Tap:** `isPurchasing = true`, `purchaseInitiated = false`
3. **Before Purchase Call:** `purchaseInitiated = true` (CRITICAL TIMING)
4. **Purchase Completes:** Listener processes, then `isPurchasing = false`, `purchaseInitiated = false`
5. **Error:** `isPurchasing = false`, `purchaseInitiated = false`, error shown

**Why `purchaseInitiated` Flag:**
- Prevents processing purchases not initiated by current user
- Prevents duplicate processing of same transaction
- Must be set **BEFORE** `requestPurchase()` to avoid race conditions
- If purchase completes before flag is set, listener ignores it

---

## Error Handling

### Common Error Scenarios

**1. Product Not Available**
- **Cause:** Product ID doesn't exist in App Store Connect
- **Detection:** Product fetch returns empty (non-blocking now)
- **User Experience:** Apple shows error dialog
- **Code:** Error thrown from `requestPurchase()`

**2. User Cancels**
- **Cause:** User taps "Cancel" on Apple's purchase sheet
- **Detection:** Error code `E_USER_CANCELLED`
- **User Experience:** No error shown (expected behavior)
- **Code:** Caught in error handler, silently handled

**3. Already Owned**
- **Cause:** User already has this subscription
- **Detection:** Error code `E_ALREADY_OWNED`
- **User Experience:** Alert shown, subscription restored
- **Code:** Special handling in error listener

**4. Network Timeout**
- **Cause:** Network issues preventing App Store connection
- **Detection:** 30-second timeout on `requestPurchase()`
- **User Experience:** Error: "Purchase request timed out"
- **Code:** Timeout promise rejects

**5. Receipt Verification Fails**
- **Cause:** Backend can't verify receipt with Apple
- **Detection:** `verifyReceiptAndUpdateSubscription()` returns `success: false`
- **User Experience:** Error alert, purchase not activated
- **Code:** Error thrown in purchase success handler

**6. Database Update Fails**
- **Cause:** Supabase update fails (network, permissions, etc.)
- **Detection:** Supabase returns error
- **User Experience:** Retry logic attempts 3 times, then shows success message with note to contact support
- **Code:** Retry logic in `updateSubscriptionInSupabase()`

---

## Production Issues & Fixes

### Issue: Purchase Dialog Never Appears (Endless Loading)

**Symptoms:**
- User taps purchase button
- Loading spinner appears
- Apple's purchase sheet never shows
- Spinner continues indefinitely

**Root Causes (Fixed):**

1. **Product Fetch Blocking Purchase**
   - **Problem:** Product fetch failed, throwing error before `requestPurchase()` was called
   - **Fix:** Made product fetch non-blocking - logs warning but continues
   - **Location:** `services/iapService.ts` line 201-225

2. **Missing Timeout on requestPurchase**
   - **Problem:** If `requestPurchase()` hangs, no timeout to detect it
   - **Fix:** Added 30-second timeout with Promise.race()
   - **Location:** `services/iapService.ts` line 230-240

3. **Initialization Not Properly Awaited**
   - **Problem:** Purchase called before initialization completed
   - **Fix:** Added explicit initialization check and await
   - **Location:** `services/iapService.ts` line 192-194

4. **Race Condition with purchaseInitiated Flag**
   - **Problem:** Flag set after `requestPurchase()`, causing listener to ignore purchase
   - **Fix:** Flag set BEFORE `requestPurchase()` in all three screens
   - **Location:** All three purchase entry points

**Additional Improvements:**
- Enhanced logging throughout purchase flow
- Better error messages for different failure scenarios
- Non-blocking product validation
- Explicit initialization checks

---

## Product IDs

### Current Products

```typescript
const SUBSCRIPTION_PRODUCTS = {
  BASIC_MONTHLY: 'execudex.basic',
  PLUS_MONTHLY: 'execudex.plus.monthly',
  PLUS_QUARTERLY: 'execudex.plus.quarterly',
};
```

**Product ID Format:**
- Reverse domain notation (com.company.product)
- Must match exactly in App Store Connect
- Case-sensitive
- No environment switching (same IDs for dev/prod/sandbox)

---

## StoreKit Version

### Current: StoreKit 1 (Deprecated)

**Indicators:**
- Uses `transactionReceipt` (base64 encoded)
- Uses `originalTransactionId` / `transactionId`
- Uses `finishTransaction()` API
- Uses Apple's verifyReceipt API endpoint
- Receipt validation via legacy API

**Why Not StoreKit 2:**
- Code was written for StoreKit 1
- `react-native-iap` v14 supports both, but code uses StoreKit 1 APIs
- Migration would require significant refactoring

**Future Considerations:**
- Apple deprecated StoreKit 1 in iOS 18
- Still works but not future-proof
- Should migrate to StoreKit 2 for long-term support

---

## Webhook Integration

### Apple Server-to-Server Notifications

**Location:** `supabase/functions/apple_webhook/index.ts`

**Purpose:**
- Receives notifications from Apple about subscription events
- Handles renewals, cancellations, refunds, etc.
- Updates database when subscription status changes

**Notification Types:**
- `INITIAL_BUY`: First purchase
- `DID_RENEW`: Subscription renewed
- `DID_FAIL_TO_RENEW`: Renewal failed
- `CANCEL`: Subscription cancelled
- `REFUND`: Purchase refunded

**Flow:**
1. Apple sends JWT-signed notification to webhook URL
2. Webhook decodes JWT (contains transaction info)
3. Finds user by `originalTransactionId`
4. Updates subscription status in database
5. Logs event to `sub_logs`

**Key Difference:**
- Webhook uses **JWT tokens** (StoreKit 2 format)
- App uses **base64 receipts** (StoreKit 1 format)
- Both work together - webhook handles server-side events

---

## Testing & Debugging

### Logging Points

**Critical Logs to Monitor:**
1. `🔵 [IAP] Purchase button tapped` - User initiated purchase
2. `🔵 [IAP] Starting purchase for product` - Service received request
3. `🔵 [IAP] Module loaded` - IAP module available
4. `🔵 [IAP] Not initialized, initializing now` - Service initializing
5. `✅ [IAP] IAP service initialized successfully` - Initialization complete
6. `🔵 [IAP] Validating product availability` - Product fetch starting
7. `🔵 [IAP] Product validation result` - Product fetch result
8. `🔵 [IAP] Calling requestPurchase` - About to call Apple
9. `🔵 [IAP] requestPurchase promise resolved` - Apple call completed
10. `🔵 [IAP] Purchase listener received` - Purchase completed
11. `🔐 Verifying receipt with Apple` - Receipt verification starting
12. `✅ Receipt verified successfully` - Verification complete

**Failure Patterns:**
- **No prompt:** Logs stop at step 8 (requestPurchase never resolves)
- **Prompt ignored:** Step 10 shows `purchaseInitiated: false`
- **Infinite loading:** Logs stop at step 11 (verification hangs)

---

## Security Considerations

### Receipt Validation

**Why Server-Side:**
- Prevents client-side tampering
- Validates with Apple's official API
- Extracts transaction IDs securely
- Updates database with verified data

**Receipt Data:**
- Base64 encoded receipt from StoreKit
- Contains all purchase information
- Signed by Apple (can't be forged)
- Validated against Apple's servers

**Transaction ID Tracking:**
- `originalTransactionId`: Stays constant across renewals (used for tracking)
- `transactionId`: Changes with each renewal (used for individual transactions)
- Both stored in database for audit trail

---

## Summary

### Complete Flow Diagram

```
User Taps Purchase Button
    ↓
Validation Checks (plan, cycle, IAP available)
    ↓
Set State (isPurchasing=true, purchaseInitiated=false)
    ↓
Determine Product ID
    ↓
Set purchaseInitiated=true (BEFORE Apple call)
    ↓
iapService.purchaseSubscription()
    ↓
Lazy Load IAP Module
    ↓
Initialize IAP Service (if not initialized)
    ↓
Validate Product (non-blocking)
    ↓
Call requestPurchase() with 30s timeout
    ↓
[APPLE'S PURCHASE SHEET APPEARS] ← This is what's failing
    ↓
User Confirms/Cancels
    ↓
Purchase Listener Receives Result
    ↓
Check purchaseInitiated flag
    ↓
Extract Receipt Data
    ↓
Verify Receipt with Apple (server-side)
    ↓
Update Supabase Database
    ↓
Reset State (isPurchasing=false, purchaseInitiated=false)
    ↓
Show Success/Error Message
```

### Key Takeaways

1. **Three Entry Points:** All follow same flow, just different screens
2. **Flag Timing:** `purchaseInitiated` must be set BEFORE `requestPurchase()`
3. **Non-Blocking Validation:** Product fetch won't block purchase
4. **Timeout Protection:** 30-second timeout prevents infinite hanging
5. **Server-Side Verification:** All receipts validated with Apple
6. **StoreKit 1:** Uses deprecated but functional APIs
7. **Error Handling:** Comprehensive error handling at each step
8. **State Management:** React state tracks purchase progress
9. **Logging:** Extensive logging for debugging production issues

---

## Recent Fixes (2025-01-31)

1. ✅ Made product fetch non-blocking
2. ✅ Added 30-second timeout to requestPurchase()
3. ✅ Enhanced initialization error handling
4. ✅ Improved logging throughout purchase flow
5. ✅ Better error messages for different failure scenarios
6. ✅ Explicit initialization checks before purchase

These fixes address the "endless loading" issue where Apple's purchase dialog never appears.

