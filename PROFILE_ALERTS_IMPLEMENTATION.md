# Profile Alerts Implementation

## Overview
This system shows first-time alerts when users enter politician or legislation profiles. Each alert shows only **once per device/installation**, regardless of user sessions, sign-outs, or account deletions.

## Files Modified

### 1. `utils/profileAlerts.ts` (Created)
**Purpose**: Central management for profile alerts with persistent storage

**Key Features**:
- Two separate alerts: one for politicians, one for legislation
- Each alert tracked independently with AsyncStorage
- Alert preferences persist across user sessions
- Export storage keys for preservation during sign-out

**How to Edit Alert Messages**:
```typescript
// Lines 17-32 in utils/profileAlerts.ts
const POLITICIAN_ALERT_CONFIG = {
  title: 'Politician Profile',
  message: 'Alert - This is your first time viewing a politician profile!',
  buttonText: 'Got it',
};

const LEGISLATION_ALERT_CONFIG = {
  title: 'Legislation Profile',
  message: 'Alert - This is your first time viewing a legislation profile!',
  buttonText: 'Got it',
};
```

### 2. `app/index1.tsx` (Modified)
**Changes**:
- Added import: `showPoliticianAlertIfNeeded`
- Added useEffect to trigger alert on component mount
- Alert shows first time any politician profile is opened

### 3. `app/index2.tsx` (Modified)
**Changes**:
- Added import: `showLegislationAlertIfNeeded`
- Added useEffect to trigger alert on component mount
- Alert shows first time any legislation profile is opened

### 4. `app/(tabs)/profile.tsx` (Modified)
**Changes**:
- Added import: `PERSISTENT_ALERT_KEYS`
- Modified `handleSignOut()` to preserve alert preferences:
  1. Save alert keys before clearing AsyncStorage
  2. Clear AsyncStorage (removes session data)
  3. Restore alert keys after clearing
- Alert preferences now survive sign-out

### 5. `services/accountDeletionService.ts` (Modified)
**Changes**:
- Added import: `PERSISTENT_ALERT_KEYS`
- Modified `deleteAccountOnServer()` to preserve alert preferences:
  1. Save alert keys before clearing AsyncStorage
  2. Clear AsyncStorage (removes all user data)
  3. Restore alert keys after clearing
- Alert preferences now survive account deletion

## How It Works

### Alert Flow
1. User opens a politician profile for the **first time**
   - `showPoliticianAlertIfNeeded()` checks AsyncStorage
   - Key `first_time_politician_alert_shown` is not found
   - Alert displays with message
   - User clicks "Got it"
   - Key is saved to AsyncStorage with value `'true'`

2. User opens another politician profile
   - `showPoliticianAlertIfNeeded()` checks AsyncStorage
   - Key `first_time_politician_alert_shown` is `'true'`
   - **No alert shown** (already seen)

3. User signs out and signs back in
   - `AsyncStorage.clear()` is called during sign-out
   - **BUT** alert keys are saved and restored
   - Alert preferences persist
   - **No alert shown** (already seen before sign-out)

### Persistence Strategy
The system uses a "save-clear-restore" pattern:

```typescript
// Before clearing AsyncStorage
const persistentData = {};
for (const key of PERSISTENT_ALERT_KEYS) {
  persistentData[key] = await AsyncStorage.getItem(key);
}

// Clear all data
await AsyncStorage.clear();

// Restore persistent data
for (const [key, value] of Object.entries(persistentData)) {
  if (value !== null) {
    await AsyncStorage.setItem(key, value);
  }
}
```

This ensures alert preferences survive:
- User sign-out
- Account deletion
- Any other `AsyncStorage.clear()` operations

## Storage Keys

### Persistent Keys (Survive sign-out)
- `first_time_politician_alert_shown` - Tracks politician alert
- `first_time_legislation_alert_shown` - Tracks legislation alert

These keys are stored in the `PERSISTENT_ALERT_KEYS` array and are automatically preserved during any storage clearing operations.

## Testing

### Test Alert Display
1. Fresh install or reset alerts (see below)
2. Open any politician profile → Alert shows
3. Open another politician profile → No alert
4. Open any legislation profile → Alert shows
5. Open another legislation profile → No alert

### Test Persistence After Sign-Out
1. View both profile types (dismiss both alerts)
2. Sign out from Account tab
3. Sign back in
4. Open politician profile → **No alert** (correctly persisted)
5. Open legislation profile → **No alert** (correctly persisted)

### Reset Alerts for Testing
Add this utility function call in your code:
```typescript
import { resetAllProfileAlerts } from '../utils/profileAlerts';

// Call this to reset both alerts
await resetAllProfileAlerts();
```

## Customization

### Change Alert Messages
Edit `utils/profileAlerts.ts` lines 17-32:
- `title`: Alert header text
- `message`: Alert body text
- `buttonText`: Dismiss button text

### Add More Persistent Data
To add more data that should survive sign-out:

1. Add storage key to `utils/profileAlerts.ts`:
```typescript
export const MY_NEW_KEY = 'my_persistent_key';
export const PERSISTENT_ALERT_KEYS = [
  POLITICIAN_ALERT_KEY, 
  LEGISLATION_ALERT_KEY,
  MY_NEW_KEY  // Add your new key here
];
```

2. The key will automatically be preserved during sign-out/deletion

## Benefits

✅ **Per-Device Persistence**: Alert shown once per device, not per user  
✅ **Session Independent**: Survives sign-out and re-login  
✅ **Account Independent**: Survives account deletion (device-level tracking)  
✅ **Clean User Experience**: Users only see each alert once ever  
✅ **Easy Customization**: Simple config object for all alert text  
✅ **Maintainable**: Centralized alert logic in one file  
✅ **Extensible**: Easy to add more persistent preferences  

## Edge Cases Handled

- **Multiple Sign-Outs**: Alert preferences persist through any number of sign-outs
- **Account Deletion**: Alert preferences survive even complete account deletion
- **Corrupt Storage**: Graceful error handling if AsyncStorage operations fail
- **Concurrent Access**: AsyncStorage operations are atomic per key
- **Missing Keys**: `null` values are not restored (avoids creating unnecessary keys)


