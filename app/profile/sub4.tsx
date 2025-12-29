import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
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
import { CardGenerationService } from '../../services/cardGenerationService';
import { CardService } from '../../services/cardService';
import { CardData, getCategoryFromTitle, getCategoryMapping, getScreenDisplayName } from '../../utils/cardData';
import { filterCardsByWords, getMostCommonWords, shouldShowSearchAssistance } from '../../utils/searchAssistanceUtils';
import { getSupabaseClient } from '../../utils/supabase';

// #region agent log - module level
fetch('http://127.0.0.1:7242/ingest/19849a76-36b4-425e-bfd9-bdf864de6ad5',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sub4.tsx:MODULE',message:'Module loaded',data:{CardLoadingIndicator:typeof CardLoadingIndicator,SearchFilterButton:typeof SearchFilterButton,Pressable:typeof Pressable,ScrollView:typeof ScrollView},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A'})}).catch(()=>{});
// #endregion

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// #region agent log - animated component check
fetch('http://127.0.0.1:7242/ingest/19849a76-36b4-425e-bfd9-bdf864de6ad5',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sub4.tsx:ANIMATED',message:'AnimatedPressable created',data:{AnimatedPressable:typeof AnimatedPressable},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B'})}).catch(()=>{});
// #endregion
const STAR_COUNT = 5;

