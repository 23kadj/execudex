import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../../components/AuthProvider';
import { addToHistory } from '../../utils/historyUtils';
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
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user } = useAuth();
  
  // Log entry to card page (crash point)
  const cardId = typeof params.cardId === 'string' ? params.cardId : undefined;
  useEffect(() => {
    console.log('[Legi5] Entering card page', {
      screen: 'legi5',
      cardId: cardId?.substring(0, 10)
    });
  }, [cardId]);
  
  // Dynamic title and subtitle configuration
  const cardTitle = typeof params.cardTitle === 'string' ? params.cardTitle : 'No Data';
  const billName = typeof params.billName === 'string' ? params.billName : 'No Data Available';
  const originalPage = typeof params.originalPage === 'string' ? params.originalPage : '';
  const isMedia = typeof params.isMedia === 'string' ? params.isMedia === 'true' : false;
  
  // Bookmark state
  const [isBookmarked, setIsBookmarked] = useState(false);
  
  // Card content state
  const [cardContent, setCardContent] = useState<{
    title: string;
    body_text: string;
    tldr: string;
    link1: string | null;
    excerpt: string;
  } | null>(null);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  
  // Card index state for subtext, is_active, screen, category, and created_at
  const [cardIndexData, setCardIndexData] = useState<{
    subtext: string;
    is_active: boolean;
    screen?: string;
    category?: string;
    created_at?: string;
  } | null>(null);
  const [isLoadingIndex, setIsLoadingIndex] = useState(false);
  
  // Check bookmark status when component mounts
  useEffect(() => {
    const checkBookmarkStatus = async () => {
      if (cardId) {
        try {
          const supabase = getSupabaseClient();
          // For now, check if any bookmark exists (without user restriction)
          const { data: bookmarkData, error: bookmarkError } = await supabase
            .from('bookmarks')
            .select('*')
            .eq('owner_id', cardId)
            .eq('bookmark_type', 'card')
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
      if (!cardId) return;
      
      // Validate cardId is a valid number before parsing
      const parsedCardId = parseInt(cardId, 10);
      if (isNaN(parsedCardId) || parsedCardId <= 0) {
        console.error('Invalid cardId:', cardId);
        setCardContent(null);
        setIsLoadingContent(false);
        return;
      }
      
      setIsLoadingContent(true);
      try {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase
          .from('card_content')
          .select('title, body_text, tldr, link1, excerpt')
          .eq('card_id', parsedCardId)
          .single();
        
        if (error) {
          console.error('Error fetching card content:', error);
          setCardContent(null);
        } else if (data) {
          setCardContent(data);
        }
      } catch (error) {
        console.error('Error in fetchCardContent:', error);
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
      if (!cardId) return;
      
      // Validate cardId is a valid number before parsing
      const parsedCardId = parseInt(cardId, 10);
      if (isNaN(parsedCardId) || parsedCardId <= 0) {
        console.error('Invalid cardId:', cardId);
        setCardIndexData(null);
        setIsLoadingIndex(false);
        return;
      }
      
      setIsLoadingIndex(true);
      try {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase
          .from('card_index')
          .select('subtext, is_active, screen, category, created_at')
          .eq('id', parsedCardId)
          .single();
        
        if (error) {
          console.error('Error fetching card index data:', error);
          setCardIndexData(null);
        } else if (data) {
          setCardIndexData(data);
        }
      } catch (error) {
        console.error('Error in fetchCardIndexData:', error);
        setCardIndexData(null);
      } finally {
        setIsLoadingIndex(false);
      }
    };
    
    fetchCardIndexData();
  }, [cardId]);

  // Helper function to capitalize first letter of each word
  const capitalizeWords = (str: string) => {
    return str.replace(/\b\w/g, (char) => char.toUpperCase());
  };

  // Helper function to format date as "Month Year"
  const formatLastUpdated = (dateString: string | undefined) => {
    if (!dateString) return 'Last Updated: Unknown';
    
    try {
      const date = new Date(dateString);
      const month = date.toLocaleString('default', { month: 'long' });
      const year = date.getFullYear();
      return `Last Updated: ${month} ${year}`;
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

  // Header with bookmark button
  const Header = useCallback(() => {
    return (
      <View style={styles.headerContainer}>
        <TouchableOpacity
          style={styles.headerIconBtn}
          onPress={() => router.back()}
          hitSlop={{ top: 12, left: 12, right: 12, bottom: 12 }}
        >
          <Image source={require('../../assets/back1.png')} style={styles.headerIcon} />
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        {cardId && (
          <BookmarkButton 
            isBookmarked={isBookmarked} 
            setIsBookmarked={setIsBookmarked} 
            cardId={cardId} 
          />
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
        {isLoadingContent || isLoadingIndex ? (
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
          <InfoSection {...infoSectionStyle} cardContent={cardContent} cardIndexData={cardIndexData} visible={true} handleLinkPress={handleLinkPress} />
        )}
      </ScrollView>
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
    if (!cardId) return;
    
    const newBookmarkState = !isBookmarked;
    setIsBookmarked(newBookmarkState);
    
    try {
      if (newBookmarkState) {
        // Bookmarking - insert into database
        const bookmarkData: any = {
          owner_id: cardId,
          bookmark_type: 'card'
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
          .eq('owner_id', cardId)
          .eq('bookmark_type', 'card');
        
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
  headerIcon: {
    width: 28,
    height: 28,
    resizeMode: 'contain',
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