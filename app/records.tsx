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
import { useAuth } from '../components/AuthProvider';
import { CardLoadingIndicator } from '../components/CardLoadingIndicator';
import { SearchFilterButton } from '../components/SearchFilterButton';
import { CardService } from '../services/cardService';
import { CardData } from '../utils/cardData';
import { getSupabaseClient } from '../utils/supabase';
import { getMostCommonWords } from '../utils/searchAssistanceUtils';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Banned words that cannot be used as filter buttons
// Includes common non-topic words and politician names (to be populated dynamically)
const COMMON_BANNED_WORDS = [
  'establishes', 'established', 'establish',
  'certain', 'certainly',
  'provides', 'provided', 'provide',
  'requires', 'required', 'require',
  'authorizes', 'authorized', 'authorize',
  'amends', 'amended', 'amend',
  'prohibits', 'prohibited', 'prohibit',
  'directs', 'directed', 'direct',
  'ensures', 'ensured', 'ensure',
  'allows', 'allowed', 'allow',
  'creates', 'created', 'create',
  'modifies', 'modified', 'modify',
  'repeals', 'repealed', 'repeal',
  'expands', 'expanded', 'expand',
  'extends', 'extended', 'extend',
  'implements', 'implemented', 'implement',
  'increases', 'increased', 'increase',
  'decreases', 'decreased', 'decrease',
  'sets', 'set',
  'defines', 'defined', 'define',
  'specifies', 'specified', 'specify',
  'determines', 'determined', 'determine',
  'designates', 'designated', 'designate',
  'approves', 'approved', 'approve',
  'appropriates', 'appropriated', 'appropriate',
  'appropriation',
  'act', 'acts',
  'bill', 'bills',
  'resolution', 'resolutions',
  'legislation', 'legislative',
  'congress', 'congressional',
  'house', 'senate',
  'federal', 'state', 'local',
  'government', 'governments',
  'department', 'departments',
  'agency', 'agencies',
  'program', 'programs',
  'funding', 'fund',
  'fiscal', 'year',
  'section', 'sections',
  'paragraph', 'paragraphs',
  'clause', 'clauses',
  'subsection', 'subsections',
  'effective', 'effectiveness',
  'date', 'dates',
  'shall', 'may', 'must',
  'such', 'each', 'any', 'all',
  'other', 'others', 'another',
  'includes', 'including', 'include',
  'means', 'meaning',
  'terms', 'term',
  'purposes', 'purpose',
  'respect', 'regards',
  'accordance', 'accord',
  'relating', 'related', 'relate',
  'concerning', 'concerned', 'concern',
  'regarding', 'regards',
  'pursuant', 'pursuant to',
  'notwithstanding', 'notwithstanding',
  'herein', 'hereof', 'hereto', 'hereunder',
  'thereof', 'thereto', 'thereunder',
  'whereas', 'whereby',
  'signs', 'sign', 'signed',
  'vetoes', 'veto', 'vetoed',
  'line', 'item'
];

// Helper function to extract first and last name from a full name
function extractNames(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return { firstName: '', lastName: '' };
  }
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: parts[0] };
  }
  // Common suffixes to ignore
  const suffixes = new Set(['jr', 'sr', 'ii', 'iii', 'iv', 'v', '2nd', '3rd', '4th', 'jr.', 'sr.', 'ii.', 'iii.', 'iv.', 'v.']);
  let lastName = parts[parts.length - 1].toLowerCase();
  // If last part is a suffix, take the one before it
  if (suffixes.has(lastName.replace(/\./g, ''))) {
    lastName = parts[parts.length - 2]?.toLowerCase() || lastName;
  }
  return {
    firstName: parts[0].toLowerCase(),
    lastName: lastName
  };
}

// Get banned words for a specific politician (includes their name + common banned words)
function getBannedWords(politicianName: string): string[] {
  const names = extractNames(politicianName);
  const nameBanned = [names.firstName, names.lastName].filter(Boolean);
  return [...new Set([...COMMON_BANNED_WORDS, ...nameBanned])];
}

