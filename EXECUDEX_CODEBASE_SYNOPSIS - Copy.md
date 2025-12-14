# Execudex Codebase - Comprehensive Technical Synopsis

## Executive Summary

Execudex is a React Native/Expo app built with Expo Router for navigation. It displays profiles for politicians and legislation, with data fetched from Supabase. The app experiences **instant native crashes (SIGSEGV)** in Preview builds, particularly when navigating to the "See More" metrics screen. Crashes occur **before any transition animation**, suggesting a native module failure during route resolution or component initialization. Search functionality also fails with "failed to load results" errors.

---

## Architecture Overview

### Technology Stack
- **Framework**: Expo SDK ~54.0.28 with Expo Router ~6.0.18
- **React**: 19.1.0
- **React Native**: 0.81.5
- **Navigation**: Expo Router (file-based routing)
- **Database**: Supabase (PostgreSQL) via `@supabase/supabase-js` ^2.54.0
- **State Management**: React Context (AuthProvider)
- **Storage**: AsyncStorage (@react-native-async-storage/async-storage 2.2.0)
- **Build Target**: Preview/Release builds (not development mode)

### Key Architectural Patterns
1. **File-based routing** via Expo Router
2. **Lazy-loaded Supabase client** (to avoid early native module initialization)
3. **Pre-processing navigation** (profile data fetched before navigation via NavigationService)
4. **Global error handlers** (ErrorBoundary, globalErrorHandler, persistentLogger)

---

## Critical Code Paths

### 1. App Initialization Flow

**Entry Point**: `app/_layout.tsx`

```typescript
// Key initialization sequence:
1. SplashScreen.preventAutoHideAsync() - called at module scope
2. initGlobalErrorHandler() - sets up error handlers
3. initDebugFlags() + persistentLogger.init() - async initialization
4. Layout component renders:
   - AuthProvider (wraps app)
   - ErrorOverlayManager
   - Stack navigator with all routes
5. useEffect calls SplashScreen.hideAsync()
```

**Critical Import Chain**:
```
app/_layout.tsx
  → components/AuthProvider.tsx
    → utils/supabase.ts (lazy-loaded via getSupabaseClient())
      → @react-native-async-storage/async-storage (requires() at runtime)
```

**Supabase Client Initialization** (`utils/supabase.ts`):
- Uses **lazy loading** pattern: AsyncStorage is `require()`d only when `getSupabaseClient()` is called
- Client is a singleton cached in module scope
- Auth storage uses AsyncStorage for session persistence
- **Note**: Previous issues with top-level AsyncStorage imports caused splash screen hangs

---

### 2. Navigation Flow - "See More" Crash Path

**Trigger**: User clicks "See Metrics" button in politician profile (`app/profile/synop.tsx`)

**Navigation Code** (`synop.tsx:336-350`):
```typescript
const handleSeeMore = () => {
  Haptics.selectionAsync();  // NATIVE CALL #1
  router.push({
    pathname: '/profile/see-more',
    params: { 
      name: name,
      position: position,
      approval: Number(localApproval ?? 0).toString(),
      disapproval: Number(localDisapproval ?? 0).toString(),
      votes: Number(votes ?? 0).toString(),
      pollSummary: pollSummary || '',
      pollLink: pollLink || ''
    }
  });  // NATIVE CALL #2 - router.push()
};
```

**Target Screen**: `app/profile/see-more.tsx`

**Screen Initialization**:
1. **Module load**: Top-level code runs immediately when route is resolved
   ```typescript
   persistentLogger.log('see-more:module_loaded').catch(() => {});
   ```
2. **Component function called**: React calls the component
3. **First line in component**:
   ```typescript
   const router = useRouter();  // NATIVE HOOK
   const params = useLocalSearchParams();  // NATIVE HOOK
   ```
4. **Logging happens**:
   ```typescript
   persistentLogger.log('see-more:component_enter', {...});
   ```

**Crash Timing**: Crash occurs **instantly** before any UI renders, suggesting:
- Native module failure during route resolution
- Failure in `useRouter()` or `useLocalSearchParams()` hooks
- Failure during module evaluation (before component runs)
- Expo Router native bridge failure

---

### 3. Search Functionality Failure

**Search Entry Point**: `app/(tabs)/exp1.tsx` - `handleSearch()` function

