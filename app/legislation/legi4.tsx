import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    Animated,
    Image,
    Keyboard,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View
} from 'react-native';
import { CardLoadingIndicator } from '../../components/CardLoadingIndicator';
import { SearchFilterButton } from '../../components/SearchFilterButton';
import { CardService } from '../../services/cardService';
import { CardData, getCategoryFromTitle } from '../../utils/cardData';
import { incrementOpens } from '../../utils/incrementOpens7d';
import { filterCardsByWords, getMostCommonWords, shouldShowSearchAssistance } from '../../utils/searchAssistanceUtils';
import { getSupabaseClient } from '../../utils/supabase';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function Legi4() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const buttonText = typeof params.buttonText === 'string' ? params.buttonText : 'No Data';
  const position = typeof params.title === 'string' ? params.title : 'No Data Available';
  const profileName = typeof params.subtitle === 'string' ? params.subtitle : 'No Data Available';
  const originalPage = typeof params.originalPage === 'string' ? params.originalPage : '';
  const profileIndex = typeof params.profileIndex === 'string' ? params.profileIndex : '';

  // State for card data from card_index table
  const [cardData, setCardData] = useState<CardData[]>([]);
  const [isCardLoading, setIsCardLoading] = useState(false);
  const currentLoadingCardId = useRef<number | null>(null);
  
  // Handle cancel loading
  const handleCancelLoading = () => {
    // Cancel individual card loading
    if (currentLoadingCardId.current !== null) {
      CardService.cancelCardGeneration(currentLoadingCardId.current);
      currentLoadingCardId.current = null;
    }
    setIsCardLoading(false);
    console.log('Loading cancelled by user');
  };
  
  // Search functionality
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<TextInput>(null);
  
  // Search assistance functionality
  const [selectedFilterWords, setSelectedFilterWords] = useState<string[]>([]);
  const [commonWords, setCommonWords] = useState<string[]>([]);
  const [showSearchAssistance, setShowSearchAssistance] = useState(false);
  
  // Filter cards based on search query and selected filter words
  const filteredCardData = (() => {
    let filtered = cardData;
    
    // Apply search query filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(card => 
        card.title?.toLowerCase().includes(query) ||
        card.subtext?.toLowerCase().includes(query)
      );
    }
    
    // Apply selected filter words
    if (selectedFilterWords.length > 0) {
      filtered = filterCardsByWords(filtered, selectedFilterWords);
    }
    
    return filtered;
  })();
  
  // Keyboard dismissal function
  const dismissKeyboard = useCallback(() => {
    Keyboard.dismiss();
    searchInputRef.current?.blur();
  }, []);

  // Determine the tab name based on original page
  const getTabName = (page: string) => {
    switch (page) {
      case 'legi1': return 'Agenda';
      case 'legi2': return 'Impact';
      case 'legi3': return 'Discourse';
      default: return '';
    }
  };
  
  const tabName = getTabName(originalPage);

  // Fetch category card data from card_index table based on buttonText category
  useEffect(() => {
    const fetchCategoryCardDataFromDB = async () => {
      if (profileIndex) {
        try {
          // Get category from buttonText (page title)
          const category = getCategoryFromTitle(buttonText);
          
          // Direct Supabase query for category filtering (no preview exclusion)
          const supabase = getSupabaseClient();
          const { data, error } = await supabase
            .from('card_index')
            .select('id, title, subtext, screen, category, opens_7d, score')
            .eq('owner_id', parseInt(profileIndex))
            .eq('is_ppl', false)
            .eq('category', category)
            .eq('is_active', true)
            .order('opens_7d', { ascending: false });
          
          if (error) {
            console.error('Error fetching category card data:', error);
            setCardData([]);
          } else {
            // Sort by opens_7d descending (with fallback to score)
            const sortedData = (data || []).sort((a, b) => {
              // Primary ordering: opens_7d (descending)
              if (a.opens_7d !== null && a.opens_7d !== undefined && 
                  b.opens_7d !== null && b.opens_7d !== undefined) {
                return b.opens_7d - a.opens_7d;
              }
              
              // Fallback ordering: score (descending) when opens_7d is not available
              if (a.score !== null && a.score !== undefined && 
                  b.score !== null && b.score !== undefined) {
                return b.score - a.score;
              }
              
              // If neither has opens_7d, prioritize the one with score
              if (a.score !== null && a.score !== undefined) return -1;
              if (b.score !== null && b.score !== undefined) return 1;
              
              // If neither has opens_7d nor score, maintain original order
              return 0;
            });
            
            setCardData(sortedData);
            
            // Update search assistance
            const shouldShow = shouldShowSearchAssistance(sortedData);
            setShowSearchAssistance(shouldShow);
            
            if (shouldShow) {
              const mostCommon = getMostCommonWords(sortedData, 10);
              setCommonWords(mostCommon);
            } else {
              setCommonWords([]);
              setSelectedFilterWords([]);
            }
          }
        } catch (error) {
          console.error('Error fetching category card data:', error);
          setCardData([]);
        }
      }
    };

    fetchCategoryCardDataFromDB();
  }, [profileIndex, buttonText]);

  // Get visible cards - show all active cards for legislation profiles
  const getVisibleCards = () => {
    if (!cardData || cardData.length === 0) return [];
    return cardData;
  };

  // Animated scale values for cards (extended for dynamic rendering)
  const card1Scale = useRef(new Animated.Value(1)).current;
  const card2Scale = useRef(new Animated.Value(1)).current;
  const card3Scale = useRef(new Animated.Value(1)).current;
  const card4Scale = useRef(new Animated.Value(1)).current;
  const card5Scale = useRef(new Animated.Value(1)).current;
  const card6Scale = useRef(new Animated.Value(1)).current;
  const card7Scale = useRef(new Animated.Value(1)).current;
  const card8Scale = useRef(new Animated.Value(1)).current;
  const card9Scale = useRef(new Animated.Value(1)).current;
  const card10Scale = useRef(new Animated.Value(1)).current;
  const card11Scale = useRef(new Animated.Value(1)).current;
  const card12Scale = useRef(new Animated.Value(1)).current;
  const card13Scale = useRef(new Animated.Value(1)).current;
  const card14Scale = useRef(new Animated.Value(1)).current;
  const card15Scale = useRef(new Animated.Value(1)).current;

  // Render cards dynamically based on available data (copied from sub4.tsx)
  const renderCards = () => {
    const cards = filteredCardData;
    const cardScales = [card1Scale, card2Scale, card3Scale, card4Scale, card5Scale, card6Scale, card7Scale, card8Scale, card9Scale, card10Scale, card11Scale, card12Scale, card13Scale, card14Scale, card15Scale];
    
    return cards.map((card, index) => {
      const cardNumber = index + 1;
      // Use a fallback animated value for cards beyond the first 15
      const cardScale = index < cardScales.length ? cardScales[index] : card1Scale;
      
      // Get styles safely with fallbacks
      const getCardStyle = (number: number) => {
        // For cards beyond 15, use card1 style as fallback
        const styleNumber = Math.min(number, 15);
        switch (styleNumber) {
          case 1: return styles.card1;
          case 2: return styles.card2;
          case 3: return styles.card3;
          case 4: return styles.card4;
          case 5: return styles.card5;
          case 6: return styles.card6;
          case 7: return styles.card7;
          case 8: return styles.card8;
          case 9: return styles.card9;
          case 10: return styles.card10;
          case 11: return styles.card11;
          case 12: return styles.card12;
          case 13: return styles.card13;
          case 14: return styles.card14;
          case 15: return styles.card15;
          default: return styles.card1;
        }
      };
      
      const getTitleRowStyle = (number: number) => {
        const styleNumber = Math.min(number, 15);
        switch (styleNumber) {
          case 1: return styles.titleRow1;
          case 2: return styles.titleRow2;
          case 3: return styles.titleRow3;
          case 4: return styles.titleRow4;
          case 5: return styles.titleRow5;
          case 6: return styles.titleRow6;
          case 7: return styles.titleRow7;
          case 8: return styles.titleRow8;
          case 9: return styles.titleRow9;
          case 10: return styles.titleRow10;
          case 11: return styles.titleRow11;
          case 12: return styles.titleRow12;
          case 13: return styles.titleRow13;
          case 14: return styles.titleRow14;
          case 15: return styles.titleRow15;
          default: return styles.titleRow1;
        }
      };
      
      const getTitleStyle = (number: number) => {
        const styleNumber = Math.min(number, 15);
        switch (styleNumber) {
          case 1: return styles.title1;
          case 2: return styles.title2;
          case 3: return styles.title3;
          case 4: return styles.title4;
          case 5: return styles.title5;
          case 6: return styles.title6;
          case 7: return styles.title7;
          case 8: return styles.title8;
          case 9: return styles.title9;
          case 10: return styles.title10;
          case 11: return styles.title11;
          case 12: return styles.title12;
          case 13: return styles.title13;
          case 14: return styles.title14;
          case 15: return styles.title15;
          default: return styles.title1;
        }
      };
      
      const getSubtextStyle = (number: number) => {
        const styleNumber = Math.min(number, 15);
        switch (styleNumber) {
          case 1: return styles.subtext1;
          case 2: return styles.subtext2;
          case 3: return styles.subtext3;
          case 4: return styles.subtext4;
          case 5: return styles.subtext5;
          case 6: return styles.subtext6;
          case 7: return styles.subtext7;
          case 8: return styles.subtext8;
          case 9: return styles.subtext9;
          case 10: return styles.subtext10;
          case 11: return styles.subtext11;
          case 12: return styles.subtext12;
          case 13: return styles.subtext13;
          case 14: return styles.subtext14;
          case 15: return styles.subtext15;
          default: return styles.subtext1;
        }
      };
      
      return (
          <AnimatedPressable
          key={card.id}
            onPressIn={() => {
              Haptics.selectionAsync();
            Animated.spring(cardScale, {
                toValue: 0.95,
                friction: 6,
                useNativeDriver: true,
              }).start();
            }}
            onPressOut={() => {
            Animated.spring(cardScale, {
                toValue: 1,
                friction: 6,
                useNativeDriver: true,
              }).start();
            }}
          onPress={async () => {
            const cardId = String(card.id || '');
            if (cardId) {
              // Validate cardId is a valid number before parsing
              const parsedCardId = parseInt(cardId, 10);
              if (isNaN(parsedCardId) || parsedCardId <= 0) {
                console.error('Invalid cardId:', cardId);
                return;
              }
              
              incrementOpens(cardId);
              
              // Track the currently loading card
              currentLoadingCardId.current = parsedCardId;
              
              // Execute full_card_gen script
              let wasCancelled = false;
              try {
                await CardService.generateFullCard(parsedCardId, setIsCardLoading, false);
              } catch (error: any) {
                if (error?.message === 'CANCELLED') {
                  console.log('Card loading was cancelled, not navigating');
                  wasCancelled = true;
                } else {
                  console.error('Error generating full card:', error);
                  // Continue with navigation even if card generation fails (non-cancellation error)
                }
              } finally {
                currentLoadingCardId.current = null;
              }
              
              // Only navigate if not cancelled
              if (wasCancelled) {
                return;
              }
            }
            router.push({
                pathname: '/legislation/legi5',
                params: { 
              cardTitle: card.title || 'No Data',
                  billName: profileName,
                  tabName: tabName,
                  cardId: cardId
                }
          });
          }}
            style={[
            getCardStyle(cardNumber),
            { transform: [{ scale: cardScale }] }
            ]}
          >
          <View style={getTitleRowStyle(cardNumber)}>
            <Text style={getTitleStyle(cardNumber)}>{card.title || 'No data now'}</Text>
            </View>
          <Text style={getSubtextStyle(cardNumber)}>{card.subtext || 'no data now'}</Text>
          </AnimatedPressable>
      );
    });
  };

  // Handler for filter word selection (max 2 selections)
  const handleFilterWordPress = (word: string) => {
    setSelectedFilterWords(prev => {
      if (prev.includes(word)) {
        // Remove the word if it's already selected
        return prev.filter(w => w !== word);
      } else {
        // Add the word only if we have less than 2 selections
        if (prev.length < 2) {
          return [...prev, word];
        } else {
          // If already at max, replace the first selected word
          return [prev[1], word];
        }
      }
    });
  };

  // Header
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
            </View>
    );
  }, [router]);

  return (
    <TouchableWithoutFeedback onPress={dismissKeyboard}>
      <View style={styles.container}>
        <Header />
        
        {/* Profile Header Container */}
        <View style={styles.profileHeaderContainer}>
          <View style={styles.headerRow}>
            <View style={styles.leftContent}>
              <Text style={styles.nameText}>{buttonText}</Text>
              <Text style={styles.subtitleText}>{profileName}: {tabName}</Text>
            </View>
          </View>
        </View>

      <ScrollView
        style={{ flex: 1, width: '100%' }}
        contentContainerStyle={{ width: '100%' }}
        showsVerticalScrollIndicator={false}
        onScrollBeginDrag={dismissKeyboard}
      >
        {/* Search Bar */}
        <View style={styles.searchBarContainer}>
          <Image source={require('../../assets/search.png')} style={styles.searchIcon} />
          <TextInput
            ref={searchInputRef}
            style={styles.searchBarInput}
            placeholder={String(`Search ${buttonText ?? ''} Cards`)}
            placeholderTextColor="#666"
            value={String(searchQuery ?? '')}
            onChangeText={(text) => setSearchQuery(String(text ?? ''))}
            keyboardAppearance={Platform.OS === 'ios' ? 'dark' : 'default'}
            blurOnSubmit={true}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => {
              setSearchQuery('');
              dismissKeyboard();
            }} style={styles.clearButton}>
              <Text style={styles.clearButtonText}>✕</Text>
            </Pressable>
          )}
        </View>

        {/* Search Assistance Filter Buttons */}
        {showSearchAssistance && commonWords.length > 0 && (
          <View style={styles.searchAssistanceContainer}>
            <View style={styles.filterButtonsContainer}>
              {commonWords.map((word, index) => (
                <SearchFilterButton
                  key={`${word}-${index}`}
                  word={word}
                  isSelected={selectedFilterWords.includes(word)}
                  onPress={handleFilterWordPress}
                />
              ))}
            </View>
          </View>
        )}

        {/* Cards Container */}
        <View style={styles.cardsContainer}>
          {renderCards()}
        </View>
      </ScrollView>
      
      <CardLoadingIndicator 
        visible={isCardLoading} 
        onCancel={handleCancelLoading}
        title="Loading Card"
        subtitle="Please keep the app open while we prepare your card..."
      />
      </View>
    </TouchableWithoutFeedback>
  );
}



