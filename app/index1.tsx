import * as Sentry from '@sentry/react-native';
import { useRouter } from 'expo-router';
import React, { memo, useEffect, useRef, useState } from 'react';
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

// Dummy pages
import { useLocalSearchParams } from 'expo-router';

// #region agent log - module level imports
fetch('http://127.0.0.1:7242/ingest/19849a76-36b4-425e-bfd9-bdf864de6ad5',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index1.tsx:MODULE',message:'Index1 module loading',data:{Sentry:typeof Sentry,React:typeof React,Animated:typeof Animated},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'F'})}).catch(()=>{});
// #endregion
import { useAuth } from '../components/AuthProvider';
import { useProfileLock } from '../hooks/useProfileLock';
import { checkBookmarkStatus, toggleBookmark } from '../utils/bookmarkUtils';
import { showPoliticianAlertForTesting, showPoliticianAlertIfNeeded, showWeakPoliticianAlertForInfoButton, showWeakPoliticianAlertIfNeeded } from '../utils/profileAlerts';
import { safeHapticsSelection } from '../utils/safeHaptics';
import { getSupabaseClient } from '../utils/supabase';
import Sub1 from './profile/sub1';
import Sub2 from './profile/sub2';
import Sub3 from './profile/sub3';
import Synop from './profile/synop';

// Fallback ErrorComponent that displays a user-friendly error message
const ErrorComponent: React.ComponentType<{ componentName?: string }> = ({ componentName = 'Unknown' }) => {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 8, textAlign: 'center' }}>
        Unable to load {componentName}
      </Text>
      <Text style={{ color: '#888', fontSize: 14, textAlign: 'center' }}>
        Please try refreshing the page or contact support if the issue persists.
      </Text>
    </View>
  );
};

// Comprehensive validation: ensure all components are valid before using them
const validateComponent = (component: any, name: string): React.ComponentType<any> => {
  // Log detailed information about the component state
  if (!component) {
    const errorMessage = `[Component Validation] Component '${name}' is null or undefined. This will cause a crash if used.`;
    console.error(errorMessage);
    console.error(`[Component Validation] Stack trace for ${name}:`, new Error().stack);
    
    // Report to Sentry with context
    Sentry.captureMessage(errorMessage, {
      level: 'error',
      tags: {
        componentName: name,
        validationStage: 'module_load',
      },
      extra: {
        componentType: typeof component,
        componentValue: component,
        stackTrace: new Error().stack,
      },
    });
    
    return ErrorComponent;
  }
  
  if (typeof component !== 'function' && typeof component !== 'object') {
    const errorMessage = `[Component Validation] Component '${name}' is not a valid React component. Type: ${typeof component}`;
    console.error(errorMessage, 'Value:', component);
    
    // Report to Sentry
    Sentry.captureMessage(errorMessage, {
      level: 'error',
      tags: {
        componentName: name,
        validationStage: 'type_check',
      },
      extra: {
        componentType: typeof component,
        componentValue: String(component).substring(0, 200), // Limit length
      },
    });
    
    return ErrorComponent;
  }
  
  // Additional check: ensure it's a valid React component (has render or is a function component)
  if (typeof component === 'object' && !component.render && typeof component !== 'function') {
    const errorMessage = `[Component Validation] Component '${name}' appears to be an object but lacks a render method.`;
    console.error(errorMessage);
    
    // Report to Sentry
    Sentry.captureMessage(errorMessage, {
      level: 'error',
      tags: {
        componentName: name,
        validationStage: 'render_check',
      },
      extra: {
        componentType: typeof component,
        hasRender: 'render' in component,
        componentKeys: Object.keys(component).slice(0, 10),
      },
    });
    
    return ErrorComponent;
  }
  
  console.log(`[Component Validation] Component '${name}' validated successfully.`);
  return component as React.ComponentType<any>;
};

// Validate all imported components immediately after import
// This ensures we catch any import failures before they reach the TABS array
let ValidatedSynop: React.ComponentType<any>;
let ValidatedSub1: React.ComponentType<any>;
let ValidatedSub2: React.ComponentType<any>;
let ValidatedSub3: React.ComponentType<any>;

