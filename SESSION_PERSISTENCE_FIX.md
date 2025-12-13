# Session Persistence Fix

## Summary
Fixed Supabase auth session persistence across app restarts in React Native/Expo. Users were being logged out prematurely due to race conditions and improper handling of session restore events.

## Root Causes

### 1. Race Condition Between `getSession()` and `onAuthStateChange`
- **Problem**: The `onAuthStateChange` handler was setting `loading = false` on every event, including `INITIAL_SESSION`
- **Impact**: The app could check `if (!session)` and redirect to signin before the session was fully restored from AsyncStorage
- **Fix**: Added explicit handling for `INITIAL_SESSION` event and tracked restore completion separately

### 2. Missing `INITIAL_SESSION` Event Handling
- **Problem**: The `INITIAL_SESSION` event (fired when Supabase restores session from storage) wasn't explicitly handled
- **Impact**: Session restore state wasn't properly tracked, leading to premature redirects
- **Fix**: Added explicit `INITIAL_SESSION` handler that sets session state without prematurely setting loading to false

### 3. Aggressive Error Handling
- **Problem**: Network errors during `getSession()` were clearing the session, even when a valid session existed in AsyncStorage
- **Impact**: Users with valid persisted sessions were logged out if there was a temporary network issue during app startup
- **Fix**: Distinguish between network errors and actual auth errors - only clear session on real auth errors

### 4. No Debugging Visibility
- **Problem**: No logging to track session restore process
- **Impact**: Impossible to debug why users were getting logged out
- **Fix**: Added comprehensive console logging at key points in the restore process

## Files Changed

### 1. `components/AuthProvider.tsx`
**Changes:**
- Added explicit handling for `INITIAL_SESSION` event
- Fixed race condition by tracking `isRestoreComplete` and `initialSessionReceived` flags
- Improved error handling to distinguish network errors from auth errors
- Added comprehensive logging:
  - When session restore begins
  - Result of `getSession()`
  - All auth state changes with event type and session info
  - When restore completes

**Key improvements:**
- Loading state only becomes `false` after session restore is definitively complete
- Network errors during restore no longer clear valid persisted sessions
- Proper sequencing ensures session is restored before routing decisions are made

### 2. `utils/supabase.ts`
**Changes:**
- Added documentation comments explaining the persistence configuration
- No functional changes (configuration was already correct)

**Configuration verified:**
- ✅ `storage: AsyncStorage` - Persists session to AsyncStorage
- ✅ `autoRefreshToken: true` - Automatically refreshes expired tokens
- ✅ `persistSession: true` - Enables session persistence across app restarts
- ✅ `detectSessionInUrl: false` - Correct for React Native
- ✅ `lock: processLock` - Prevents concurrent auth operations

## How to Verify in Dev Client

### Test Session Persistence:
1. **Sign in** to the app with valid credentials
2. **Force-kill the app** (swipe away from recent apps or use dev tools)
3. **Relaunch the app** from the home screen (not from dev tools)
4. **Check console logs** - You should see:
   ```
   [AuthProvider] Starting session restore...
   [AuthProvider] Auth state change: INITIAL_SESSION
   [AuthProvider] INITIAL_SESSION received, session restored from storage
   [AuthProvider] getSession() completed
   [AuthProvider] Session restore complete
   ```
5. **Verify behavior**: User should remain signed in and see the main app (not redirected to signin)

### Test Network Error Handling:
1. **Sign in** to the app
2. **Enable airplane mode** or disable network
3. **Force-kill and relaunch** the app
4. **Check console logs** - Should see network error warning but session should be preserved
5. **Verify behavior**: User should remain signed in (session from AsyncStorage), even though network call failed

### Test Actual Sign Out:
1. **Sign in** to the app
2. **Manually sign out** from profile screen
3. **Force-kill and relaunch** the app
4. **Verify behavior**: User should be on signin screen (no session to restore)

## Expected Console Output

### Successful Session Restore:
```
[AuthProvider] Starting session restore...
[AuthProvider] Auth state change: INITIAL_SESSION { hasSession: true, userId: '...' }
[AuthProvider] INITIAL_SESSION received, session restored from storage
[AuthProvider] getSession() completed { hasSession: true, hasError: false, userId: '...' }
[AuthProvider] Session restore complete { hasSession: true, userId: '...' }
```

### No Session to Restore:
```
[AuthProvider] Starting session restore...
[AuthProvider] Auth state change: INITIAL_SESSION { hasSession: false, userId: undefined }
[AuthProvider] INITIAL_SESSION received, session restored from storage
[AuthProvider] getSession() completed { hasSession: false, hasError: false }
[AuthProvider] Session restore complete { hasSession: false }
```

### Network Error During Restore:
```
[AuthProvider] Starting session restore...
[AuthProvider] Auth state change: INITIAL_SESSION { hasSession: true, userId: '...' }
[AuthProvider] INITIAL_SESSION received, session restored from storage
[AuthProvider] getSession() completed { hasSession: true, hasError: true, errorMessage: 'network error...' }
[AuthProvider] Network error during getSession(), keeping existing session if available
[AuthProvider] Session restore complete { hasSession: true, userId: '...' }
```

## Technical Details

### Session Restore Flow:
1. `AuthProvider` mounts and sets `loading = true`
2. `onAuthStateChange` listener is set up
3. Supabase automatically restores session from AsyncStorage
4. `INITIAL_SESSION` event fires with restored session
5. `getSession()` is called to verify/refresh session
6. Once both complete, `loading = false` and routing proceeds

### Why This Prevents Premature Redirects:
- The `_layout.tsx` checks `if (loading)` before checking `if (!session)`
- With our fix, `loading` only becomes `false` after session restore is complete
- This ensures the session state is accurate before routing decisions are made

## Notes
- No UI changes were made beyond what's necessary for proper session handling
- No navigation structure changes were made
- Users are NOT automatically signed out on refresh/network errors (only on actual auth errors)
- All changes are backward compatible

