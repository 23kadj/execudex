# iOS In-App Purchase Flow - Diagnostic Report

**Date:** 2025-01-31  
**Issue:** Apple Review reports "no prompt is displayed when tapped to purchase subscriptions" in Sandbox/TestFlight

---

## 1. Stack & Library Identification

### IAP Library
- **Library:** `react-native-iap`
- **Version:** `^14.4.16` (from `package.json` line 44)
- **Initialization:** Lazy-loaded via `services/iapService.ts` and `iap.apple.ts`
- **StoreKit Version:** Uses `requestPurchase` API (v14+), which supports both StoreKit 1 and StoreKit 2

### Key Files
- `services/iapService.ts` - Main IAP service wrapper (singleton)
- `iap.apple.ts` - Legacy IAP module (still used in some screens)
- `types/iapTypes.ts` - Type definitions
- `utils/iapAvailability.ts` - Environment detection

### Product IDs
- `execudex.basic` - Basic monthly subscription
- `execudex.plus.monthly` - Plus monthly subscription
- `execudex.plus.quarterly` - Plus quarterly subscription

---

## 2. Purchase Entry Points

### Entry Point 1: Onboarding Screen (`app/index.tsx`)
- **UI Component:** `Pressable` with text "Continue" (line 2865)
- **Handler:** Inline `onPress` async function (line 2867)
- **Purchase Function:** `iapService.purchaseSubscription(productId)` (line 2915)
- **Button State:** Disabled if `!plan || !cycle` (line 2866)
- **Loading State:** `isPurchasing` (line 2896)

**Flow:**
1. User selects plan/cycle
2. Clicks "Continue"
3. Checks `isIAPAvailable()` (line 2886) - **GATING POINT**
4. Sets `isPurchasing = true`, `purchaseInitiated = false`
5. Calls `iapService.initialize()` (line 2899)
6. Determines `productId` from plan/cycle (lines 2902-2913)
7. Calls `iapService.purchaseSubscription(productId)` (line 2915)
8. Sets `purchaseInitiated = true` (line 2918) - **AFTER** purchase call succeeds

### Entry Point 2: Subscription Screen (`app/subscription.tsx`)
- **UI Component:** `TouchableOpacity` with dynamic text (line 829)
- **Handler:** `handlePurchaseButtonPress()` (line 547)
- **Purchase Function:** `iapService.purchaseSubscription(productId)` (line 596)
- **Button State:** Disabled if `!selectedPlan || !selectedCycle || isPurchasing` (line 835)
- **Loading State:** `isPurchasing` (line 584)

**Flow:**
1. User selects plan/cycle
2. Clicks "Purchase Subscription" button
3. Validates `selectedPlan` and `selectedCycle` (line 548) - **GATING POINT**
4. Checks current subscription status (lines 552-564) - **GATING POINT**
5. Checks `isIAPAvailable()` (line 576) - **GATING POINT**
6. Sets `isPurchasing = true`, `purchaseInitiated = false`
7. Determines `productId` (lines 589-591)
8. Calls `iapService.purchaseSubscription(productId)` (line 596)
9. Sets `purchaseInitiated = true` (line 599) - **AFTER** purchase call succeeds

### Entry Point 3: Subs Screen (`app/subs.tsx`)
- **UI Component:** `TouchableOpacity` with text "Purchase Subscription" (line 999)
- **Handler:** `handlePurchaseButtonPress()` (line 702)
- **Purchase Function:** `iapService.purchaseSubscription(productId)` (line 759)
- **Button State:** Disabled if `!selectedPlan || !selectedCycle || isPurchasing` (line 1005)
- **Loading State:** `isPurchasing` (line 741)

**Flow:** Similar to Entry Point 2 (lines 703-775)

### Restore Purchases
- **Location:** All three screens have "Restore Purchases" buttons
- **Handler:** `handleRestorePurchases()` in each screen
- **Function:** `restorePurchases()` from `iap.apple.ts` or `iapService.restorePurchases()`

---

## 3. Product Loading / Offerings Fetching

### Current Implementation
**CRITICAL FINDING:** Products are NOT pre-fetched before purchase.