// Filter out words that are too similar (within 1-2 letters of being identical)
function filterSimilarWords(words: string[]): string[] {
  if (words.length <= 1) return words;
  
  // Sort by length (longest first) to keep longer words when one is substring of another
  const sorted = [...words].sort((a, b) => b.length - a.length);
  const filtered: string[] = [];
  
  for (const word of sorted) {
    const wordLower = word.toLowerCase();
    let isTooSimilar = false;
    
    for (const existing of filtered) {
      const existingLower = existing.toLowerCase();
      
      // Check if one word is a substring of the other
      if (existingLower.includes(wordLower) || wordLower.includes(existingLower)) {
        isTooSimilar = true;
        break;
      }
      
      // Check if they differ by only 1-2 characters (for words of similar length)
      const lenDiff = Math.abs(wordLower.length - existingLower.length);
      if (lenDiff <= 2 && wordLower.length > 3 && existingLower.length > 3) {
        // Simple character difference check
        let differences = 0;
        const minLen = Math.min(wordLower.length, existingLower.length);
        for (let i = 0; i < minLen; i++) {
          if (wordLower[i] !== existingLower[i]) differences++;
        }
        differences += lenDiff; // Add length difference
        
        // If they differ by 1-2 characters total, they're too similar
        if (differences <= 2) {
          isTooSimilar = true;
          break;
        }
      }
    }
    
    if (!isTooSimilar) {
      filtered.push(word);
    }
  }
  
  return filtered;
}

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

