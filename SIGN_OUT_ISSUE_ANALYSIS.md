# Sign Out Issue - Detailed Analysis

## Problem Description

**Issue**: When a user signs out from the app, they are being redirected to the home screen (`/(tabs)/home`) instead of staying on the onboarding screen (`/`). The expected behavior is that after signing out, the user should be taken to the onboarding screen where they can choose to sign in again or create a new account.

**Current Behavior**: 
- User clicks "Sign Out" button
- App navigates to onboarding screen (`/`)
- Onboarding screen immediately detects a session (or stale session data) and redirects back to home screen
- User ends up on home screen instead of onboarding

**Expected Behavior**:
- User clicks "Sign Out" button
- Session is cleared in AuthProvider
- App navigates to onboarding screen (`/`)
- Onboarding screen detects no session and stays on onboarding (doesn't redirect)
- User sees the first step of onboarding ("Get Started")

---

## Architecture Overview

The app uses:
- **Expo Router** for navigation
- **Supabase** for authentication with session persistence via AsyncStorage
- **React Context (AuthProvider)** to manage authentication state
- **onAuthStateChange listener** to react to Supabase auth events

---

## Key Files and Their Roles

### 1. `app/(tabs)/profile.tsx` - Sign Out Handler
**Location**: Lines 20-44

**Purpose**: Handles the user's sign out action

**Current Implementation**:
```typescript
const handleSignOut = async () => {
  Alert.alert(
    'Sign Out',
    'Are you sure you want to sign out?',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            console.log('[Profile] Starting sign out...');
            // Sign out - this triggers SIGNED_OUT event in AuthProvider
            await signOut();
            console.log('[Profile] Sign out call completed, waiting for session to clear...');
            
            // Wait a bit for the SIGNED_OUT event to fire and session state to clear
            // The AuthProvider's onAuthStateChange will handle clearing the session
            await new Promise(resolve => setTimeout(resolve, 300));
            
            console.log('[Profile] Navigating to onboarding after sign out');
            router.replace('/');
          } catch (error) {
            console.error('[Profile] Sign out error:', error);
            Alert.alert('Error', 'Failed to sign out. Please try again.');
          }
        },
      },
    ]
  );
};
```

**Flow**:
1. Calls `signOut()` from AuthProvider (which calls Supabase's `auth.signOut()`)
2. Waits 300ms for session state to clear
3. Navigates to `/` (onboarding screen)

**Potential Issue**: The 300ms delay might not be sufficient, or the session state might not be clearing properly before navigation.

---

### 2. `components/AuthProvider.tsx` - Authentication State Management
**Location**: Full file (225 lines)

**Purpose**: Manages authentication state and listens to Supabase auth events

**Key Sections**:

#### Session State (Lines 20-22):
```typescript
const [session, setSession] = useState<Session | null>(null);
const [user, setUser] = useState<User | null>(null);
const [loading, setLoading] = useState(true);
```

#### Auth State Change Listener (Lines 24-76):
```typescript
useEffect(() => {
  // ... setup code ...
  
  const {
    data: { subscription },
  } = getSupabaseClient().auth.onAuthStateChange((event, session) => {
    console.log(`[AuthProvider] Auth state change: ${event}`, {
      hasSession: !!session,
      userId: session?.user?.id,
    });

    // Handle INITIAL_SESSION event - this fires when Supabase restores session from storage
    if (event === 'INITIAL_SESSION') {
      console.log('[AuthProvider] INITIAL_SESSION received, session restored from storage');
      initialSessionReceived = true;
      setSession(session);
      setUser(session?.user ?? null);
      return;
    }

    // Handle different auth events
    if (event === 'TOKEN_REFRESHED') {
      setSession(session);
      setUser(session?.user ?? null);
    } else if (event === 'SIGNED_OUT') {
      // User was signed out - clear session
      console.log('[AuthProvider] User signed out');
      setSession(null);
      setUser(null);
      if (!isRestoreComplete) {
        isRestoreComplete = true;
        setLoading(false);
      }
    } else if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
      setSession(session);
      setUser(session?.user ?? null);
    }

    if (isRestoreComplete) {
      setLoading(false);
    }
  });
  
  // ... getSession() call ...
  
  return () => subscription.unsubscribe();
}, []);
```

**Key Points**:
- When `SIGNED_OUT` event fires, it sets `session` and `user` to `null`
- However, React state updates are asynchronous
- The `onAuthStateChange` callback receives the event, but React state might not update immediately

#### Sign Out Function (Lines 194-202):
```typescript
const signOut = async () => {
  try {
    const { error } = await getSupabaseClient().auth.signOut();
    if (error) throw error;
  } catch (error) {
    console.error('Error signing out:', error);
    throw error;
  }
};
```

**Flow**:
1. Calls Supabase's `auth.signOut()` which:
   - Clears the session from AsyncStorage
   - Triggers the `SIGNED_OUT` event
   - The event listener then updates React state

**Potential Issue**: The `SIGNED_OUT` event fires, but React state update (`setSession(null)`) is asynchronous. The navigation might happen before the state update propagates to components.

---

### 3. `app/index.tsx` - Onboarding Screen
**Location**: Lines 57-199

**Purpose**: The onboarding screen that should display after sign out

**Key Sections**:

#### Session Tracking (Line 64):
```typescript
const previousSessionRef = useRef<boolean>(false); // Track previous session state
```

#### Redirect Logic (Lines 143-199):
```typescript
useEffect(() => {
  const hadSession = previousSessionRef.current;
  const hasSession = !!session?.user?.id;
  
  // Detect logout: had session before, but no session now
  if (!authLoading && hadSession && !hasSession) {
    console.log('[Onboarding] User logged out - resetting to first step');
    setStepIndex(0);
    // Update ref immediately after detecting logout
    previousSessionRef.current = false;
    // Don't check for plan if user just logged out - stay on onboarding
    return;
  }
  
  // Update the ref for next comparison
  previousSessionRef.current = hasSession;
  
  // If no session, don't check for plan or redirect
  if (!hasSession) {
    return;
  }
  
  // Don't check/redirect if user is on payment plan step (stepIndex 8) - let them complete it
  if (stepIndex === 8) {
    return;
  }
  
  // Only check if we have a valid session and auth is not loading
  if (!authLoading && hasSession) {
    const checkUserPlan = async () => {
      try {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase
          .from('users')
          .select('plan')
          .eq('uuid', session.user.id)
          .maybeSingle();
        
        if (error) {
          console.error('[Onboarding] Error checking user plan:', error);
          return; // Stay on onboarding if we can't check
        }
        
        // Only redirect if user has a plan (has completed onboarding)
        const userData = data as { plan?: string } | null;
        if (userData?.plan && userData.plan.trim() !== '') {
          console.log('[Onboarding] User has plan, redirecting to home');
          router.replace('/(tabs)/home');  // ⚠️ THIS IS THE PROBLEM
        } else {
          console.log('[Onboarding] User authenticated but no plan found - staying on onboarding to complete plan selection');
        }
      } catch (error) {
        console.error('[Onboarding] Exception checking user plan:', error);
      }
    };
    
    checkUserPlan();
  }
}, [session, authLoading, router, stepIndex]);
```

**The Problem**:
1. When user signs out and navigates to `/`, the onboarding screen mounts
2. The `useEffect` runs and checks `hasSession = !!session?.user?.id`
3. **CRITICAL**: If the session state hasn't cleared yet (React state update is async), `hasSession` might still be `true`
4. The code then calls `checkUserPlan()` which queries the database
5. If the user had a plan before, it finds the plan and redirects to home
6. Even if the session is cleared, the database query might still succeed if there's a race condition

**Race Condition**:
- `signOut()` is called → Supabase clears session → `SIGNED_OUT` event fires → React state updates (async)
- Navigation happens 300ms later → Onboarding screen mounts → `useEffect` runs
- If React state hasn't updated yet, `session` might still have the old value
- The check `hasSession = !!session?.user?.id` returns `true`
- Plan check runs and redirects to home

---

### 4. `utils/supabase.ts` - Supabase Client Configuration
**Location**: Full file (62 lines)

**Purpose**: Configures Supabase client with session persistence

**Key Configuration** (Lines 31-38):
```typescript
supabaseClient = hasValidSupabaseConfig
  ? createClient(SUPABASE_URL!, SUPABASE_KEY!, {
      auth: {
        storage: AsyncStorage, // Persists session to AsyncStorage
        autoRefreshToken: true, // Automatically refreshes expired tokens
        persistSession: true, // Enables session persistence across app restarts
        detectSessionInUrl: false, // Not needed for React Native
        lock: processLock, // Prevents concurrent auth operations
      },
    })
```

**Important**: `persistSession: true` means sessions are stored in AsyncStorage. When `auth.signOut()` is called, it should clear this storage, but there might be timing issues.

---

## Execution Flow (Current - Broken)

```
1. User clicks "Sign Out" button
   ↓
2. handleSignOut() in profile.tsx executes
   ↓
3. Calls signOut() from AuthProvider
   ↓
4. AuthProvider.signOut() calls getSupabaseClient().auth.signOut()
   ↓
5. Supabase clears session from AsyncStorage
   ↓
6. Supabase triggers SIGNED_OUT event
   ↓
7. AuthProvider's onAuthStateChange listener receives SIGNED_OUT event
   ↓
8. AuthProvider calls setSession(null) and setUser(null) [ASYNC STATE UPDATE]
   ↓
9. handleSignOut() waits 300ms
   ↓
10. handleSignOut() calls router.replace('/')
    ↓
11. Onboarding screen (app/index.tsx) mounts
    ↓
12. Onboarding screen's useEffect runs
    ↓
13. Checks: hasSession = !!session?.user?.id
    ⚠️ PROBLEM: session might still have old value (React state update not propagated yet)
    ↓
14. If hasSession is true:
    - Calls checkUserPlan()
    - Queries database for user's plan
    - If plan exists, redirects to home
    ↓
15. User ends up on home screen instead of onboarding
```

---

## Root Cause Analysis

### Primary Issue: Race Condition Between State Update and Navigation

1. **React State Updates Are Asynchronous**: When `setSession(null)` is called in AuthProvider, React doesn't immediately update the state. The state update is scheduled and happens in the next render cycle.

2. **Navigation Happens Too Early**: The 300ms delay might not be sufficient, or the navigation might happen before React has re-rendered with the updated state.

3. **Stale Session Data**: When the onboarding screen's `useEffect` runs, it might be reading a stale `session` value from the context that hasn't been updated yet.

4. **Database Query Still Works**: Even if the session is cleared in Supabase, there might be a brief window where:
   - The session token is still valid
   - The database query succeeds
   - The plan is found and redirect happens

### Secondary Issue: Session Persistence

The app is configured with `persistSession: true`, which means:
- Sessions are stored in AsyncStorage
- On app restart, sessions are restored
- When signing out, AsyncStorage should be cleared, but there might be timing issues

---

## Potential Solutions

### Solution 1: Wait for Session State to Actually Clear
Instead of a fixed 300ms delay, wait for the session state to actually be null:

```typescript
// In profile.tsx
onPress: async () => {
  await signOut();
  
  // Wait for session to actually clear
  let attempts = 0;
  while (session && attempts < 10) {
    await new Promise(resolve => setTimeout(resolve, 100));
    attempts++;
  }
  
  router.replace('/');
}
```

**Problem**: This requires access to `session` from `useAuth()`, which is already available in the component.

### Solution 2: Use a Sign-Out Flag
Add a flag to AuthProvider that indicates sign-out is in progress:

```typescript
// In AuthProvider
const [isSigningOut, setIsSigningOut] = useState(false);

const signOut = async () => {
  setIsSigningOut(true);
  try {
    const { error } = await getSupabaseClient().auth.signOut();
    if (error) throw error;
  } finally {
    setIsSigningOut(false);
  }
};
```

Then in onboarding screen, check this flag and don't redirect if sign-out is in progress.

### Solution 3: Clear Session Synchronously Before Navigation
In the sign-out handler, directly clear the session state before navigating:

```typescript
// This won't work because signOut is in AuthProvider, not accessible directly
```

### Solution 4: Check Session from Supabase Directly
In the onboarding screen, check the session directly from Supabase instead of relying on React state:

```typescript
// In onboarding screen useEffect
const checkSession = async () => {
  const { data: { session } } = await getSupabaseClient().auth.getSession();
  if (!session) {
    // No session, stay on onboarding
    return;
  }
  // Check plan...
};
```

### Solution 5: Use Navigation State to Prevent Redirect
Add a navigation parameter or state that indicates we're coming from sign-out:

```typescript
// In profile.tsx
router.replace({
  pathname: '/',
  params: { fromSignOut: 'true' }
});

// In onboarding screen
if (params.fromSignOut === 'true') {
  // Don't check for plan, stay on onboarding
  return;
}
```

---

## Recommended Fix

**Best Approach**: Combine Solution 2 and Solution 4:

1. Add an `isSigningOut` flag to AuthProvider
2. In the onboarding screen, check this flag and also verify session directly from Supabase
3. Only redirect if:
   - `isSigningOut` is false (sign-out is complete)
   - AND session from Supabase is null/undefined
   - AND session from context is null/undefined

This ensures we're checking the actual session state, not just relying on React state updates.

---

## Testing Checklist

To verify the fix works:

1. ✅ Sign in to the app
2. ✅ Navigate to profile screen
3. ✅ Click "Sign Out"
4. ✅ Verify: Should navigate to onboarding screen (`/`)
5. ✅ Verify: Should NOT redirect to home screen
6. ✅ Verify: Should see "Get Started" step of onboarding
7. ✅ Verify: Can proceed through onboarding or click "Sign In" link

---

## Additional Context

- **Session Persistence**: The app uses AsyncStorage to persist sessions across app restarts. This was implemented to prevent users from being logged out when the app closes.
- **Previous Working State**: The user mentioned that sign-out was working before, but changes were made to handle session persistence. The current issue likely stems from those changes.
- **Related Files**: 
  - `SESSION_PERSISTENCE_FIX.md` - Documents the session persistence implementation
  - `app/_layout.tsx` - Root layout that wraps app in AuthProvider

---

## Code Locations Summary

| File | Lines | Purpose |
|------|-------|---------|
| `app/(tabs)/profile.tsx` | 20-44 | Sign out button handler |
| `components/AuthProvider.tsx` | 24-76 | Auth state change listener |
| `components/AuthProvider.tsx` | 194-202 | Sign out function |
| `app/index.tsx` | 143-199 | Onboarding redirect logic |
| `utils/supabase.ts` | 31-38 | Session persistence config |

---

## Questions for Analysis

1. Why is the session state not clearing before navigation?
2. Is the 300ms delay sufficient, or should we wait for actual state update?
3. Should we check session directly from Supabase instead of React state?
4. Is there a way to synchronously clear the session before navigation?
5. Would adding a sign-out flag help prevent the redirect?










