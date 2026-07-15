import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { getSupabaseClient } from '../utils/supabase';

/**
 * Register push token for a user
 * Called when user subscribes to a profile or when app starts (optional)
 */
export async function registerPushToken(userId: string): Promise<string | null> {
  try {
    if (!Device.isDevice) {
      console.log('[PushTokenService] Push notifications only work on physical devices');
      return null;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('[PushTokenService] Failed to get push token - permissions not granted');
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: '4e28ab10-6645-47e9-ba49-fedf1a4a752d', // From app.json
    });
    const pushToken = tokenData.data;

    // Store token in database. A genuinely empty {} error (confirmed via
    // JSON.stringify — not just hidden non-enumerable fields) has been
    // observed here, which rules out RLS/schema errors (those always carry a
    // message/code) and points to a swallowed network-layer failure instead.
    // One retry after a short delay covers a transient blip; if it still
    // comes back empty, give up quietly rather than blocking anything.
    const attemptUpsert = () =>
      getSupabaseClient()
        .from('user_push_tokens')
        .upsert({
          user_id: userId,
          push_token: pushToken,
          device_type: Platform.OS,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,device_type'
        });

    let { error } = await attemptUpsert();
    if (error) {
      console.warn('[PushTokenService] First upsert attempt failed, retrying once:', error.message || error);
      await new Promise((resolve) => setTimeout(resolve, 2000));
      ({ error } = await attemptUpsert());
    }

    if (error) {
      console.error('[PushTokenService] Error storing push token after retry:', error.message || JSON.stringify(error));
      return null;
    }

    console.log('[PushTokenService] Push token registered successfully');
    return pushToken;
  } catch (error: any) {
    console.error('[PushTokenService] Error registering push token:', error?.message || error);
    return null;
  }
}