**Search Flow**:
```typescript
const handleSearch = async () => {
  const supabase = getSupabaseClient();  // Lazy-loaded client
  
  // Search politicians
  const { data: pplData, error: pplError } = await supabase
    .from('ppl_index')
    .select('id, name, sub_name, limit_score')
    .or(`name.ilike.%${q}%,sub_name.ilike.%${q}%`)
    .order('limit_score', { ascending: false });

  if (pplError) throw pplError;
  
  // Search legislation (similar query)
  // ... combines results and navigates to /results
};
```

**Error**: "failed to load results" suggests:
- Supabase query failing silently
- Network timeout
- Query syntax error (`.or()` with `ilike` patterns)
- Missing error handling

---

## Key Files and Their Roles

### Core Infrastructure

**`utils/supabase.ts`** (56 lines)
- **Purpose**: Supabase client singleton with lazy AsyncStorage loading
- **Key Function**: `getSupabaseClient()` - lazy-loads AsyncStorage and creates client
- **Critical**: Uses `require()` pattern to defer native module loading
- **Auth Config**: Persists sessions to AsyncStorage, auto-refresh enabled

**`components/AuthProvider.tsx`** (225 lines)
- **Purpose**: React Context provider for auth state
- **Initialization**: Calls `getSupabaseClient().auth.getSession()` on mount
- **Events**: Listens to `onAuthStateChange` (INITIAL_SESSION, TOKEN_REFRESHED, etc.)
- **Critical**: Imports Supabase client (lazy-loaded, safe)

**`utils/persistentLogger.ts`** (238 lines)
- **Purpose**: Dual logging (AsyncStorage + file system)
- **File Logging**: Uses `expo-file-system` to write to `debug.log`
- **AsyncStorage**: Rolling buffer (last 200 entries)
- **Recent Addition**: File-backed logging for crash-proof persistence

**`utils/nativeCallDebugger.ts`** (227 lines)
- **Purpose**: Wraps native calls with logging
- **Wrapper Function**: `safeNativeCall(type, method, params, callFn)`
- **Logs**: Before, success, and failure events
- **Types**: 'haptics', 'linking', 'router', 'supabase', 'other'

**`utils/globalErrorHandler.ts`** (174 lines)
- **Purpose**: Catches unhandled errors and promise rejections
- **Initialization**: Called early in `_layout.tsx`
- **Note**: Only catches JS errors, not native crashes (SIGSEGV)

---

### Navigation & Routing

**`services/navigationService.ts`** (407 lines)
- **Purpose**: Pre-processes profile navigation (checks access, fetches data)
- **Key Methods**:
  - `navigateToPoliticianProfile()` - checks access → processes → navigates
  - `navigateToLegislationProfile()` - same pattern
- **Processing**: Calls `PoliticianProfileService.handleProfileOpen()` before navigation
- **Critical**: Uses `router.push()` from expo-router (native call)

**`app/profile/synop.tsx`** (868 lines)
- **Purpose**: Politician profile summary component
- **"See More" Button**: `handleSeeMore()` calls `router.push('/profile/see-more')`
- **Native Calls**: `Haptics.selectionAsync()` before navigation

**`app/profile/see-more.tsx`** (469 lines)
- **Purpose**: Metrics detail screen (crash target)
- **Imports**: 
  - `expo-haptics`
  - `expo-router` (useRouter, useLocalSearchParams)
  - React Native (Linking, etc.)
- **Module Load Log**: `persistentLogger.log('see-more:module_loaded')` at top level
- **Component Entry Log**: First line logs params snapshot

---

### Profile Processing

**`services/politicianProfileService.ts`** (846+ lines)
- **Purpose**: Handles profile data processing before navigation
- **Key Method**: `handleProfileOpen(politicianId)` - called by NavigationService
- **Likely**: Makes Supabase Edge Function calls to fetch/process profile data

**`services/legislationProfileService.ts`** (similar structure)
- **Purpose**: Legislation profile processing

---

## Crash Analysis

### Crash Characteristics

1. **Timing**: Instant crash (no transition animation)
2. **Trigger**: Clicking "See Metrics" button
3. **Failure Point**: Before `see-more.tsx` component renders
4. **Native Signal**: SIGSEGV (segmentation fault - memory access violation)
5. **Build Type**: Preview/Release builds only (dev mode may work)

### Hypothesized Crash Causes

