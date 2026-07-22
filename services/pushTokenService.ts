import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { getSupabaseClient } from '../utils/supabase';

/**
 * Register push token for a user
 * Called when user subscribes to a profile, and once per login from AuthProvider
 * (see the SIGNED_IN / INITIAL_SESSION handling there).
 */
export async function registerPushToken(userId: string): Promise<string | null> {
  try {
    if (!Device.isDevice) {
      console.log('[PushTokenService] Push notifications only work on physical devices');
      return null;
    }

    // Every policy on user_push_tokens is `auth.uid() = user_id`, so the upsert
    // only works once the session has actually rehydrated into the client. If we
    // fire while auth is still restoring from AsyncStorage the request goes out
    // under the anon role and PostgREST rejects it before it can build a body —
    // which is where the featureless `{}` error came from. Confirm the session
    // first; the caller retries on the next SIGNED_IN rather than on a timer.
    const supabase = getSupabaseClient();
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) {
      console.warn('[PushTokenService] Could not read session, skipping registration:', sessionError.message);
      return null;
    }
    if (!session?.user?.id) {
      console.log('[PushTokenService] No active session yet, skipping registration');
      return null;
    }
    if (session.user.id !== userId) {
      console.warn('[PushTokenService] Session user does not match requested user, skipping registration');
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

    const { error, status } = await supabase
      .from('user_push_tokens')
      .upsert({
        user_id: session.user.id,
        push_token: pushToken,
        device_type: Platform.OS,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,device_type'
      });

    if (error) {
      // Always log the HTTP status: a bodyless 401/403 is what an auth/RLS
      // problem looks like here, and it is indistinguishable from a network
      // failure if you only print the (possibly empty) error object.
      console.error(
        `[PushTokenService] Error storing push token (HTTP ${status ?? 'unknown'}):`,
        error.message || JSON.stringify(error)
      );
      return null;
    }

    console.log('[PushTokenService] Push token registered successfully');
    return pushToken;
  } catch (error: any) {
    console.error('[PushTokenService] Error registering push token:', error?.message || error);
    return null;
  }
}
