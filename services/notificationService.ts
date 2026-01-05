import * as Notifications from 'expo-notifications';
import { getCategoryMapping, getScreenDisplayName } from '../utils/cardData';
import { getSupabaseClient } from '../utils/supabase';

/**
 * Service to handle profile subscription notifications
 */
export class NotificationService {
  /**
   * Check subscriptions and send notifications when new cards are created
   * Called after card generation completes
   */
  static async handleCardGenerationNotification(
    profileId: number,
    isPpl: boolean,
    profileName: string,
    categories: Array<{ category: string; screen: string }>,
    userId?: string // Current user who generated cards (optional, to exclude from notifications)
  ): Promise<void> {
    try {
      const supabase = getSupabaseClient();
      const profileIdFormatted = isPpl ? `ppl${profileId}` : `legi${profileId}`;

      // Get all users subscribed to this profile
      const { data: subscriptions, error: subError } = await supabase
        .from('subs')
        .select('user')
        .eq('profile_id', profileIdFormatted);

      if (subError) {
        console.error('[NotificationService] Error fetching subscriptions:', subError);
        return;
      }

      if (!subscriptions || subscriptions.length === 0) {
        console.log('[NotificationService] No subscriptions found for profile:', profileIdFormatted);
        return;
      }

      // Map categories to display names
      const categoryMapping = getCategoryMapping();
      const categoryDisplayNames = categories.map(({ category, screen }) => {
        if (category === 'more') {
          // For "more" category, just return the screen display name directly (e.g., "Economy", "Environment")
          const screenDisplayName = getScreenDisplayName(screen);
          return screenDisplayName;
        } else {
          return categoryMapping[category] || category;
        }
      }).filter(Boolean);

      // Build notification message
      const profileTypeText = isPpl ? `${profileName}'s profile` : `the ${profileName} profile`;
      const message = `New cards have been generated for ${profileTypeText}. The new cards can be found in the categories and pages below`;

      // Filter out the user who generated cards (if provided)
      const subscribedUserIds = subscriptions
        .map(sub => sub.user)
        .filter(uuid => !userId || uuid !== userId);

      if (subscribedUserIds.length === 0) {
        console.log('[NotificationService] No users to notify (all filtered out)');
        return;
      }

      // Check which users have notifications enabled
      const { data: usersWithNotifications, error: usersError } = await supabase
        .from('users')
        .select('uuid')
        .in('uuid', subscribedUserIds)
        .eq('notifications_enabled', true);

      if (usersError) {
        console.error('[NotificationService] Error checking notification preferences:', usersError);
        return;
      }

      const userIdsToNotify = (usersWithNotifications || []).map(u => u.uuid);

      if (userIdsToNotify.length === 0) {
        console.log('[NotificationService] No users with notifications enabled');
        return;
      }

      // Insert notification records into database
      const notificationRecords = userIdsToNotify.map(userUuid => ({
        user_id: userUuid,
        profile_id: profileIdFormatted,
        profile_name: profileName,
        is_ppl: isPpl,
        message: message,
        categories: categoryDisplayNames
      }));

      const { error: insertError } = await supabase
        .from('notifications')
        .insert(notificationRecords);

      if (insertError) {
        console.error('[NotificationService] Error inserting notifications:', insertError);
        return;
      }

      // Send push notifications to all subscribed users with notifications enabled
      await Promise.all(
        userIdsToNotify.map(userUuid => 
          this.sendPushNotification(userUuid, profileName, isPpl, categoryDisplayNames)
        )
      );

      console.log(`[NotificationService] Sent notifications to ${userIdsToNotify.length} users`);
    } catch (error) {
      console.error('[NotificationService] Error in handleCardGenerationNotification:', error);
    }
  }

  /**
   * Send push notification to a user
   * Tries to send via Expo Push API first, falls back to local notification if token not found
   */
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

      const profileTypeText = isPpl ? `${profileName}'s` : `the ${profileName}`;
      const title = `New Cards for ${profileTypeText} Profile`;
      const body = isPpl 
        ? `New cards for ${profileName}'s profile have been generated, come check them out!`
        : `New cards for the ${profileName} profile have been generated, come check them out!`;

      // If push token exists, send via Expo Push API (works when app is closed)
      if (tokenData?.push_token && !tokenError) {
        try {
              const message = {
                to: tokenData.push_token,
                sound: 'notification.wav',
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

          if (response.ok) {
            console.log(`[NotificationService] Push notification sent via Expo API for user ${userId}`);
            return; // Successfully sent via push API
          } else {
            const errorText = await response.text();
            console.error('[NotificationService] Error sending via Expo API:', errorText);
            // Fall through to local notification
          }
        } catch (pushError) {
          console.error('[NotificationService] Error calling Expo Push API:', pushError);
          // Fall through to local notification
        }
      }

      // Fallback: Schedule local notification (works when app is running/background)
      console.log(`[NotificationService] Using local notification fallback for user ${userId}`);
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          sound: 'notification.wav',
          data: { navigateTo: 'notifications' },
        },
        trigger: null, // null = immediate
      });
    } catch (error) {
      console.error('[NotificationService] Error sending push notification:', error);
    }
  }

  /**
   * Get notifications for current user
   * Only returns notifications if user has notifications_enabled = true
   */
  static async getUserNotifications(userId: string, limit: number = 100): Promise<any[]> {
    try {
      const supabase = getSupabaseClient();
      
      // Check if user has notifications enabled
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('notifications_enabled')
        .eq('uuid', userId)
        .maybeSingle();

      if (userError) {
        console.error('[NotificationService] Error checking notification settings:', userError);
        return [];
      }

      // If notifications are disabled, return empty array
      if (userData?.notifications_enabled === false) {
        return [];
      }

      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', oneWeekAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('[NotificationService] Error fetching notifications:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('[NotificationService] Error in getUserNotifications:', error);
      return [];
    }
  }

  /**
   * Mark notification as read
   */
  static async markAsRead(notificationId: number, userId: string): Promise<boolean> {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId)
        .eq('user_id', userId);

      if (error) {
        console.error('[NotificationService] Error marking notification as read:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('[NotificationService] Error in markAsRead:', error);
      return false;
    }
  }

  /**
   * Delete a notification
   */
  static async deleteNotification(notificationId: number, userId: string): Promise<boolean> {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId)
        .eq('user_id', userId);

      if (error) {
        console.error('[NotificationService] Error deleting notification:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('[NotificationService] Error in deleteNotification:', error);
      return false;
    }
  }

  /**
   * Clean up old notifications (older than 1 week)
   */
  static async cleanupOldNotifications(): Promise<void> {
    try {
      const supabase = getSupabaseClient();
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      const { error } = await supabase
        .from('notifications')
        .delete()
        .lt('created_at', oneWeekAgo.toISOString());

      if (error) {
        console.error('[NotificationService] Error cleaning up old notifications:', error);
      }
    } catch (error) {
      console.error('[NotificationService] Error in cleanupOldNotifications:', error);
    }
  }
}