#### Hypothesis 1: Native Hook Failure
**Theory**: `useRouter()` or `useLocalSearchParams()` fails during route resolution
- Expo Router's native bridge may crash when resolving route params
- Possible memory corruption in route params (special characters, large strings)
- Native module not initialized properly in Preview builds

**Evidence**:
- Crash happens at component entry (first line uses `useRouter()`)
- No error logs (native crash bypasses JS error handlers)

#### Hypothesis 2: Module Evaluation Failure
**Theory**: Top-level code in `see-more.tsx` causes crash during module evaluation
- `persistentLogger.log('see-more:module_loaded')` may trigger native module access
- `expo-file-system` may not be initialized in Preview builds
- AsyncStorage access during module eval may fail

**Evidence**:
- Module-load log is at top level (runs before component)
- File logging was recently added (may not be compatible with Preview builds)

#### Hypothesis 3: Route Params Serialization Failure
**Theory**: Large or malformed params cause native crash
- Params include strings (name, position, pollSummary, pollLink)
- Native bridge fails to serialize/deserialize params
- Memory overflow in native param handling

**Evidence**:
- Params passed include potentially long strings (pollSummary, pollLink)
- Crash happens during route resolution (before component sees params)

#### Hypothesis 4: Haptics + Router Race Condition
**Theory**: `Haptics.selectionAsync()` called immediately before `router.push()` causes native bridge conflict
- Two native calls in rapid succession
- Haptics may hold native lock that conflicts with router

**Evidence**:
- `handleSeeMore()` calls haptics then immediately router.push()
- No await/sequencing between calls

---

## Search Failure Analysis

### Error Pattern
- User enters search query
- "failed to load results" message appears
- No results displayed

### Potential Causes

1. **Query Syntax Error**:
   ```typescript
   .or(`name.ilike.%${q}%,sub_name.ilike.%${q}%`)
   ```
   - Supabase `.or()` may not support multiple `ilike` patterns in this format
   - Should use `.or('name.ilike.%,sub_name.ilike.%')` with proper escaping

2. **Network Timeout**: Supabase queries timing out silently
3. **Missing Error Handling**: Errors thrown but not displayed to user
4. **Table Permissions**: RLS policies blocking queries
5. **Client Not Initialized**: `getSupabaseClient()` returning invalid client

---

## Native Module Dependencies

### Critical Native Modules

1. **@react-native-async-storage/async-storage** (2.2.0)
   - Used by: Supabase auth, persistentLogger, ErrorBoundary
   - Loading: Lazy-loaded in supabase.ts, top-level in other files
   - **Risk**: Top-level imports may cause Preview build crashes

2. **expo-router** (6.0.18)
   - Used by: All navigation
   - Hooks: `useRouter()`, `useLocalSearchParams()`, `useSegments()`
   - **Risk**: Native bridge crashes during route resolution

3. **expo-haptics** (15.0.7)
   - Used by: Button presses, navigation triggers
   - **Risk**: Called synchronously before navigation (potential race condition)

4. **expo-file-system** (implicit - part of Expo SDK)
   - Used by: persistentLogger for file logging
   - **Risk**: May not be properly linked in Preview builds

5. **expo-splash-screen** (31.0.10)
   - Used by: `_layout.tsx` for splash management
   - **Risk**: Module scope calls may fail in Preview builds

---

## Data Flow

### Profile Navigation Flow
```
User clicks button
  → handleSeeMore() (synop.tsx)
    → Haptics.selectionAsync() [NATIVE]
    → router.push('/profile/see-more', params) [NATIVE]
      → Expo Router resolves route [NATIVE]
        → Module loads (see-more.tsx) [MODULE EVAL]
          → persistentLogger.log('see-more:module_loaded') [ASYNCSTORAGE/FILE]
          → Component function called [REACT]
            → useRouter() [NATIVE HOOK] ← CRASH HERE?
            → useLocalSearchParams() [NATIVE HOOK] ← OR HERE?
            → persistentLogger.log('see-more:component_enter') [ASYNCSTORAGE/FILE]
            → Component renders
```

### Search Flow
```
User enters query
  → handleSearch() (exp1.tsx)
    → getSupabaseClient() [ASYNCSTORAGE ACCESS]
      → Supabase query to ppl_index [NETWORK]
      → Supabase query to legi_index [NETWORK]
        → Transform results
          → router.push('/results', { searchResults }) [NATIVE]
            → Results screen displays
```

