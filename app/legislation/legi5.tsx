import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../../components/AuthProvider';
import { addToHistory } from '../../utils/historyUtils';
import { trackCardOpen } from '../../utils/cardOpensTracker';
import { safeNativeCall } from '../../utils/nativeCallDebugger';
import { showCardAlertIfNeeded, showCardAlertForTesting } from '../../utils/profileAlerts';
import { safeHapticsSelection } from '../../utils/safeHaptics';
import { getSupabaseClient } from '../../utils/supabase';

function getDisplayText(url: string) {
  try {
    // If url is a full URL, use the URL object
    const u = new URL(url);
    return u.hostname;
  } catch {
    // If url is not a full URL, fallback to regex for domain extraction
    const match = url.match(/^([a-zA-Z0-9.-]+\\.[a-zA-Z]{2,})/);
    return match ? match[1] : url;
  }
}

function InfoSection({
  gridTitleStyle,
  gridInfoStyle,
  tldrStyle,
  listStyle,
  linkStyles,
  cardContent,
  cardIndexData,
  impactData,
  visible,
  handleLinkPress
}: {
  gridTitleStyle: { container: any; text: any };
  gridInfoStyle: { text: any };
  tldrStyle: { container: any; text: any };
  listStyle: { text: any };
  linkStyles: { pill: any; text: any }[];
  cardContent: {
    title: string;
    body_text: string;
    tldr: string;
    link1: string | null;
    excerpt: string;
  } | null;
  cardIndexData: {
    subtext: string;
    is_active: boolean;
    screen?: string;
    category?: string;
  } | null;
  impactData: string | null;
  visible: boolean;
  handleLinkPress: (url: string) => void;
}) {
  if (!visible) return null;
  
  // Filter out null/empty links - use only link1 as specified
  const availableLinks = [
    cardContent?.link1
  ].filter((link): link is string => Boolean(link && link.trim() !== ''));
  
  return (
    <View style={styles.contentSection}>
      {/* Large Grid Card */}
      <View style={gridTitleStyle.container}>
        <Text style={gridTitleStyle.text}>
          {cardIndexData?.subtext || 'No data'}
        </Text>
        <Text style={gridInfoStyle.text}>
          {cardContent?.body_text || '730 - 740 characters'}
        </Text>
      </View>
      {/* Second Grid Card */}
      <View style={tldrStyle.container}>
        <Text style={tldrStyle.text}>TLDR</Text>
        <View style={styles.listContainer}>
          <Text style={listStyle.text}>
            {cardContent?.tldr || '130 - 140 characters'}
          </Text>
        </View>
      </View>
      {/* Personal Impact Grid Card */}
      <View style={tldrStyle.container}>
        <Text style={tldrStyle.text}>Personal Impact</Text>
        <View style={styles.listContainer}>
          <Text style={listStyle.text}>
            {impactData || 'No Data Available'}
          </Text>
        </View>
      </View>
      {/* Third Grid Card - Excerpt */}
      <View style={tldrStyle.container}>
        <Text style={tldrStyle.text}>Excerpt</Text>
        <View style={styles.listContainer}>
          <Text style={listStyle.text}>
            {cardContent?.excerpt || 'No excerpt available'}
          </Text>
        </View>
      </View>
      {/* Links Row */}
      <View style={styles.linksRow}>
        {availableLinks.map((link, idx) => (
          <TouchableOpacity
            key={`link-${idx}`}
            style={linkStyles[idx].pill}
            onPress={() => handleLinkPress(link)}
            activeOpacity={0.7}
          >
            <Text style={linkStyles[idx].text}>{getDisplayText(link)}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

export default function Legi5() {
  // ============================================
  // VERY EARLY LOGGING - FIRST THING IN COMPONENT
  // ============================================
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user } = useAuth();
  
  // Log screen entry immediately with all params
  console.log('========================================');
  console.log('[LEGI5] SCREEN ENTRY - VERY EARLY');
  console.log('[LEGI5] Timestamp:', new Date().toISOString());
  console.log('[LEGI5] All params (raw):', JSON.stringify(params, null, 2));
  console.log('[LEGI5] Params keys:', Object.keys(params));
  console.log('[LEGI5] User ID:', user?.id || 'null');
  console.log('========================================');
  
  // Extract and validate params with logging
  const cardId = typeof params.cardId === 'string' ? params.cardId : undefined;
  const cardTitle = typeof params.cardTitle === 'string' ? params.cardTitle : 'No Data';
  const billName = typeof params.billName === 'string' ? params.billName : 'No Data Available';
  const originalPage = typeof params.originalPage === 'string' ? params.originalPage : '';
  const isMedia = typeof params.isMedia === 'string' ? params.isMedia === 'true' : false;
  
  console.log('[LEGI5] Extracted params:', {
    cardId: cardId ? `${cardId.substring(0, 10)}...` : 'undefined',
    cardTitle: cardTitle.substring(0, 30),
    billName: billName.substring(0, 30),
    originalPage,
    isMedia,
  });
  
  // Log first native call checkpoint
  console.log('[LEGI5] Checkpoint: Component initialized, about to make first native calls');
  
  // Bookmark state
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [isMoreSheetVisible, setIsMoreSheetVisible] = useState(false);
  
  // Card content state
  const [cardContent, setCardContent] = useState<{
    title: string;
    body_text: string;
    tldr: string;
    link1: string | null;
    excerpt: string;
  } | null>(null);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  
  // Card index state for subtext, is_active, screen, category, created_at, owner_id, and is_ppl
  const [cardIndexData, setCardIndexData] = useState<{
    subtext: string;
    is_active: boolean;
    screen?: string;
    category?: string;
    created_at?: string;
    owner_id?: string;
    is_ppl?: boolean;
  } | null>(null);
  const [isLoadingIndex, setIsLoadingIndex] = useState(false);
  
  // State for profile slug (fetched from ppl_index or legi_index)
  const [profileSlug, setProfileSlug] = useState<string | null>(null);

  // State for impact data
  const [impactData, setImpactData] = useState<string | null>(null);
  const [isLoadingImpact, setIsLoadingImpact] = useState(false);

  // Sheet actions (same logic as previous header icons)
  const handleSheetInfoPress = () => {
    safeHapticsSelection();
    showCardAlertForTesting();
    setIsMoreSheetVisible(false);
  };

  const handleSheetFeedbackPress = () => {
    safeHapticsSelection();
    try {
      // Build source string: {slug}/{owner_id}/{cardId}
      if (cardId && cardIndexData?.owner_id && profileSlug) {
        const source = `${profileSlug}/${cardIndexData.owner_id}/${cardId}`;
        router.push(`/feedback?source=${source}`);
      } else {
        router.push('/feedback');
      }
    } catch (error) {
      console.error('[LEGI5] Error navigating to feedback:', error);
    } finally {
      setIsMoreSheetVisible(false);
    }
  };
  
  // Show first-time card/info card alert
  useEffect(() => {
    showCardAlertIfNeeded();
  }, []);
  
  // Increment opens_7d when page loads
  useEffect(() => {
    if (cardId) {
      trackCardOpen(cardId);
    }
  }, [cardId]);

  // Check bookmark status when component mounts
  useEffect(() => {
    const checkBookmarkStatus = async () => {
      if (!cardId) {
        console.log('[LEGI5] Skipping bookmark check - no cardId');
        return;
      }
      
      console.log('[LEGI5] Checkpoint: Starting bookmark status check');
      
      try {
        const result = await safeNativeCall(
          'supabase',
          'bookmarks.select',
          { owner_id: cardId, bookmark_type: 'card' },
          async () => {
            const supabase = getSupabaseClient();
            const { data: bookmarkData, error: bookmarkError } = await supabase
              .from('bookmarks')
              .select('*')
              .eq('owner_id', cardId)
              .eq('bookmark_type', 'card')
              .maybeSingle();
            
            // Handle errors gracefully - don't throw to prevent TurboModule crash
            if (bookmarkError) {
              // PGRST116 = no rows returned (expected, not an error)
              if (bookmarkError.code === 'PGRST116') {
                return null;
              }
              // For other errors, log but return null instead of throwing
              console.error('[LEGI5] Bookmark query error:', bookmarkError);
              return null;
            }
            
            return bookmarkData;
          }
        );
        
        if (result) {
          console.log('[LEGI5] Bookmark found, setting isBookmarked=true');
          setIsBookmarked(true);
        } else {
          console.log('[LEGI5] No bookmark found');
        }
      } catch (error) {
        console.error('[LEGI5] Error checking bookmark status:', error);
      }
    };
    
    checkBookmarkStatus();
  }, [cardId]);

  // Add card to history when card data is loaded
  useEffect(() => {
    const addCardToHistory = async () => {
      if (cardId && cardContent && billName && user?.id) {
        try {
          await addToHistory({
            id: cardId,
            name: cardContent.title,
            sub_name: billName,
            is_ppl: false, // This is a legislation card page
            item_type: 'card',
          }, user.id);
        } catch (error) {
          console.error('Error adding card to history:', error);
        }
      }
    };
    
    addCardToHistory();
  }, [cardId, cardContent, billName, user?.id]);
  
  // Fetch card content from card_content table
  useEffect(() => {
    const fetchCardContent = async () => {
      if (!cardId) {
        console.log('[LEGI5] Skipping card content fetch - no cardId');
        return;
      }
      
      console.log('[LEGI5] Checkpoint: Starting card content fetch');
      
      // Validate cardId is a valid number before parsing
      const parsedCardId = parseInt(cardId, 10);
      if (isNaN(parsedCardId) || parsedCardId <= 0) {
        console.error('[LEGI5] Invalid cardId:', cardId);
        setCardContent(null);
        setIsLoadingContent(false);
        return;
      }
      
      setIsLoadingContent(true);
      try {
        const result = await safeNativeCall(
          'supabase',
          'card_content.select',
          { card_id: parsedCardId },
          async () => {
            const supabase = getSupabaseClient();
            const { data, error } = await supabase
              .from('card_content')
              .select('title, body_text, tldr, link1, excerpt')
              .eq('card_id', parsedCardId)
              .maybeSingle();
            
            // Handle errors gracefully - don't throw to prevent TurboModule crash
            if (error) {
              // PGRST116 = no rows returned (expected, not an error)
              if (error.code === 'PGRST116') {
                return null;
              }
              // For other errors, log but return null instead of throwing
              console.error('[LEGI5] Card content query error:', error);
              return null;
            }
            
            return data;
          }
        );
        
        if (result) {
          console.log('[LEGI5] Card content fetched successfully');
          setCardContent(result);
        } else {
          console.log('[LEGI5] No card content found');
          setCardContent(null);
        }
      } catch (error) {
        console.error('[LEGI5] Error in fetchCardContent:', error);
        setCardContent(null);
      } finally {
        setIsLoadingContent(false);
      }
    };
    
    fetchCardContent();
  }, [cardId]);
  
  // Fetch card index data for subtext, is_active, screen, and category
  useEffect(() => {
    const fetchCardIndexData = async () => {
      if (!cardId) {
        console.log('[LEGI5] Skipping card index fetch - no cardId');
        return;
      }
      
      console.log('[LEGI5] Checkpoint: Starting card index fetch');
      
      // Validate cardId is a valid number before parsing
      const parsedCardId = parseInt(cardId, 10);
      if (isNaN(parsedCardId) || parsedCardId <= 0) {
        console.error('[LEGI5] Invalid cardId:', cardId);
        setCardIndexData(null);
        setIsLoadingIndex(false);
        return;
      }
      
      setIsLoadingIndex(true);
      try {
        const result = await safeNativeCall(
          'supabase',
          'card_index.select',
          { id: parsedCardId },
          async () => {
            const supabase = getSupabaseClient();
            const { data, error } = await supabase
              .from('card_index')
              .select('subtext, is_active, screen, category, created_at, owner_id, is_ppl')
              .eq('id', parsedCardId)
              .maybeSingle();
            
            // Handle errors gracefully - don't throw to prevent TurboModule crash
            if (error) {
              // PGRST116 = no rows returned (expected, not an error)
              if (error.code === 'PGRST116') {
                return null;
              }
              // For other errors, log but return null instead of throwing
              console.error('[LEGI5] Card index query error:', error);
              return null;
            }
            
            return data;
          }
        );
        
        if (result) {
          console.log('[LEGI5] Card index data fetched successfully');
          setCardIndexData(result);
        } else {
          console.log('[LEGI5] No card index data found');
          setCardIndexData(null);
        }
      } catch (error) {
        console.error('[LEGI5] Error in fetchCardIndexData:', error);
        setCardIndexData(null);
      } finally {
        setIsLoadingIndex(false);
      }
    };
    
    fetchCardIndexData();
  }, [cardId]);

  // Fetch profile slug from ppl_index or legi_index based on card owner
  useEffect(() => {
    const fetchProfileSlug = async () => {
      if (!cardIndexData?.owner_id) {
        return;
      }
      
      try {
        const supabase = getSupabaseClient();
        const tableName = cardIndexData.is_ppl ? 'ppl_index' : 'legi_index';
        const selectField = cardIndexData.is_ppl ? 'slug' : 'bill_id';
        const { data, error } = await supabase
          .from(tableName)
          .select(selectField)
          .eq('id', cardIndexData.owner_id)
          .single();
        
        const value = (data as any)?.[selectField];
        if (!error && value) {
          setProfileSlug(value);
        }
      } catch (error) {
        console.error('[LEGI5] Error fetching profile identifier:', error);
      }
    };
    
    fetchProfileSlug();
  }, [cardIndexData?.owner_id, cardIndexData?.is_ppl]);

  // Fetch impact data from impact table
  useEffect(() => {
    const fetchImpactData = async () => {
      if (!cardId || !user?.id) {
        setImpactData(null);
        setIsLoadingImpact(false);
        return;
      }
      
      console.log('[LEGI5] Checkpoint: Starting impact data fetch');
      
      // Validate cardId is a valid number before parsing
      const parsedCardId = parseInt(cardId, 10);
      if (isNaN(parsedCardId) || parsedCardId <= 0) {
        console.error('[LEGI5] Invalid cardId for impact fetch:', cardId);
        setImpactData(null);
        setIsLoadingImpact(false);
        return;
      }
      
      setIsLoadingImpact(true);
      try {
        const result = await safeNativeCall(
          'supabase',
          'impact.select',
          { card_id: parsedCardId, user_id: user.id },
          async () => {
            const supabase = getSupabaseClient();
            const { data, error } = await supabase
              .from('impact')
              .select('impact')
              .eq('card_id', parsedCardId)
              .eq('user_id', user.id)
              .maybeSingle();
            
            // Handle errors gracefully - don't throw to prevent TurboModule crash
            if (error) {
              // PGRST116 = no rows returned (expected, not an error)
              if (error.code === 'PGRST116') {
                return null;
              }
              // For other errors, log but return null instead of throwing
              console.error('[LEGI5] Impact query error:', error);
              return null;
            }
            
            return data;
          }
        );
        
        if (result && result.impact) {
          console.log('[LEGI5] Impact data fetched successfully');
          setImpactData(result.impact);
        } else {
          console.log('[LEGI5] No impact data found');
          setImpactData(null);
        }
      } catch (error) {
        console.error('[LEGI5] Error in fetchImpactData:', error);
        setImpactData(null);
      } finally {
        setIsLoadingImpact(false);
      }
    };
    
    fetchImpactData();
  }, [cardId, user?.id]);

  // Helper function to capitalize first letter of each word
  const capitalizeWords = (str: string) => {
    return str.replace(/\b\w/g, (char) => char.toUpperCase());
  };

  // Helper function to format date as "Month Day, Year"
  const formatLastUpdated = (dateString: string | undefined) => {
    if (!dateString) return 'Last Updated: Unknown';
    
    try {
      const date = new Date(dateString);
      const month = date.toLocaleString('default', { month: 'long' });
      const day = date.getDate();
      const year = date.getFullYear();
      return `Last Updated: ${month} ${day}, ${year}`;
    } catch (error) {
      return 'Last Updated: Unknown';
    }
  };

  // Determine the category from database data
  const getCategory = () => {
    // First try to get category from card_index data
    if (cardIndexData?.category) {
      // If category is "more", use screen name instead
      if (cardIndexData.category === 'more' && cardIndexData.screen) {
        switch (cardIndexData.screen) {
          case 'agenda_legi': return 'Agenda';
          case 'impact': return 'Impact';
          case 'discourse': return 'Discourse';
          default: return capitalizeWords(cardIndexData.screen);
        }
      }
      return capitalizeWords(cardIndexData.category);
    }
    
    // If no category in database, map from screen value
    if (cardIndexData?.screen) {
      switch (cardIndexData.screen) {
        case 'agenda_legi': return 'Agenda';
        case 'impact': return 'Impact';
        case 'discourse': return 'Discourse';
        default: return capitalizeWords(cardIndexData.screen);
      }
    }
    
    // Fallback to page-based mapping for legacy support
    switch (originalPage) {
      case 'legi1': return 'Agenda';
      case 'legi2': return 'Impact';
      case 'legi3': return 'Discourse';
      case 'legi4': return 'Details';
      default: return '';
    }
  };
  
  const category = getCategory();
  const subtitle = category ? `${billName}: ${category}` : billName;
  
  // Determine sourcing subtext based on is_media value
  // Default to 'Verified Research & Official Records' if isMedia is not provided
  const sourcingSubtext = isMedia === true
    ? 'Verified Media & News'
    : 'Verified Research & Official Records';

  // Handler for haptic feedback
  const handleHaptic = () => {
    safeHapticsSelection();
  };

  // Handler for opening links
  const handleLinkPress = async (url: string) => {
    safeHapticsSelection();
    
    try {
      // Validate URL format before attempting to open
      if (!url || typeof url !== 'string' || url.trim() === '') {
        console.error('Invalid URL:', url);
        return;
      }
      
      // Basic URL validation - must start with http:// or https://
      const trimmedUrl = url.trim();
      if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
        console.error('URL must start with http:// or https://:', trimmedUrl);
        return;
      }
      
      const supported = await Linking.canOpenURL(trimmedUrl);
      if (supported) {
        await Linking.openURL(trimmedUrl);
      } else {
        console.log("Can't open URL: " + trimmedUrl);
      }
    } catch (error) {
      console.error("Error opening URL: ", error);
    }
  };

  // Header with contact and bookmark buttons
  const Header = useCallback(() => {
    const handleBack = () => {
      console.log('[LEGI5] Checkpoint: Back button pressed, about to call router.back()');
      try {
        safeNativeCall('router', 'back', {}, () => {
          router.back();
          return Promise.resolve();
        });
      } catch (error) {
        console.error('[LEGI5] Error calling router.back():', error);
      }
    };
    
    return (
      <View style={styles.headerContainer}>
        <TouchableOpacity
          style={styles.headerIconBtn}
          onPress={handleBack}
          hitSlop={{ top: 12, left: 12, right: 12, bottom: 12 }}
        >
          <Image source={require('../../assets/back1.png')} style={styles.headerIcon} />
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        {cardId && (
          <>
            <BookmarkButton 
              isBookmarked={isBookmarked} 
              setIsBookmarked={setIsBookmarked} 
              cardId={cardId} 
            />
            <TouchableOpacity
              style={[styles.headerIconBtn, styles.headerIconBtnTight]}
              onPress={() => setIsMoreSheetVisible(true)}
              hitSlop={{ top: 12, left: 12, right: 12, bottom: 12 }}
            >
              <Image source={require('../../assets/more.png')} style={styles.headerIcon} />
            </TouchableOpacity>
          </>
        )}
      </View>
    );
  }, [router, cardId, isBookmarked]);

  // InfoSection styles
  const infoSectionStyle = {
    gridTitleStyle: { container: styles.gridContainer, text: styles.title1 },
    gridInfoStyle: { text: styles.info1 },
    tldrStyle: { container: styles.gridContainer2, text: styles.tldr1 },
    listStyle: { text: styles.list1 },
    linkStyles: [
      { pill: styles.linkPill1, text: styles.linkText1 },
      { pill: styles.linkPill2, text: styles.linkText2 },
    ],
  };

  return (
    <View style={styles.container}>
      <Header />
      <ScrollView contentContainerStyle={{ paddingBottom: 30 }} style={{ marginTop: 90 }} showsVerticalScrollIndicator={false}>
        {/* Profile Header Container */}
        <View style={styles.profileHeaderContainer}>
          <Text style={styles.nameText}>{cardTitle}</Text>
          <Text style={styles.subtitleText}>{subtitle}</Text>
          <Text style={styles.subtitleText}>{formatLastUpdated(cardIndexData?.created_at)}</Text>
        </View>

        {/* InfoSections */}
        {isLoadingContent || isLoadingIndex || isLoadingImpact ? (
          <View style={styles.contentSection}>
            <View style={styles.gridContainer}>
              <Text style={styles.title1}>Loading...</Text>
              <Text style={styles.info1}>Loading content...</Text>
            </View>
             <View style={styles.gridContainer2}>
               <Text style={styles.tldr1}>TLDR</Text>
               <View style={styles.listContainer}>
                 <Text style={styles.list1}>Loading...</Text>
               </View>
             </View>
             <View style={styles.gridContainer2}>
               <Text style={styles.tldr1}>Personal Impact</Text>
               <View style={styles.listContainer}>
                 <Text style={styles.list1}>Loading...</Text>
               </View>
             </View>
             <View style={styles.gridContainer2}>
               <Text style={styles.tldr1}>Direct Quotes</Text>
               <View style={styles.listContainer}>
                 <Text style={styles.list1}>Loading...</Text>
               </View>
             </View>
          </View>
        ) : !cardContent && !cardIndexData ? (
          <View style={styles.contentSection}>
            <View style={styles.gridContainer}>
              <Text style={styles.title1}>No Data Available</Text>
              <Text style={styles.info1}>Unable to load card content. Please try again later.</Text>
            </View>
          </View>
        ) : (
          <InfoSection {...infoSectionStyle} cardContent={cardContent} cardIndexData={cardIndexData} impactData={impactData} visible={true} handleLinkPress={handleLinkPress} />
        )}
      </ScrollView>

      <Modal
        transparent
        animationType="slide"
        visible={isMoreSheetVisible}
        onRequestClose={() => setIsMoreSheetVisible(false)}
      >
        <View style={styles.moreModalRoot}>
          <Pressable style={styles.moreBackdrop} onPress={() => setIsMoreSheetVisible(false)} />
          <View style={styles.moreSheet}>
            <Text style={styles.moreSheetTitle}>Info Card</Text>
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

// Bookmark button component
const BookmarkButton = ({ isBookmarked, setIsBookmarked, cardId }: { 
  isBookmarked: boolean; 
  setIsBookmarked: (value: boolean) => void; 
  cardId: string; 
}) => {
  const { user } = useAuth();
  
  const handleBookmarkToggle = async () => {
    if (!cardId) {
      console.log('[LEGI5] Bookmark toggle skipped - no cardId');
      return;
    }
    
    console.log('[LEGI5] Checkpoint: Bookmark toggle', { currentState: isBookmarked });
    
    const newBookmarkState = !isBookmarked;
    setIsBookmarked(newBookmarkState);
    
    try {
      if (newBookmarkState) {
        // Bookmarking - insert into database
        console.log('[LEGI5] Checkpoint: Inserting bookmark');
        const bookmarkData: any = {
          owner_id: cardId,
          bookmark_type: 'card'
        };
        
        // Only add user_id if user is authenticated
        if (user?.id) {
          bookmarkData.user_id = user.id;
        }
        
        await safeNativeCall(
          'supabase',
          'bookmarks.insert',
          bookmarkData,
          async () => {
            const supabase = getSupabaseClient();
            const { error: insertError } = await supabase
              .from('bookmarks')
              .insert(bookmarkData);
            
            if (insertError) {
              throw insertError;
            }
          }
        );
        
        console.log('[LEGI5] Bookmark inserted successfully');
      } else {
        // Unbookmarking - delete from database
        console.log('[LEGI5] Checkpoint: Deleting bookmark');
        await safeNativeCall(
          'supabase',
          'bookmarks.delete',
          { owner_id: cardId, bookmark_type: 'card' },
          async () => {
            const supabase = getSupabaseClient();
            const { error: deleteError } = await supabase
              .from('bookmarks')
              .delete()
              .eq('owner_id', cardId)
              .eq('bookmark_type', 'card');
            
            if (deleteError) {
              throw deleteError;
            }
          }
        );
        
        console.log('[LEGI5] Bookmark deleted successfully');
      }
    } catch (error) {
      console.error('[LEGI5] Error handling bookmark:', error);
      // Revert state on error
      setIsBookmarked(!newBookmarkState);
    }
  };

  return (
    <TouchableOpacity
      style={styles.headerIconBtn}
      onPress={handleBookmarkToggle}
      hitSlop={{ top: 12, left: 12, right: 12, bottom: 12 }}
    >
      <Image
        source={
          isBookmarked
            ? require('../../assets/bookmark2.png')
            : require('../../assets/bookmark1.png')
        }
        style={styles.headerIcon}
      />
    </TouchableOpacity>
  );
};

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
    // Match index1/index2 spacing between bookmark and more icon
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
    marginBottom: 8,
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

  // MAIN
  container: { flex: 1, backgroundColor: '#000' },

  // Profile Header Container (copied from synop.tsx)
  profileHeaderContainer: {
    marginBottom: 2,
    /* marginTop: 100, // Adjusted to account for header */
    alignItems: 'flex-start',
    paddingHorizontal: 10,
    width: '95%',        // ← Set to specific percentage
    alignSelf: 'center', // ← Center the container
  },
  nameText: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '500',
    marginBottom: 2,
    textAlign: 'left',
  },
  subtitleText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '400',
    marginBottom: 3,
    textAlign: 'left',
  },
  lastUpdatedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    marginTop: -8,
  },
  lastUpdatedLabel: {
    color: '#6B6B6B',
    fontSize: 12,
    fontWeight: '400',
    marginRight: -1,
  },
  lastUpdatedData: {
    color: '#6B6B6B',
    fontSize: 12,
    fontWeight: '400',
  },
  
  // Content Section
  // First Box - Body Text (identical to sub5)
  gridContainer: {
    backgroundColor: '#050505',
    width: '95%',
    alignSelf: 'center',
    borderColor: '#101010',
    borderWidth: 1,
    borderRadius: 32,
    marginTop: 5,
    marginBottom: 5,
    paddingTop: 18,
    paddingBottom: 18,
    paddingHorizontal: 20,
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
  },
  title1: {
    color: '#fff',
    fontSize: 19,
    fontWeight: '500',
    textAlign: 'left',
    marginBottom: 15,
  },
  info1: {
    color: '#ccc',
    fontSize: 15,
    fontWeight: '400',
    textAlign: 'left',
  },
  
  // Second Box - TLDR (identical to sub5)
  gridContainer2: {
    backgroundColor: '#050505',
    width: '95%',
    borderColor: '#101010',
    borderWidth: 1,
    alignSelf: 'center',
    borderRadius: 32,
    marginTop: 10,
    marginBottom: 0,
    paddingTop: 18,
    paddingBottom: 5,
    paddingHorizontal: 20,
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
  },
  tldr1: {
    color: '#fff',
    fontSize: 19,
    fontWeight: '500',
    textAlign: 'left',
    marginBottom: 0,
    height: 40,
  },
  list1: {
    color: '#ccc',
    fontSize: 15,
    fontWeight: '400',
    textAlign: 'left',
    marginBottom: 10,
  },
  listContainer: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },

  // Links Row
  linksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    marginBottom: 10,
    width: '100%',
    alignSelf: 'center',
  },
  linkPill1: {
    backgroundColor: '#0A0A0A',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginRight: 10,
    minWidth: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkText1: {
    color: '#434343',
    fontSize: 11,
    fontWeight: '400',
  },
  linkPill2: {
    backgroundColor: '#0A0A0A',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginRight: 10,
    minWidth: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkText2: {
    color: '#434343',
    fontSize: 11,
    fontWeight: '400',
  },

  contentSection: {
    width: '100%',
    alignItems: 'center',
    marginTop: 0,
  },
}); 