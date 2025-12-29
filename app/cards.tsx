import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { useAuth } from '../components/AuthProvider';
import { CardLoadingIndicator } from '../components/CardLoadingIndicator';
import { SearchFilterButton } from '../components/SearchFilterButton';
import { CardService } from '../services/cardService';
import { CardData } from '../utils/cardData';
import { filterCardsByWords, getMostCommonWords, shouldShowSearchAssistance } from '../utils/searchAssistanceUtils';
import { getSupabaseClient } from '../utils/supabase';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Parse onboard data string to extract individual terms (values only)
const parseOnboardTerms = (onboardData: string | null): string[] => {
  if (!onboardData) return [];
  
  const terms: string[] = [];
  const parts = onboardData.split(' | ');
  
  for (const part of parts) {
    const colonIndex = part.indexOf(':');
    if (colonIndex > 0) {
      const value = part.substring(colonIndex + 1).trim();
      // Split comma-separated values and add individual terms
      if (value) {
        const valueParts = value.split(',').map(v => v.trim()).filter(Boolean);
        terms.push(...valueParts);
      }
    }
  }
  
  return terms;
};

// Cycle numbered styles (1..15) to preserve visual variety for >15 cards.
const styleIndex = (index: number) => ((index % 15) + 1) as 1|2|3|4|5|6|7|8|9|10|11|12|13|14|15;

