# EXC_BAD_ACCESS: Exception 1, Code 1, Subcode 0 >

**Issue ID:** 7114616940
**Project:** react-native
**Date:** 12/15/2025, 9:33:34 PM

## Root Cause
```
# Root Cause of the Issue

Unsanitized database error objects containing null pointers crash Hermes VM during TurboModule conversion.

### User navigates to profile page, triggering data fetch.
The user interacts with the UI, leading to the rendering of `Index1` and subsequently `Synop` and `Sub4` components, which initiate Supabase data fetching.
(See @app/index1.tsx)

### Sub4 component attempts to fetch card data from Supabase.
The `Sub4` component calls Supabase to fetch card data, which is wrapped in a try/catch block that handles the error object directly.
(See @app/profile/sub4.tsx)

### Supabase query fails, returning an error object with null values.
The Supabase client returns an error object (`error`) to the JavaScript layer. This object, originating from the native layer, contains fields that hold `null` pointers (e.g., from database columns that are null).

### Error object is logged and passed to the native bridge.
The error is caught and logged via `console.error('sub4: card_index fetch error', error);`. This logging operation implicitly passes the complex, unsanitized error object across the React Native bridge (TurboModule) for serialization and display in the native console/Sentry.
(See @app/profile/sub4.tsx)

### TurboModule attempts to convert NSArray (error object) to JSIArray.
The native bridge function `facebook::react::TurboModuleConvertUtils::convertNSArrayToJSIArray` is invoked to serialize the Objective-C error object (which is an NSArray/NSDictionary representation) into a JavaScript object (JSIArray) for the Hermes VM.

### Hermes VM attempts to encode a null pointer value.
During the array conversion, the Hermes VM encounters a `null` pointer within the error object's data structure. The function `hermes::vm::HermesValue32::encodeHermesValue` attempts to process this null value.

### Fatal EXC_BAD_ACCESS crash due to null pointer dereference.
The attempt to encode the null pointer results in an `EXC_BAD_ACCESS` crash, as the native code tries to dereference an invalid memory address (0x0). This is the direct cause of the crash, triggered by the unsanitized error data.
```

## Tags

- **app.device:** 6d025285405573d8e36f1a6cdac9954b65158085
- **appVersion:** 1.0.0
- **device:** iPhone14,7
- **device.class:** high
- **device.family:** iOS
- **deviceId:** 6D05F541-3456-4E01-B126-B8F489019278
- **dist:** 15
- **environment:** production
- **event.environment:** native
- **event.origin:** ios
- **executionEnvironment:** bare
- **expoChannel:** null
- **expoGoVersion:** null
- **expoRuntimeVersion:** null
- **handled:** no
- **level:** fatal
- **mechanism:** mach
- **os:** iOS 18.3.2
- **os.build:** 22D82
- **os.name:** iOS
- **os.rooted:** no
- **release:** com.execudex.app@1.0.0+15
- **user:** id:D278213D-8736-4EF5-8AB4-452512308D57

## Exception

### Exception 1
**Type:** EXC_BAD_ACCESS
**Value:** Exception 1, Code 1, Subcode 0 >
Attempted to dereference null pointer.

#### Stacktrace

```
 hermes::vm::HermesValue32::encodeHermesValue in unknown file [Line null] (In app)
 hermes::vm::ArrayImpl::_setOwnIndexedImpl in unknown file [Line null] (In app)
 hermes::vm::ArrayImpl::_setOwnIndexedImpl in unknown file [Line null] (In app)
 hermes::vm::JSObject::putComputedWithReceiver_RJS in unknown file [Line null] (In app)
 facebook::hermes::(anonymous namespace)::HermesRuntimeImpl::setValueAtIndexImpl in unknown file [Line null] (In app)
 facebook::react::TurboModuleConvertUtils::convertNSArrayToJSIArray in unknown file [Line null] (In app)
 facebook::react::TurboModuleConvertUtils::convertNSExceptionToJSError in unknown file [Line null] (In app)
 facebook::react::ObjCTurboModule::performVoidMethodInvocation in unknown file [Line null] (In app)
 std::__1::__function::__func<T>::operator() in unknown file [Line null] (Not in app)
 _dispatch_call_block_and_release in unknown file [Line null] (Not in app)
 _dispatch_client_callout in unknown file [Line null] (Not in app)
 _dispatch_lane_serial_drain in unknown file [Line null] (Not in app)
 _dispatch_lane_invoke in unknown file [Line null] (Not in app)
 _dispatch_root_queue_drain_deferred_wlh in unknown file [Line null] (Not in app)
 _dispatch_workloop_worker_thread in unknown file [Line null] (Not in app)
 _pthread_wqthread in unknown file [Line null] (Not in app)
```
below is the next set of logs

