import * as Haptics from 'expo-haptics';

/**
 * Safely calls Haptics.selectionAsync() with error handling
 * Prevents native crashes from invalid haptics calls
 */
export const safeHapticsSelection = () => {
  try {
    Haptics.selectionAsync().catch(() => {
      // Silently fail if haptics not available or fails
    });
  } catch (error) {
    // Silently fail if haptics not available
  }
};

/**
 * Safely calls Haptics.impactAsync() with error handling
 * Prevents native crashes from invalid haptics calls
 */
export const safeHapticsImpact = (style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Medium) => {
  try {
    Haptics.impactAsync(style).catch(() => {
      // Silently fail if haptics not available or fails
    });
  } catch (error) {
    // Silently fail if haptics not available
  }
};

/**
 * Safely calls Haptics.notificationAsync() with error handling
 * Prevents native crashes from invalid haptics calls
 */
export const safeHapticsNotification = (type: Haptics.NotificationFeedbackType = Haptics.NotificationFeedbackType.Success) => {
  try {
    Haptics.notificationAsync(type).catch(() => {
      // Silently fail if haptics not available or fails
    });
  } catch (error) {
    // Silently fail if haptics not available
  }
};