try {
  // #region agent log - validation start
  fetch('http://127.0.0.1:7242/ingest/19849a76-36b4-425e-bfd9-bdf864de6ad5',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index1.tsx:VALIDATE_START',message:'Starting component validation',data:{Synop:typeof Synop,Sub1:typeof Sub1,Sub2:typeof Sub2,Sub3:typeof Sub3},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'F'})}).catch(()=>{});
  // #endregion
  ValidatedSynop = validateComponent(Synop, 'Synop');
  ValidatedSub1 = validateComponent(Sub1, 'Sub1');
  ValidatedSub2 = validateComponent(Sub2, 'Sub2');
  ValidatedSub3 = validateComponent(Sub3, 'Sub3');
  // #region agent log - validation complete
  fetch('http://127.0.0.1:7242/ingest/19849a76-36b4-425e-bfd9-bdf864de6ad5',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index1.tsx:VALIDATE_COMPLETE',message:'Component validation complete',data:{ValidatedSynop:typeof ValidatedSynop,ValidatedSub1:typeof ValidatedSub1},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'F'})}).catch(()=>{});
  // #endregion
} catch (error) {
  // If validation itself fails, log and use ErrorComponent for all
  console.error('[Component Validation] Critical error during validation:', error);
  Sentry.captureException(error, {
    tags: {
      validationStage: 'validation_execution',
    },
    extra: {
      errorMessage: error instanceof Error ? error.message : String(error),
    },
  });
  
  ValidatedSynop = ErrorComponent;
  ValidatedSub1 = ErrorComponent;
  ValidatedSub2 = ErrorComponent;
  ValidatedSub3 = ErrorComponent;
}

// Log validation results for debugging
const validationResults = {
  Synop: ValidatedSynop !== ErrorComponent ? '✓' : '✗',
  Sub1: ValidatedSub1 !== ErrorComponent ? '✓' : '✗',
  Sub2: ValidatedSub2 !== ErrorComponent ? '✓' : '✗',
  Sub3: ValidatedSub3 !== ErrorComponent ? '✓' : '✗',
};

console.log('[Component Validation] All components validated:', validationResults);

// Report validation summary to Sentry if any components failed
if (Object.values(validationResults).some(result => result === '✗')) {
  Sentry.captureMessage('Component validation failures detected', {
    level: 'warning',
    tags: {
      validationStage: 'summary',
    },
    extra: {
      validationResults,
      failedComponents: Object.entries(validationResults)
        .filter(([_, result]) => result === '✗')
        .map(([name]) => name),
    },
  });
}

// Create TABS array with validated components (all components are guaranteed to be valid React components)
const TABS = [
  { label: 'Synopsis',  key: 'synop',   component: ValidatedSynop,  componentName: 'Synop'  },
  { label: 'Agenda',    key: 'sub1a',   component: ValidatedSub1,   componentName: 'Sub1'   },
  { label: 'Identity',  key: 'sub2',    component: ValidatedSub2,   componentName: 'Sub2'   },
  { label: 'Affiliates',key: 'sub3',    component: ValidatedSub3,   componentName: 'Sub3'   },
];

const SCREEN_WIDTH = Dimensions.get('window').width;

// Safe component renderer with error boundary
const ComponentRenderer = memo(function ComponentRenderer({
  Component,
  props,
  componentName,
}: {
  Component: React.ComponentType<any>;
  props: any;
  componentName: string;
}) {
  try {
    // Final runtime check before rendering
    if (!Component || Component === null || Component === undefined) {
      console.error(`[ComponentRenderer] Component is null/undefined for ${componentName}`);
      Sentry.captureMessage(`Component is null/undefined at render time: ${componentName}`, {
        level: 'error',
        tags: {
          componentName,
          validationStage: 'render_time_check',
        },
      });
      return <ErrorComponent componentName={componentName} />;
    }

    if (typeof Component !== 'function' && typeof Component !== 'object') {
      console.error(`[ComponentRenderer] Component is not valid React component for ${componentName}, type=${typeof Component}`);
      Sentry.captureMessage(`Component is not valid React component at render time: ${componentName}`, {
        level: 'error',
        tags: {
          componentName,
          validationStage: 'render_time_type_check',
        },
        extra: {
          componentType: typeof Component,
        },
      });
      return <ErrorComponent componentName={componentName} />;
    }

    // Render the component
    return <Component {...props} />;
  } catch (error) {
    // Catch any rendering errors and report to Sentry
    console.error(`[ComponentRenderer] Error rendering component ${componentName}:`, error);
    Sentry.captureException(error, {
      tags: {
        componentName,
        validationStage: 'component_render',
      },
      extra: {
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
      },
    });
    return <ErrorComponent componentName={componentName} />;
  }
});

export default function Index1({ navigation }: { navigation?: any }) {
  // #region agent log - Index1 entry
  fetch('http://127.0.0.1:7242/ingest/19849a76-36b4-425e-bfd9-bdf864de6ad5',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index1.tsx:COMPONENT_ENTRY',message:'Index1 component entered',data:{hasNavigation:!!navigation},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'F'})}).catch(()=>{});
  // #endregion
  const params = useLocalSearchParams();
  // #region agent log - params
  fetch('http://127.0.0.1:7242/ingest/19849a76-36b4-425e-bfd9-bdf864de6ad5',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index1.tsx:PARAMS',message:'Index1 params',data:{paramsKeys:Object.keys(params),index:params.index,title:params.title?.toString().substring(0,20)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'D'})}).catch(()=>{});
  // #endregion
  const { user } = useAuth();
  const router = useRouter();
  // Align with Index2: treat navigation params as the primary source of display text.
  // We still fetch the same DB rows as before; we just avoid mutating `name/position` from that fetch to reduce churn.
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
  
  // State for profile slug and weak status
  const [profileSlug, setProfileSlug] = useState<string | null>(null);
  const [isWeakProfile, setIsWeakProfile] = useState<boolean>(false);
  const [isMoreSheetVisible, setIsMoreSheetVisible] = useState(false);
  
  const submittedStars = typeof params.submittedStars === 'string' ? parseInt(params.submittedStars) : 0;
  
  // Profile lock status
  const { lockStatus, isLoading: lockLoading, hideTabBar, refetch: refetchLockStatus } = useProfileLock(
    typeof params.index === 'string' ? params.index : undefined, 
    true
  );

  // Show first-time politician profile alert (normal or weak based on profile status)
  useEffect(() => {
    const showAlert = async () => {
      const profileId = typeof params.index === 'string' ? params.index : undefined;
      
      if (profileId) {
        if (isWeakProfile) {
          // Show weak profile alert for this specific profile
          await showWeakPoliticianAlertIfNeeded(user?.id, profileId);
        } else {
          // Show normal first-time alert
          await showPoliticianAlertIfNeeded();
        }
      }
    };
    
    showAlert();
  }, [isWeakProfile, params.index, user?.id]);

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

  // Fetch profile slug and weak status from ppl_index
  useEffect(() => {
    const fetchProfileMetadata = async () => {
      const index = params.index;
      if (index) {
        try {
          const supabase = getSupabaseClient();
          const { data, error } = await supabase
            .from('ppl_index')
            .select('slug, weak')
            .eq('id', index)
            .single();
          
          if (!error && data) {
            if (data.slug) {
              setProfileSlug(data.slug);
            }
            // Set weak status (default to false if not present)
            setIsWeakProfile(data.weak === true);
          }
        } catch (error) {
          console.error('Error fetching profile metadata:', error);
        }
      }
    };
    
    fetchProfileMetadata();
  }, [params.index]);

  // Fetch data from Supabase if index is provided and not already prefetched
  // Note: Access check now happens in NavigationService BEFORE navigation
  useEffect(() => {
    const fetchProfileData = async () => {
      const index = params.index;
      if (index && typeof index === 'string') {
        // Skip fetch if we already have prefetched data
        if (profileData) {
          console.log('Using prefetched profile data, skipping fetch');
          return;
        }
        
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
            // NOTE: crash-isolation test: do not update name/position state here.
            // We still fetch indexData (same as before) but keep UI driven by params.
          }
          
          // Fetch profile data from ppl_profiles
          // Use maybeSingle() to handle cases where profile doesn't exist yet
          const { data: fetchedProfileData, error: profileError } = await supabase
            .from('ppl_profiles')
            .select('index_id, approval, disapproval, synopsis, agenda, identity, affiliates, poll_summary, poll_link, score')
            .eq('index_id', politicianId)
            .maybeSingle();
          
          if (profileError) {
            console.error('Error fetching profile data for index', politicianId, ':', profileError);
          } else if (fetchedProfileData) {
            console.log('Successfully fetched profile data:', fetchedProfileData);
            const profile = fetchedProfileData as { approval?: number | null; disapproval?: number | null; score?: number | null; [key: string]: any };
            console.log('Score from database:', profile.score);
            
            // Update approval/disapproval percentages
            if (profile.approval !== null && profile.approval !== undefined && profile.disapproval !== null && profile.disapproval !== undefined) {
              approvalPercentage = Number(profile.approval);
              disapprovalPercentage = Number(profile.disapproval);
            }
            
            // Store profile data for use in child components
            setProfileData(fetchedProfileData);
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
    // #region agent log - cardRefreshTrigger change
    fetch('http://127.0.0.1:7242/ingest/19849a76-36b4-425e-bfd9-bdf864de6ad5',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index1.tsx:CARD_REFRESH',message:'triggerCardRefresh called',data:{currentValue:cardRefreshTrigger},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'G'})}).catch(()=>{});
    // #endregion
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

  // Note: Access check now happens in NavigationService BEFORE navigation
  // This component only loads if access is granted

  // Sheet actions (same logic as the previous header icons)
  const handleSheetInfoPress = () => {
    safeHapticsSelection();
    if (isWeakProfile) {
      showWeakPoliticianAlertForInfoButton();
    } else {
      showPoliticianAlertForTesting();
    }
    setIsMoreSheetVisible(false);
  };

  const handleSheetFeedbackPress = () => {
    safeHapticsSelection();
    try {
      const profileId = params.index as string | undefined;
      // Pass source as {slug}/{profileId} for politician profiles
      if (profileSlug && profileId) {
        const source = `${profileSlug}/${profileId}`;
        router.push(`/feedback?source=${source}`);
      } else {
        router.push('/feedback');
      }
    } catch (error) {
      console.error('[INDEX1] Error navigating to feedback:', error);
    } finally {
      setIsMoreSheetVisible(false);
    }
  };

  return (
    <View style={styles.container}>
      <Header 
        navigation={navigation}
        router={router}
        isBookmarked={isBookmarked}
        setIsBookmarked={setIsBookmarked}
        profileId={params.index as string}
        onPressMore={() => {
          safeHapticsSelection();
          setIsMoreSheetVisible(true);
        }}
      />

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
          // Defensive validation: ensure tab exists and has valid component
          if (!tab || !tab.component) {
            const errorMessage = `Tab missing or invalid for index=${idx}, key=${tab?.key || 'unknown'}`;
            console.error(`[Component Render] ${errorMessage}`);
            Sentry.captureMessage(errorMessage, {
              level: 'error',
              tags: {
                tabIndex: idx,
                tabKey: tab?.key || 'unknown',
                validationStage: 'tab_existence_check',
              },
            });
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
                <ErrorComponent componentName={tab?.componentName || 'Unknown Tab'} />
              </Animated.View>
            );
          }

          // Runtime validation: ensure component is still valid (double-check)
          const Component = tab.component;
          if (!Component || Component === null || Component === undefined) {
            const errorMessage = `Tab component is null/undefined at runtime for key=${tab.key}`;
            console.error(`[Component Render] ${errorMessage}`);
            Sentry.captureMessage(errorMessage, {
              level: 'error',
              tags: {
                tabIndex: idx,
                tabKey: tab.key,
                componentName: tab.componentName,
                validationStage: 'runtime_null_check',
              },
            });
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
                <ErrorComponent componentName={tab.componentName} />
              </Animated.View>
            );
          }

          // Validate component is a valid React component (function or class)
          if (typeof Component !== 'function' && typeof Component !== 'object') {
            const errorMessage = `Tab component is not a valid React component for key=${tab.key}, type=${typeof Component}`;
            console.error(`[Component Render] ${errorMessage}`);
            Sentry.captureMessage(errorMessage, {
              level: 'error',
              tags: {
                tabIndex: idx,
                tabKey: tab.key,
                componentName: tab.componentName,
                validationStage: 'runtime_type_check',
              },
              extra: {
                componentType: typeof Component,
              },
            });
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
                <ErrorComponent componentName={tab.componentName} />
              </Animated.View>
            );
          }

          // Prepare component and props based on tab key
          let ComponentToRender: React.ComponentType<any> | null = null;
          let componentProps: any = null;

          try {
            if (tab.key === 'synop') {
              // Double-check ValidatedSynop is still valid
              if (ValidatedSynop && ValidatedSynop !== ErrorComponent && typeof ValidatedSynop !== 'undefined') {
                ComponentToRender = ValidatedSynop;
                componentProps = {
                  scrollY,
                  goToTab,
                  name,
                  position,
                  submittedStars,
                  approvalPercentage,
                  disapprovalPercentage,
                  profileData,
                  index: params.index as string | undefined,
                  scrollRef: synopScrollRef,
                  refetchLockStatus,
                  triggerCardRefresh,
                };
              } else {
                console.warn(`[Component Render] ValidatedSynop is invalid or ErrorComponent for tab=${tab.key}`);
              }
            } else {
              // For other tabs, use the validated component from TABS array
              if (Component && Component !== ErrorComponent && typeof Component !== 'undefined') {
                ComponentToRender = Component as React.ComponentType<any>;
                componentProps = {
                  scrollY,
                  name,
                  position,
                  goToTab,
                  ...(params.index ? { index: parseInt(params.index as string) } : {}),
                  scrollRef: tab.key === 'sub1a' ? sub1ScrollRef : tab.key === 'sub2' ? sub2ScrollRef : sub3ScrollRef,
                  cardRefreshTrigger,
                };
              } else {
                console.warn(`[Component Render] Component is invalid or ErrorComponent for tab=${tab.key}`);
              }
            }
          } catch (error) {
            // Catch any errors during component/props preparation
            console.error(`[Component Render] Error preparing component for tab=${tab.key}:`, error);
            Sentry.captureException(error, {
              tags: {
                tabIndex: idx,
                tabKey: tab.key,
                componentName: tab.componentName,
                validationStage: 'props_preparation',
              },
            });
            ComponentToRender = null; // Will fall back to ErrorComponent
          }

          // Render component with error boundary
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
              {ComponentToRender ? (
                <ComponentRenderer
                  Component={ComponentToRender}
                  props={componentProps}
                  componentName={tab.componentName}
                />
              ) : (
                <ErrorComponent componentName={tab.componentName} />
              )}
            </Animated.View>
          );
        })}
      </Animated.ScrollView>

      <Animated.View style={{ opacity: scrollY.interpolate({ inputRange: [0, 120], outputRange: [1, 0.15], extrapolate: 'clamp' }) }}>
        <Footer 
          tabIndex={tabIndex}
          translateX={translateX}
          pillWidth={pillWidth}
          lockStatus={lockStatus}
          goToTab={goToTab}
          tabLayouts={tabLayouts}
          pillInitialized={pillInitialized}
        />
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

// Header component - converted from useCallback to proper React component
const Header = memo(function Header({ 
  navigation, 
  router, 
  isBookmarked, 
  setIsBookmarked, 
  profileId,
  onPressMore
}: { 
  navigation?: any; 
  router: any; 
  isBookmarked: boolean; 
  setIsBookmarked: (value: boolean | ((prev: boolean) => boolean)) => void; 
  profileId: string | undefined;
  onPressMore: () => void;
}) {
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
      <BookmarkButton isBookmarked={isBookmarked} setIsBookmarked={setIsBookmarked} profileId={profileId} />
      <TouchableOpacity
        style={[styles.headerIconBtn, styles.headerIconBtnTight]}
        onPress={onPressMore}
        hitSlop={{ top: 12, left: 12, right: 12, bottom: 12 }}
      >
        <Image source={require('../assets/more.png')} style={styles.headerIcon} />
      </TouchableOpacity>
    </View>
  );
});

// Footer component - converted from useCallback to proper React component
const Footer = memo(function Footer({ 
  tabIndex, 
  translateX, 
  pillWidth, 
  lockStatus, 
  goToTab, 
  tabLayouts, 
  pillInitialized 
}: { 
  tabIndex: number; 
  translateX: Animated.Value; 
  pillWidth: Animated.Value; 
  lockStatus: any; 
  goToTab: (idx: number) => void; 
  tabLayouts: React.MutableRefObject<{ x: number; width: number }[]>; 
  pillInitialized: React.MutableRefObject<boolean>;
}) {
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
});

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