const styles = StyleSheet.create({
  // HEADER
  headerContainer: {
    position: 'absolute',
    top: 30,
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

  // Profile Header Container
  profileHeaderContainer: {
    marginBottom: 2,
    marginTop: 100,
    alignItems: 'flex-start',
    paddingHorizontal: 10,
    width: '95%',
    alignSelf: 'center',
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
    marginBottom: 10,
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    width: '100%',
  },
  leftContent: {
    flex: 1,
    alignItems: 'flex-start',
  },

  // Cards Container
  cardsContainer: {
    paddingHorizontal: 0,
    paddingBottom: 20,
  },

  // Card 1 styles
  card1: {
    backgroundColor: '#050505',
    borderRadius: 28,
    padding: 20,
    marginBottom: 15,
    width: '95%',
    minHeight: 100,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    borderWidth: 1,
    borderColor: '#101010',
  },
  titleRow1: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginBottom: 0,
  },
  title1: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '500',
    flexWrap: 'wrap',
    flexShrink: 1,
  },

  subtext1: {
    color: '#ccc',
    fontSize: 14,
    marginTop: 6,
    fontWeight: '400',
  },

  // Card 2 styles
  card2: {
    backgroundColor: '#050505',
    borderRadius: 28,
    padding: 20,
    marginBottom: 15,
    width: '95%',
    minHeight: 100,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    borderWidth: 1,
    borderColor: '#101010',
  },
  titleRow2: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginBottom: 0,
  },
  title2: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '500',
    flexWrap: 'wrap',
    flexShrink: 1,
  },

  subtext2: {
    color: '#ccc',
    fontSize: 14,
    marginTop: 6,
    fontWeight: '400',
  },

  // Card 3 styles
  card3: {
    backgroundColor: '#050505',
    borderRadius: 28,
    padding: 20,
    marginBottom: 15,
    width: '95%',
    minHeight: 100,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    borderWidth: 1,
    borderColor: '#101010',
  },
  titleRow3: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginBottom: 0,
  },
  title3: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '500',
    flexWrap: 'wrap',
    flexShrink: 1,
  },

  subtext3: {
    color: '#ccc',
    fontSize: 14,
    marginTop: 6,
    fontWeight: '400',
  },

  // Card 4 styles
  card4: {
    backgroundColor: '#050505',
    borderRadius: 28,
    padding: 20,
    marginBottom: 15,
    width: '95%',
    minHeight: 100,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    borderWidth: 1,
    borderColor: '#101010',
  },
  titleRow4: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginBottom: 0,
  },
  title4: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '500',
    flexWrap: 'wrap',
    flexShrink: 1,
  },

  subtext4: {
    color: '#ccc',
    fontSize: 14,
    marginTop: 6,
    fontWeight: '400',
  },

  // Card 5 styles
  card5: {
    backgroundColor: '#050505',
    borderRadius: 28,
    padding: 20,
    marginBottom: 15,
    width: '95%',
    minHeight: 100,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    borderWidth: 1,
    borderColor: '#101010',
  },
  titleRow5: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginBottom: 0,
  },
  title5: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '500',
  },

  subtext5: {
    color: '#ccc',
    fontSize: 14,
    marginTop: 6,
    fontWeight: '400',
  },

  // Card 6 styles
  card6: {
    backgroundColor: '#050505',
    borderRadius: 28,
    padding: 20,
    marginBottom: 15,
    width: '95%',
    minHeight: 100,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    borderWidth: 1,
    borderColor: '#101010',
  },
  titleRow6: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginBottom: 0,
  },
  title6: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '500',
  },

  subtext6: {
    color: '#ccc',
    fontSize: 14,
    marginTop: 6,
    fontWeight: '400',
  },

  // Card 7 styles
  card7: {
    backgroundColor: '#050505',
    borderRadius: 28,
    padding: 20,
    marginBottom: 15,
    width: '95%',
    minHeight: 100,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    borderWidth: 1,
    borderColor: '#101010',
  },
  titleRow7: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginBottom: 0,
  },
  title7: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '500',
  },

  subtext7: {
    color: '#ccc',
    fontSize: 14,
    marginTop: 6,
    fontWeight: '400',
  },

  // Card 8 styles
  card8: {
    backgroundColor: '#050505',
    borderRadius: 28,
    padding: 20,
    marginBottom: 15,
    width: '95%',
    minHeight: 100,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    borderWidth: 1,
    borderColor: '#101010',
  },
  titleRow8: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginBottom: 0,
  },
  title8: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '500',
  },

  subtext8: {
    color: '#ccc',
    fontSize: 14,
    marginTop: 6,
    fontWeight: '400',
  },

  // Card 9 styles
  card9: {
    backgroundColor: '#050505',
    borderRadius: 28,
    padding: 20,
    marginBottom: 15,
    width: '95%',
    minHeight: 100,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    borderWidth: 1,
    borderColor: '#101010',
  },
  titleRow9: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginBottom: 0,
  },
  title9: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '500',
  },

  subtext9: {
    color: '#ccc',
    fontSize: 14,
    marginTop: 6,
    fontWeight: '400',
  },

  // Card 10 styles
  card10: {
    backgroundColor: '#050505',
    borderRadius: 28,
    padding: 20,
    marginBottom: 15,
    width: '95%',
    minHeight: 100,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    borderWidth: 1,
    borderColor: '#101010',
  },
  titleRow10: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginBottom: 0,
  },
  title10: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '500',
  },

  subtext10: {
    color: '#ccc',
    fontSize: 14,
    marginTop: 6,
    fontWeight: '400',
  },

  // Card 11 styles
  card11: {
    backgroundColor: '#050505',
    borderRadius: 28,
    padding: 20,
    marginBottom: 15,
    width: '95%',
    minHeight: 100,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    borderWidth: 1,
    borderColor: '#101010',
  },
  titleRow11: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginBottom: 0,
  },
  title11: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '500',
  },
  subtext11: {
    color: '#ccc',
    fontSize: 14,
    marginTop: 6,
    fontWeight: '400',
  },

  // Card 12 styles
  card12: {
    backgroundColor: '#050505',
    borderRadius: 28,
    padding: 20,
    marginBottom: 15,
    width: '95%',
    minHeight: 100,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    borderWidth: 1,
    borderColor: '#101010',
  },
  titleRow12: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginBottom: 0,
  },
  title12: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '500',
  },
  subtext12: {
    color: '#ccc',
    fontSize: 14,
    marginTop: 6,
    fontWeight: '400',
  },

  // Card 13 styles
  card13: {
    backgroundColor: '#050505',
    borderRadius: 28,
    padding: 20,
    marginBottom: 15,
    width: '95%',
    minHeight: 100,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    borderWidth: 1,
    borderColor: '#101010',
  },
  titleRow13: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginBottom: 0,
  },
  title13: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '500',
  },
  subtext13: {
    color: '#ccc',
    fontSize: 14,
    marginTop: 6,
    fontWeight: '400',
  },

  // Card 14 styles
  card14: {
    backgroundColor: '#050505',
    borderRadius: 28,
    padding: 20,
    marginBottom: 15,
    width: '95%',
    minHeight: 100,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    borderWidth: 1,
    borderColor: '#101010',
  },
  titleRow14: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginBottom: 0,
  },
  title14: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '500',
  },
  subtext14: {
    color: '#ccc',
    fontSize: 14,
    marginTop: 6,
    fontWeight: '400',
  },

  // Card 15 styles
  card15: {
    backgroundColor: '#050505',
    borderRadius: 28,
    padding: 20,
    marginBottom: 15,
    width: '95%',
    minHeight: 100,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    borderWidth: 1,
    borderColor: '#101010',
  },
  titleRow15: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginBottom: 0,
  },
  title15: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '500',
  },
  subtext15: {
    color: '#ccc',
    fontSize: 14,
    marginTop: 6,
    fontWeight: '400',
  },
  
  // Search bar styles
  searchBarContainer: {
    backgroundColor: '#050505',
    width: '90%',
    alignSelf: 'center',
    borderRadius: 20,
    height: 60,
    marginTop: 10,
    marginBottom: 15,
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
  
  // Search assistance styles
  searchAssistanceContainer: {
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  filterButtonsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
}); 