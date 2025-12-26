import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { useAuth } from '../components/AuthProvider';
import { useProfileLock } from '../hooks/useProfileLock';
import { NavigationService } from '../services/navigationService';
import { showLegislationAlertIfNeeded, showLegislationAlertForTesting, showWeakLegislationAlertIfNeeded, showWeakLegislationAlertForInfoButton } from '../utils/profileAlerts';
import { safeHapticsSelection } from '../utils/safeHaptics';
import { getSupabaseClient } from '../utils/supabase';

import Legi1 from './legislation/legi1';
import Legi2 from './legislation/legi2';
import Legi3 from './legislation/legi3';
import Overview from './overview';

const TABS = [
  { label: 'Overview',  key: 'overview',   component: Overview  },
  { label: 'Agenda',    key: 'agenda',   component: Legi1  },
  { label: 'Impact',  key: 'impact',    component: Legi2  },
  { label: 'Discourse',key: 'discourse',   component: Legi3  },
];

const SCREEN_WIDTH = Dimensions.get('window').width;

export default function Index2({ navigation }: { navigation?: any }) {
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [isWeakProfile, setIsWeakProfile] = useState<boolean>(false);
  const [isMoreSheetVisible, setIsMoreSheetVisible] = useState(false);
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user } = useAuth();
  
  // Profile lock status
  const { lockStatus, isLoading: lockLoading, hideTabBar } = useProfileLock(
    typeof params.index === 'string' ? params.index : undefined, 
    false
  );

  // Show first-time legislation profile alert (normal or weak based on profile status)
  useEffect(() => {
    const showAlert = async () => {
      const profileId = typeof params.index === 'string' ? params.index : undefined;
      
      if (profileId) {
        if (isWeakProfile) {
          // Show weak profile alert for this specific profile
          await showWeakLegislationAlertIfNeeded(user?.id, profileId);
        } else {
          // Show normal first-time alert
          await showLegislationAlertIfNeeded();
        }
      }
    };
    
    showAlert();
  }, [isWeakProfile, params.index, user?.id]);

  // Force tab index to 0 (overview) when profile is locked
  useEffect(() => {
    if (lockStatus?.isLocked && lockStatus.lockedPage === 'overview') {
      setTabIndex(0);
      // Scroll to overview page
      if (scrollRef.current) {
        scrollRef.current.scrollTo({ x: 0, animated: true });
      }
    }
  }, [lockStatus]);
  
  // Check bookmark status when component mounts
  useEffect(() => {
    const checkBookmarkStatus = async () => {
      const index = params.index;
      if (index) {
        try {
          // For now, check if any bookmark exists (without user restriction)
          const supabase = getSupabaseClient();
          const { data: bookmarkData, error: bookmarkError } = await supabase
            .from('bookmarks')
            .select('*')
            .eq('owner_id', index)
            .eq('bookmark_type', 'legi')
            .single();
          
          if (!bookmarkError && bookmarkData) {
            setIsBookmarked(true);
          }
        } catch (error) {
          console.error('Error checking bookmark status:', error);
        }
      }
    };
    
    checkBookmarkStatus();
  }, [params.index]);
  
  // Get title and subtitle from params
  const name = typeof params.title === 'string' ? params.title : 'No Data Available';
  const position = typeof params.subtitle === 'string' ? params.subtitle : 'No Data Available';
  
  // Initialize profileData with prefetched data if available
  const [profileData, setProfileData] = useState<any>(() => {
    if (typeof params.prefetchedProfileData === 'string') {
      try {
        return JSON.parse(params.prefetchedProfileData);
      } catch (e) {
        console.error('Failed to parse prefetched profile data:', e);
        return null;
      }
    }
    return null;
  });
  
  // State for bill status and profile "slug" (for legislation: bill_id)
  const [billStatus, setBillStatus] = useState<string>('No Data');
  const [profileSlug, setProfileSlug] = useState<string | null>(null);
  // (More sheet is a simple non-draggable overlay; no extra animation state needed)
  
  // Fetch bill status, bill_id, and weak status from legi_index when component mounts
  // Note: Access check now happens in NavigationService BEFORE navigation
  useEffect(() => {
    const fetchBillData = async () => {
      const index = params.index;
      if (index) {
        try {
          const supabase = getSupabaseClient();
          const { data: legislationData, error } = await supabase
            .from('legi_index')
            .select('bill_status, bill_id, weak')
            .eq('id', index)
            .single();
          
          if (!error && legislationData) {
            if (legislationData.bill_status) {
              setBillStatus(legislationData.bill_status);
            }
            if (legislationData.bill_id) {
              setProfileSlug(legislationData.bill_id);
            }
            // Set weak status (default to false if not present)
            setIsWeakProfile(legislationData.weak === true);
          }
        } catch (error) {
          console.error('Error fetching bill data:', error);
        }
      }
    };
    
    fetchBillData();
  }, [params.index]);
  
  const [tabIndex, setTabIndex] = useState(0);
  const [isLowMateriality, setIsLowMateriality] = useState(false);
  const [suggestUI, setSuggestUI] = useState<any>(null);
  const scrollRef = useRef<ScrollView>(null);

  // Handle low materiality from bill_cards script
  const handleLowMateriality = useCallback((suggestUI: any) => {
    setIsLowMateriality(true);
    setSuggestUI(suggestUI);
    // Force to overview tab
    setTabIndex(0);
    scrollRef.current?.scrollTo({ x: 0, animated: true });
  }, []);

  // Set up NavigationService callbacks
  useEffect(() => {
    NavigationService.setLowMaterialityCallback((isLowMateriality: boolean, suggestUI?: any) => {
      if (isLowMateriality) {
        handleLowMateriality(suggestUI);
      }
    });
  }, [handleLowMateriality]);

  // Animation values
  const translateX = useRef(new Animated.Value(0)).current;
  const pillWidth = useRef(new Animated.Value(0)).current;
  const scrollX = useRef(new Animated.Value(0)).current;
  const bottomPadding = useRef(new Animated.Value(80)).current; // Animated bottom padding
  // Store tab measurements
  const tabLayouts = useRef<{ x: number; width: number }[]>([]);
  const pillInitialized = useRef(false);
  // Shared scrollY for footer fade
  const scrollY = useRef(new Animated.Value(0)).current;
  
  // Animate bottom padding based on tab bar visibility
  useEffect(() => {
    Animated.timing(bottomPadding, {
      toValue: hideTabBar ? 0 : 80,
      duration: 300,
      useNativeDriver: false, // padding cannot use native driver
    }).start();
  }, [hideTabBar, bottomPadding]);
  
  // Create individual refs for each tab
  const tabRefs = [
    useRef<ScrollView>(null) as React.RefObject<ScrollView>,
    useRef<ScrollView>(null) as React.RefObject<ScrollView>,
    useRef<ScrollView>(null) as React.RefObject<ScrollView>,
    useRef<ScrollView>(null) as React.RefObject<ScrollView>,
    useRef<ScrollView>(null) as React.RefObject<ScrollView>,
    useRef<ScrollView>(null) as React.RefObject<ScrollView>,
  ];


  // When a tab is pressed, animate the pill to its position and width
  function goToTab(idx: number) {
    scrollRef.current?.scrollTo({ x: idx * SCREEN_WIDTH, animated: true });
    setTabIndex(idx);
    
    // Scroll to top of the new tab's content
    // Defensive check: ensure idx is within bounds
    if (idx >= 0 && idx < tabRefs.length && tabRefs[idx]?.current) {
      tabRefs[idx].current?.scrollTo({ y: 0, animated: true });
    }
    
    const layout = tabLayouts.current[idx];
    if (layout) {
      // Use JS-driven animation for both translateX and width to avoid native driver conflicts
      Animated.spring(translateX, {
        toValue: layout.x,
        useNativeDriver: false, // Changed to false to avoid conflicts with width animation
        tension: 100,
        friction: 8,
      }).start();
      // Always animate pillWidth with useNativeDriver: false (width is NOT supported by native driver)
      Animated.spring(pillWidth, {
        toValue: layout.width,
        useNativeDriver: false, // Width must be JS-driven
        tension: 100,
        friction: 8,
      }).start();
    }
  }

  // Handle scroll events to sync the pill position
  // NOTE: useNativeDriver: false is required because we update width (not natively supported)
  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
    { useNativeDriver: false }
  );

  // Update pill position based on scroll
  scrollX.addListener(({ value }) => {
    const progress = value / SCREEN_WIDTH;
    const leftIdx = Math.floor(progress);
    const rightIdx = Math.ceil(progress);
    const lerp = progress - leftIdx;
    const left = tabLayouts.current[leftIdx] || { x: 0, width: 0 };
    const right = tabLayouts.current[rightIdx] || left;
    // Interpolate position and width
    const x = left.x + (right.x - left.x) * lerp;
    const width = left.width + (right.width - left.width) * lerp;
    translateX.setValue(x);
    pillWidth.setValue(width);
    // Update tabIndex for text color
    const newIndex = Math.round(progress);
    if (newIndex !== tabIndex) setTabIndex(newIndex);
  });

  // Function to scroll to top of current tab
  const scrollCurrentTabToTop = () => {
    // Defensive check: ensure tabIndex is within bounds
    if (tabIndex >= 0 && tabIndex < tabRefs.length && tabRefs[tabIndex]?.current) {
      tabRefs[tabIndex].current?.scrollTo({ y: 0, animated: true });
    }
  };

  // Sheet actions (same logic as the previous header icons)
  const handleSheetInfoPress = () => {
    safeHapticsSelection();
    if (isWeakProfile) {
      showWeakLegislationAlertForInfoButton();
    } else {
      showLegislationAlertForTesting();
    }
    setIsMoreSheetVisible(false);
  };

  const handleSheetFeedbackPress = () => {
    safeHapticsSelection();
    try {
      // Pass source as {slug}/{profileId} for legislation profiles
      const profileId = params.index as string;
      if (profileSlug && profileId) {
        const source = `${profileSlug}/${profileId}`;
        router.push(`/feedback?source=${source}`);
      } else {
        router.push('/feedback');
      }
    } catch (error) {
      console.error('[INDEX2] Error navigating to feedback:', error);
    } finally {
      setIsMoreSheetVisible(false);
    }
  };

  // Header
  const Header = useCallback(() => {
    return (
      <View style={styles.headerContainer}>
        <TouchableOpacity
          style={styles.headerIconBtn}
          onPress={() => {
            // Go back to the existing home screen
            router.back();
          }}
          hitSlop={{ top: 12, left: 12, right: 12, bottom: 12 }}
        >
          <Image source={require('../assets/back1.png')} style={styles.headerIcon} />
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <BookmarkButton isBookmarked={isBookmarked} setIsBookmarked={setIsBookmarked} profileId={params.index as string} />
        <TouchableOpacity
          style={[styles.headerIconBtn, styles.headerIconBtnTight]}
          onPress={() => {
            safeHapticsSelection();
            setIsMoreSheetVisible(true);
          }}
          hitSlop={{ top: 12, left: 12, right: 12, bottom: 12 }}
        >
          <Image source={require('../assets/more.png')} style={styles.headerIcon} />
        </TouchableOpacity>
      </View>
    );
  }, [router, isBookmarked, params.index]);

  // Footer with animated pill
  const Footer = useCallback(() => {
    if (isLowMateriality) return null;
    
    // If profile should hide tab bar (locked or limited cards), don't show it
    if (hideTabBar) {
      return null;
    }
    
    return (
      <View style={styles.bottomBarWrapper}>
        <View style={styles.bottomBarPill}>
          <View style={styles.bottomBar}>
            {/* Animated white pill indicator */}
            <Animated.View
              style={[
                styles.animatedPill,
                {
                  transform: [{ translateX }],
                  width: pillWidth,
                },
              ]}
            />
            {TABS.map((tab, idx) => (
              <TouchableOpacity
                key={tab.key}
                style={styles.tabButton}
                activeOpacity={0.85}
                onPress={() => goToTab(idx)}
                onLayout={e => {
                  const { x, width } = e.nativeEvent.layout;
                  tabLayouts.current[idx] = { x, width };
                  // Set initial pill position/width on first render
                  if (idx === tabIndex && !pillInitialized.current) {
                    translateX.setValue(x);
                    pillWidth.setValue(width);
                    pillInitialized.current = true;
                  }
                }}
              >
                <Text style={[styles.tabText, tabIndex === idx && styles.tabTextActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    );
  }, [tabIndex, translateX, pillWidth, isLowMateriality, hideTabBar]);

  // Note: Access check now happens in NavigationService BEFORE navigation
  // This component only loads if access is granted

  return (
    <View style={styles.container}>
      <Header />

      <Animated.ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={!isLowMateriality && !lockStatus?.isLocked}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        onMomentumScrollEnd={e => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
          setTabIndex(idx);
          // Scroll to top when switching tabs via swipe
          if (idx !== tabIndex) {
            setTimeout(() => {
              // Defensive check: ensure idx is within bounds
              if (idx >= 0 && idx < tabRefs.length && tabRefs[idx]?.current) {
                tabRefs[idx].current?.scrollTo({ y: 0, animated: true });
              }
            }, 100);
          }
        }}
      >
        {TABS.map((tab, idx) => {
          // Defensive validation: ensure tab exists and has valid component
          if (!tab || !tab.component) {
            console.error(`Tab missing or invalid for index=${idx}, key=${tab?.key || 'unknown'}`);
            return null;
          }

          // Validate component is a valid React component (function or class)
          const Component = tab.component;
          if (typeof Component !== 'function' && typeof Component !== 'object') {
            console.error(`Tab component is not a valid React component for key=${tab.key}`);
            return null;
          }

          // Additional safety check: ensure component is not null/undefined
          if (Component === null || Component === undefined) {
            console.error(`Tab component is null/undefined for key=${tab.key}`);
            return null;
          }

          // Type assertion for TypeScript - safer than 'as any' as it ensures React component type
          const ValidatedComponent = Component as React.ComponentType<any>;

          return (
            <Animated.View
              key={tab.key}
              style={{
                width: SCREEN_WIDTH,
                flex: 1,
                alignItems: 'stretch',
                justifyContent: 'flex-start',
                paddingTop: 100,   // leave space for header
                paddingBottom: bottomPadding, // animated padding for footer
              }}
            >
              {tab.key === 'overview' ? (
                <ValidatedComponent 
                  name={name} 
                  position={position} 
                  billStatus={billStatus} 
                  isLowMateriality={isLowMateriality} 
                  congressLink={suggestUI?.congress_link}
                  prefetchedProfileData={profileData}
                />
              ) : (
                <ValidatedComponent 
                  name={name} 
                  position={position} 
                  scrollY={scrollY}
                  scrollRef={idx >= 0 && idx < tabRefs.length ? tabRefs[idx] : undefined}
                />
              )}
            </Animated.View>
          );
        })}
      </Animated.ScrollView>

      <Animated.View style={{ opacity: scrollY.interpolate({ inputRange: [0, 120], outputRange: [1, 0.15], extrapolate: 'clamp' }) }}>
        <Footer />
      </Animated.View>

      <Modal
        transparent
        animationType="slide"
        visible={isMoreSheetVisible}
        onRequestClose={() => setIsMoreSheetVisible(false)}
      >
        <View style={styles.moreModalRoot}>
          <Pressable style={styles.moreBackdrop} onPress={() => setIsMoreSheetVisible(false)} />
          <View style={styles.moreSheet}>
            <Text style={styles.moreSheetTitle}>Profile</Text>

            <View style={styles.moreSheetActions}>
              <TouchableOpacity
                style={styles.moreSheetActionBtn}
                activeOpacity={1}
                onPress={handleSheetInfoPress}
                accessibilityRole="button"
              >
                <Text style={styles.moreSheetActionText}>Info</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.moreSheetActionBtn}
                activeOpacity={1}
                onPress={handleSheetFeedbackPress}
                accessibilityRole="button"
              >
                <Text style={styles.moreSheetActionText}>Feedback</Text>
              </TouchableOpacity>
            </View>

            <View style={{ flex: 1 }} />

            <View style={styles.moreCloseButtonRow}>
              <TouchableOpacity
                style={styles.moreCloseButton}
                activeOpacity={1}
                onPress={() => setIsMoreSheetVisible(false)}
                accessibilityRole="button"
              >
                <Text style={styles.moreCloseButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const BookmarkButton = memo(function BookmarkButton({ isBookmarked, setIsBookmarked, profileId }: { isBookmarked: boolean; setIsBookmarked: React.Dispatch<React.SetStateAction<boolean>>; profileId: string | undefined }) {
  const { user } = useAuth();
  
  const handleBookmarkToggle = async () => {
    if (!profileId) return;
    
    const newBookmarkState = !isBookmarked;
    setIsBookmarked(newBookmarkState);
    
    try {
      if (newBookmarkState) {
        // Bookmarking - insert into database
        const bookmarkData: any = {
          owner_id: profileId,
          bookmark_type: 'legi'
        };
        
        // Only add user_id if user is authenticated
        if (user?.id) {
          bookmarkData.user_id = user.id;
        }
        
        const supabase = getSupabaseClient();
        const { error: insertError } = await supabase
          .from('bookmarks')
          .insert(bookmarkData);
        
        if (insertError) {
          console.error('Error inserting bookmark:', insertError);
          // Revert state if insert failed
          setIsBookmarked(false);
        }
      } else {
        // Unbookmarking - delete from database
        const supabase = getSupabaseClient();
        const { error: deleteError } = await supabase
          .from('bookmarks')
          .delete()
          .eq('owner_id', profileId)
          .eq('bookmark_type', 'legi');
        
        if (deleteError) {
          console.error('Error deleting bookmark:', deleteError);
          // Revert state if delete failed
          setIsBookmarked(true);
        }
      }
    } catch (error) {
      console.error('Error handling bookmark:', error);
      // Revert state on error
      setIsBookmarked(!newBookmarkState);
    }
  };

  // Always show bookmark button
  return (
    <TouchableOpacity
      style={styles.headerIconBtn}
      onPress={handleBookmarkToggle}
      hitSlop={{ top: 12, left: 12, right: 12, bottom: 12 }}
    >
      <Image
        source={
          isBookmarked
            ? require('../assets/bookmark2.png')
            : require('../assets/bookmark1.png')
        }
        style={styles.headerIcon}
      />
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  // HEADER
  headerContainer: {
    position: 'absolute',
    top: 30, // edit this to move header up/down
    left: 0,
    right: 0,
    height: 60,
    paddingTop: 16,
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
  headerIconBtnTight: {
    // Pull the last icon slightly left to reduce visual gap vs the bookmark icon
    marginLeft: -6,
  },
  headerIcon: {
    width: 28,
    height: 28,
    resizeMode: 'contain',
  },

  // MORE (bottom sheet overlay)
  moreModalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  moreBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  moreSheet: {
    height: '28.75%',
    backgroundColor: '#080808',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 24,
    justifyContent: 'flex-start',
  },
  moreSheetTitle: {
    fontSize: 16,
    fontWeight: '300',
    color: '#fff',
    marginBottom: 5,
    marginLeft: 13,
    marginTop: 5,
  },
  moreSheetActions: {
    alignItems: 'flex-start',
  },
  moreSheetActionBtn: {
    paddingVertical: 8,
  },
  moreSheetActionText: {
    fontSize: 20,
    fontWeight: '500',
    color: '#fff',
    marginLeft: 13,
  },
  moreCloseButtonRow: {
    alignItems: 'center',
  },
  moreCloseButton: {
    borderRadius: 18,
    paddingHorizontal: 34,
    paddingVertical: 12,
    minHeight: 46,
    width: 120,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2f2f2f',
  },
  moreCloseButtonText: {
    fontSize: 17,
    fontWeight: '500',
    color: '#f2f2f2',
    textAlign: 'center',
  },

  // FOOTER / TABS
  bottomBarWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom:50,
    alignItems: 'center',
    zIndex: 10,
  },
  bottomBarPill: {
    backgroundColor: '#151515',
    borderRadius: 28,
    paddingVertical: 4,
    paddingHorizontal: 10,
    minWidth: 350,
    shadowColor: '#000',
    shadowOpacity: 0.13,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  animatedPill: {
    position: 'absolute',
    backgroundColor: '#fff',
    borderRadius: 18,
    paddingHorizontal: 10,
    paddingVertical: 3,
    minWidth: 50,
    height: 32,
    left: 0,
    top: 0,
    zIndex: 1,
  },
  tabButton: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 32,
    minWidth: 75,
    marginHorizontal: 2,
    zIndex: 2,
  },
  tabText: {
    color: '#fff',
    fontWeight: '500',
    fontSize: 14,
  },
  tabTextActive: {
    color: '#000',
  },

  // MAIN
  container:  { flex: 1, backgroundColor: '#000' },
  animatedPages: { flex: 1 },
}); 