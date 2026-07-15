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
      // Neither the raw object nor its message/code/details/hint fields have
      // surfaced anything useful so far — dump everything we can about its
      // actual shape so the next occurrence is diagnosable instead of another
      // guess.
      let safeStringified = '(stringify failed)';
      try { safeStringified = JSON.stringify(error); } catch {}
      console.error('[PushTokenService] Error storing push token:', {
        message: error.message,
        code: (error as any).code,
        details: (error as any).details,
        hint: (error as any).hint,
        name: (error as any).name,
        typeofError: typeof error,
        keys: Object.keys(error),
        stringified: safeStringified,
        toStringResult: String(error),
      });
      return null;
    }

    console.log('[PushTokenService] Push token registered successfully');
    return pushToken;
  } catch (error: any) {
    console.error('[PushTokenService] Error registering push token:', error?.message || error);
    return null;
  }
}