---

## Debugging Infrastructure

### Existing Debug Tools

1. **Persistent Logger** (`utils/persistentLogger.ts`)
   - AsyncStorage buffer (200 entries)
   - File logging (`debug.log`)
   - Logs to both on every event

2. **Native Call Debugger** (`utils/nativeCallDebugger.ts`)
   - Wraps native calls with logging
   - Logs before/after/success/failure

3. **Global Error Handler** (`utils/globalErrorHandler.ts`)
   - Catches JS errors and promise rejections
   - **Limitation**: Cannot catch native crashes (SIGSEGV)

4. **Debug Screens**:
   - `/debug-logs` - View persistent logs
   - `/debug-flags` - Toggle native call disabling
   - `/debug-supabase-health` - Test Supabase connection

### Logging Coverage

**See More Crash Path Logging**:
- ✅ Module load: `see-more:module_loaded`
- ✅ Component entry: `see-more:component_enter`
- ✅ Native call before: `native:router:push:before`
- ❌ **Gap**: No logs if crash happens during route resolution (before component)

**Problem**: Native crashes bypass JavaScript error handlers. Logs may not persist if crash is instant.

---

## Solutions & Methods Already Attempted

This section documents all solutions, fixes, and debugging approaches that have already been tried. **Do not suggest these again** as they have been tested and did not resolve the crash issue.

### 1. Lazy-Loaded Supabase Client
**Status**: ✅ Implemented, ✅ Fixed splash screen hangs
**Implementation**: 
- Converted `utils/supabase.ts` to use lazy loading pattern
- AsyncStorage is `require()`d only when `getSupabaseClient()` is called (not at module scope)
- Client is singleton cached in module scope after first call
- **Result**: Fixed splash screen hangs, but did not fix "See More" crash

### 2. Error Boundaries & Error Handling
**Status**: ✅ Implemented, ❌ Does not catch native crashes
**Implementation**:
- Added `components/ErrorBoundary.tsx` - React error boundary component
- Added `utils/globalErrorHandler.ts` - Catches unhandled JS errors and promise rejections
- Added `components/ErrorOverlay.tsx` - On-screen error display
- Wrapped native calls in try/catch blocks
- **Result**: Catches JavaScript errors, but native crashes (SIGSEGV) bypass all JS error handlers

### 3. Native Call Wrapping
**Status**: ✅ Implemented, ❌ Logs but doesn't prevent crashes
**Implementation**:
- Created `utils/nativeCallDebugger.ts` with `safeNativeCall()` wrapper
- Wraps: haptics, linking, router, supabase calls
- Logs: before call, success, failure
- Checks debug flags before executing
- **Result**: Provides visibility but cannot prevent native crashes that happen during route resolution

### 4. Persistent Logging Infrastructure
**Status**: ✅ Implemented, ⚠️ May not capture instant crashes
**Implementation**:
- `utils/persistentLogger.ts` - Dual logging system:
  - AsyncStorage buffer (rolling, last 200 entries)
  - File system logging (`expo-file-system` to `debug.log`)
- Module-load breadcrumbs: `persistentLogger.log('see-more:module_loaded')` at top of `see-more.tsx`
- Component-entry breadcrumbs: Logs params snapshot immediately on component entry
- Checkpoints before every native call
- **Result**: Provides debugging visibility, but instant crashes may occur before logs persist to file/AsyncStorage

### 5. Debug Flags System
**Status**: ✅ Implemented, ✅ Tested
**Implementation**:
- `utils/debugFlags.ts` - Feature flags system
- Can disable: haptics, linking, router, supabase calls
- Flags persist to AsyncStorage
- UI screen at `/debug-flags` to toggle flags
- **Result**: Successfully disables calls but crash still occurs even with all flags enabled (suggesting crash is in route resolution itself)

### 6. Early Logging at Screen Entry
**Status**: ✅ Implemented on multiple screens
**Implementation**:
- Added very early logging at component entry in:
  - `app/profile/see-more.tsx` - Logs params snapshot at first line
  - `app/legislation/legi5.tsx` - Comprehensive early logging
  - `app/profile/sub5.tsx` - Early logging with params
- Logs include: timestamp, all params, user state
- **Result**: Logs are created but crash happens before they can be viewed (instant crash)