- **No product fetching on screen mount** - Screens initialize IAP but don't fetch products
- **Product fetching only happens inside `purchaseSubscription()`** (line 181-191 in `services/iapService.ts`)
- **Conditional fetch:** Only if `fetchProducts` is available (line 181)

### What Happens If Products Are Empty
1. **In `purchaseSubscription()`** (line 182-191):
   - Fetches products with `fetchProducts({ skus: [productId], type: 'subs' })`
   - If product not found, throws error: `"Product ${productId} is not available from the App Store"`
   - **This error would prevent `requestPurchase()` from being called**
   - **This could cause "no prompt displayed" if product fetch fails silently or times out**

### Product ID Storage
- **Hardcoded:** Product IDs are hardcoded strings in code
- **No environment switching:** Same product IDs used for dev/prod/sandbox
- **String mismatch risk:** If App Store Connect product IDs don't match exactly, fetch will fail

### Product Fetch Timing
- **Lazy:** Only fetched when user taps purchase button
- **No pre-validation:** UI doesn't check if products exist before showing purchase button
- **No loading state:** UI doesn't show "loading products" state

---

## 4. Purchase Call Path

### Full Call Chain

#### Onboarding (`app/index.tsx`):
```
Continue Button (line 2867)
  → Check isIAPAvailable() (line 2886)
  → iapService.initialize() (line 2899)
  → iapService.purchaseSubscription(productId) (line 2915)
    → lazyLoadIAPModule() (line 155)
    → Check RNIap/initConnection (line 158)
    → Ensure initialized (line 172-174)
    → Check requestPurchase exists (line 176)
    → fetchProducts() [OPTIONAL] (line 182)
    → requestPurchase({ type: 'subs', request: { ios: { sku: productId } } }) (line 194)
  → Set purchaseInitiated = true (line 2918)
```

#### Subscription Screens (`app/subscription.tsx`, `app/subs.tsx`):
```
Purchase Button (line 547/702)
  → Validate selectedPlan/selectedCycle (line 548/703)
  → Check subscription restrictions (lines 552-574/707-729)
  → Check isIAPAvailable() (line 576/733)
  → iapService.purchaseSubscription(productId) (line 596/759)
    → [Same chain as above]
  → Set purchaseInitiated = true (line 599/762)
```

### Exact Purchase API Call
**File:** `services/iapService.ts` line 194-201
```typescript
await requestPurchase({
  type: 'subs',
  request: {
    ios: { sku: productId },
    android: { skus: [productId], subscriptionOffers: [] },
  },
});
```

**Parameters:**
- `type: 'subs'` - Subscription type
- `sku: productId` - Product ID (e.g., 'execudex.plus.monthly')
- **No offer token specified** - Uses default subscription offer
- **No trial handling** - Relies on App Store Connect configuration

### Error Handling
**File:** `services/iapService.ts` line 203-211
```typescript
catch (error: any) {
  console.error('❌ Purchase failed:', error);
  if (error.code === 'E_USER_CANCELLED') {
    throw new Error('Purchase was cancelled by user');
  }
  throw new Error(error.message || 'Purchase failed');
}
```

**Issues:**
- Errors are re-thrown, caught by UI handlers
- UI handlers set `isPurchasing = false` on error
- **BUT:** If error occurs AFTER `requestPurchase()` is called but BEFORE Apple sheet appears, `purchaseInitiated` might not be set, causing listener to ignore the purchase

---

## 5. Pre-Purchase Gating Risks (Can Cause "No Prompt Displayed")

### Gating Check 1: `isIAPAvailable()`
**Location:** `utils/iapAvailability.ts` line 11-33

**Logic:**
- Returns `false` if `Constants.executionEnvironment === 'storeClient'` (Expo Go)
- Returns `true` if module loaded successfully
- Returns `true` optimistically if not yet attempted

**Risk:** In TestFlight, if module load fails silently, `isIAPAvailable()` might return `true` but `requestPurchase` is `null`, causing error at line 177 in `iapService.ts`:
```typescript
if (!requestPurchase) {
  throw new Error('In-app purchase request API is unavailable...');
}
```
**This error prevents `requestPurchase()` from being called = "no prompt displayed"**

### Gating Check 2: Product Fetch Failure
**Location:** `services/iapService.ts` line 181-191

