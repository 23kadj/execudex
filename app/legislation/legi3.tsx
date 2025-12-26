import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { CardLoadingIndicator } from '../../components/CardLoadingIndicator';
import { CardGenerationService } from '../../services/cardGenerationService';
import { CardService } from '../../services/cardService';
import { CardData, fetchCardsByScreen, fetchLegislationTier, getCardIndexScreenForPage, getScreenDisplayName, searchCardsForPage } from '../../utils/cardData';
import { getSupabaseClient } from '../../utils/supabase';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface Legi3Props {
  scrollY?: any;
  name?: string;
  position?: string;
  scrollRef?: React.RefObject<ScrollView>;
}

export default function Legi3({ scrollY, name, position, scrollRef }: Legi3Props) {
  const router = useRouter();
  const params = useLocalSearchParams();
  
  // Get the legislation ID from navigation parameters
  const legislationId = typeof params.index === 'string' ? params.index : '';
  
  // State for card data from card_index table
  const [cardData, setCardData] = useState<CardData[]>([]);
  const [tier, setTier] = useState<string>('base');
  const [isLoading, setIsLoading] = useState(true);
  const [isCardLoading, setIsCardLoading] = useState(false);
  
  // State for generate cards button
  const [isGeneratingCards, setIsGeneratingCards] = useState(false);
  const [showGenerateButton, setShowGenerateButton] = useState(false);
  const [showInsufficientCardsMessage, setShowInsufficientCardsMessage] = useState(false);
  const generateButtonScale = useRef(new Animated.Value(1)).current;
  const abortControllerRef = useRef<AbortController | null>(null);
  const currentLoadingCardId = useRef<number | null>(null);

  // Search (submit-on-enter, above grid)
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<TextInput>(null);

  const handleSearchSubmit = async () => {
    const q = String(searchQuery ?? '').trim();
    if (!q || !legislationId) return;

    try {
      const cards = await searchCardsForPage({
        ownerId: parseInt(legislationId, 10),
        isPpl: false,
        pageName: 'legi3',
        query: q,
      });

      const searchResults = cards.map((c) => ({
        id: String(c.id),
        title: c.title,
        subtitle: c.subtext,
        type: 'card' as const,
        limit_score: 0,
        category: c.category ?? null,
        is_ppl: false,
      }));

      router.push({
        pathname: '/results',
        params: {
          mode: 'cardSearch',
          searchQuery: q,
          searchResults: JSON.stringify(searchResults),
          originPage: 'legi3',
          ownerName: String(name ?? 'No Data Available'),
          ownerIsPpl: 'false',
        }
      });
    } catch (error) {
      console.error('Error searching cards (legi3):', error);
    } finally {
      searchInputRef.current?.blur();
    }
  };
  
  // Fetch legislation tier
  useEffect(() => {
    const fetchTier = async () => {
      if (legislationId) {
        try {
          const legislationTier = await fetchLegislationTier(parseInt(legislationId));
          setTier(legislationTier);
        } catch (error) {
          console.error('Error fetching legislation tier:', error);
          setTier('base');
        }
      }
    };

    fetchTier();
  }, [legislationId]);
  
  // Fetch card data from card_index table for preview card assignment
  useEffect(() => {
    const fetchCardDataFromDB = async () => {
      if (legislationId) {
        try {
          const cards = await fetchCardsByScreen({
            ownerId: parseInt(legislationId),
            isPpl: false,
            pageName: 'legi3',
            tier: tier
          });
          
          // Cards are already sorted by opens_7d descending
          setCardData(cards);
          
          // Check if generate button should be shown (no unused coverage cards)
          const supabase = getSupabaseClient();
          const { data: coverageCards, error } = await supabase
            .from('card_index')
            .select('id')
            .eq('owner_id', parseInt(legislationId))
            .eq('is_ppl', false)
            .eq('screen', 'coverage')
            .or('used.is.null,used.eq.false');
          
          // Check if generate button should be shown using new service method
          const shouldShow = await CardGenerationService.checkDiscourseButtonVisibility(parseInt(legislationId));
          console.log('Legi3 - Should show generate button:', shouldShow);
          setShowGenerateButton(shouldShow);
          
          setIsLoading(false);
        } catch (error) {
          console.error('Error fetching card data:', error);
          setCardData([]);
          setShowGenerateButton(false);
          setIsLoading(false);
        }
      }
    };

    if (tier !== 'base' || legislationId) {
    fetchCardDataFromDB();
    }
  }, [legislationId, tier]);

  // Handle cancel loading
  const handleCancelLoading = () => {
    // Cancel generate cards operation
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGeneratingCards(false);
    
    // Cancel individual card loading
    if (currentLoadingCardId.current !== null) {
      CardService.cancelCardGeneration(currentLoadingCardId.current);
      currentLoadingCardId.current = null;
    }
    setIsCardLoading(false);
    
    console.log('Card generation cancelled by user');
  };

  // Handle generate cards button press
  const handleGenerateCards = async () => {
    if (!legislationId || isGeneratingCards) return;
    
    // Create new abort controller
    abortControllerRef.current = new AbortController();
    
    setIsGeneratingCards(true);
    try {
      const result = await CardGenerationService.generateDiscourseCards(parseInt(legislationId));
      
      // Check if operation was aborted
      if (abortControllerRef.current?.signal.aborted) {
        return;
      }
      
      if (result.success) {
        // Check if the result indicates insufficient cards
        if (result.lowMateriality) {
          setShowInsufficientCardsMessage(true);
          setShowGenerateButton(false);
          // Mark legislation as weak in database
          await CardGenerationService.markLegislationAsWeak(parseInt(legislationId));
        } else {
          // Refresh cards after generation
          const cards = await fetchCardsByScreen({
            ownerId: parseInt(legislationId),
            isPpl: false,
            pageName: 'legi3',
            tier: tier
          });
          setCardData(cards);
          
          // Check if button should still be shown
          const shouldShow = await CardGenerationService.checkDiscourseButtonVisibility(parseInt(legislationId));
          setShowGenerateButton(shouldShow);
        }
      } else {
        // If generation failed, check if it's due to insufficient material
        if (result.message.includes('no_material_cards') || result.message.includes('low_materiality')) {
          setShowInsufficientCardsMessage(true);
          setShowGenerateButton(false);
          // Mark legislation as weak in database
          await CardGenerationService.markLegislationAsWeak(parseInt(legislationId));
        }
      }
    } catch (error) {
      // Don't log error if it was an abort
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Card generation aborted');
        return;
      }
      console.error('Error generating cards:', error);
    } finally {
      if (!abortControllerRef.current?.signal.aborted) {
        setIsGeneratingCards(false);
      }
      abortControllerRef.current = null;
    }
  };
  
  // Animated scale values for cards
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
  
  // Animated scale values for grid buttons
  const gridButtonFullScale = useRef(new Animated.Value(1)).current;
  
  // Local scrollY value for this component
  const localScrollY = useRef(new Animated.Value(0)).current;

  // Get layout configuration based on tier
  const getLayoutConfig = () => {
    let cardCount = 4;
    let gridType = 4;
    let showMoreSelections = false;

    switch (tier) {
      case 'base':
        cardCount = 4;
        gridType = 4;
        showMoreSelections = false;
        break;
      case 'soft':
        cardCount = 6;
        gridType = 4;
        showMoreSelections = false;
        break;
      case 'hard':
        cardCount = 10;
        gridType = 4;
        showMoreSelections = true;
        break;
      default:
        cardCount = 4;
        gridType = 4;
        showMoreSelections = false;
    }

    return { cardCount, gridType, showMoreSelections };
  };

  const layoutConfig = getLayoutConfig();

  const handleGridButtonPress = (buttonText: string) => {
    router.push({
      pathname: '/legislation/legi4',
      params: { 
        buttonText,
        title: position,
        subtitle: name,
        originalPage: 'legi3',
        profileIndex: legislationId
      }
    });
  };

  // Render cards based on layout config
  const renderCards = () => {
    const cards = [];
    const cardScales = [card1Scale, card2Scale, card3Scale, card4Scale, card5Scale, card6Scale, card7Scale, card8Scale, card9Scale, card10Scale];
    
    // Only render cards for which we have data
    for (let i = 0; i < Math.min(layoutConfig.cardCount, cardData.length); i++) {
      const cardNumber = i + 1;
      // Use a fallback animated value for cards beyond the first 10
      const cardScale = i < cardScales.length ? cardScales[i] : card1Scale;
      
      // Get styles safely with fallbacks
      const getCardStyle = (number: number) => {
        // For cards beyond 10, use card1 style as fallback
        const styleNumber = Math.min(number, 10);
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
          default: return styles.card1;
        }
      };
      
      const getTitleRowStyle = (number: number) => {
        const styleNumber = Math.min(number, 10);
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
          default: return styles.titleRow1;
        }
      };
      
      const getTitleStyle = (number: number) => {
        const styleNumber = Math.min(number, 10);
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
          default: return styles.title1;
        }
      };
      
      const getSubtextStyle = (number: number) => {
        const styleNumber = Math.min(number, 10);
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
          default: return styles.subtext1;
        }
      };
      
      cards.push(
        <AnimatedPressable
          key={`card${cardNumber}`}
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
            const cardId = String(cardData[cardNumber - 1]?.id || '');
            if (cardId) {
              // Validate cardId is a valid number before parsing
              const parsedCardId = parseInt(cardId, 10);
              if (isNaN(parsedCardId) || parsedCardId <= 0) {
                console.error('Invalid cardId:', cardId);
                return;
              }
              
              // Track the currently loading card
              currentLoadingCardId.current = parsedCardId;
              
              // Execute full_card_gen script
              let wasCancelled = false;
              try {
                await CardService.generateFullCard(parsedCardId, setIsCardLoading);
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
                cardTitle: cardData[cardNumber - 1]?.title || `Card ${cardNumber}`,
                billName: name,
                tabName: 'Discourse',
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
            <Text style={getTitleStyle(cardNumber)}>
              {cardData[cardNumber - 1]?.title || `Card ${cardNumber} Title`}
            </Text>
          </View>
          <Text style={getSubtextStyle(cardNumber)}>
            {cardData[cardNumber - 1]?.subtext || `Card ${cardNumber} subtitle text`}
          </Text>
        </AnimatedPressable>
      );
    }
    
    return cards;
  };


  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <Animated.ScrollView
      ref={scrollRef}
      style={{ flex: 1, width: '100%' }}
      contentContainerStyle={{ width: '100%', paddingBottom: 20 }}
      showsVerticalScrollIndicator={false}
      scrollEventThrottle={16}
      onScroll={Animated.event(
        [{ nativeEvent: { contentOffset: { y: localScrollY } } }],
        { useNativeDriver: false }
      )}
    >
      <View style={styles.container}>
        <View style={styles.searchBarContainer}>
          <Image source={require('../../assets/search.png')} style={styles.searchIcon} />
          <TextInput
            ref={searchInputRef}
            style={styles.searchBarInput}
            placeholder={String(`Search ${getScreenDisplayName(getCardIndexScreenForPage('legi3', false))} Cards`)}
            placeholderTextColor="#666"
            value={String(searchQuery ?? '')}
            onChangeText={(text) => setSearchQuery(String(text ?? ''))}
            returnKeyType="search"
            onSubmitEditing={handleSearchSubmit}
            blurOnSubmit={true}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')} style={styles.clearButton}>
              <Text style={styles.clearButtonText}>✕</Text>
            </Pressable>
          )}
        </View>
        {/* Grid above the four cards */}
        <View style={styles.gridContainer}>
          <View style={styles.gridRow}>
            <AnimatedPressable
              onPressIn={() => {
                Haptics.selectionAsync();
                Animated.spring(gridButtonFullScale, {
                  toValue: 0.95,
                  friction: 6,
                  useNativeDriver: true,
                }).start();
              }}
              onPressOut={() => {
                Animated.spring(gridButtonFullScale, {
                  toValue: 1,
                  friction: 6,
                  useNativeDriver: true,
                }).start();
              }}
              onPress={() => handleGridButtonPress('Backers')}
              style={[
                styles.gridButton1,
                { transform: [{ scale: gridButtonFullScale }] }
              ]}
            >
              <Text style={styles.gridButtonText1}>Backers</Text>
            </AnimatedPressable>
            <AnimatedPressable
              onPressIn={() => {
                Haptics.selectionAsync();
                Animated.spring(gridButtonFullScale, {
                  toValue: 0.95,
                  friction: 6,
                  useNativeDriver: true,
                }).start();
              }}
              onPressOut={() => {
                Animated.spring(gridButtonFullScale, {
                  toValue: 1,
                  friction: 6,
                  useNativeDriver: true,
                }).start();
              }}
              onPress={() => handleGridButtonPress('Opposers')}
              style={[
                styles.gridButton2,
                { transform: [{ scale: gridButtonFullScale }] }
              ]}
            >
              <Text style={styles.gridButtonText2}>Opposers</Text>
            </AnimatedPressable>
          </View>
          <View style={styles.gridRow}>
            <AnimatedPressable
              onPressIn={() => {
                Haptics.selectionAsync();
                Animated.spring(gridButtonFullScale, {
                  toValue: 0.95,
                  friction: 6,
                  useNativeDriver: true,
                }).start();
              }}
              onPressOut={() => {
                Animated.spring(gridButtonFullScale, {
                  toValue: 1,
                  friction: 6,
                  useNativeDriver: true,
                }).start();
              }}
              onPress={() => handleGridButtonPress('Narratives')}
              style={[
                styles.gridButton3,
                { transform: [{ scale: gridButtonFullScale }] }
              ]}
            >
              <Text style={styles.gridButtonText3}>Narratives</Text>
            </AnimatedPressable>
            <AnimatedPressable
              onPressIn={() => {
                Haptics.selectionAsync();
                Animated.spring(gridButtonFullScale, {
                  toValue: 0.95,
                  friction: 6,
                  useNativeDriver: true,
                }).start();
              }}
              onPressOut={() => {
                Animated.spring(gridButtonFullScale, {
                  toValue: 1,
                  friction: 6,
                  useNativeDriver: true,
                }).start();
              }}
              onPress={() => handleGridButtonPress('Coverage')}
              style={[
                styles.gridButton4,
                { transform: [{ scale: gridButtonFullScale }] }
              ]}
            >
              <Text style={styles.gridButtonText4}>Coverage</Text>
            </AnimatedPressable>
          </View>
        </View>
        <View style={styles.cardsContainer}>
          {renderCards()}
        </View>
        
        {/* Generate New Cards Button or Insufficient Cards Message */}
        {showGenerateButton && (
          <View style={styles.generateButtonContainer}>
            <Animated.View style={{ transform: [{ scale: generateButtonScale }] }}>
              <Pressable
                onPressIn={() => {
                  Haptics.selectionAsync();
                  Animated.spring(generateButtonScale, {
                    toValue: 0.95,
                    friction: 6,
                    useNativeDriver: true,
                  }).start();
                }}
                onPressOut={() => {
                  Animated.spring(generateButtonScale, {
                    toValue: 1,
                    friction: 6,
                    useNativeDriver: true,
                  }).start();
                }}
                onPress={handleGenerateCards}
                disabled={isGeneratingCards}
                style={[
                  styles.generateButton,
                  isGeneratingCards && styles.generateButtonDisabled
                ]}
              >
                <Text style={[
                  styles.generateButtonText,
                  isGeneratingCards && styles.generateButtonTextDisabled
                ]}>
                  {isGeneratingCards ? 'Generating...' : 'Generate New Cards'}
                </Text>
              </Pressable>
            </Animated.View>
          </View>
        )}
        
        {/* Insufficient Cards Message */}
        {showInsufficientCardsMessage && (
          <View style={styles.insufficientCardsContainer}>
            <Text style={styles.insufficientCardsTitle}>Legislation Too Small</Text>
            <Text style={styles.insufficientCardsMessage}>
              This legislation doesn't have enough material to generate a complete profile. 
              The bill may be too brief or contain insufficient policy content for detailed analysis.
            </Text>
          </View>
        )}
      </View>
      
      <CardLoadingIndicator 
        visible={isLoading || isGeneratingCards || isCardLoading} 
        onCancel={handleCancelLoading}
        title={isGeneratingCards ? "Loading Legislation Cards" : "Loading Legislation"}
        subtitle="Please keep the app open while we prepare your legislation..."
      />
    </Animated.ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingTop: 0,
    paddingBottom: 0,
    paddingHorizontal: 0,
    backgroundColor: '#000',
    alignItems: 'stretch',
  },
  // Search bar (matches sub4)
  searchBarContainer: {
    backgroundColor: '#050505',
    borderColor: '#101010',
    borderWidth: 1,
    width: '90%',
    alignSelf: 'center',
    borderRadius: 20,
    height: 60,
    marginTop: 2,
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
  loadingText: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
    marginTop: 50,
  },
  cardsContainer: {
    width: '100%',
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
  // Grid styles
  gridContainer: {
    backgroundColor: '#040404',
    borderColor: '#101010',
    borderWidth: 1,
    width: '95%',
    alignSelf: 'center',
    borderRadius: 32,
    height: 165,
    marginTop: 0,
    marginBottom: 15,
    paddingTop: 18,
    paddingBottom: 18,
    justifyContent: 'space-between',
  },
  gridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 0,
    paddingHorizontal: 0,
  },
  gridButton1: {
    backgroundColor: '#090909',
    borderRadius: 15,
    height: 58,
    width: '43%',
    marginLeft: 20,
    marginHorizontal: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridButton2: {
    backgroundColor: '#090909',
    borderRadius: 15,
    height: 58,
    width: '43%',
    marginRight: 20,
    marginHorizontal: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridButton3: {
    backgroundColor: '#090909',
    borderRadius: 15,
    height: 58,
    width: '43%',
    marginLeft: 20,
    marginHorizontal: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridButton4: {
    backgroundColor: '#090909',
    borderRadius: 15,
    height: 58,
    width: '43%',
    marginRight: 20,
    marginHorizontal: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridButtonText1: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '400',
    textAlign: 'center',
  },
  gridButtonText2: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '400',
    textAlign: 'center',
  },
  gridButtonText3: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '400',
    textAlign: 'center',
  },
  gridButtonText4: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '400',
    textAlign: 'center',
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
    flexWrap: 'wrap',
    flexShrink: 1,
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
    flexWrap: 'wrap',
    flexShrink: 1,
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
    flexWrap: 'wrap',
    flexShrink: 1,
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
    flexWrap: 'wrap',
    flexShrink: 1,
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
    flexWrap: 'wrap',
    flexShrink: 1,
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
    flexWrap: 'wrap',
    flexShrink: 1,
  },
  subtext10: {
    color: '#ccc',
    fontSize: 14,
    marginTop: 6,
    fontWeight: '400',
  },
  generateButtonContainer: {
    width: '92%',
    alignSelf: 'center',
    marginTop: 0,
    marginBottom: 30,
  },
  generateButton: {
    backgroundColor: '#050505',
    borderRadius: 20,
    borderColor: '#101010',
    borderWidth: 1,
    height: 60,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  generateButtonDisabled: {
    backgroundColor: '#333',
    opacity: 0.6,
  },
  generateButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '400',
    textAlign: 'center',
  },
  generateButtonTextDisabled: {
    color: '#999',
  },
  
  // Insufficient Cards Message styles (dark theme)
  insufficientCardsContainer: {
    width: '92%',
    alignSelf: 'center',
    marginTop: 20,
    marginBottom: 30,
    padding: 20,
    backgroundColor: '#111',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#222',
  },
  insufficientCardsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  insufficientCardsMessage: {
    fontSize: 14,
    color: '#ddd',
    lineHeight: 20,
    textAlign: 'center',
  },
}); 
