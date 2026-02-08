import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Image, Keyboard, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import CardLoadingIndicator from '../components/CardLoadingIndicator';
import { CardService } from '../services/cardService';
import { getSupabaseClient } from '../utils/supabase';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Card pages/categories unavailable for Politician
const POLITICIAN_UNAVAILABLE_PAGES = ['Impact', 'Discourse'];
const POLITICIAN_UNAVAILABLE_CATEGORIES = ['action', 'scope', 'process', 'exceptions', 'sectors', 'demographics', 'regions', 'aftermath', 'backers', 'opposers', 'narratives'];

// Card pages/categories unavailable for Legislation
const LEGISLATION_UNAVAILABLE_PAGES = ['Identity', 'Affiliates'];
const LEGISLATION_UNAVAILABLE_CATEGORIES = ['economy', 'immigration', 'healthcare', 'defense', 'environment', 'education', 'background', 'career', 'public image', 'accomplishments', 'statements', 'awards', 'party', 'organizations', 'businesses', 'politicians', 'medias', 'donors', 'more', 'social programs', 'national security', 'beliefs', 'enterprises'];

function getScreenForCardPage(cardPage: string, isPpl: boolean): string {
  if (cardPage === 'Agenda') return isPpl ? 'agenda_ppl' : 'agenda_legi';
  if (cardPage === 'Identity') return 'identity';
  if (cardPage === 'Affiliates') return 'affiliates';
  if (cardPage === 'Impact') return 'impact';
  if (cardPage === 'Discourse') return 'discourse';
  return '';
}

