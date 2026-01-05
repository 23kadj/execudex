# Push Notifications Setup Guide for Production

## Current Status
The app currently uses **local notifications** which work when the app is running or in the background. For **true push notifications** that work when the app is closed, you need to implement the following:

## Steps for Production Push Notifications

### 1. iOS Setup in Apple Developer Account

1. **Create APNs Authentication Key (.p8 file):**
   - Go to [Apple Developer Portal](https://developer.apple.com/account)
   - Navigate to Certificates, Identifiers & Profiles → Keys
   - Click "+" to create a new key
   - Enable "Apple Push Notifications service (APNs)"
   - Download the .p8 file (you can only download it once!)
   - Note the Key ID and Team ID

2. **Upload APNs Key to Expo/EAS:**
   - Run: `eas credentials`
   - Select iOS platform → Push Notifications → Set up APNs Authentication Key
   - Upload your .p8 file and provide Key ID and Team ID
   - Alternatively, upload via Expo Dashboard → Credentials → iOS → Push Notifications

3. **Enable Push Notifications Capability:**
   - Go to Certificates, Identifiers & Profiles → Identifiers
   - Select your App ID (com.execudex.app)
   - Enable "Push Notifications" capability
   - Save

2. **Update app.json:**
   Add push notification configuration:
   ```json
   {
     "expo": {
       "ios": {
         "supportsTablet": true,
         "bundleIdentifier": "com.execudex.app",
         "infoPlist": {
           "ITSAppUsesNonExemptEncryption": false
         },
         "config": {
           "usesNonExemptEncryption": false
         }
       },
       "plugins": [
         [
           "expo-notifications",
           {
             "icon": "./assets/icon.png",
             "color": "#ffffff",
             "sounds": ["./assets/notification.wav"],
             "mode": "production"
           }
         ]
       ]
     }
   }
   ```

### 2. Register Device Tokens

Create a service to register device tokens when users subscribe:

**File: `services/pushTokenService.ts`** (NEW FILE - needs to be created)
```typescript
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { getSupabaseClient } from '../utils/supabase';

export async function registerPushToken(userId: string): Promise<string | null> {
  try {
    if (!Device.isDevice) {
      console.log('Push notifications only work on physical devices');
      return null;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: '4e28ab10-6645-47e9-ba49-fedf1a4a752d', // From your app.json
    });
    const pushToken = tokenData.data;

    // Store token in database
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('user_push_tokens')
      .upsert({
        user_id: userId,
        push_token: pushToken,
        device_type: Platform.OS,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,device_type'
      });

    if (error) {
      console.error('Error storing push token:', error);
      return null;
    }

    return pushToken;
  } catch (error) {
    console.error('Error registering push token:', error);
    return null;
  }
}
```

### 3. Database Table for Push Tokens

Create migration: `supabase/migrations/[timestamp]_create_user_push_tokens.sql`
```sql
CREATE TABLE IF NOT EXISTS user_push_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  push_token TEXT NOT NULL,
  device_type TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, device_type)
);

CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON user_push_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_push_tokens_token ON user_push_tokens(push_token);
```

### 4. Call registerPushToken When User Subscribes

Update `app/index1.tsx` and `app/index2.tsx` subscribe functions to register token:

```typescript
import { registerPushToken } from '../services/pushTokenService';

// In subscribeToProfile function, after successful subscription:
if (user?.id) {
  await registerPushToken(user.id);
}
```

### 5. Update NotificationService to Send via Expo Push API

Replace `sendPushNotification` in `services/notificationService.ts`:

```typescript
private static async sendPushNotification(
  userId: string,
  profileName: string,
  isPpl: boolean,
  categories: string[]
): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    
    // Fetch user's push token
    const { data: tokenData, error: tokenError } = await supabase
      .from('user_push_tokens')
      .select('push_token')
      .eq('user_id', userId)
      .maybeSingle();

    if (tokenError || !tokenData?.push_token) {
      console.log(`No push token found for user ${userId}`);
      return;
    }

    const profileTypeText = isPpl ? `${profileName}'s` : `the ${profileName}`;
    const title = `New Cards for ${profileTypeText} Profile`;
    const body = `New cards for the ${profileTypeText} profile have been generated, come check them out!`;

    // Send via Expo Push Notification API
    const message = {
      to: tokenData.push_token,
      sound: 'default',
      title: title,
      body: body,
      data: { navigateTo: 'notifications' },
      badge: 1,
    };

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      console.error('Error sending push notification:', await response.text());
    }
  } catch (error) {
    console.error('[NotificationService] Error sending push notification:', error);
  }
}
```

### 6. Update Edge Functions to Send Push Notifications

For `supabase/functions/ppl_card_gen/index.ts` and `supabase/functions/bill_cards/index.ts`, add push notification sending logic similar to above (fetch tokens from database and send via Expo API).

### 7. Build with EAS Build

Push notifications require a native build:
```bash
eas build --platform ios --profile production
```

### 8. Test on Physical Device

Push notifications only work on physical iOS devices, not simulators.

## Current Notification Text

The push notification text has been updated to:
- **Title:** "New Cards for [Profile Name]'s Profile" (for politicians) or "New Cards for the [Profile Name] Profile" (for legislation)
- **Body:** "New cards for the [Profile Name]'s profile have been generated, come check them out!" (for politicians) or "New cards for the [Profile Name] profile have been generated, come check them out!" (for legislation)

**Location:** `services/notificationService.ts` lines 113-115

## Notification Navigation

When a user taps a push notification, they are navigated to `/notifications` page.

**Location:** `app/_layout.tsx` - `NotificationNavigationHandler` component