// Map a cycled number to your existing style buckets.
const getCardStyleByIndex = (n: number) => {
  switch (n) {
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

const getTitleRowStyleByIndex = (n: number) => {
  switch (n) {
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

const getTitleStyleByIndex = (n: number) => {
  switch (n) {
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

const getSubtextStyleByIndex = (n: number) => {
  switch (n) {
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

export default function Cards() {
  const router = useRouter();
  const { user } = useAuth();

  // Search functionality
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<TextInput>(null);
  
  // Search assistance functionality
  const [selectedFilterWords, setSelectedFilterWords] = useState<string[]>([]);
  const [commonWords, setCommonWords] = useState<string[]>([]);
  const [showSearchAssistance, setShowSearchAssistance] = useState(false);
  
  // Sort By button state and cycling
  const [sortByLabel, setSortByLabel] = useState('Sort By');
  const sortByLabels = ['Sort By', 'Recent', 'Popular'];
  
  const cycleSortBy = () => {
    const currentIndex = sortByLabels.indexOf(sortByLabel);
    const nextIndex = (currentIndex + 1) % sortByLabels.length;
    setSortByLabel(sortByLabels[nextIndex]);
  };
  
  // State for card data
  const [cardData, setCardData] = useState<CardData[]>([]);
  const [loadingCards, setLoadingCards] = useState(false);
  const [isCardLoading, setIsCardLoading] = useState(false);
  const sortByButtonScale = useRef(new Animated.Value(1)).current;
  const currentLoadingCardId = useRef<number | null>(null);
  
  // Filter cards based on search query and selected filter words
  const filteredCardData = (() => {
    const defaultCompare = (a: any, b: any) => {
      const ao = a?.opens_7d ?? -Infinity;
      const bo = b?.opens_7d ?? -Infinity;
      if (ao !== bo) return bo - ao;

      const as = a?.score ?? -Infinity;
      const bs = b?.score ?? -Infinity;
      if (as !== bs) return bs - as;

      return (b?.id ?? 0) - (a?.id ?? 0);
    };

    const createdAtMs = (x: any) => {
      const raw = x?.created_at;
      const ms = typeof raw === 'string' ? Date.parse(raw) : raw instanceof Date ? raw.getTime() : NaN;
      return Number.isFinite(ms) ? ms : -Infinity;
    };

    const compareRecent = (a: any, b: any) => {
      const at = createdAtMs(a);
      const bt = createdAtMs(b);
      if (at !== bt) return bt - at;
      return defaultCompare(a, b);
    };

    const comparePopular = (a: any, b: any) => {
      const ao = a?.opens_7d ?? 0;
      const bo = b?.opens_7d ?? 0;
      const aHas = typeof ao === 'number' && ao > 0;
      const bHas = typeof bo === 'number' && bo > 0;

      // If both have meaningful opens_7d, sort by it.
      if (aHas && bHas) {
        if (ao !== bo) return bo - ao;
        return defaultCompare(a, b);
      }

      // If only one has meaningful opens_7d, prefer it.
      if (aHas !== bHas) return aHas ? -1 : 1;

      // If neither has opens_7d (null/0), "sort that specific card by default".
      return defaultCompare(a, b);
    };

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

    // Apply Sort By
    if (sortByLabel === 'Recent') {
      filtered = [...filtered].sort(compareRecent);
    } else if (sortByLabel === 'Popular') {
      filtered = [...filtered].sort(comparePopular);
    } else {
      // Default behavior (matches prior ordering semantics)
      filtered = [...filtered].sort(defaultCompare);
    }
    
    return filtered;
  })();

  // Pagination (10 cards per page) - applies to whatever filtered/search results are currently visible
  const PAGE_SIZE = 10;
  const [pageIndex, setPageIndex] = useState(0); // 0-based page
  const filteredCount = filteredCardData.length;
  const totalPages = Math.max(1, Math.ceil(filteredCount / PAGE_SIZE));

  // If the current page disappears due to filtering/search, clamp to the last available page.
  useEffect(() => {
    if (pageIndex > totalPages - 1) {
      setPageIndex(totalPages - 1);
    }
  }, [pageIndex, totalPages]);

  const pageStart = pageIndex * PAGE_SIZE;
  const paginatedCardData = filteredCardData.slice(pageStart, pageStart + PAGE_SIZE);
  const canGoPrev = pageIndex > 0;
  const canGoNext = pageIndex < totalPages - 1;

  const goPrevPage = useCallback(() => {
    if (!canGoPrev) return;
    setPageIndex(prev => Math.max(0, prev - 1));
  }, [canGoPrev]);

  const goNextPage = useCallback(() => {
    if (!canGoNext) return;
    setPageIndex(prev => Math.min(totalPages - 1, prev + 1));
  }, [canGoNext, totalPages]);
  
  // Keyboard dismissal function
  const dismissKeyboard = useCallback(() => {
    Keyboard.dismiss();
    searchInputRef.current?.blur();
  }, []);

  // Create stable Animated.Value map keyed by card ID to prevent memory leaks
  const scalesRef = useRef<Map<number, Animated.Value>>(new Map());
  
  // Get or create animated value for a card ID
  const getScale = useCallback((cardId: number) => {
    if (!scalesRef.current.has(cardId)) {
      scalesRef.current.set(cardId, new Animated.Value(1));
    }
    return scalesRef.current.get(cardId)!;
  }, []);
  
  // Clean up animated values for cards that no longer exist
  useEffect(() => {
    const currentCardIds = new Set(filteredCardData.map(card => card.id));
    const keysToDelete: number[] = [];
    
    scalesRef.current.forEach((_, cardId) => {
      if (!currentCardIds.has(cardId)) {
        keysToDelete.push(cardId);
      }
    });
    
    keysToDelete.forEach(cardId => {
      scalesRef.current.delete(cardId);
    });
  }, [filteredCardData]);

  // Fetch recommended cards based on demographics matching
  useEffect(() => {
    const fetchRecommendedCards = async () => {
      if (!user?.id) {
        setCardData([]);
        setLoadingCards(false);
        return;
      }

      setLoadingCards(true);
      try {
        const supabase = getSupabaseClient();

        // Fetch user's onboard data
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('onboard')
          .eq('uuid', user.id)
          .maybeSingle();

        if (userError) {
          console.error('Error fetching user onboard data:', userError);
          setCardData([]);
          setLoadingCards(false);
          return;
        }

        // Parse onboard terms (extract individual values)
        const onboardTerms = parseOnboardTerms(userData?.onboard || null);
        if (onboardTerms.length === 0) {
          setCardData([]);
          setLoadingCards(false);
          return;
        }

        // Fetch all cards from card_content with demographics
        const { data: cardContentData, error: cardContentError } = await supabase
          .from('card_content')
          .select('card_id, demographics')
          .not('demographics', 'is', null);

        if (cardContentError) {
          console.error('Error fetching card_content:', cardContentError);
          setCardData([]);
          setLoadingCards(false);
          return;
        }

        if (!cardContentData || cardContentData.length === 0) {
          setCardData([]);
          setLoadingCards(false);
          return;
        }

        // Match cards where demographics contain any onboard term
        const matchedCardIds: number[] = [];
        for (const contentRow of cardContentData) {
          const demographics = String(contentRow.demographics || '').toLowerCase();
          const cardId = contentRow.card_id;
          
          // Check if any onboard term appears in demographics
          for (const term of onboardTerms) {
            const termLower = term.toLowerCase().trim();
            if (termLower && demographics.includes(termLower)) {
              matchedCardIds.push(cardId);
              break; // Found a match, no need to check other terms for this card
            }
          }
        }

        if (matchedCardIds.length === 0) {
          setCardData([]);
          setLoadingCards(false);
          return;
        }

        // Fetch card_index data for matched cards
        const { data: cardIndexData, error: cardIndexError } = await supabase
          .from('card_index')
          .select('id, title, subtext, opens_7d, score, created_at, is_ppl, owner_id, screen')
          .in('id', matchedCardIds)
          .eq('is_active', true);

        if (cardIndexError) {
          console.error('Error fetching card_index:', cardIndexError);
          setCardData([]);
          setLoadingCards(false);
          return;
        }

        if (!cardIndexData || cardIndexData.length === 0) {
          setCardData([]);
          setLoadingCards(false);
          return;
        }

        // Fetch owner names for all cards
        const ownerIds = [...new Set(cardIndexData.map((card: any) => card.owner_id).filter(Boolean))];
        const pplIds = cardIndexData.filter((card: any) => card.is_ppl).map((card: any) => card.owner_id).filter(Boolean);
        const legiIds = cardIndexData.filter((card: any) => !card.is_ppl).map((card: any) => card.owner_id).filter(Boolean);

        // Fetch politician names
        let pplNames: Record<number, string> = {};
        if (pplIds.length > 0) {
          const { data: pplData } = await supabase
            .from('ppl_index')
            .select('id, name')
            .in('id', pplIds);
          
          if (pplData) {
            pplData.forEach((ppl: any) => {
              pplNames[ppl.id] = ppl.name;
            });
          }
        }

        // Fetch legislation names
        let legiNames: Record<number, string> = {};
        if (legiIds.length > 0) {
          const { data: legiData } = await supabase
            .from('legi_index')
            .select('id, name')
            .in('id', legiIds);
          
          if (legiData) {
            legiData.forEach((legi: any) => {
              legiNames[legi.id] = legi.name;
            });
          }
        }

        // Enrich card data with owner names
        const enrichedCards = cardIndexData.map((card: any) => {
          const ownerName = card.is_ppl 
            ? (pplNames[card.owner_id] || 'Unknown')
            : (legiNames[card.owner_id] || 'Unknown');
          return {
            ...card,
            ownerName,
          };
        });

        // Sort cards by opens_7d descending (with fallback to score)
        const sorted = enrichedCards.sort((a: any, b: any) => {
          const ao = a?.opens_7d ?? -Infinity;
          const bo = b?.opens_7d ?? -Infinity;
          if (ao !== bo) return bo - ao;

          const as = a?.score ?? -Infinity;
          const bs = b?.score ?? -Infinity;
          if (as !== bs) return bs - as;

          return (b?.id ?? 0) - (a?.id ?? 0);
        });

        setCardData(sorted as CardData[]);
        
        // Update search assistance
        const shouldShow = shouldShowSearchAssistance(sorted);
        setShowSearchAssistance(shouldShow);
        
        if (shouldShow) {
          const mostCommon = getMostCommonWords(sorted, 10);
          setCommonWords(mostCommon);
        } else {
          setCommonWords([]);
          setSelectedFilterWords([]);
        }
      } catch (err) {
        console.error('Error fetching recommended cards:', err);
        setCardData([]);
      } finally {
        setLoadingCards(false);
      }
    };

    fetchRecommendedCards();
  }, [user?.id]);

  // Handle cancel loading
  const handleCancelLoading = () => {
    // Cancel individual card loading
    if (currentLoadingCardId.current !== null) {
      CardService.cancelCardGeneration(currentLoadingCardId.current);
      currentLoadingCardId.current = null;
    }
    setIsCardLoading(false);
  };

  // Animation handlers for cards
  const onPressIn = useCallback((cardId: number) => {
    const v = getScale(cardId);
    if (!v) return;
    Haptics.selectionAsync();
    Animated.spring(v, { toValue: 0.95, friction: 6, useNativeDriver: true }).start();
  }, [getScale]);
  
  const onPressOut = useCallback((cardId: number) => {
    const v = getScale(cardId);
    if (!v) return;
    Animated.spring(v, { toValue: 1, friction: 6, useNativeDriver: true }).start();
  }, [getScale]);

  // Card renderer
  const renderCard = (card: any, index: number) => {
    const n = styleIndex(index); // 1..15 cycled
    const scale = getScale(card.id);

    return (
      <AnimatedPressable
        key={String(card?.id ?? `card-${index}`)}
        onPressIn={() => onPressIn(card.id)}
        onPressOut={() => onPressOut(card.id)}
        onPress={async () => {
          const cardId = String(card.id || '');
          if (!cardId) {
            console.error('Invalid cardId: card.id is missing');
            return;
          }
          
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
            await CardService.generateFullCard(parsedCardId, setIsCardLoading, card.is_ppl ?? true);
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
          
          // Determine navigation based on card type
          const isPpl = card.is_ppl ?? true;
          const ownerName = card.ownerName || 'Unknown';
          const screen = card.screen || '';
          
          if (isPpl) {
            router.push({
              pathname: '/profile/sub5',
              params: {
                cardTitle: card.title || 'No Data',
                profileName: ownerName,
                sourcePage: 'cards',
                originalPage: screen || 'cards',
                pageCount: String(1),
                cardId: cardId,
              },
            });
          } else {
            router.push({
              pathname: '/legislation/legi5',
              params: {
                cardTitle: card.title || 'No Data',
                billName: ownerName,
                sourcePage: 'cards',
                originalPage: screen || 'cards',
                isMedia: 'false',
                pageCount: String(1),
                cardId: cardId,
              },
            });
          }
        }}
        style={[getCardStyleByIndex(n), { transform: [{ scale }] }]}
      >
        <View style={getTitleRowStyleByIndex(n)}>
          <Text style={getTitleStyleByIndex(n)}>{card.title || 'No data now'}</Text>
        </View>
        <Text style={getSubtextStyleByIndex(n)}>{card.subtext || 'no data now'}</Text>
      </AnimatedPressable>
    );
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

  // Header (render as an element, not an inline component, to avoid unmount/remount "blink")
  const header = useMemo(() => {
    return (
      <View style={styles.headerContainer}>
        <TouchableOpacity
          style={styles.headerIconBtn}
          activeOpacity={1}
          onPress={() => router.back()}
          hitSlop={{ top: 12, left: 12, right: 12, bottom: 12 }}
        >
          <Image
            source={require('../assets/back1.png')}
            style={styles.headerIcon}
            fadeDuration={0}
          />
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <TouchableOpacity
          style={styles.headerIconBtn}
          activeOpacity={1}
          onPress={goPrevPage}
          disabled={!canGoPrev}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canGoPrev }}
          hitSlop={{ top: 12, left: 12, right: 12, bottom: 12 }}
        >
          <Image
            source={
              canGoPrev ? require('../assets/left1.png') : require('../assets/leftgrey.png')
            }
            style={styles.headerIcon}
            fadeDuration={0}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.headerIconBtn}
          activeOpacity={1}
          onPress={goNextPage}
          disabled={!canGoNext}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canGoNext }}
          hitSlop={{ top: 12, left: 12, right: 12, bottom: 12 }}
        >
          <Image
            source={
              canGoNext
                ? require('../assets/right1.png')
                : require('../assets/rightgrey.png')
            }
            style={styles.headerIcon}
            fadeDuration={0}
          />
        </TouchableOpacity>
      </View>
    );
  }, [router, canGoPrev, canGoNext, goPrevPage, goNextPage]);

  return (
    <TouchableWithoutFeedback onPress={dismissKeyboard}>
      <View style={styles.container}>
        {header}
        
        <View style={styles.contentContainer}>
        <View style={styles.titleContainer}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>Recommended Cards</Text>
            <Animated.View style={{ transform: [{ scale: sortByButtonScale }], marginLeft: 10 }}>
              <Pressable
                onPressIn={() => {
                  Haptics.selectionAsync();
                  Animated.spring(sortByButtonScale, {
                    toValue: 0.95,
                    friction: 6,
                    useNativeDriver: true,
                  }).start();
                }}
                onPressOut={() => {
                  Animated.spring(sortByButtonScale, {
                    toValue: 1,
                    friction: 6,
                    useNativeDriver: true,
                  }).start();
                }}
                onPress={cycleSortBy}
                style={styles.sortByButton}
              >
                <Text style={styles.sortByButtonText}>{sortByLabel}</Text>
              </Pressable>
            </Animated.View>
          </View>
          <Text style={styles.subtitleText}>Whenever a card is opened, we take note of which groups it might be of interest to. The more cards are opened, the more cards will be recommended to you.</Text>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.cardsContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onScrollBeginDrag={dismissKeyboard}
        >
          <View style={styles.searchBarContainer}>
            <Image source={require('../assets/search.png')} style={styles.searchIcon} />
            <TextInput
              ref={searchInputRef}
              style={styles.searchBarInput}
              placeholder="Search Recommended Cards"
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

          {showSearchAssistance && commonWords.length > 0 && filteredCount >= 10 && (
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

          {loadingCards ? (
            <View style={styles.emptyStateContainer}>
              <Text style={styles.emptyStateText}>Loading recommended cards...</Text>
            </View>
          ) : paginatedCardData.length === 0 ? (
            <View style={styles.emptyStateContainer}>
              <Text style={styles.emptyStateText}>
                No recommended cards are currently available, come back later. You can update your demographic indicators in the settings.
              </Text>
            </View>
          ) : (
            paginatedCardData.map((card, index) => renderCard(card, index))
          )}
        </ScrollView>
        </View>
        
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
    marginHorizontal: -2,
  },
  headerIcon: {
    width: 28,
    height: 28,
    resizeMode: 'contain',
  },

  // MAIN CONTAINER
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  contentContainer: {
    flex: 1,
    paddingTop: 90, // Space for header
  },
  titleContainer: {
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
  },
  sortByButton: {
    backgroundColor: '#080808',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#101010',
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sortByButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  subtitleText: {
    color: '#888',
    fontSize: 13,
    fontWeight: '400',
    marginBottom: 0,
    marginTop: 8,
    textAlign: 'left',
    lineHeight: 18,
  },

  // Cards Container
  cardsContainer: {
    paddingHorizontal: 0,
    paddingBottom: 20,
  },
  emptyStateContainer: {
    paddingHorizontal: 20,
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateText: {
    color: '#999',
    fontSize: 16,
    fontWeight: '400',
    textAlign: 'center',
    lineHeight: 24,
  },

  // Card 1 styles
  card1: {
    backgroundColor: '#050505',
    borderRadius: 28,
    padding: 20,
    marginBottom: 15,
    width: '95%',
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: '#1a1a1a',
  },
  titleRow1: {
    marginBottom: 8,
  },
  title1: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    lineHeight: 24,
  },
  subtext1: {
    fontSize: 14,
    color: '#999',
    lineHeight: 20,
  },

  // Card 2-15 styles (same structure)
  card2: {
    backgroundColor: '#050505',
    borderRadius: 28,
    padding: 20,
    marginBottom: 15,
    width: '95%',
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: '#1a1a1a',
  },
  titleRow2: { marginBottom: 8 },
  title2: { fontSize: 18, fontWeight: '600', color: '#fff', lineHeight: 24 },
  subtext2: { fontSize: 14, color: '#999', lineHeight: 20 },
  card3: {
    backgroundColor: '#050505',
    borderRadius: 28,
    padding: 20,
    marginBottom: 15,
    width: '95%',
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: '#1a1a1a',
  },
  titleRow3: { marginBottom: 8 },
  title3: { fontSize: 18, fontWeight: '600', color: '#fff', lineHeight: 24 },
  subtext3: { fontSize: 14, color: '#999', lineHeight: 20 },
  card4: {
    backgroundColor: '#050505',
    borderRadius: 28,
    padding: 20,
    marginBottom: 15,
    width: '95%',
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: '#1a1a1a',
  },
  titleRow4: { marginBottom: 8 },
  title4: { fontSize: 18, fontWeight: '600', color: '#fff', lineHeight: 24 },
  subtext4: { fontSize: 14, color: '#999', lineHeight: 20 },
  card5: {
    backgroundColor: '#050505',
    borderRadius: 28,
    padding: 20,
    marginBottom: 15,
    width: '95%',
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: '#1a1a1a',
  },
  titleRow5: { marginBottom: 8 },
  title5: { fontSize: 18, fontWeight: '600', color: '#fff', lineHeight: 24 },
  subtext5: { fontSize: 14, color: '#999', lineHeight: 20 },
  card6: {
    backgroundColor: '#050505',
    borderRadius: 28,
    padding: 20,
    marginBottom: 15,
    width: '95%',
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: '#1a1a1a',
  },
  titleRow6: { marginBottom: 8 },
  title6: { fontSize: 18, fontWeight: '600', color: '#fff', lineHeight: 24 },
  subtext6: { fontSize: 14, color: '#999', lineHeight: 20 },
  card7: {
    backgroundColor: '#050505',
    borderRadius: 28,
    padding: 20,
    marginBottom: 15,
    width: '95%',
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: '#1a1a1a',
  },
  titleRow7: { marginBottom: 8 },
  title7: { fontSize: 18, fontWeight: '600', color: '#fff', lineHeight: 24 },
  subtext7: { fontSize: 14, color: '#999', lineHeight: 20 },
  card8: {
    backgroundColor: '#050505',
    borderRadius: 28,
    padding: 20,
    marginBottom: 15,
    width: '95%',
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: '#1a1a1a',
  },
  titleRow8: { marginBottom: 8 },
  title8: { fontSize: 18, fontWeight: '600', color: '#fff', lineHeight: 24 },
  subtext8: { fontSize: 14, color: '#999', lineHeight: 20 },
  card9: {
    backgroundColor: '#050505',
    borderRadius: 28,
    padding: 20,
    marginBottom: 15,
    width: '95%',
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: '#1a1a1a',
  },
  titleRow9: { marginBottom: 8 },
  title9: { fontSize: 18, fontWeight: '600', color: '#fff', lineHeight: 24 },
  subtext9: { fontSize: 14, color: '#999', lineHeight: 20 },
  card10: {
    backgroundColor: '#050505',
    borderRadius: 28,
    padding: 20,
    marginBottom: 15,
    width: '95%',
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: '#1a1a1a',
  },
  titleRow10: { marginBottom: 8 },
  title10: { fontSize: 18, fontWeight: '600', color: '#fff', lineHeight: 24 },
  subtext10: { fontSize: 14, color: '#999', lineHeight: 20 },
  card11: {
    backgroundColor: '#050505',
    borderRadius: 28,
    padding: 20,
    marginBottom: 15,
    width: '95%',
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: '#1a1a1a',
  },
  titleRow11: { marginBottom: 8 },
  title11: { fontSize: 18, fontWeight: '600', color: '#fff', lineHeight: 24 },
  subtext11: { fontSize: 14, color: '#999', lineHeight: 20 },
  card12: {
    backgroundColor: '#050505',
    borderRadius: 28,
    padding: 20,
    marginBottom: 15,
    width: '95%',
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: '#1a1a1a',
  },
  titleRow12: { marginBottom: 8 },
  title12: { fontSize: 18, fontWeight: '600', color: '#fff', lineHeight: 24 },
  subtext12: { fontSize: 14, color: '#999', lineHeight: 20 },
  card13: {
    backgroundColor: '#050505',
    borderRadius: 28,
    padding: 20,
    marginBottom: 15,
    width: '95%',
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: '#1a1a1a',
  },
  titleRow13: { marginBottom: 8 },
  title13: { fontSize: 18, fontWeight: '600', color: '#fff', lineHeight: 24 },
  subtext13: { fontSize: 14, color: '#999', lineHeight: 20 },
  card14: {
    backgroundColor: '#050505',
    borderRadius: 28,
    padding: 20,
    marginBottom: 15,
    width: '95%',
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: '#1a1a1a',
  },
  titleRow14: { marginBottom: 8 },
  title14: { fontSize: 18, fontWeight: '600', color: '#fff', lineHeight: 24 },
  subtext14: { fontSize: 14, color: '#999', lineHeight: 20 },
  card15: {
    backgroundColor: '#050505',
    borderRadius: 28,
    padding: 20,
    marginBottom: 15,
    width: '95%',
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: '#1a1a1a',
  },
  titleRow15: { marginBottom: 8 },
  title15: { fontSize: 18, fontWeight: '600', color: '#fff', lineHeight: 24 },
  subtext15: { fontSize: 14, color: '#999', lineHeight: 20 },
  
  // Search bar styles
  searchBarContainer: {
    backgroundColor: '#050505',
    borderWidth: 1,
    borderColor: '#101010',
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

