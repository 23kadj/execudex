# Splash Screen Isolation Report

## Goal
Identify why preview/release builds never exit splash screen by isolating native crashes before React renders.

## Entry Point Verification

### ✅ Entry Point Confirmed
- **package.json `"main"`**: `"expo-router/entry"` (standard Expo Router entry)
- **Entry Path**: Single entry point via Expo Router
- **Expo Router Entry**: `app/_layout.tsx` is the root layout component

## Files Changed

### 1. `app/_layout.tsx` - STRIPPED TO MINIMAL BOOT SCREEN
**Status**: ✅ Modified

**Changes Made**:
- Removed ALL imports except React and basic View/Text
- Commented out all heavy imports:
  - `expo-router` (Stack, useRouter, useSegments)
  - `expo-splash-screen`
  - `AuthProvider` and `useAuth`
  - `ThemeProvider`
  - `ErrorBoundary`
  - `EnvErrorScreen`
  - `hasValidSupabaseConfig` from `utils/supabase` ⚠️ **CRITICAL**
  - `logStartup` from `utils/startupLogger` ⚠️ **CRITICAL**
- Renders minimal `<Text>BOOT</Text>` screen
- All original code preserved in comments for easy restoration

## Critical Findings

### ⚠️ PRIMARY SUSPECT: `utils/supabase.ts` Top-Level AsyncStorage Import

**Problem**: `app/_layout.tsx` imports `hasValidSupabaseConfig` from `utils/supabase.ts`, which causes:

1. **Module Evaluation Chain**:
   ```
   app/_layout.tsx
   → imports hasValidSupabaseConfig from utils/supabase.ts
   → utils/supabase.ts imports AsyncStorage at top level
   → AsyncStorage is a native module
   → Supabase client is created at module scope (uses AsyncStorage)
   ```

2. **Execution Timing**: This happens at **module evaluation time**, before React even renders.

3. **Crash Point**: If AsyncStorage or Supabase client creation crashes in release builds, the app never gets past the splash screen.

### ⚠️ SECONDARY ISSUES: Other Top-Level AsyncStorage Imports

Found 8 files importing AsyncStorage at top level:
- `utils/startupLogger.ts` (imported by _layout.tsx via logStartup)
- `utils/supabase.ts` (imported by _layout.tsx via hasValidSupabaseConfig)
- `components/ErrorBoundary.tsx` (imported by _layout.tsx)
- `app/(tabs)/home.tsx`
- `app/profile/synop.tsx`
- `services/accountDeletionService.ts`
- `utils/historyUtils.ts`
- `app/profile/rankings.tsx`

**Note**: IAP is already lazy-loaded in `services/iapService.ts` ✅

## Babel Configuration

### ❌ No `babel.config.js` Found
- Expo uses default Babel configuration
- **Issue**: `react-native-reanimated` requires `react-native-reanimated/plugin` in Babel config
- **Impact**: If reanimated is used anywhere (found in `components/HelloWave.tsx`), missing plugin could cause issues
- **Status**: Reanimated not imported in `_layout.tsx`, so not blocking BOOT screen

## Hermes Status

### ✅ Hermes Enabled (Default)
- Hermes is the default JavaScript engine for React Native
- Found in dependencies: `hermes-parser`, `babel-plugin-syntax-hermes-parser`
- **Known Issues**: Some libraries have compatibility issues with Hermes, but none identified in top-level imports

## Expected Behavior

### If BOOT Screen Renders:
✅ **React can render** - Issue is in one of the commented-out imports
- Next step: Re-enable imports one by one to isolate the culprit

### If BOOT Screen Does NOT Render:
❌ **Native crash before React** - Issue is in:
- React Native core
- Expo Router entry point
- Native module initialization at app launch
- Hermes engine initialization

## Root Cause Analysis

### Most Likely Cause: AsyncStorage in Supabase Client Creation

**Why**:
1. `app/_layout.tsx` imports `hasValidSupabaseConfig` at top level
2. This triggers `utils/supabase.ts` module evaluation
3. `utils/supabase.ts` imports AsyncStorage and creates Supabase client immediately
4. In release builds, native module initialization can fail silently or crash
5. App hangs on splash screen because React never renders

**Evidence**:
- AsyncStorage is a native module requiring native bridge
- Supabase client creation happens synchronously at module scope
- No error handling around client creation
- Release builds have different native module loading behavior than dev

## Recommendations

### Immediate Next Steps:
1. **Test BOOT screen** in preview/release build
2. If BOOT renders: Re-enable imports incrementally:
   - First: Remove `hasValidSupabaseConfig` import, hardcode check
   - Second: Lazy-load Supabase client creation
   - Third: Lazy-load AsyncStorage in supabase.ts
3. If BOOT doesn't render: Check native crash logs, Expo Router entry point

### Long-term Fixes:
1. **Lazy-load Supabase client**: Don't create client at module scope
2. **Lazy-load AsyncStorage**: Import only when needed
3. **Add error boundaries**: Wrap native module initialization in try/catch
4. **Add babel.config.js**: Include reanimated plugin if reanimated is used

## Files Requiring Changes (After BOOT Test)

### High Priority:
1. `utils/supabase.ts` - Convert to lazy initialization
2. `utils/startupLogger.ts` - Lazy-load AsyncStorage
3. `components/ErrorBoundary.tsx` - Lazy-load AsyncStorage

### Medium Priority:
4. Create `babel.config.js` with reanimated plugin (if reanimated is used)

## Restoration Instructions

To restore original `app/_layout.tsx`:
1. Uncomment all commented code blocks
2. Remove the minimal BOOT screen code
3. Restore all imports

All original code is preserved in comments with clear markers.

