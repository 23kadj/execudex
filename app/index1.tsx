import { useRouter } from 'expo-router';
import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

// Dummy pages
import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '../components/AuthProvider';
import { useProfileLock } from '../hooks/useProfileLock';
import { checkBookmarkStatus, toggleBookmark } from '../utils/bookmarkUtils';
import { getSupabaseClient } from '../utils/supabase';
import Sub1 from './profile/sub1';
import Sub2 from './profile/sub2';
import Sub3 from './profile/sub3';
import Synop from './profile/synop';

const TABS = [
  { label: 'Synopsis',  key: 'synop',   component: Synop  },
  { label: 'Agenda',    key: 'sub1a',   component: Sub1   },
  { label: 'Identity',  key: 'sub2',    component: Sub2   },
  { label: 'Affiliates',key: 'sub3',    component: Sub3   },
];

const SCREEN_WIDTH = Dimensions.get('window').width;

export default function Index1({ navigation }: { navigation?: any }) {
  const params = useLocalSearchParams();
  const { user } = useAuth();
  const router = useRouter();
  const [name, setName] = useState(typeof params.title === 'string' ? params.title : 'No Data Available');
  const [position, setPosition] = useState(typeof params.subtitle === 'string' ? params.subtitle : 'No Data Available');
  const [profileData, setProfileData] = useState<any>(null);
  const submittedStars = typeof params.submittedStars === 'string' ? parseInt(params.submittedStars) : 0;
  
  // Profile lock status
  const { lockStatus, isLoading: lockLoading, hideTabBar, refetch: refetchLockStatus } = useProfileLock(
    typeof params.index === 'string' ? params.index : undefined, 
    true
  );

  // Force tab index to 0 (synopsis) when profile is locked
  useEffect(() => {
    if (lockStatus?.isLocked && lockStatus.lockedPage === 'synopsis') {
      setTabIndex(0);
      // Scroll to synopsis page
      if (scrollRef.current) {
        scrollRef.current.scrollTo({ x: 0, animated: true });
      }
    }
  }, [lockStatus]);
  
  // Parse the numbers object from params
  let approvalPercentage = 50;
  let disapprovalPercentage = 50;
  if (typeof params.numbersObj === 'string') {
    try {
      const numbers = JSON.parse(params.numbersObj);
      if (numbers.red && numbers.green) {
        // Extract numeric values from percentage strings (e.g., "53.6%" -> 53.6)
        approvalPercentage = parseFloat(numbers.green.replace('%', ''));
        disapprovalPercentage = parseFloat(numbers.red.replace('%', ''));
      }
    } catch (e) {
      console.error('Failed to parse numbersObj:', e);
    }
  }
  
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
            .eq('bookmark_type', 'ppl')
            .maybeSingle();
          
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

  // Fetch data from Supabase if index is provided
  // Note: Access check now happens in NavigationService BEFORE navigation
  useEffect(() => {
    const fetchProfileData = async () => {
      const index = params.index;
      if (index && typeof index === 'string') {
        try {
          console.log('Fetching data for index:', index);
          const politicianId = parseInt(index);
          
          // Fetch basic info from ppl_index
          const supabase = getSupabaseClient();
          const { data: indexData, error: indexError } = await supabase
            .from('ppl_index')
            .select('name, sub_name')
            .eq('id', politicianId)
            .maybeSingle();
          
          if (indexError) {
            console.error('Error fetching politician data for index', politicianId, ':', indexError);
            return;
          }
          
          if (indexData) {
            console.log('Successfully fetched index data:', indexData);
            const index = indexData as { name?: string; sub_name?: string };
            setName(index.name || 'No Data Available');
            setPosition(index.sub_name || 'No Data Available');
          }
          
          // Fetch profile data from ppl_profiles
          // Use maybeSingle() to handle cases where profile doesn't exist yet
          const { data: profileData, error: profileError } = await supabase
            .from('ppl_profiles')
            .select('index_id, approval, disapproval, synopsis, agenda, identity, affiliates, poll_summary, poll_link, score')
            .eq('index_id', politicianId)
            .maybeSingle();
          
          if (profileError) {
            console.error('Error fetching profile data for index', politicianId, ':', profileError);
          } else if (profileData) {
            console.log('Successfully fetched profile data:', profileData);
            const profile = profileData as { approval?: number | null; disapproval?: number | null; score?: number | null; [key: string]: any };
            console.log('Score from database:', profile.score);
            
            // Update approval/disapproval percentages
            if (profile.approval !== null && profile.approval !== undefined && profile.disapproval !== null && profile.disapproval !== undefined) {
              approvalPercentage = Number(profile.approval);
              disapprovalPercentage = Number(profile.disapproval);
            }
            
            // Store profile data for use in child components
            setProfileData(profileData);
          }
        } catch (err) {
          console.error('Error in fetchProfileData:', err);
        }
      }
    };
    
    fetchProfileData();
  }, [params.index]);
  
  // Check bookmark status when component mounts or user changes
  useEffect(() => {
    const checkBookmark = async () => {
      if (user?.id && params.index && typeof params.index === 'string') {
        try {
          const bookmarked = await checkBookmarkStatus(user.id, params.index, 'ppl');
          setIsBookmarked(bookmarked);
        } catch (error) {
          console.error('Error checking bookmark status:', error);
        }
      }
    };
    
    checkBookmark();
  }, [user, params.index]);
  
  const [tabIndex, setTabIndex] = useState(0);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  
  // Refresh trigger for card data - increments when cards are generated from synopsis
  const [cardRefreshTrigger, setCardRefreshTrigger] = useState(0);
  const triggerCardRefresh = () => {
    setCardRefreshTrigger(prev => prev + 1);
  };

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
  
  // Refs to track scroll positions for each tab
  const tabScrollRefs = useRef<(ScrollView | null)[]>([]);
  
  // Create individual refs for each tab
  const synopScrollRef = useRef<ScrollView>(null) as React.RefObject<ScrollView>;
  const sub1ScrollRef = useRef<ScrollView>(null) as React.RefObject<ScrollView>;
  const sub2ScrollRef = useRef<ScrollView>(null) as React.RefObject<ScrollView>;
  const sub3ScrollRef = useRef<ScrollView>(null) as React.RefObject<ScrollView>;

  // When a tab is pressed, animate the pill to its position and width
  function goToTab(idx: number) {
    scrollRef.current?.scrollTo({ x: idx * SCREEN_WIDTH, animated: true });
    setTabIndex(idx);
    
    // Scroll to top of the new tab's content
    const refs = [synopScrollRef, sub1ScrollRef, sub2ScrollRef, sub3ScrollRef];
    // Defensive check: ensure idx is within bounds
    if (idx >= 0 && idx < refs.length && refs[idx]?.current) {
      refs[idx].current?.scrollTo({ y: 0, animated: true });
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
    const refs = [synopScrollRef, sub1ScrollRef, sub2ScrollRef, sub3ScrollRef];
    // Defensive check: ensure tabIndex is within bounds
    if (tabIndex >= 0 && tabIndex < refs.length && refs[tabIndex]?.current) {
      refs[tabIndex].current?.scrollTo({ y: 0, animated: true });
    }
  };

  // Header
  const Header = useCallback(() => {
    return (
      <View style={styles.headerContainer}>
        <TouchableOpacity
          style={styles.headerIconBtn}
          onPress={() =>
            navigation?.goBack ? navigation.goBack() : router.back()
          }
          hitSlop={{ top: 12, left: 12, right: 12, bottom: 12 }}
        >
          <Image source={require('../assets/back1.png')} style={styles.headerIcon} />
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <BookmarkButton isBookmarked={isBookmarked} setIsBookmarked={setIsBookmarked} profileId={params.index as string} />
      </View>
    );
  }, [navigation, router, isBookmarked]);

  // Footer with animated pill
  const Footer = useCallback(() => {
    // If profile is locked, don't show the tab bar
    if (lockStatus?.isLocked) {
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
  }, [tabIndex, translateX, pillWidth, lockStatus]);

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
        scrollEnabled={!lockStatus?.isLocked}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        onMomentumScrollEnd={e => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
          setTabIndex(idx);
          scrollCurrentTabToTop(); // Scroll to top when switching tabs
        }}
      >
        {TABS.map((tab, idx) => {
          // Create a fallback error component to prevent rendering undefined
          const ErrorFallback = () => (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>Unable to load this section</Text>
            </View>
          );

          // Defensive validation: ensure tab exists and has valid component
          if (!tab || !tab.component) {
            console.error(`Tab missing or invalid for index=${idx}, key=${tab?.key || 'unknown'}`);
            return (
              <Animated.View
                key={`error-${idx}`}
                style={{
                  width: SCREEN_WIDTH,
                  flex: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingTop: 100,
                  paddingBottom: bottomPadding,
                }}
              >
                <ErrorFallback />
              </Animated.View>
            );
          }

          // Validate component is a valid React component (function or class)
          const Component = tab.component;
          
          // Comprehensive type checking for React components
          const isValidComponent = 
            typeof Component === 'function' || 
            (typeof Component === 'object' && Component !== null && (Component.$$typeof || Component.render));
          
          if (!isValidComponent || Component === null || Component === undefined) {
            console.error(`Tab component is not a valid React component for key=${tab.key}, type=${typeof Component}`);
            return (
              <Animated.View
                key={tab.key}
                style={{
                  width: SCREEN_WIDTH,
                  flex: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingTop: 100,
                  paddingBottom: bottomPadding,
                }}
              >
                <ErrorFallback />
              </Animated.View>
            );
          }

          // Type assertion for TypeScript - safer than 'as any' as it ensures React component type
          const ValidatedComponent = Component as React.ComponentType<any>;

          return (
            <Animated.View
              key={tab.key}
              style={{
                width: SCREEN_WIDTH,
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                paddingTop: 100,   // leave space for header
                paddingBottom: bottomPadding, // animated padding for footer
              }}
            >
              {tab.key === 'synop' ? (
                <Synop 
                  scrollY={scrollY} 
                  goToTab={goToTab} 
                  name={name} 
                  position={position} 
                  submittedStars={submittedStars}
                  approvalPercentage={approvalPercentage}
                  disapprovalPercentage={disapprovalPercentage}
                  profileData={profileData}
                  index={params.index as string | undefined}
                  scrollRef={synopScrollRef}
                  refetchLockStatus={refetchLockStatus}
                  triggerCardRefresh={triggerCardRefresh}
                />
              ) : (
                <ValidatedComponent 
                  scrollY={scrollY} 
                  name={name} 
                  position={position} 
                  goToTab={goToTab} 
                  {...(params.index ? { index: parseInt(params.index as string) } : {})}
                  scrollRef={tab.key === 'sub1a' ? sub1ScrollRef : tab.key === 'sub2' ? sub2ScrollRef : sub3ScrollRef}
                  cardRefreshTrigger={cardRefreshTrigger}
                />
              )}

            </Animated.View>
          );
        })}
      </Animated.ScrollView>

      <Animated.View style={{ opacity: scrollY.interpolate({ inputRange: [0, 120], outputRange: [1, 0.15], extrapolate: 'clamp' }) }}>
        <Footer />
      </Animated.View>
      
    </View>
  );
}

const BookmarkButton = memo(function BookmarkButton({ isBookmarked, setIsBookmarked, profileId }: { isBookmarked: boolean; setIsBookmarked: (value: boolean | ((prev: boolean) => boolean)) => void; profileId: string | undefined }) {
  const { user } = useAuth();
  
  const handleBookmarkToggle = async () => {
    if (!profileId || !user?.id) return;
    
    const newBookmarkState = !isBookmarked;
    setIsBookmarked(newBookmarkState);
    
    try {
      const success = await toggleBookmark(user.id, profileId, 'ppl', isBookmarked);
      
      if (!success) {
        // Revert state if operation failed
        setIsBookmarked(!newBookmarkState);
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
  headerIcon: {
    width: 28,
    height: 28,
    resizeMode: 'contain',
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
  
  // ERROR FALLBACK
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  errorText: {
    color: '#999',
    fontSize: 16,
    textAlign: 'center',
  },
});