**Logic:**
- Fetches product before purchase
- If product not found, throws error: `"Product ${productId} is not available from the App Store"`

**Risk:**
- In sandbox, if product IDs don't match exactly, fetch fails
- If fetch times out or returns empty array, error is thrown
- **This prevents `requestPurchase()` from being called = "no prompt displayed"**

### Gating Check 3: Plan/Cycle Selection
**Location:** All entry points check `!selectedPlan || !selectedCycle`

**Risk:** Low - UI disables button, so this shouldn't be hit

### Gating Check 4: Subscription Status Checks
**Location:** `app/subscription.tsx` lines 552-574, `app/subs.tsx` lines 707-729

**Logic:**
- Blocks purchase if user has active Plus subscription (not Basic)
- Blocks purchase if user has Basic and tries to select Basic again

**Risk:** Medium - If `profileUsage` state is stale or incorrectly loaded, valid purchases might be blocked

### Gating Check 5: IAP Initialization Failure
**Location:** `services/iapService.ts` line 172-174

**Logic:**
- If not initialized, calls `this.initialize()`
- `initialize()` can fail silently (line 114-116)

**Risk:** If initialization fails silently, `this.isInitialized` stays `false`, but code continues. However, `initConnection()` might not have succeeded, causing `requestPurchase()` to fail.

---

## 6. Post-Purchase Blocking Risks (Can Cause Infinite Loading)

### Blocking Point 1: Receipt Verification
**Location:** All `handlePurchaseSuccess()` functions

**Flow:**
1. Purchase listener receives purchase (line 168/264 in screens, line 271 in index.tsx)
2. Checks `purchaseInitiated` flag (line 173/274) - **If false, purchase is ignored**
3. Extracts `receiptData` (line 426/539/287)
4. Calls `iapService.verifyReceiptAndUpdateSubscription()` (line 434/547/294)
5. **AWAITS verification result** - **BLOCKS UI**
6. If verification fails, throws error
7. Only then sets `isPurchasing = false` (line 195/271)

**Risk:**
- **In sandbox, receipt verification can be slow (2-5 seconds)**
- **If verification endpoint is down or slow, user sees loading spinner indefinitely**
- **If verification fails, error is shown but `isPurchasing` might not reset if error handling fails**

### Blocking Point 2: Supabase Update After Verification
**Location:** `app/subscription.tsx` line 448, `app/subs.tsx` line 562

**Flow:**
- After receipt verification, calls `updateSubscriptionInSupabase()`
- This updates user record in Supabase
- **AWAITED** - Blocks UI
- Has retry logic (lines 518-543 in subscription.tsx, 671-698 in subs.tsx)

**Risk:**
- If Supabase is slow, user waits
- If retry also fails, shows alert but might not reset `isPurchasing` properly

### Blocking Point 3: Purchase Listener Setup
**Location:** All screens set up listeners in `useEffect`

**Issue:** Listeners check `purchaseInitiated` flag (line 173/274)
- Flag is set **AFTER** `requestPurchase()` succeeds (line 599/762/2918)
- **If Apple sheet appears but `requestPurchase()` promise hasn't resolved yet, flag might be false when purchase completes**
- **This causes purchase to be ignored, leaving user in loading state**

### Blocking Point 4: Missing `finally` Blocks
**Location:** Purchase listeners

**Issue:** Some error paths don't reset `isPurchasing`:
- `app/subscription.tsx` line 192-198: Has `finally` but only resets if `purchaseInitiated`
- `app/subs.tsx` line 192-198: Same pattern
- `app/index.tsx` line 327-333: Same pattern

**Risk:** If error occurs before `purchaseInitiated` is set, `isPurchasing` might not reset

---

## 7. Sandbox/TestFlight Specifics

### Sandbox Detection
**Location:** `supabase/functions/verify_receipt/index.ts` line 168-205

**Logic:**
- Tries production URL first
- If status `21007` (sandbox receipt), tries sandbox URL
- **Automatic detection - no manual sandbox flag**

### Sandbox-Specific Risks

#### Risk 1: Product ID Mismatch
- Sandbox uses same product IDs as production
- If product IDs in App Store Connect don't match code exactly, fetch fails
- **No environment-based product ID switching**

