# Persistent Debugging System

Complete debugging infrastructure for Preview builds without Xcode access.

## Features

### 1. Persistent Logger (`utils/persistentLogger.ts`)
- Stores last ~200 log entries in AsyncStorage
- Rolling buffer (automatically removes old entries)
- Works in Preview builds
- Logs persist across app restarts

### 2. Debug Logs Screen (`app/debug-logs.tsx`)
- View all persistent logs
- Copy logs to clipboard
- Clear logs
- Real-time updates

### 3. Debug Flags Screen (`app/debug-flags.tsx`)
- Toggle flags to disable native calls:
  - `disableHaptics` - Disables all haptics calls
  - `disableLinking` - Disables Linking.canOpenURL/openURL
  - `disableRouter` - Disables router navigation
  - `disableSupabase` - Disables Supabase queries
- Flags persist to AsyncStorage
- Loaded automatically on app startup

### 4. Checkpoints
- **See More Page**: Checkpoint at very top of component
- **Native Calls**: Checkpoint immediately before each native call wrapper

## Usage

### Accessing Debug Screens

Navigate to:
- `/debug-logs` - View persistent logs
- `/debug-flags` - Toggle debug flags

### Using Persistent Logger

```typescript
import { persistentLogger } from '../utils/persistentLogger';

// Log an event
await persistentLogger.log('eventName', { data: 'value' });

// Log a checkpoint (special type)
await persistentLogger.checkpoint('checkpointName', { data: 'value' });

// Get logs
const logs = persistentLogger.getLogs();

// Export as text
const text = persistentLogger.exportAsText();

// Export as JSON
const json = persistentLogger.exportAsJSON();
```

### Using Debug Flags

```typescript
import { debugFlags } from '../utils/debugFlags';

// Check if a flag is enabled
if (!debugFlags.disableHaptics) {
  // Make haptics call
}

// Set a flag (automatically persists)
debugFlags.disableHaptics = true;

// Reset all flags
import { resetDebugFlags } from '../utils/debugFlags';
await resetDebugFlags();
```

## Checkpoint Locations

### See More Page (`app/profile/see-more.tsx`)
- ✅ Checkpoint at very top of component (before any logic)
- ✅ Checkpoint before haptics call
- ✅ Checkpoint before Linking.canOpenURL
- ✅ Checkpoint before Linking.openURL
- ✅ Checkpoint before router.back()

### Card Screens (`app/legislation/legi5.tsx`, `app/profile/sub5.tsx`)
- ✅ Early logging at component entry
- ✅ Checkpoints before all native calls

## Native Call Wrapping

All native calls are automatically:
1. Logged to persistent logger
2. Checked against debug flags
3. Wrapped in try/catch with error logging

Native call types tracked:
- `haptics` - Haptics.selectionAsync, etc.
- `linking` - Linking.canOpenURL, Linking.openURL
- `router` - router.push, router.back
- `supabase` - All Supabase queries

## Debugging Workflow

1. **Reproduce crash** - Navigate to problematic screen
2. **Check debug logs** - Go to `/debug-logs` screen
3. **Find last checkpoint** - Look for last successful checkpoint before crash
4. **Identify suspect call** - Check which native call type was last
5. **Disable that call** - Go to `/debug-flags` and toggle the flag
6. **Test again** - See if crash still occurs
7. **Narrow down** - If crash stops, that call type is the culprit

## Log Format

Each log entry contains:
- `timestamp` - When the event occurred
- `eventName` - Name of the event/checkpoint
- `data` - Optional data object
- `level` - 'info', 'warn', 'error', or 'checkpoint'

## Storage

- **Logs**: Stored in AsyncStorage key `@execudex:debug_logs`
- **Flags**: Stored in AsyncStorage key `@execudex:debug_flags`
- Both are automatically loaded on app startup

## Example Log Entry

```json
{
  "timestamp": 1234567890,
  "eventName": "see-more:handleLinkPress:before",
  "data": {
    "url": "https://example.com"
  },
  "level": "checkpoint"
}
```

## Integration Points

1. **App Startup** (`app/_layout.tsx`)
   - Initializes persistent logger
   - Loads debug flags from storage
   - Logs app startup event

2. **Native Call Wrapper** (`utils/nativeCallDebugger.ts`)
   - Automatically logs all native calls
   - Checks flags before executing
   - Logs to persistent logger

3. **See More Page** (`app/profile/see-more.tsx`)
   - Checkpoint at component entry
   - Checkpoints before all native calls

4. **Card Screens** (`app/legislation/legi5.tsx`, `app/profile/sub5.tsx`)
   - Early logging with all params
   - Checkpoints before native calls