// Normalize category/title to the exact enum your DB uses.
const normalizeCategory = (title?: string) => {
  if (!title) return null;
  const t = title.trim().toLowerCase();
  // Use existing getCategoryFromTitle utility for consistency
  return getCategoryFromTitle(title);
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

export default function Sub4() {
  // #region agent log - component entry
  fetch('http://127.0.0.1:7242/ingest/19849a76-36b4-425e-bfd9-bdf864de6ad5',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sub4.tsx:ENTRY',message:'Sub4 component entered',data:{},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'C'})}).catch(()=>{});
  // #endregion
  const router = useRouter();
  const params = useLocalSearchParams();
  // #region agent log - params
  fetch('http://127.0.0.1:7242/ingest/19849a76-36b4-425e-bfd9-bdf864de6ad5',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sub4.tsx:PARAMS',message:'Params received',data:{paramsKeys:Object.keys(params),buttonText:params.buttonText,profileIndex:params.profileIndex},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'D'})}).catch(()=>{});
  // #endregion
  const buttonText = typeof params.buttonText === 'string' ? params.buttonText : 'No Data';
  const position = typeof params.title === 'string' ? params.title : 'No Data Available';
  const profileName = typeof params.subtitle === 'string' ? params.subtitle : 'No Data Available';
  const originalPage = typeof params.originalPage === 'string' ? params.originalPage : '';
  const profileIndex = typeof params.profileIndex === 'string' ? params.profileIndex : '';

  const [tier, setTier] = useState<string>('base');
  
  // Search functionality
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<TextInput>(null);
  
  // Log entry to category page (crash point)
  useEffect(() => {
    console.log('[Sub4] Entering category page', {
      screen: 'sub4',
      category: buttonText,
      profileIndex,
      originalPage
    });
  }, [buttonText, profileIndex, originalPage]);
  
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
  
  // State for card data from card_index table
  const [cardData, setCardData] = useState<CardData[]>([]);
  const [loadingCards, setLoadingCards] = useState(false);
  const [isCardLoading, setIsCardLoading] = useState(false);
  
  // State for generate cards button
  const [isGeneratingCards, setIsGeneratingCards] = useState(false);
  const [showGenerateButton, setShowGenerateButton] = useState(false);
  const generateButtonScale = useRef(new Animated.Value(1)).current;
  const sortByButtonScale = useRef(new Animated.Value(1)).current;
  const abortControllerRef = useRef<AbortController | null>(null);
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

  // Determine the screen name based on the original page
  const getScreenName = (page: string) => {
    switch (page) {
      case 'sub1': return 'Agenda';
      case 'sub2': return 'Identity';
      case 'sub3': return 'Affiliates';
      default: return '';
    }
  };
  
  const screenName = getScreenName(originalPage);

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

  // NOTE: for crash isolation testing, we are intentionally NOT fetching tier here.
  // The legislative equivalent (`legi4`) does not tier-fetch on page open.
  // If needed later, restore the ppl_index tier fetch.
  useEffect(() => {
    setTier('base');
  }, [profileIndex]);

  // Fetch card data from card_index table based on screen value and category
  useEffect(() => {
    const fetchAllCards = async () => {
      if (!profileIndex) {
        setCardData([]);
        return;
      }

      setLoadingCards(true);
      try {
        const category = normalizeCategory(buttonText);
        if (!category) {
          setCardData([]);
          setLoadingCards(false);
          return;
        }

        const ownerId = Number(profileIndex);
        if (Number.isNaN(ownerId)) {
          console.warn('sub4: invalid owner_id', profileIndex);
          setCardData([]);
          setLoadingCards(false);
          return;
        }

        // Determine the correct screen value based on the original page
        let targetScreen: string;
        switch (originalPage) {
          case 'sub1': targetScreen = 'agenda_ppl'; break;
          case 'sub2': targetScreen = 'identity'; break;
          case 'sub3': targetScreen = 'affiliates'; break;
          default: targetScreen = 'agenda_ppl'; // fallback
        }

        // NOTE: for crash isolation testing, we are intentionally using a single query (like `legi4`)
        // instead of paging with `range()` in a loop.
        const supabase = getSupabaseClient();
        const { data, error } = await supabase
          .from('card_index')
          .select('id, title, subtext, screen, category, opens_7d, score, created_at')
          .eq('owner_id', ownerId)
          .eq('is_ppl', true)
          .eq('is_active', true)
          .eq('screen', targetScreen)
          .eq('category', category)
          .order('opens_7d', { ascending: false });

        if (error) {
          console.error('sub4: card_index fetch error', error);
          setCardData([]);
          setShowGenerateButton(false);
          return;
        }

        // Client-side stable sort with fallback to `score` (kept consistent with prior behavior)
        const sorted = (data ?? []).sort((a: any, b: any) => {
          const ao = a?.opens_7d ?? -Infinity;
          const bo = b?.opens_7d ?? -Infinity;
          if (ao !== bo) return bo - ao;

          const as = a?.score ?? -Infinity;
          const bs = b?.score ?? -Infinity;
          if (as !== bs) return bs - as;

          return (b?.id ?? 0) - (a?.id ?? 0);
        });

        setCardData(sorted);
        
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
        
        // Check if generate button should be shown
        const shouldShowButton = await CardGenerationService.shouldShowGenerateButtonForCategory(ownerId, category);
        setShowGenerateButton(shouldShowButton);
      } catch (err) {
        console.error('sub4: unexpected fetch error', err);
        setCardData([]);
        setShowGenerateButton(false);
      } finally {
        setLoadingCards(false);
      }
    };

    fetchAllCards();
  }, [profileIndex, buttonText, originalPage]);

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
    if (!profileIndex || isGeneratingCards) return;
    
    // Create new abort controller
    abortControllerRef.current = new AbortController();
    
    setIsGeneratingCards(true);
    try {
      const category = normalizeCategory(buttonText);
      if (!category) {
        console.error('No valid category found for button text:', buttonText);
        return;
      }
      
      const ownerId = Number(profileIndex);
      // Pre-check: if not allowed, hide button and bail
      const canGenerate = await CardGenerationService.shouldShowGenerateButtonForCategory(ownerId, category);
      if (!canGenerate) {
        setShowGenerateButton(false);
        return;
      }

      // Save timestamp before generation to find newly created cards
      const beforeGenerationTimestamp = new Date().toISOString();
      
      const result = await CardGenerationService.generatePoliticianCards(
        ownerId, 
        'sub4',
        category
      ) as any;
      
      // Check if operation was aborted
      if (abortControllerRef.current?.signal.aborted) {
        return;
      }
      
      if (result.success) {
        // Get number of cards generated
        const cardsGenerated = result.data?.inserted || 0;
        
        // Get categories of newly generated cards with screen info
        const generatedCategoryScreenPairs = await CardGenerationService.getGeneratedCardCategories(
          ownerId,
          true, // isPpl
          beforeGenerationTimestamp
        );
        
        // Map category values to display names, handling "more" category specially
        const categoryMapping = getCategoryMapping();
        const categoryDisplayNames = generatedCategoryScreenPairs.map(({ category, screen }) => {
          if (category === 'more') {
            // Format "more" category with screen name
            const screenDisplayName = getScreenDisplayName(screen);
            return `${categoryMapping[category]}: ${screenDisplayName}`;
          } else {
            return categoryMapping[category] || category;
          }
        }).filter(Boolean);
        
        // Check if requested category was found in generated cards
        const requestedCategoryFound = generatedCategoryScreenPairs.some(
          ({ category: cat }) => cat === category
        );
        
        // Build success message
        let message = `Generated ${cardsGenerated} card${cardsGenerated !== 1 ? 's' : ''} successfully!`;
        
        if (categoryDisplayNames.length > 0) {
          message += `\n\nThe new cards can be found in the following categories: ${categoryDisplayNames.join(', ')}.`;
        }
        
        if (!requestedCategoryFound && categoryDisplayNames.length > 0) {
          message += `\n\nThere weren't enough cards for the requested section, we apologize for the inconvenience.`;
        }
        
        // Show success message
        Alert.alert(
          'Success',
          message,
          [{ text: 'OK' }]
        );
        
        // Refresh cards after generation
        const fetchAllCards = async () => {
          setLoadingCards(true);
          try {
            const ownerId = Number(profileIndex);
            const targetScreen: string = (() => {
              switch (originalPage) {
                case 'sub1': return 'agenda_ppl';
                case 'sub2': return 'identity';
                case 'sub3': return 'affiliates';
                default: return 'agenda_ppl';
              }
            })();

            const pageSize = 100;
            let from = 0;
            let to = pageSize - 1;
            let allRows: any[] = [];

            const supabase = getSupabaseClient();
            while (true) {
              const { data, error } = await supabase
                .from('card_index')
                .select('id, title, subtext, screen, category, opens_7d, score, created_at')
                .eq('owner_id', ownerId)
                .eq('is_ppl', true)
                .eq('is_active', true)
                .eq('screen', targetScreen)
                .eq('category', category)
                .order('opens_7d', { ascending: false, nullsFirst: false })
                .range(from, to);

              if (error) {
                console.error('sub4: card_index fetch error', error);
                break;
              }

              const batch = data ?? [];
              allRows = allRows.concat(batch);

              if (batch.length < pageSize) {
                break;
              }
              from += pageSize;
              to += pageSize;
            }

            const sorted = allRows.sort((a, b) => {
              const ao = a?.opens_7d ?? -Infinity;
              const bo = b?.opens_7d ?? -Infinity;
              if (ao !== bo) return bo - ao;

              const as = a?.score ?? -Infinity;
              const bs = b?.score ?? -Infinity;
              if (as !== bs) return bs - as;

              return (b?.id ?? 0) - (a?.id ?? 0);
            });

            setCardData(sorted);
            
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
            
            // Check if button should still be shown
            const shouldShowButtonAfterGen = await CardGenerationService.shouldShowGenerateButtonForCategory(ownerId, category);
            setShowGenerateButton(shouldShowButtonAfterGen);
          } catch (err) {
            console.error('sub4: unexpected fetch error', err);
            setCardData([]);
            setShowGenerateButton(false);
          } finally {
            setLoadingCards(false);
          }
        };
        
        fetchAllCards();
      } else {
        // On failure, re-check visibility and hide if conditions require it
        try {
          const ownerId2 = Number(profileIndex);
          const shouldShowBtn = await CardGenerationService.shouldShowGenerateButtonForCategory(ownerId2, category);
          setShowGenerateButton(shouldShowBtn);
        } catch {}
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

  // Animation handlers for FlatList items
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

  // Card renderer (used by ScrollView mapping)
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
            pathname: '/profile/sub5',
            params: {
              cardTitle: card.title || 'No Data',
              profileName: profileName,
              sourcePage: 'sub4',
              originalPage: originalPage,
              pageCount: String(1),
              cardId: cardId,
            },
          });
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

  // Handler for haptic feedback
  const handleHaptic = () => {
                Haptics.selectionAsync();
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
            source={require('../../assets/back1.png')}
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
              canGoPrev ? require('../../assets/left1.png') : require('../../assets/leftgrey.png')
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
                ? require('../../assets/right1.png')
                : require('../../assets/rightgrey.png')
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
            <Text style={styles.title}>{buttonText}</Text>
            <Animated.View style={{ transform: [{ scale: sortByButtonScale }] }}>
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
          <Text style={styles.subtitleText}>{profileName}: {screenName}</Text>
        </View>

        {/* Crash-isolation test: use ScrollView (like legi4) instead of FlatList */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.cardsContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onScrollBeginDrag={dismissKeyboard}
        >
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

          {paginatedCardData.map((card, index) => renderCard(card, index))}

          {/* Generate New Cards Button */}
          {showGenerateButton && buttonText !== 'More Selections' && (
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
        </ScrollView>
        </View>
        
        <CardLoadingIndicator 
          visible={isCardLoading || isGeneratingCards} 
          onCancel={handleCancelLoading}
          title={isGeneratingCards ? "Loading Cards" : "Loading Card"}
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
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 24,
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
    /**
     * TWEAK HERE (does NOT affect layout of the row):
     * - Increase `top` to move DOWN, decrease (or negative) to move UP.
     * - Increase `left` to move RIGHT, decrease (or negative) to move LEFT.
     * Using relative positioning shifts ONLY this button visually without moving siblings.
     */
    position: 'relative',
    top: 10,
    left: 0,
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
    color: '#fff',
    fontSize: 13,
    fontWeight: '400',
    marginBottom: 0,
    textAlign: 'left',
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

  // Card 2 styles
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
  titleRow2: {
    marginBottom: 8,
  },
  title2: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    lineHeight: 24,
  },
  subtext2: {
    fontSize: 14,
    color: '#999',
    lineHeight: 20,
  },

  // Card 3 styles
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
  titleRow3: {
    marginBottom: 8,
  },
  title3: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    lineHeight: 24,
  },
  subtext3: {
    fontSize: 14,
    color: '#999',
    lineHeight: 20,
  },

  // Card 4 styles
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
  titleRow4: {
    marginBottom: 8,
  },
  title4: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    lineHeight: 24,
  },
  subtext4: {
    fontSize: 14,
    color: '#999',
    lineHeight: 20,
  },

  // Card 5 styles
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
  titleRow5: {
    marginBottom: 8,
  },
  title5: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    lineHeight: 24,
  },
  subtext5: {
    fontSize: 14,
    color: '#999',
    lineHeight: 20,
  },

  // Card 6 styles
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
  titleRow6: {
    marginBottom: 8,
  },
  title6: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    lineHeight: 24,
  },
  subtext6: {
    fontSize: 14,
    color: '#999',
    lineHeight: 20,
  },

  // Card 7 styles
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
  titleRow7: {
    marginBottom: 8,
  },
  title7: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    lineHeight: 24,
  },
  subtext7: {
    fontSize: 14,
    color: '#999',
    lineHeight: 20,
  },

  // Card 8 styles
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
  titleRow8: {
    marginBottom: 8,
  },
  title8: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    lineHeight: 24,
  },
  subtext8: {
    fontSize: 14,
    color: '#999',
    lineHeight: 20,
  },

  // Card 9 styles
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
  titleRow9: {
    marginBottom: 8,
  },
  title9: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    lineHeight: 24,
  },
  subtext9: {
    fontSize: 14,
    color: '#999',
    lineHeight: 20,
  },

  // Card 10 styles
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
  titleRow10: {
    marginBottom: 8,
  },
  title10: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    lineHeight: 24,
  },
  subtext10: {
    fontSize: 14,
    color: '#999',
    lineHeight: 20,
  },

  // Card 11 styles
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
  titleRow11: {
    marginBottom: 8,
  },
  title11: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    lineHeight: 24,
  },
  subtext11: {
    fontSize: 14,
    color: '#999',
    lineHeight: 20,
  },

  // Card 12 styles
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
  titleRow12: {
    marginBottom: 8,
  },
  title12: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    lineHeight: 24,
  },
  subtext12: {
    fontSize: 14,
    color: '#999',
    lineHeight: 20,
  },

  // Card 13 styles
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
  titleRow13: {
    marginBottom: 8,
  },
  title13: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    lineHeight: 24,
  },
  subtext13: {
    fontSize: 14,
    color: '#999',
    lineHeight: 20,
  },

  // Card 14 styles
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
  titleRow14: {
    marginBottom: 8,
  },
  title14: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    lineHeight: 24,
  },
  subtext14: {
    fontSize: 14,
    color: '#999',
    lineHeight: 20,
  },

  // Card 15 styles
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
  titleRow15: {
    marginBottom: 8,
  },
  title15: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    lineHeight: 24,
  },
  subtext15: {
    fontSize: 14,
    color: '#999',
    lineHeight: 20,
  },
  
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
  generateButtonContainer: {
    width: '92%',
    alignSelf: 'center',
    marginTop: 0,
    marginBottom: 30,
  },
  generateButton: {
    backgroundColor: '#050505',
    borderRadius: 20,
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