### 7. Splash Screen Isolation Testing
**Status**: ✅ Attempted, ✅ Identified root cause of different issue
**Implementation**:
- Stripped `app/_layout.tsx` to minimal BOOT screen
- Removed all imports to isolate native module initialization
- Identified top-level AsyncStorage imports as cause of splash screen hangs
- **Result**: Fixed splash screen issue (different from current crash), identified lazy-loading pattern

### 8. Session Persistence Fix
**Status**: ✅ Implemented (unrelated to crash)
**Implementation**:
- Fixed race condition in `components/AuthProvider.tsx`
- Proper handling of `INITIAL_SESSION` event
- Distinguish network errors from auth errors
- **Result**: Fixed session persistence, but unrelated to "See More" crash

### 9. Profile Processing Reordering
**Status**: ✅ Implemented (unrelated to crash)
**Implementation**:
- Moved access check BEFORE profile processing in `services/navigationService.ts`
- Prevents wasted processing on denied access
- **Result**: Fixed profile quota system, but unrelated to crash

### 10. Safe Haptics Wrapper
**Status**: ✅ Implemented
**Implementation**:
- `utils/safeHaptics.ts` - Wrapper functions for haptics calls
- `safeHapticsSelection()`, `safeHapticsImpact()`, `safeHapticsNotification()`
- Wrapped in try/catch with error logging
- **Result**: Prevents haptics errors from crashing, but "See More" crash occurs even when haptics is disabled via flags

### 11. Search Query Syntax Attempts
**Status**: ⚠️ Unknown if attempted
**Implementation**:
- Current search uses: `.or(`name.ilike.%${q}%,sub_name.ilike.%${q}%`)`
- **Note**: This syntax may be incorrect for Supabase - proper format might be `.or('name.ilike.%pattern%,sub_name.ilike.%pattern%')`
- **Status**: Search still failing, syntax may need verification

### 12. Navigation Pre-Processing
**Status**: ✅ Implemented
**Implementation**:
- `services/navigationService.ts` pre-processes profile navigation
- Checks access, processes data, THEN navigates
- Uses `router.push()` from expo-router
- **Result**: Works for profile navigation, but "See More" navigation bypasses this (direct `router.push()`)

### 13. Removing Native Module Imports at Module Scope
**Status**: ✅ Attempted for Supabase/AsyncStorage
**Implementation**:
- Converted top-level AsyncStorage imports to lazy `require()` calls
- Applied to: `utils/supabase.ts`, `utils/startupLogger.ts`
- **Note**: Other files still have top-level AsyncStorage imports:
  - `components/ErrorBoundary.tsx`
  - `utils/persistentLogger.ts`
  - `app/(tabs)/home.tsx`
  - `app/profile/synop.tsx`
- **Result**: Fixed some issues, but "See More" crash persists

### 14. File-Backed Logging
**Status**: ✅ Recently added
**Implementation**:
- Added `expo-file-system` integration to `persistentLogger.ts`
- Writes to `FileSystem.documentDirectory + "debug.log"`
- Single-line JSON format (newline-delimited)
- **Result**: Too new to evaluate effectiveness for instant crashes

### 15. Checkpoint Logging Pattern
**Status**: ✅ Implemented throughout codebase
**Implementation**:
- Logs checkpoints before every native call
- Pattern: `persistentLogger.checkpoint('event:action:before', data)`
- Used in: see-more.tsx, legi5.tsx, sub5.tsx, navigationService.ts
- **Result**: Provides breadcrumb trail, but crash happens before checkpoints can help

### Approaches NOT Yet Attempted (Possibilities for Secondary LLM)

1. **Delaying router.push()**: Not tested if adding delay/await between haptics and router.push helps
2. **Alternative navigation methods**: Not tested `router.replace()` or other Expo Router methods
3. **Route parameter sanitization**: Not tested if sanitizing/validating params before navigation helps
4. **Component lazy loading**: Not tested React.lazy() or dynamic imports for see-more.tsx
5. **Expo Router version downgrade**: Not tested if older Expo Router version works better
6. **Removing module-scope logger**: Not tested if removing top-level `persistentLogger.log()` from see-more.tsx helps
7. **Separating haptics from navigation**: Not tested if removing haptics call entirely (not just disabling) helps
8. **Route configuration changes**: Not tested if explicit route config in `_layout.tsx` helps
9. **Native module linking verification**: Not verified if all native modules properly linked in Preview builds
10. **React 19 compatibility**: Not verified if React 19.1.0 is compatible with Expo Router 6.0.18

