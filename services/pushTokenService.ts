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
      console.error('[PushTokenService] Error storing push token:', error);
      return null;
    }

    console.log('[PushTokenService] Push token registered successfully');
    return pushToken;
  } catch (error) {
    console.error('[PushTokenService] Error registering push token:', error);
    return null;
  }
}