export default function Records() {
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const profileIndex = typeof params.profileIndex === 'string' ? params.profileIndex : '';

  // Search functionality
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<TextInput>(null);
  
  // Category filter buttons (dynamically generated from card titles)
  const [categoryFilters, setCategoryFilters] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  
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
  
  // Filter records based on search query and selected filter words
  const filteredCardData = (() => {
    const defaultCompare = (a: any, b: any) => {
      // Sort by demographics match score first (highest first)
      const aMatch = a?.matchScore ?? 0;
      const bMatch = b?.matchScore ?? 0;
      if (aMatch !== bMatch) return bMatch - aMatch;

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
    
    // Apply category filter (single selection, like sub4)
    if (selectedCategory) {
      const categoryLower = selectedCategory.toLowerCase();
      filtered = filtered.filter(card => {
        const title = (card.title || '').toLowerCase();
        const subtext = (card.subtext || '').toLowerCase();
        const combined = `${title} ${subtext}`;
        return combined.includes(categoryLower);
      });
    }
    
    // Apply search query filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(card => 
        card.title?.toLowerCase().includes(query) ||
        card.subtext?.toLowerCase().includes(query)
      );
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

  // Fetch voting records
  useEffect(() => {
    const fetchVotingRecords = async () => {
      if (!profileIndex) {
        setCardData([]);
        setLoadingCards(false);
        return;
      }

      setLoadingCards(true);
      try {
        const ownerId = Number(profileIndex);
        if (Number.isNaN(ownerId)) {
          console.warn('records: invalid owner_id', profileIndex);
          setCardData([]);
          setLoadingCards(false);
          return;
        }

        const supabase = getSupabaseClient();
        
        // Fetch politician name from ppl_index
        const { data: politicianData, error: polError } = await supabase
          .from('ppl_index')
          .select('name')
          .eq('id', ownerId)
          .single();

        if (polError || !politicianData) {
          console.error('records: error fetching politician name:', polError);
          setCardData([]);
          setLoadingCards(false);
          return;
        }

        const politicianName = politicianData.name;

        // Fetch cards where subtext contains "vetoes", "signs", or "votes" and the politician's name
        // Voting record cards: "[Politician Name] signs/vetoes [Bill Number]" or "[Politician Name] votes yes/no [Bill Number]"
        const { data, error } = await supabase
          .from('card_index')
          .select('id, title, subtext, opens_7d, score, created_at, is_ppl, owner_id, screen, web_id, web, link')
          .eq('owner_id', ownerId)
          .eq('is_ppl', true)
          .eq('is_active', true)
          .or(`subtext.ilike.%${politicianName} signs%,subtext.ilike.%${politicianName} vetoes%,subtext.ilike.%${politicianName} votes%`)
          .order('opens_7d', { ascending: false });

        if (error) {
          console.error('records: card_index fetch error', error);
          setCardData([]);
          setLoadingCards(false);
          return;
        }

        if (!data || data.length === 0) {
          setCardData([]);
          setLoadingCards(false);
          return;
        }

        // Filter to ensure subtext contains "vetoes", "signs", or "votes" (case-insensitive)
        const votingRecords = data.filter(card => {
          const subtext = (card.subtext || '').toLowerCase();
          return subtext.includes('vetoes') || subtext.includes('signs') || subtext.includes('votes');
        });

        // Fetch owner names for all cards
        const ownerIds = [...new Set(votingRecords.map((card: any) => card.owner_id).filter(Boolean))];
        const pplIds = votingRecords.filter((card: any) => card.is_ppl).map((card: any) => card.owner_id);
        
        let ownerNamesMap: Record<number, string> = {};
        
        if (pplIds.length > 0) {
          const { data: pplData, error: pplError } = await supabase
            .from('ppl_index')
            .select('id, name')
            .in('id', pplIds);
            
          if (!pplError && pplData) {
            pplData.forEach((ppl: any) => {
              ownerNamesMap[ppl.id] = ppl.name;
            });
          }
        }

        // Map cards with owner names
        const cardsWithOwners = votingRecords.map((card: any) => ({
          ...card,
          ownerName: ownerNamesMap[card.owner_id] || 'Unknown',
        }));

        // Client-side stable sort with fallback to `score`
        const sortedCards = [...cardsWithOwners].sort((a: any, b: any) => {
          const ao = a?.opens_7d ?? -Infinity;
          const bo = b?.opens_7d ?? -Infinity;
          if (ao !== bo) return bo - ao;

          const as = a?.score ?? -Infinity;
          const bs = b?.score ?? -Infinity;
          if (as !== bs) return bs - as;

          return (b?.id ?? 0) - (a?.id ?? 0);
        });

        setCardData(sortedCards);
        
        // Generate category filters from card titles (top 10 words, excluding banned words)
        if (sortedCards.length > 0) {
          const bannedWordsSet = new Set(getBannedWords(politicianName).map(w => w.toLowerCase()));
          const commonWords = getMostCommonWords(sortedCards, 50); // Get more words to filter
          
          // Filter out banned words (keep lowercase)
          const filteredWords = commonWords
            .filter(word => !bannedWordsSet.has(word.toLowerCase()))
            .slice(0, 20); // Get more words before filtering similar ones
          
          // Filter out similar words (within 1-2 letters of being identical)
          const uniqueWords = filterSimilarWords(filteredWords);
          
          // Take top 10 and keep lowercase
          setCategoryFilters(uniqueWords.slice(0, 10));
        } else {
          setCategoryFilters([]);
        }
        
      } catch (err) {
        console.error('records: unexpected error fetching voting records:', err);
        setCardData([]);
      } finally {
        setLoadingCards(false);
      }
    };

    fetchVotingRecords();
  }, [profileIndex, user?.id]);

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
          
          // Check if card needs records_open (if web_id is null, it's an incomplete voting record card)
          const needsRecordOpen = !card.web_id;
          
          let wasCancelled = false;
          try {
            // Step 1: If card doesn't have web_id, call records_open first
            if (needsRecordOpen) {
              setIsCardLoading(true);
              const supabase = getSupabaseClient();
              const { data: recordsOpenData, error: recordsOpenError } = await supabase.functions.invoke('records_open', {
                body: { card_id: parsedCardId },
              });
              
              if (recordsOpenError || !recordsOpenData?.success) {
                console.error('Error calling records_open:', recordsOpenError || recordsOpenData);
                Alert.alert(
                  'Error',
                  recordsOpenData?.error || 'This voting record is currently unavailable.',
                  [{ text: 'OK' }]
                );
                return;
              }
            }
            
            // Step 2: Execute full_card_gen script
            await CardService.generateFullCard(parsedCardId, setIsCardLoading, card.is_ppl ?? true);
          } catch (error: any) {
            if (error?.message === 'CANCELLED') {
              console.log('Card loading was cancelled, not navigating');
              wasCancelled = true;
            } else {
              console.error('Error generating full card:', error);
              // Show error alert for voting records
              if (needsRecordOpen) {
                Alert.alert(
                  'Error',
                  'This voting record is currently unavailable.',
                  [{ text: 'OK' }]
                );
              }
              // Continue with navigation even if card generation fails (non-cancellation error)
            }
          } finally {
            currentLoadingCardId.current = null;
            setIsCardLoading(false);
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
                sourcePage: 'records',
                originalPage: screen || 'records',
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
                sourcePage: 'records',
                originalPage: screen || 'records',
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

  // Handler for category filter button selection
  const handleCategoryPress = (category: string) => {
    setSelectedCategory(prev => prev === category ? null : category);
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
            <Text style={styles.title}>Voting Records</Text>
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
              placeholder="Search Voting Records"
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

          {/* Category filter buttons (generated from card titles) */}
          {categoryFilters.length > 0 && (
            <View style={styles.searchAssistanceContainer}>
              <View style={styles.filterButtonsContainer}>
                {categoryFilters.map((category, index) => (
                  <SearchFilterButton
                    key={`${category}-${index}`}
                    word={category}
                    isSelected={selectedCategory === category}
                    onPress={handleCategoryPress}
                  />
                ))}
              </View>
            </View>
          )}

          {loadingCards ? (
            <View style={styles.emptyStateContainer}>
              <Text style={styles.emptyStateText}>Loading voting records...</Text>
            </View>
          ) : paginatedCardData.length === 0 ? (
            <View style={styles.emptyStateContainer}>
              <Text style={styles.emptyStateText}>
                Voting Records are currently unavailable
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