---

## Known Issues & Constraints

### Current Constraints

1. **Preview builds only**: Crashes don't reproduce in dev mode
2. **No Xcode access**: Cannot debug native crashes directly
3. **Instant crashes**: No time for logs to persist before SIGSEGV
4. **No native crash logs**: React Native doesn't surface native crash details to JS

---

## Code Structure Summary

### Directory Structure
```
app/
  _layout.tsx          # Root layout, initializes app
  index.tsx            # Onboarding screen
  (tabs)/
    home.tsx           # Main home screen
    exp1.tsx           # Search screen (failing)
  profile/
    synop.tsx          # Profile summary (has "See More" button)
    see-more.tsx       # Metrics screen (CRASH TARGET)
  legislation/
    legi5.tsx          # Legislation detail screen
  results.tsx          # Search results screen
  debug-logs.tsx       # Debug log viewer

components/
  AuthProvider.tsx     # Auth context provider
  ErrorBoundary.tsx    # React error boundary (JS only)
  ErrorOverlay.tsx     # Error display overlay

services/
  navigationService.ts        # Pre-processing navigation
  politicianProfileService.ts # Profile data processing
  legislationProfileService.ts

utils/
  supabase.ts           # Lazy-loaded Supabase client
  persistentLogger.ts   # Dual logging (AsyncStorage + file)
  nativeCallDebugger.ts # Native call wrapper
  globalErrorHandler.ts # Global error catching
  debugFlags.ts         # Feature flags for disabling native calls
```

---

## Critical Code Snippets

### See More Navigation (Crash Trigger)
```typescript
// app/profile/synop.tsx:336-350
const handleSeeMore = () => {
  Haptics.selectionAsync();  // Immediate native call
  router.push({              // Immediate navigation
    pathname: '/profile/see-more',
    params: { 
      name, position,
      approval: Number(localApproval ?? 0).toString(),
      disapproval: Number(localDisapproval ?? 0).toString(),
      votes: Number(votes ?? 0).toString(),
      pollSummary: pollSummary || '',
      pollLink: pollLink || ''
    }
  });
};
```

### Target Screen Entry
```typescript
// app/profile/see-more.tsx:1-50
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
// ... other imports

// MODULE SCOPE - runs when module loads
persistentLogger.log('see-more:module_loaded').catch(() => {});

export default function SeeMore({ ... }) {
  // FIRST LINE - native hooks
  const router = useRouter();              // ← CRASH POSSIBILITY
  const params = useLocalSearchParams();   // ← CRASH POSSIBILITY
  
  // Logging
  persistentLogger.log('see-more:component_enter', {...});
  // ... rest of component
}
```

### Search Query (Failing)
```typescript
// app/(tabs)/exp1.tsx:197-201
const { data: pplData, error: pplError } = await supabase
  .from('ppl_index')
  .select('id, name, sub_name, limit_score')
  .or(`name.ilike.%${q}%,sub_name.ilike.%${q}%`)  // ← POTENTIAL SYNTAX ERROR
  .order('limit_score', { ascending: false });
```

---

## Recommendations for Analysis

When analyzing this codebase, consider:

1. **Native Module Initialization**: Are all native modules properly linked in Preview builds?
2. **Route Param Serialization**: Can Expo Router handle the param structure being passed?
3. **Haptics + Router Race**: Should haptics be awaited before navigation?
4. **Module Evaluation Timing**: Is file logging safe to call at module scope?
5. **Search Query Syntax**: Is the `.or()` with `ilike` pattern correct for Supabase?
6. **Error Handling**: Are Supabase errors being caught and displayed?
7. **Memory Pressure**: Are large params causing native memory issues?
8. **Expo Router Version**: Is 6.0.18 compatible with React 19.1.0 and RN 0.81.5?

---

## Build Configuration

- **Expo SDK**: ~54.0.28
- **React**: 19.1.0 (latest)
- **React Native**: 0.81.5
- **New Architecture**: Enabled (`"newArchEnabled": true` in app.json)
- **Platform**: iOS/Android Preview builds
- **Entry Point**: `expo-router/entry` (standard Expo Router)

---

**End of Synopsis**
