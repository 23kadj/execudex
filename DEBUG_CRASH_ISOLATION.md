# Crash Isolation & Debugging Infrastructure

This document describes the comprehensive debugging infrastructure added to isolate and identify native crash sources.

## Overview

The app now includes:
1. **Very early logging** at screen entry with all params
2. **Native call tracking** with detailed logging
3. **Feature flags** to disable suspect native calls
4. **Global error handlers** with on-screen overlay
5. **Checkpoint logging** before each native call

## Key Files

### Debug Utilities
- `utils/nativeCallDebugger.ts` - Tracks all native module calls
- `utils/globalErrorHandler.ts` - Catches unhandled errors and promise rejections
- `utils/debugFlags.ts` - Feature flags to disable native calls
- `components/ErrorOverlay.tsx` - On-screen error display

### Updated Screens
- `app/legislation/legi5.tsx` - Full debugging infrastructure
- `app/profile/sub5.tsx` - Full debugging infrastructure (partially updated)

## Usage

### Viewing Native Call Logs

All native calls are automatically logged. Check console for:
```
[NATIVE_CALL] ✅ haptics.selectionAsync
[NATIVE_CALL] ❌ linking.openURL
```

### Disabling Native Calls for Testing

From console or code:
```typescript
import { debugFlags } from './utils/debugFlags';

// Disable haptics to test if it's causing crashes
debugFlags.disableHaptics = true;

// Disable linking
debugFlags.disableLinking = true;

// Disable router
debugFlags.disableRouter = true;

// Disable Supabase
debugFlags.disableSupabase = true;

// Reset all flags
import { resetDebugFlags } from './utils/debugFlags';
resetDebugFlags();
```

### Viewing Error Logs

Errors are automatically captured. Check console for:
```
[FATAL_ERROR] FATAL
[UNHANDLED_PROMISE_REJECTION]
```

The error overlay will also appear on-screen if an error occurs.

### Exporting Logs

```typescript
import { nativeCallDebugger, globalErrorHandler } from './utils/...';

// Export native call logs
const nativeLogs = nativeCallDebugger.exportLogs();
console.log(nativeLogs);

// Export error logs
const errorLogs = globalErrorHandler.exportErrorLogs();
console.log(errorLogs);
```

## Debugging Workflow

1. **Reproduce the crash** - Navigate to the problematic screen
2. **Check console logs** - Look for the last successful checkpoint before crash
3. **Identify suspect native call** - Check which native call type was last logged
4. **Disable that call type** - Use debug flags to disable it
5. **Test again** - See if crash still occurs
6. **Narrow down** - If crash stops, that call type is the culprit

## Checkpoint Logging

Each screen logs checkpoints before native calls:
```
[LEGI5] Checkpoint: Component initialized
[LEGI5] Checkpoint: Starting bookmark status check
[LEGI5] Checkpoint: About to call Linking.canOpenURL
```

The last checkpoint before a crash indicates where the problem occurred.

## Feature Flags

All feature flags are accessible via `debugFlags`:
- `disableHaptics` - Disables all haptics calls
- `disableLinking` - Disables Linking.canOpenURL and Linking.openURL
- `disableRouter` - Disables router navigation
- `disableSupabase` - Disables all Supabase queries

When a flag is enabled, the native call is skipped and logged as "DISABLED by flag".

## Error Overlay

The error overlay automatically appears when:
- A fatal JavaScript error occurs
- An unhandled promise rejection occurs

The overlay shows:
- Error type
- Timestamp
- Error message
- Stack trace (if available)

## Next Steps

1. Test the app and reproduce the crash
2. Check console for the last checkpoint
3. Identify which native call type was last executed
4. Disable that call type using debug flags
5. Test again to confirm isolation







