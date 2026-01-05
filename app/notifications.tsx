import * as Haptics from 'expo-haptics';
import * as ExpoNotifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Image, Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { useAuth } from '../components/AuthProvider';
import { ProfileLoadingIndicator } from '../components/ProfileLoadingIndicator';
import { NavigationService } from '../services/navigationService';
import { NotificationService } from '../services/notificationService';
import { getSupabaseClient } from '../utils/supabase';

const AnimatedPressable = Animated.createAnimatedComponent(View);

interface NotificationData {
  id: number;
  profile_id: string;
  profile_name: string;
  is_ppl: boolean;
  message: string;
  categories: string[];
  created_at: string;
  read: boolean;
}

export default function Notifications() {
  const router = useRouter();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [notificationPermissionStatus, setNotificationPermissionStatus] = useState<ExpoNotifications.PermissionStatus | null>(null);
  const [isLoadingPermissions, setIsLoadingPermissions] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(true);
  
  // Create animated values for each notification card
  const scalesRef = useRef<{ [key: string]: Animated.Value }>({});

  // Initialize scale for a card if it doesn't exist
  const getScale = (key: string) => {
    if (!scalesRef.current[key]) {
      scalesRef.current[key] = new Animated.Value(1);
    }
    return scalesRef.current[key];
  };

  useEffect(() => {
    if (user?.id) {
      fetchUserNotificationSettings();
      // Cleanup old notifications on load
      NotificationService.cleanupOldNotifications();
      // Check notification permission status
      checkNotificationPermissions();
    } else {
      setLoading(false);
    }

  }, [user]);

  // Fetch notifications when notificationsEnabled changes
  useEffect(() => {
    if (user?.id) {
      fetchNotifications();
    }
  }, [user, notificationsEnabled]);

  const fetchUserNotificationSettings = async () => {
    if (!user?.id) return;
    
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('users')
        .select('notifications_enabled')
        .eq('uuid', user.id)
        .maybeSingle();
      
      if (error) {
        console.error('Error fetching notification settings:', error);
        return;
      }
      
      // Default to true if not set (for backwards compatibility)
      setNotificationsEnabled(data?.notifications_enabled ?? true);
    } catch (error) {
      console.error('Error in fetchUserNotificationSettings:', error);
    }
  };

  const checkNotificationPermissions = async () => {
    try {
      const { status } = await ExpoNotifications.getPermissionsAsync();
      setNotificationPermissionStatus(status);
    } catch (error) {
      console.error('Error checking notification permissions:', error);
    }
  };

  const handleToggleNotifications = async () => {
    try {
      setIsLoadingPermissions(true);
      Haptics.selectionAsync();

      if (!user?.id) {
        Alert.alert('Error', 'Please sign in to change notification settings.');
        return;
      }

      const supabase = getSupabaseClient();

      if (notificationsEnabled) {
        // Turning OFF notifications
        const { error } = await supabase
          .from('users')
          .update({ notifications_enabled: false })
          .eq('uuid', user.id);

        if (error) {
          throw error;
        }

        setNotificationsEnabled(false);
        // Clear notifications from view
        setNotifications([]);
      } else {
        // Turning ON notifications
        const currentStatus = await ExpoNotifications.getPermissionsAsync();
        
        if (currentStatus.status === 'granted') {
          // Permissions already granted - just update the flag
          const { error } = await supabase
            .from('users')
            .update({ notifications_enabled: true })
            .eq('uuid', user.id);

          if (error) {
            throw error;
          }

          setNotificationsEnabled(true);
          Alert.alert('Notifications On', 'Notifications are on.');
          // Refresh notifications
          fetchNotifications();
        } else {
          // Permissions not granted - request them
          const { status } = await ExpoNotifications.requestPermissionsAsync();
          setNotificationPermissionStatus(status);
          
          if (status === 'granted') {
            // Update flag and register push token
            const { error } = await supabase
              .from('users')
              .update({ notifications_enabled: true })
              .eq('uuid', user.id);

            if (error) {
              throw error;
            }

            setNotificationsEnabled(true);
            
            // Register push token
            const { registerPushToken } = await import('../services/pushTokenService');
            await registerPushToken(user.id);
            
            Alert.alert('Notifications On', 'You\'re receiving notifications.');
            // Refresh notifications
            fetchNotifications();
          } else {
            Alert.alert('Permission Denied', 'Notifications were denied. You cannot receive notifications without enabling them.');
          }
        }
      }
    } catch (error) {
      console.error('Error toggling notifications:', error);
      Alert.alert('Error', 'Failed to update notification settings. Please try again.');
    } finally {
      setIsLoadingPermissions(false);
    }
  };

  const fetchNotifications = async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    // Don't fetch notifications if user has them disabled
    if (!notificationsEnabled) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await NotificationService.getUserNotifications(user.id);
      setNotifications(data as NotificationData[]);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationPress = async (notification: NotificationData) => {
    // Mark as read
    if (!notification.read) {
      await NotificationService.markAsRead(notification.id, user!.id);
      // Update local state
      setNotifications(prev => 
        prev.map(n => n.id === notification.id ? { ...n, read: true } : n)
      );
    }

    // Delete notification immediately
    try {
      const deleted = await NotificationService.deleteNotification(notification.id, user!.id);
      if (deleted) {
        // Remove from local state
        setNotifications(prev => prev.filter(n => n.id !== notification.id));
        console.log(`[Notifications] Deleted notification ${notification.id} immediately`);
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
    }

    // Navigate to profile
    const profileId = notification.profile_id.replace(/^(ppl|legi)/, '');
    
    try {
      // Fetch subtitle from database
      const supabase = getSupabaseClient();
      let subtitle = '';
      
      if (notification.is_ppl) {
        const { data } = await supabase
          .from('ppl_index')
          .select('sub_name')
          .eq('id', parseInt(profileId))
          .maybeSingle();
        subtitle = data?.sub_name || '';
      } else {
        const { data } = await supabase
          .from('legi_index')
          .select('sub_name')
          .eq('id', parseInt(profileId))
          .maybeSingle();
        subtitle = data?.sub_name || '';
      }
      
      if (notification.is_ppl) {
        // Navigate to politician profile
        await NavigationService.navigateToPoliticianProfile({
          pathname: '/index1',
          params: {
            index: profileId,
            title: notification.profile_name,
            subtitle: subtitle,
            imgKey: 'placeholder',
            numbersObj: JSON.stringify({ red: '50%', green: '50%' })
          }
        }, user?.id);
      } else {
        // Navigate to legislation profile
        await NavigationService.navigateToLegislationProfile({
          pathname: '/index2',
          params: {
            index: profileId,
            title: notification.profile_name,
            subtitle: subtitle,
            imgKey: 'placeholder',
            numbersObj: JSON.stringify({ red: '', green: '' }),
            returnTab: '0',
            returnMode: 'legi'
          }
        }, user?.id);
      }
    } catch (error) {
      console.error('Error fetching profile subtitle:', error);
      // Navigate anyway with empty subtitle if fetch fails
      if (notification.is_ppl) {
        await NavigationService.navigateToPoliticianProfile({
          pathname: '/index1',
          params: {
            index: profileId,
            title: notification.profile_name,
            subtitle: '',
            imgKey: 'placeholder',
            numbersObj: JSON.stringify({ red: '50%', green: '50%' })
          }
        }, user?.id);
      } else {
        await NavigationService.navigateToLegislationProfile({
          pathname: '/index2',
          params: {
            index: profileId,
            title: notification.profile_name,
            subtitle: '',
            imgKey: 'placeholder',
            numbersObj: JSON.stringify({ red: '', green: '' }),
            returnTab: '0',
            returnMode: 'legi'
          }
        }, user?.id);
      }
    }
  };

  const dismissKeyboard = () => {
    Keyboard.dismiss();
  };

  // Filter notifications based on search query
  const filteredNotifications = notifications.filter(notification => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      notification.profile_name.toLowerCase().includes(query) ||
      notification.message.toLowerCase().includes(query) ||
      notification.categories.some(cat => cat.toLowerCase().includes(query))
    );
  });

  // Format date for display
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      // Check if date is valid
      if (isNaN(date.getTime())) {
        console.error('Invalid date string:', dateString);
        return 'Unknown';
      }
      
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      
      // Handle negative differences (future dates)
      if (diffMs < 0) {
        return 'Just now';
      }
      
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffHours / 24);

      if (diffMinutes < 1) {
        return 'Just now';
      } else if (diffMinutes < 60) {
        return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`;
      } else if (diffHours < 24) {
        return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
      } else if (diffDays < 7) {
        return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
      } else {
        return date.toLocaleDateString();
      }
    } catch (error) {
      console.error('Error formatting date:', error, dateString);
      return 'Unknown';
    }
  };

  return (
    <TouchableWithoutFeedback onPress={dismissKeyboard} accessible={false}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.headerContainer}>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => router.back()}
            hitSlop={{ top: 12, left: 12, right: 12, bottom: 12 }}
          >
            <Image source={require('../assets/back1.png')} style={styles.headerIcon} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notifications</Text>
        </View>
        
        {/* Search Bar */}
        {!loading && notifications.length > 0 && (
          <View style={styles.searchBarContainer}>
            <View style={styles.searchBarSurface}>
              <Image source={require('../assets/search.png')} style={styles.searchIcon} />
              <TextInput
                style={styles.searchBarInput}
                placeholder="Search Notifications"
                placeholderTextColor="#666"
                value={String(searchQuery ?? '')}
                onChangeText={(text) => setSearchQuery(String(text ?? ''))}
                blurOnSubmit
              />
              {searchQuery.length > 0 && (
                <Pressable onPress={() => setSearchQuery('')} style={styles.clearButton}>
                  <Text style={styles.clearButtonText}>✕</Text>
                </Pressable>
              )}
            </View>
          </View>
        )}
        
        {/* Notification Toggle Button */}
        {!loading && user && (
          <View style={[
            styles.toggleButtonContainer,
            notifications.length === 0 && styles.toggleButtonContainerTop
          ]}>
            <TouchableOpacity
              onPress={handleToggleNotifications}
              style={styles.toggleButton}
              disabled={isLoadingPermissions}
            >
              <Text style={styles.toggleButtonText}>
                {notificationsEnabled 
                  ? 'Turn off notifications' 
                  : 'Turn on notifications'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
        
        {/* Content */}
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {!user ? (
            <View style={styles.noNotificationsContainer}>
              <Text style={styles.noNotificationsText}>Please sign in to view notifications</Text>
              <Text style={styles.noNotificationsSubtext}>Sign in to see notifications for your subscribed profiles</Text>
            </View>
          ) : loading ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Loading notifications...</Text>
            </View>
          ) : notifications.length === 0 ? (
            <View style={styles.noNotificationsContainer}>
              <Text style={styles.noNotificationsText}>No notifications yet</Text>
              <Text style={styles.noNotificationsSubtext}>You'll receive notifications when new cards are generated for profiles you're subscribed to</Text>
            </View>
          ) : filteredNotifications.length === 0 ? (
            <View style={styles.noNotificationsContainer}>
              <Text style={styles.noNotificationsText}>No notifications match your search</Text>
              <Text style={styles.noNotificationsSubtext}>Try adjusting your search query</Text>
            </View>
          ) : (
            <View style={styles.notificationsContainer}>
              {filteredNotifications.map((notification) => {
                const notificationKey = `notification-${notification.id}`;
                const scale = getScale(notificationKey);

                return (
                  <Animated.View
                    key={notificationKey}
                    style={[
                      { transform: [{ scale }] }
                    ]}
                  >
                    <Pressable
                      onPressIn={() => {
                        Haptics.selectionAsync();
                        Animated.spring(scale, {
                          toValue: 0.95,
                          friction: 6,
                          useNativeDriver: true,
                        }).start();
                      }}
                      onPressOut={() => {
                        Animated.spring(scale, {
                          toValue: 1,
                          friction: 6,
                          useNativeDriver: true,
                        }).start();
                      }}
                      onPress={() => handleNotificationPress(notification)}
                      style={[
                        styles.notificationCard,
                        !notification.read && styles.notificationCardUnread
                      ]}
                    >
                      <View style={styles.notificationCardContent}>
                        <View style={styles.notificationTopRow}>
                          <Text style={styles.notificationTitle} numberOfLines={2}>
                            {notification.profile_name}
                          </Text>
                          <Text style={styles.notificationDate}>
                            {formatDate(notification.created_at)}
                          </Text>
                        </View>
                        <View style={styles.notificationBottomRow}>
                          <Text style={styles.notificationMessage} numberOfLines={3}>
                            {notification.message}
                          </Text>
                        </View>
                        {notification.categories && notification.categories.length > 0 && (
                          <View style={styles.categoriesContainer}>
                            <Text style={styles.categoriesText}>
                              {notification.categories.map(cat => {
                                // Remove "More Selections: " prefix if present (for backwards compatibility)
                                // Just show the page name directly (e.g., "Economy" instead of "More Selections: Economy")
                                return cat.replace(/^More Selections: /, '');
                              }).join(', ')}
                            </Text>
                          </View>
                        )}
                      </View>
                    </Pressable>
                  </Animated.View>
                );
              })}
            </View>
          )}
        </ScrollView>
        
        <ProfileLoadingIndicator 
          visible={loading && !!user}
          title="Loading Notifications"
          subtitle="Please keep the app open while we load your notifications..."
        />
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  headerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 90,
    paddingTop: 46,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#000',
    zIndex: 100,
  },
  headerIconBtn: {
    padding: 8,
    marginHorizontal: 2,
  },
  headerIcon: {
    width: 28,
    height: 28,
    resizeMode: 'contain',
  },
  headerTitle: {
    position: 'absolute',
    marginTop: 40,
    left: 0,
    right: 0,
    color: '#fff',
    fontSize: 18,
    fontWeight: '400',
    textAlign: 'center',
  },
  searchBarContainer: {
    position: 'absolute',
    top: 90,
    left: 0,
    right: 0,
    backgroundColor: '#000',
    paddingVertical: 6,
    paddingHorizontal: 20,
    zIndex: 100,
  },
  toggleButtonContainer: {
    position: 'absolute',
    top: 162, // Below search bar (90 header + 60 search bar + 12 padding)
    left: 0,
    right: 0,
    backgroundColor: '#000',
    paddingHorizontal: 20,
    paddingTop: 15, // Same margin-top as notificationsContainer
    paddingBottom: 0,
    zIndex: 99,
  },
  toggleButtonContainerTop: {
    top: 90, // Below header when no notifications (no search bar)
    paddingTop: 6, // Match search bar padding
  },
  toggleButton: {
    backgroundColor: '#050505',
    borderWidth: 1,
    borderColor: '#101010',
    borderRadius: 20,
    height: 45, // 3/4 of search bar height (60 * 0.75 = 45)
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  toggleButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '400',
    textAlign: 'center',
  },
  searchBarSurface: {
    backgroundColor: '#050505',
    borderWidth: 1,
    borderColor: '#101010',
    width: '100%',
    alignSelf: 'center',
    borderRadius: 20,
    height: 60,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchIcon: {
    width: 20,
    height: 20,
    marginRight: 12,
    tintColor: '#666',
  },
  searchBarInput: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '400',
    flex: 1,
  },
  clearButton: {
    padding: 8,
    marginLeft: 8,
  },
  clearButtonText: {
    color: '#666',
    fontSize: 18,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    paddingTop: 222, // Leave space for header (90), search bar (60), toggle button (45), and padding (27)
    paddingHorizontal: 0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  loadingText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '500',
  },
  noNotificationsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
    paddingHorizontal: 20,
  },
  noNotificationsText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '500',
    marginBottom: 8,
    textAlign: 'center',
  },
  noNotificationsSubtext: {
    color: '#aaa',
    fontSize: 14,
    textAlign: 'center',
  },
  notificationsContainer: {
    width: '100%',
    alignItems: 'center',
    paddingTop: 15, // Adjust this value to increase margin-top of the notification button row
    paddingBottom: 20,
  },
  notificationCard: {
    backgroundColor: '#050505',
    borderRadius: 22,
    padding: 20,
    marginBottom: 10,
    width: '95%',
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    minHeight: 100,
    borderWidth: 1,
    borderColor: '#101010',
  },
  notificationCardUnread: {
    borderColor: '#2a2a2a',
    backgroundColor: '#080808',
  },
  notificationCardContent: {
    width: '100%',
    paddingHorizontal: 0,
    flex: 1,
  },
  notificationTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 8,
  },
  notificationBottomRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    width: '100%',
    marginBottom: 8,
  },
  notificationTitle: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 18,
    flex: 1,
    marginRight: 10,
  },
  notificationDate: {
    color: '#666',
    fontSize: 12,
    fontWeight: '400',
  },
  notificationMessage: {
    color: '#aaa',
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 20,
  },
  categoriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a',
  },
  categoriesLabel: {
    color: '#666',
    fontSize: 12,
    fontWeight: '400',
  },
  categoriesText: {
    color: '#888',
    fontSize: 12,
    fontWeight: '400',
    flex: 1,
  },
});