# WatchdogTermination: The OS watchdog terminated your app, possibly because it overused RAM.

**Issue ID:** 7114620628
**Project:** react-native
**Date:** 12/15/2025, 9:36:29 PM
## Issue Summary
Watchdog Termination due to Suspected RAM Overuse from Rendering Error
**What's wrong:** App terminated by **OS Watchdog**, strongly suggesting **RAM overuse** as the primary failure mode.
**In the trace:** Multiple successful **Supabase API calls** occurred just before termination, indicating data fetching was likely not the bottleneck.

## Root Cause
```
# Root Cause of the Issue

The `fetchCardsByScreen` utility returned all 304 cards when `tier` was unset, causing the component to allocate excessive memory and trigger an OS Watchdog termination.

### User navigates to the profile page, triggering initial data fetch.
The user interaction triggers the mounting of the `Index1` component and subsequent data fetching for the politician profile.
(See @app/index1.tsx)

### Supabase returns a large number of cards (304) for the 'affiliates' screen.
The breadcrumb logs show a successful HEAD request to `card_index` for `screen=eq.affiliates`. The console log later confirms `totalCards: 304`.

```
{'http.query': 'select=*&owner_id=eq.1&is_ppl=eq.true&screen=eq.affiliates&is_active=eq.true', ...}
```

### User taps the 'Affiliates' tab, mounting the Sub3 component.
The touch event in breadcrumb 8 precedes the component error and crash, indicating the user navigated to the memory-intensive page.

```
<breadcrumb_8 type="user" category="touch" level="info">
Touch event within element: Text
```

### Sub3 component fetches cards, but the 'tier' state is initially undefined or empty.
The `tier` state is fetched asynchronously in a separate `useEffect`. During the initial card fetch, `tier` is likely an empty string or undefined, leading to the next critical step.

```typescript
// app/profile/sub3.tsx: useEffect for fetching cards
const cards = await fetchCardsByScreen({ /* ... */ tier: tier });
setCardData(cards);
```
(See @app/profile/sub3.tsx)

### The card fetching utility returns ALL 304 cards due to missing 'tier' value.
The `fetchCardsByScreen` function fails to apply the necessary card limit when `tier` is not explicitly 'hard' or 'soft', causing it to return the entire `sortedCards` array (304 cards).

```typescript
// utils/cardData.ts: fetchCardsByScreen
// If tier is 'base' or not specified, return all cards.
if (tier?.toLowerCase() === 'base' || !tier) {
  return sortedCards; // Returns ALL active cards (304 in this case)
}
```
(See @utils/cardData.ts)

### Sub3 component stores 304 card objects in state, triggering a massive re-render.
The `cardData` state now holds 304 objects, leading to the creation of hundreds of React components and Animated values in the `renderCards` function, despite the visual limit (`layoutConfig.cardCount`) being small.

```typescript
// app/profile/sub3.tsx: renderCards
// This loop runs 304 times if cardData.length is 304
for (let i = 0; i < Math.min(layoutConfig.cardCount, cardData.length); i++) {
  // ... creates AnimatedPressable, Animated.Value, etc.
}
```
(See @app/profile/sub3.tsx)

### Excessive memory allocation causes OS Watchdog to terminate the application.
The creation and management of hundreds of React components and Animated values under high memory pressure leads to the OS Watchdog termination, confirming RAM overuse.
```

## Tags

- **appVersion:** 1.0.0
- **device:** iPhone14,7
- **device.class:** high
- **device.family:** iOS
- **deviceId:** 0933E31D-B503-4419-B87F-57BE7A658718
- **dist:** 15
- **environment:** production
- **event.environment:** native
- **event.origin:** ios
- **executionEnvironment:** bare
- **expoChannel:** null
- **expoGoVersion:** null
- **expoRuntimeVersion:** null
- **handled:** no
- **level:** fatal
- **mechanism:** watchdog_termination
- **os:** iOS 18.3.2
- **os.build:** 22D82
- **os.name:** iOS
- **os.rooted:** no
- **release:** com.execudex.app@1.0.0+15
- **user:** id:D278213D-8736-4EF5-8AB4-452512308D57

## Exception

### Exception 1
**Type:** WatchdogTermination
**Value:** The OS watchdog terminated your app, possibly because it overused RAM.

