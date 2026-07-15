import { getSupabaseClient } from '../utils/supabase';

/**
 * Service to handle profile subscription notifications
 */
export class NotificationService {
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