export default function CardSearch() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<TextInput>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isCardLoading, setIsCardLoading] = useState(false);
  const currentLoadingCardId = useRef<number | null>(null);
  const [trendingCards, setTrendingCards] = useState<any[]>([]);

  const [category1Label, setCategory1Label] = useState('Profile Type');
  const [category2Label, setCategory2Label] = useState('Card Page');
  const [policyAreaLabel, setPolicyAreaLabel] = useState('Card Category');
  const [selectedCardCategoryValue, setSelectedCardCategoryValue] = useState<string | null>(null);

  // Read selected card category from AsyncStorage when returning from card-subjects page
  useFocusEffect(
    useCallback(() => {
      const checkAsyncStorage = async () => {
        try {
          const storedLabel = await AsyncStorage.getItem('selectedCardCategoryLabel');
          const storedValue = await AsyncStorage.getItem('selectedCardCategoryValue');

          if (storedLabel) {
            setPolicyAreaLabel(storedLabel);
            await AsyncStorage.removeItem('selectedCardCategoryLabel');
          }
          if (storedValue) {
            setSelectedCardCategoryValue(storedValue);
            await AsyncStorage.removeItem('selectedCardCategoryValue');
          }
        } catch (error) {
          console.error('Error reading AsyncStorage for card category:', error);
        }
      };

      checkAsyncStorage();
    }, [])
  );

  const category1Labels = ['Profile Type', 'Politician', 'Legislation', 'Both'];
  const category2Labels = ['Card Page', 'Agenda', 'Identity', 'Affiliates', 'Impact', 'Discourse'];

  const isCardPageDisabled = useCallback((page: string) => {
    if (category1Label === 'Profile Type' || category1Label === 'Both') return false;
    if (category1Label === 'Politician') return POLITICIAN_UNAVAILABLE_PAGES.includes(page);
    if (category1Label === 'Legislation') return LEGISLATION_UNAVAILABLE_PAGES.includes(page);
    return false;
  }, [category1Label]);

  const isCardCategoryDisabled = useCallback((category: string) => {
    const catLower = category.toLowerCase();
    if (category1Label === 'Profile Type' || category1Label === 'Both') return false;
    if (category1Label === 'Politician') return POLITICIAN_UNAVAILABLE_CATEGORIES.includes(catLower);
    if (category1Label === 'Legislation') return LEGISLATION_UNAVAILABLE_CATEGORIES.includes(catLower);
    return false;
  }, [category1Label]);

  useEffect(() => {
    if (category2Label !== 'Card Page' && isCardPageDisabled(category2Label)) {
      setCategory2Label('Card Page');
    }
  }, [category1Label, category2Label, isCardPageDisabled]);

  useEffect(() => {
    if (selectedCardCategoryValue && isCardCategoryDisabled(selectedCardCategoryValue)) {
      setSelectedCardCategoryValue(null);
      setPolicyAreaLabel('Card Category');
    }
  }, [category1Label, selectedCardCategoryValue, isCardCategoryDisabled]);

  const cycleCategory1 = () => {
    const currentIndex = category1Labels.indexOf(category1Label);
    const nextIndex = (currentIndex + 1) % category1Labels.length;
    setCategory1Label(category1Labels[nextIndex]);
  };

  const cycleCategory2 = () => {
    const currentIndex = category2Labels.indexOf(category2Label);
    let nextIndex = (currentIndex + 1) % category2Labels.length;
    const nextPage = category2Labels[nextIndex];
    while (nextPage !== 'Card Page' && isCardPageDisabled(nextPage)) {
      nextIndex = (nextIndex + 1) % category2Labels.length;
      if (category2Labels[nextIndex] === 'Card Page') break;
    }
    setCategory2Label(category2Labels[nextIndex]);
  };

  const resetFilters = () => {
    setCategory1Label('Profile Type');
    setCategory2Label('Card Page');
    setPolicyAreaLabel('Card Category');
    setSelectedCardCategoryValue(null);
  };

  const dismissKeyboard = () => Keyboard.dismiss();

  const handleScreenPress = () => {
    dismissKeyboard();
  };

  const handleSearchCards = useCallback(async () => {
    if (isSearching) return;
    setIsSearching(true);
    dismissKeyboard();

    try {
      const supabase = getSupabaseClient();
      const q = searchQuery.trim();
      const profileType = category1Label;
      const cardPage = category2Label;
      const cardCategory = selectedCardCategoryValue;

      const shouldQueryPpl = profileType === 'Politician' || profileType === 'Both' || profileType === 'Profile Type';
      const shouldQueryLegi = profileType === 'Legislation' || profileType === 'Both' || profileType === 'Profile Type';

      const allResults: any[] = [];

      const runQuery = async (isPpl: boolean) => {
        let query = supabase
          .from('card_index')
          .select('id, title, subtext, screen, category, is_ppl, owner_id')
          .eq('is_active', true)
          .eq('is_ppl', isPpl);

        if (cardPage !== 'Card Page') {
          const screen = getScreenForCardPage(cardPage, isPpl);
          if (screen) query = query.eq('screen', screen);
        }

        if (cardCategory) {
          query = query.eq('category', cardCategory.toLowerCase());
        }

        if (q) {
          query = query.or(`title.ilike.%${q}%,subtext.ilike.%${q}%`);
        }

        const { data, error } = await query.order('opens_7d', { ascending: false });
        if (error) throw error;
        return data || [];
      };

      if (shouldQueryPpl) {
        const pplData = await runQuery(true);
        allResults.push(...pplData);
      }
      if (shouldQueryLegi) {
        const legiData = await runQuery(false);
        allResults.push(...legiData);
      }

      const ownerIds = [...new Set(allResults.map((c: any) => c.owner_id).filter(Boolean))];
      const pplIds = allResults.filter((c: any) => c.is_ppl).map((c: any) => c.owner_id).filter(Boolean);
      const legiIds = allResults.filter((c: any) => !c.is_ppl).map((c: any) => c.owner_id).filter(Boolean);

      let pplNames: Record<number, string> = {};
      if (pplIds.length > 0) {
        const { data: pplData } = await supabase.from('ppl_index').select('id, name').in('id', pplIds);
        if (pplData) pplData.forEach((p: any) => { pplNames[p.id] = p.name; });
      }

      let legiNames: Record<number, string> = {};
      if (legiIds.length > 0) {
        const { data: legiData } = await supabase.from('legi_index').select('id, name').in('id', legiIds);
        if (legiData) legiData.forEach((l: any) => { legiNames[l.id] = l.name; });
      }

      const enriched = allResults.map((c: any) => ({
        ...c,
        ownerName: c.is_ppl ? (pplNames[c.owner_id] || 'Unknown') : (legiNames[c.owner_id] || 'Unknown'),
      }));

      const filters: Record<string, string | null> = {
        profileType: profileType !== 'Profile Type' ? profileType : null,
        cardPage: cardPage !== 'Card Page' ? cardPage : null,
        cardCategory: cardCategory || null,
      };

      router.push({
        pathname: '/card-results',
        params: {
          searchResults: JSON.stringify(enriched),
          searchQuery: q || '',
          filters: JSON.stringify(filters),
        },
      });
    } catch (err) {
      console.error('Card search error:', err);
    } finally {
      setIsSearching(false);
    }
  }, [router, searchQuery, category1Label, category2Label, selectedCardCategoryValue, isSearching]);

  // Fetch trending agenda cards: get all with opens_7d not null, order by opens_7d desc,
  // then take first 5 where screen = agenda_legi or agenda_ppl
  useEffect(() => {
    const fetchTrendingCards = async () => {
      try {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase
          .from('card_index')
          .select('id, title, subtext, screen, is_ppl, owner_id')
          .eq('is_active', true)
          .not('opens_7d', 'is', null)
          .order('opens_7d', { ascending: false })
          .limit(200);

        if (error) {
          console.error('Error fetching trending cards:', error);
          setTrendingCards([]);
          return;
        }

        const allOrdered = data || [];
        const agendaScreens = ['agenda_legi', 'agenda_ppl'];
        const top5Agenda = allOrdered
          .filter((c: any) => agendaScreens.includes(c.screen))
          .slice(0, 5);

        if (top5Agenda.length === 0) {
          setTrendingCards([]);
          return;
        }

        const pplIds = top5Agenda.filter((c: any) => c.is_ppl).map((c: any) => c.owner_id).filter(Boolean);
        const legiIds = top5Agenda.filter((c: any) => !c.is_ppl).map((c: any) => c.owner_id).filter(Boolean);

        let pplNames: Record<number, string> = {};
        if (pplIds.length > 0) {
          const { data: pplData } = await supabase.from('ppl_index').select('id, name').in('id', pplIds);
          if (pplData) pplData.forEach((p: any) => { pplNames[p.id] = p.name; });
        }

        let legiNames: Record<number, string> = {};
        if (legiIds.length > 0) {
          const { data: legiData } = await supabase.from('legi_index').select('id, name').in('id', legiIds);
          if (legiData) legiData.forEach((l: any) => { legiNames[l.id] = l.name; });
        }

        const enriched = top5Agenda.map((c: any) => ({
          ...c,
          ownerName: c.is_ppl ? (pplNames[c.owner_id] || 'Unknown') : (legiNames[c.owner_id] || 'Unknown'),
        }));

        setTrendingCards(enriched);
      } catch (err) {
        console.error('Error fetching trending cards:', err);
        setTrendingCards([]);
      }
    };

    fetchTrendingCards();
  }, []);

  const handleTrendingCardPress = useCallback(
    async (card: any) => {
      const cardIdStr = String(card.id ?? '');
      const parsedCardId = parseInt(cardIdStr, 10);
      if (!cardIdStr || isNaN(parsedCardId) || parsedCardId <= 0) return;

      const isPpl = card.is_ppl ?? true;
      const ownerName = card.ownerName || 'Unknown';

      setIsCardLoading(true);
      currentLoadingCardId.current = parsedCardId;
      let wasCancelled = false;

      try {
        await CardService.generateFullCard(parsedCardId, setIsCardLoading, isPpl);
      } catch (error: any) {
        if (error?.message === 'CANCELLED') {
          wasCancelled = true;
        } else {
          console.error('Error generating full card:', error);
        }
      } finally {
        currentLoadingCardId.current = null;
      }

      if (wasCancelled) {
        setIsCardLoading(false);
        return;
      }

      const baseParams = {
        cardTitle: card.title || 'No Data',
        sourcePage: 'card-search',
        originalPage: 'card-search',
        isMedia: 'false',
        pageCount: String(1),
        cardId: cardIdStr,
      };

      if (isPpl) {
        router.push({
          pathname: '/profile/sub5',
          params: { ...baseParams, profileName: ownerName },
        });
      } else {
        router.push({
          pathname: '/legislation/legi5',
          params: { ...baseParams, billName: ownerName },
        });
      }
    },
    [router]
  );

  const hasAnyFilter =
    category1Label !== 'Profile Type' ||
    category2Label !== 'Card Page' ||
    policyAreaLabel !== 'Card Category' ||
    searchQuery.trim().length > 0;

  const handleSearchBarSearch = useCallback(async () => {
    const q = searchQuery.trim();
    if (!q || isSearching) return;

    setIsSearching(true);
    dismissKeyboard();

    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('card_index')
        .select('id, title, subtext, screen, category, is_ppl, owner_id')
        .eq('is_active', true)
        .or(`title.ilike.%${q}%,subtext.ilike.%${q}%`)
        .order('opens_7d', { ascending: false });

      if (error) throw error;

      const allResults = data || [];
      const pplIds = allResults.filter((c: any) => c.is_ppl).map((c: any) => c.owner_id).filter(Boolean);
      const legiIds = allResults.filter((c: any) => !c.is_ppl).map((c: any) => c.owner_id).filter(Boolean);

      let pplNames: Record<number, string> = {};
      if (pplIds.length > 0) {
        const { data: pplData } = await supabase.from('ppl_index').select('id, name').in('id', pplIds);
        if (pplData) pplData.forEach((p: any) => { pplNames[p.id] = p.name; });
      }

      let legiNames: Record<number, string> = {};
      if (legiIds.length > 0) {
        const { data: legiData } = await supabase.from('legi_index').select('id, name').in('id', legiIds);
        if (legiData) legiData.forEach((l: any) => { legiNames[l.id] = l.name; });
      }

      const enriched = allResults.map((c: any) => ({
        ...c,
        ownerName: c.is_ppl ? (pplNames[c.owner_id] || 'Unknown') : (legiNames[c.owner_id] || 'Unknown'),
      }));

      router.push({
        pathname: '/card-results',
        params: {
          searchResults: JSON.stringify(enriched),
          searchQuery: q,
          filters: JSON.stringify({}),
        },
      });
    } catch (err) {
      console.error('Search bar error:', err);
    } finally {
      setIsSearching(false);
    }
  }, [router, searchQuery, isSearching]);

  const handleCancelCardLoading = useCallback(() => {
    if (currentLoadingCardId.current !== null) {
      CardService.cancelCardGeneration(currentLoadingCardId.current);
      currentLoadingCardId.current = null;
    }
    setIsCardLoading(false);
  }, []);

  // Search category grid buttons (visual only, no animation)

  return (
    <TouchableWithoutFeedback onPress={handleScreenPress}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.headerContainer}>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => router.back()}
            hitSlop={{ top: 12, left: 12, right: 12, bottom: 12 }}
          >
            <Image source={require('../assets/back1.png')} style={styles.headerIcon} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
          onScrollBeginDrag={dismissKeyboard}
        >
          {/* Search Bar */}
          <View style={styles.searchBarContainer}>
            <Image source={require('../assets/search.png')} style={styles.searchIcon} />
            <TextInput
              ref={searchInputRef}
              style={styles.searchBarInput}
              placeholder="Search Cards"
              placeholderTextColor="#666"
              value={String(searchQuery ?? '')}
              onChangeText={(text) => setSearchQuery(String(text ?? ''))}
              onSubmitEditing={handleSearchBarSearch}
              returnKeyType="search"
              keyboardAppearance={Platform.OS === 'ios' ? 'dark' : 'default'}
              blurOnSubmit={true}
            />
            {searchQuery.length > 0 && (
              <Pressable
                onPress={() => {
                  setSearchQuery('');
                  dismissKeyboard();
                }}
                style={styles.clearButton}
              >
                <Text style={styles.clearButtonText}>✕</Text>
              </Pressable>
            )}
          </View>

          {/* Search Category Grid */}
          <View style={styles.searchGridContainer}>
            <View style={styles.searchGridRow}>
              <AnimatedPressable
                onPress={() => {
                  Haptics.selectionAsync();
                  cycleCategory1();
                }}
                style={styles.searchGridButton1}
              >
                <Text style={styles.searchGridButtonText1}>{category1Label}</Text>
              </AnimatedPressable>
              <AnimatedPressable
                onPress={() => {
                  Haptics.selectionAsync();
                  dismissKeyboard();
                  cycleCategory2();
                }}
                style={styles.searchGridButton2}
              >
                <Text style={styles.searchGridButtonText2}>{category2Label}</Text>
              </AnimatedPressable>
            </View>
            <View style={styles.searchGridRowFull}>
              <AnimatedPressable
                onPress={() => {
                  Haptics.selectionAsync();
                  dismissKeyboard();
                  router.push({
                    pathname: '/card-subjects',
                    params: { profileType: category1Label },
                  });
                }}
                style={styles.searchGridButtonFull}
              >
                <Text style={styles.searchGridButtonFullText} numberOfLines={1}>
                  {policyAreaLabel}
                </Text>
              </AnimatedPressable>
            </View>
            <View style={styles.searchGridRowFull}>
              <AnimatedPressable
                onPress={() => {
                  Haptics.selectionAsync();
                  dismissKeyboard();
                  resetFilters();
                }}
                style={styles.searchGridButtonFull}
              >
                <Text style={styles.searchGridButtonFullText}>Reset Filter</Text>
              </AnimatedPressable>
            </View>
            <View style={styles.searchGridRowFull}>
              <AnimatedPressable
                onPress={() => {
                  if (!hasAnyFilter) return;
                  Haptics.selectionAsync();
                  dismissKeyboard();
                  handleSearchCards();
                }}
                style={[styles.searchGridButtonFull, !hasAnyFilter && styles.searchGridButtonDisabled]}
              >
                <Text style={[styles.searchGridButtonFullText, !hasAnyFilter && styles.searchGridButtonTextDisabled]}>
                  {isSearching ? 'Searching...' : 'Search Cards'}
                </Text>
              </AnimatedPressable>
            </View>
          </View>

          {/* Trending Agenda Cards */}
          <View style={styles.sectionHeader}>
            <Text style={styles.trendingPoliticiansTitle}>Trending Agenda Cards</Text>
          </View>
          <View style={styles.trendingCardsContainer}>
            {trendingCards.map((card, index) => (
              <AnimatedPressable
                key={`trending-${card.id}-${index}`}
                onPress={() => {
                  Haptics.selectionAsync();
                  handleTrendingCardPress(card);
                }}
                style={styles.trendingCardButton}
              >
                <View style={styles.trendingCardTitleRow}>
                  <Text style={styles.trendingCardTitle} numberOfLines={2}>
                    {card.title || 'No data'}
                  </Text>
                </View>
                <Text style={styles.trendingCardSubtext} numberOfLines={2}>
                  {card.subtext || ''}
                </Text>
              </AnimatedPressable>
            ))}
          </View>
        </ScrollView>

        <CardLoadingIndicator
          visible={isSearching || isCardLoading}
          title={isSearching ? 'Searching Cards' : 'Loading Card'}
          subtitle={isSearching ? 'Finding cards that match your filters...' : 'Please keep the app open while we prepare your card...'}
          onCancel={isCardLoading ? handleCancelCardLoading : undefined}
        />
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  scrollContent: {
    paddingHorizontal: 0,
    paddingBottom: 20,
    paddingTop: 90, // Space for header
  },
  headerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 90,
    paddingTop: 46,
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
  searchGridContainer: {
    backgroundColor: '#050505',
    width: '95%',
    alignSelf: 'center',
    borderRadius: 32,
    height: 275,
    marginTop: 0,
    marginBottom: 5,
    paddingTop: 18,
    paddingBottom: 13,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#101010',
  },
  searchGridRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 5,
    paddingHorizontal: 0,
  },
  searchGridButton1: {
    backgroundColor: '#090909',
    borderRadius: 15,
    borderColor: '#101010',
    borderWidth: 1,
    height: 50,
    width: '44.5%',
    marginRight: '3%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchGridButton2: {
    backgroundColor: '#090909',
    borderRadius: 15,
    borderColor: '#101010',
    borderWidth: 1,
    height: 50,
    width: '44.5%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchGridButton3: {
    backgroundColor: '#090909',
    borderRadius: 15,
    borderColor: '#101010',
    borderWidth: 1,
    height: 50,
    width: '45%',
    marginLeft: '4%',
    marginHorizontal: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchGridButton4: {
    backgroundColor: '#090909',
    borderRadius: 15,
    borderColor: '#101010',
    borderWidth: 1,
    height: 50,
    width: '43%',
    marginRight: 20,
    marginHorizontal: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchGridButtonText1: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '400',
    textAlign: 'center',
  },
  searchGridButtonText2: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '400',
    textAlign: 'center',
  },
  searchGridButtonText3: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '400',
    textAlign: 'center',
  },
  searchGridButtonText4: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '400',
    textAlign: 'center',
  },
  searchGridRowFull: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 5,
    paddingHorizontal: 0,
  },
  searchGridButtonFull: {
    backgroundColor: '#090909',
    borderRadius: 14,
    borderColor: '#101010',
    borderWidth: 1,
    height: 50,
    width: '92%',
    marginLeft: 20,
    marginRight: 20,
    marginHorizontal: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchGridButtonFullText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '400',
    textAlign: 'center',
  },
  sectionHeader: {
    alignItems: 'center',
    marginTop: 18,
  },
  trendingPoliticiansTitle: {
    color: '#aaa',
    fontSize: 15,
    marginTop: 10,
    marginBottom: 10,
    fontWeight: '400',
    textAlign: 'center',
  },
  searchGridButtonDisabled: {
    opacity: 0.5,
  },
  searchGridButtonTextDisabled: {
    color: '#666',
  },
  trendingCardsContainer: {
    paddingHorizontal: 0,
    paddingBottom: 20,
  },
  trendingCardButton: {
    backgroundColor: '#050505',
    borderRadius: 28,
    padding: 20,
    marginBottom: 15,
    width: '95%',
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: '#1a1a1a',
  },
  trendingCardTitleRow: {
    marginBottom: 8,
  },
  trendingCardTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 24,
  },
  trendingCardSubtext: {
    color: '#999',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
  },
});