#### Risk 2: Receipt Verification Timing
- Sandbox receipt verification can be slower than production
- **No timeout on verification call** - can hang indefinitely
- **No retry logic for verification failures**

#### Risk 3: TestFlight vs Sandbox Account
- TestFlight uses sandbox environment
- **No explicit TestFlight detection** - relies on Apple's automatic handling
- If sandbox account isn't properly configured, purchases fail silently

#### Risk 4: Free Trial Handling
- Code doesn't explicitly handle free trials
- Relies on App Store Connect configuration
- **If trial is misconfigured, purchase might fail or behave unexpectedly**

#### Risk 5: Sandbox Receipt Format
- Sandbox receipts might have different structure
- `findValidExecudexSubscriptions()` (line 210 in verify_receipt) filters by product ID and expiry
- **If sandbox receipt format differs, filtering might fail**

---

## 8. UI State + Loading Indicators

### State Variables

#### Onboarding (`app/index.tsx`):
- `isPurchasing` (line 760) - Controls loading spinner
- `purchaseInitiated` (line 761) - Flags if purchase was user-initiated
- `purchaseError` (line 760) - Stores error message
- `iapStatus` (line 256) - 'loading' | 'available' | 'unavailable'

#### Subscription Screens (`app/subscription.tsx`, `app/subs.tsx`):
- `isPurchasing` (line 49) - Controls button disabled state and spinner
- `purchaseInitiated` (line 51) - Flags if purchase was user-initiated
- `iapStatus` (line 52) - 'loading' | 'available' | 'unavailable'
- `selectedPlan` / `selectedCycle` (lines 55-56) - Selected subscription

### Stuck Spinner Root Causes

#### Cause 1: `purchaseInitiated` Flag Race Condition
**Scenario:**
1. User taps purchase button
2. `purchaseInitiated = false` (line 585/742)
3. `requestPurchase()` is called (line 596/759)
4. Apple sheet appears immediately
5. User completes purchase
6. Purchase listener fires
7. **But `purchaseInitiated` is still `false`** (if `requestPurchase()` promise hasn't resolved)
8. Purchase is ignored (line 173/274)
9. `isPurchasing` stays `true` forever

**Fix Needed:** Set `purchaseInitiated = true` **BEFORE** calling `requestPurchase()`, or use a different mechanism

#### Cause 2: Receipt Verification Timeout
**Scenario:**
1. Purchase completes
2. Receipt verification starts (line 434/547/294)
3. Verification hangs (network issue, slow sandbox)
4. User sees spinner indefinitely
5. No timeout, no cancellation

**Fix Needed:** Add timeout to receipt verification

#### Cause 3: Error Handler Doesn't Reset State
**Scenario:**
1. Purchase completes
2. Receipt verification fails
3. Error is thrown (line 440/553/300)
4. Error handler runs (line 185/186/321)
5. **But if `purchaseInitiated` is false, `isPurchasing` doesn't reset** (line 194/195/329)
6. Spinner stays forever

**Fix Needed:** Always reset `isPurchasing` in `finally` block, regardless of `purchaseInitiated`

#### Cause 4: Missing Error Handler
**Scenario:**
1. `requestPurchase()` throws error
2. Error caught in try/catch (line 603/766/2921)
3. `isPurchasing = false` is set (line 605/768/2923)
4. **But if error occurs in listener (not in button handler), no handler resets state**

**Fix Needed:** Ensure all error paths reset `isPurchasing`

---

## 9. Highest-Likelihood Root Causes

### Root Cause #1: Product Fetch Failure (HIGHEST PROBABILITY)
**Why:** 
- Products are fetched inside `purchaseSubscription()` just before calling `requestPurchase()`
- If fetch fails or times out, error is thrown before `requestPurchase()` is called
- Apple reviewer sees button tap but no prompt = "no prompt displayed"

**Evidence:**
- Line 181-191 in `services/iapService.ts` fetches products before purchase
- If product not found, throws error that prevents `requestPurchase()` call
- No pre-fetching means product availability isn't validated until purchase button is tapped

**Diagnosis:**
- Check logs for "Product X is not available from the App Store" errors
- Verify product IDs in App Store Connect match code exactly
- Check if `fetchProducts()` is timing out in sandbox

### Root Cause #2: `purchaseInitiated` Flag Race Condition (HIGH PROBABILITY)
**Why:**
- Flag is set **AFTER** `requestPurchase()` succeeds (line 599/762/2918)
- But Apple sheet can appear before promise resolves
- If purchase completes before flag is set, listener ignores it
- User sees loading spinner forever

**Evidence:**
- Flag set after `await iapService.purchaseSubscription()` (line 599/762/2918)
- Listener checks flag before processing (line 173/274)
- If flag is false, purchase is ignored and `isPurchasing` might not reset

**Diagnosis:**
- Check logs for "⚠️ Ignoring purchase callback - purchase not initiated by user"
- This would indicate purchase completed but flag wasn't set yet

### Root Cause #3: IAP Module Not Properly Loaded in TestFlight (MEDIUM PROBABILITY)
**Why:**
- Lazy loading might fail silently in TestFlight
- `isIAPAvailable()` returns `true` optimistically (line 28 in `iapAvailability.ts`)
- But `requestPurchase` might be `null`, causing error at line 177

**Evidence:**
- `isIAPAvailable()` returns `true` if not yet attempted (line 28)
- But `lazyLoadIAPModule()` might fail to load module
- Error at line 177 prevents `requestPurchase()` call

**Diagnosis:**
- Check logs for "In-app purchase request API is unavailable" errors
- Verify `react-native-iap` module is properly linked in native build

---

## 10. Minimal Change Recommendations

### Priority 1: Fix `purchaseInitiated` Flag Timing
**Change:** Set `purchaseInitiated = true` **BEFORE** calling `requestPurchase()`

**Files:**
- `app/index.tsx` line 2917-2918
- `app/subscription.tsx` line 598-599
- `app/subs.tsx` line 761-762

**Before:**
```typescript
await iapService.purchaseSubscription(productId);
setPurchaseInitiated(true);
```

**After:**
```typescript
setPurchaseInitiated(true); // Set BEFORE purchase call
await iapService.purchaseSubscription(productId);
```

**Rationale:** Ensures flag is set before Apple sheet appears, preventing listener from ignoring purchase

### Priority 2: Add Timeout to Receipt Verification
**Change:** Add timeout wrapper to `verifyReceiptAndUpdateSubscription()`

**File:** `services/iapService.ts` line 418-448

**Add:**
```typescript
async verifyReceiptAndUpdateSubscription(
  userId: string,
  receiptData: string
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('🔐 Verifying receipt with Apple...');
    
    // Add timeout (10 seconds)
    const timeoutPromise = new Promise<{ success: false; error: string }>((resolve) => {
      setTimeout(() => resolve({ success: false, error: 'Receipt verification timed out' }), 10000);
    });
    
    const verificationPromise = getSupabaseClient().functions.invoke('verify_receipt', {
      body: { receiptData, userId }
    });
    
    const { data, error } = await Promise.race([verificationPromise, timeoutPromise]);
    
    // ... rest of function
```

**Rationale:** Prevents infinite loading if verification hangs

### Priority 3: Always Reset `isPurchasing` in Finally
**Change:** Ensure `isPurchasing` is always reset, regardless of `purchaseInitiated`

**Files:**
- `app/index.tsx` line 327-333
- `app/subscription.tsx` line 192-198
- `app/subs.tsx` line 192-198

**Before:**
```typescript
finally {
  if (purchaseInitiated) {
    setIsPurchasing(false);
  }
  setPurchaseInitiated(false);
}
```

**After:**
```typescript
finally {
  setIsPurchasing(false); // Always reset
  setPurchaseInitiated(false);
}
```

**Rationale:** Prevents stuck spinner if error occurs before flag is set

### Priority 4: Pre-Fetch Products on Screen Mount
**Change:** Fetch products when screen mounts to validate availability early

**Files:**
- `app/subscription.tsx` - Add to `useEffect` (line 66)
- `app/subs.tsx` - Add to `useEffect` (line 66)
- `app/index.tsx` - Add to `useEffect` (line 250)

**Add:**
```typescript
useEffect(() => {
  // ... existing code ...
  
  const validateProducts = async () => {
    try {
      const products = await iapService.getAvailableSubscriptions();
      if (products.length === 0) {
        console.warn('⚠️ No products available - IAP may not work');
        setIapStatus('unavailable');
      }
    } catch (error) {
      console.error('Error validating products:', error);
    }
  };
  
  if (iapStatus === 'available') {
    validateProducts();
  }
}, [iapStatus]);
```

**Rationale:** Surfaces product availability issues before user taps purchase

### Priority 5: Improve Error Logging
**Change:** Add more detailed logging around purchase flow

**Files:**
- `services/iapService.ts` line 169, 181, 194
- All purchase button handlers

**Add logs:**
- Before/after `requestPurchase()` call
- Product fetch results
- `purchaseInitiated` flag state
- Receipt verification start/end times

**Rationale:** Helps diagnose issues in TestFlight where debugging is limited

---

## 11. Diagnostic Logging Checklist

Add these logs to confirm diagnosis in one test run:

### Log Point 1: Purchase Button Tap
**Location:** All `handlePurchaseButtonPress()` functions
```typescript
console.log('🔵 [IAP] Purchase button tapped', {
  productId,
  isIAPAvailable: isIAPAvailable(),
  purchaseInitiated: purchaseInitiated,
  isPurchasing: isPurchasing
});
```

### Log Point 2: Before Product Fetch
**Location:** `services/iapService.ts` line 180
```typescript
console.log('🔵 [IAP] About to fetch product', { productId });
```

### Log Point 3: After Product Fetch
**Location:** `services/iapService.ts` line 186
```typescript
console.log('🔵 [IAP] Product fetch result', { 
  found: !!found, 
  productId: found?.id || found?.productId 
});
```

### Log Point 4: Before requestPurchase
**Location:** `services/iapService.ts` line 193
```typescript
console.log('🔵 [IAP] About to call requestPurchase', { productId, type: 'subs' });
```

### Log Point 5: After requestPurchase (if succeeds)
**Location:** `services/iapService.ts` line 201 (after await)
```typescript
console.log('🔵 [IAP] requestPurchase completed successfully');
```

### Log Point 6: Purchase Listener Received
**Location:** All purchase listeners, first line of callback
```typescript
console.log('🔵 [IAP] Purchase listener received', {
  purchaseInitiated,
  transactionId: purchase.originalTransactionId || purchase.transactionId,
  productId: purchase.productId
});
```

### Log Point 7: Receipt Verification Start
**Location:** `services/iapService.ts` line 423
```typescript
console.log('🔵 [IAP] Receipt verification started', { userId, receiptLength: receiptData.length });
```

### Log Point 8: Receipt Verification End
**Location:** `services/iapService.ts` line 442
```typescript
console.log('🔵 [IAP] Receipt verification completed', { success: true });
```

### Expected Log Sequence (Success):
1. 🔵 [IAP] Purchase button tapped
2. 🔵 [IAP] About to fetch product
3. 🔵 [IAP] Product fetch result (found: true)
4. 🔵 [IAP] About to call requestPurchase
5. 🔵 [IAP] requestPurchase completed successfully
6. 🔵 [IAP] Purchase listener received (purchaseInitiated: true)
7. 🔵 [IAP] Receipt verification started
8. 🔵 [IAP] Receipt verification completed

### Failure Patterns to Look For:
- **No prompt:** Logs stop at step 4 (requestPurchase never completes)
- **Prompt but ignored:** Step 6 shows `purchaseInitiated: false`
- **Infinite loading:** Logs stop at step 7 (verification hangs)

---

## Summary

**Most Likely Issue:** Product fetch failure or `purchaseInitiated` flag race condition preventing Apple's purchase sheet from appearing or being processed.

**Key Findings:**
1. Products are not pre-fetched, only validated at purchase time
2. `purchaseInitiated` flag is set AFTER `requestPurchase()` call, creating race condition
3. Receipt verification has no timeout, can hang indefinitely
4. Error handlers don't always reset `isPurchasing` state

**Recommended Fix Order:**
1. Fix `purchaseInitiated` flag timing (immediate)
2. Add receipt verification timeout (immediate)
3. Always reset `isPurchasing` in finally (immediate)
4. Pre-fetch products on mount (nice-to-have)
5. Add diagnostic logging (for testing)

