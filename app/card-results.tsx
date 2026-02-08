import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState } from 'react';
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
    View,
} from 'react-native';
import { CardLoadingIndicator } from '../components/CardLoadingIndicator';
import { CardService } from '../services/cardService';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface CardResultItem {
  id: number;
  title: string;
  subtext: string;
  category?: string | null;
  is_ppl?: boolean;
  owner_id?: number;
  ownerName?: string;
}

// Cycle numbered styles (1..15) to preserve visual variety for >15 cards.
const styleIndex = (index: number) => ((index % 15) + 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15;

const getCardStyleByIndex = (n: number) => {
  const cardStyles = [
    styles.card1, styles.card2, styles.card3, styles.card4, styles.card5,
    styles.card6, styles.card7, styles.card8, styles.card9, styles.card10,
    styles.card11, styles.card12, styles.card13, styles.card14, styles.card15,
  ];
  return cardStyles[(n - 1) % 15] || styles.card1;
};

const getTitleRowStyleByIndex = (n: number) => {
  const rowStyles = [
    styles.titleRow1, styles.titleRow2, styles.titleRow3, styles.titleRow4, styles.titleRow5,
    styles.titleRow6, styles.titleRow7, styles.titleRow8, styles.titleRow9, styles.titleRow10,
    styles.titleRow11, styles.titleRow12, styles.titleRow13, styles.titleRow14, styles.titleRow15,
  ];
  return rowStyles[(n - 1) % 15] || styles.titleRow1;
};

const getTitleStyleByIndex = (n: number) => {
  const titleStyles = [
    styles.title1, styles.title2, styles.title3, styles.title4, styles.title5,
    styles.title6, styles.title7, styles.title8, styles.title9, styles.title10,
    styles.title11, styles.title12, styles.title13, styles.title14, styles.title15,
  ];
  return titleStyles[(n - 1) % 15] || styles.title1;
};

const getSubtextStyleByIndex = (n: number) => {
  const subtextStyles = [
    styles.subtext1, styles.subtext2, styles.subtext3, styles.subtext4, styles.subtext5,
    styles.subtext6, styles.subtext7, styles.subtext8, styles.subtext9, styles.subtext10,
    styles.subtext11, styles.subtext12, styles.subtext13, styles.subtext14, styles.subtext15,
  ];
  return subtextStyles[(n - 1) % 15] || styles.subtext1;
};

export default function CardResults() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [isCardLoading, setIsCardLoading] = useState(false);
  const currentLoadingCardId = useRef<number | null>(null);

  const searchResultsJson = typeof params.searchResults === 'string' ? params.searchResults : '';
  const searchQueryParam = typeof params.searchQuery === 'string' ? params.searchQuery : '';
  const filtersJson = typeof params.filters === 'string' ? params.filters : '{}';

  const filters: Record<string, string | null> = useMemo(() => {
    try {
      return JSON.parse(filtersJson);
    } catch {
      return {};
    }
  }, [filtersJson]);

  const initialResults: CardResultItem[] = useMemo(() => {
    try {
      return searchResultsJson ? JSON.parse(searchResultsJson) : [];
    } catch {
      return [];
    }
  }, [searchResultsJson]);

  const [localSearchQuery, setLocalSearchQuery] = useState(searchQueryParam);
  const searchInputRef = useRef<TextInput>(null);

  const filteredResults = useMemo(() => {
    const q = (localSearchQuery || '').trim().toLowerCase();
    if (!q) return initialResults;
    return initialResults.filter(
      (card) =>
        (card.title || '').toLowerCase().includes(q) ||
        (card.subtext || '').toLowerCase().includes(q)
    );
  }, [initialResults, localSearchQuery]);

  const dismissKeyboard = useCallback(() => {
    Keyboard.dismiss();
    searchInputRef.current?.blur();
  }, []);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleCancelCardLoading = useCallback(() => {
    if (currentLoadingCardId.current !== null) {
      CardService.cancelCardGeneration(currentLoadingCardId.current);
      currentLoadingCardId.current = null;
    }
    setIsCardLoading(false);
  }, []);

  const handleCardPress = useCallback(
    async (card: CardResultItem) => {
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

      if (wasCancelled) return;

      const baseParams = {
        cardTitle: card.title || 'No Data',
        sourcePage: 'card-results',
        originalPage: 'card-results',
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

  const scalesRef = useRef<Map<number, Animated.Value>>(new Map());
  const getScale = useCallback((cardId: number) => {
    if (!scalesRef.current.has(cardId)) {
      scalesRef.current.set(cardId, new Animated.Value(1));
    }
    return scalesRef.current.get(cardId)!;
  }, []);

  const onPressIn = useCallback(
    (cardId: number) => {
      const v = getScale(cardId);
      if (!v) return;
      Haptics.selectionAsync();
      Animated.spring(v, { toValue: 0.95, friction: 6, useNativeDriver: true }).start();
    },
    [getScale]
  );

  const onPressOut = useCallback(
    (cardId: number) => {
      const v = getScale(cardId);
      if (!v) return;
      Animated.spring(v, { toValue: 1, friction: 6, useNativeDriver: true }).start();
    },
    [getScale]
  );

  const ResultsCount = useCallback(() => {
    const activeFilters = Object.values(filters).filter((f) => f !== null);
    const filterText =
      activeFilters.length > 0
        ? ` (${activeFilters.length} filter${activeFilters.length > 1 ? 's' : ''} applied)`
        : '';

    if (searchQueryParam) {
      return (
        <View style={styles.resultsCountContainer}>
          <Text style={styles.resultsCountText}>
            {filteredResults.length} result{filteredResults.length !== 1 ? 's' : ''} found for
            "{searchQueryParam}"{filterText}
          </Text>
        </View>
      );
    }

    const noFilterText =
      activeFilters.length > 0
        ? `(${activeFilters.length} filter${activeFilters.length > 1 ? 's' : ''} applied)`
        : '(No filters applied)';

    return (
      <View style={styles.resultsCountContainer}>
        <Text style={styles.resultsCountText}>
          {filteredResults.length} result{filteredResults.length !== 1 ? 's' : ''} found {noFilterText}
        </Text>
      </View>
    );
  }, [searchQueryParam, filteredResults.length, filters]);

  return (
    <TouchableWithoutFeedback onPress={dismissKeyboard}>
      <View style={styles.container}>
        <View style={styles.headerContainer}>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={handleBack}
            hitSlop={{ top: 12, left: 12, right: 12, bottom: 12 }}
          >
            <Image source={require('../assets/back1.png')} style={styles.headerIcon} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {searchQueryParam ? `Search: ${searchQueryParam}` : 'Card Results'}
          </Text>
        </View>

        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onScrollBeginDrag={dismissKeyboard}
        >
          <ResultsCount />

          <View style={styles.searchBarContainer}>
            <Image source={require('../assets/search.png')} style={styles.searchIcon} />
            <TextInput
              ref={searchInputRef}
              style={styles.searchBarInput}
              placeholder="Search Cards"
              placeholderTextColor="#666"
              value={String(localSearchQuery ?? '')}
              onChangeText={(text) => setLocalSearchQuery(String(text ?? ''))}
              keyboardAppearance={Platform.OS === 'ios' ? 'dark' : 'default'}
              blurOnSubmit={true}
            />
            {localSearchQuery.length > 0 && (
              <Pressable
                onPress={() => {
                  setLocalSearchQuery('');
                  dismissKeyboard();
                }}
                style={styles.clearButton}
              >
                <Text style={styles.clearButtonText}>✕</Text>
              </Pressable>
            )}
          </View>

          {filteredResults.length === 0 ? (
            <View style={styles.noResultsContainer}>
              <Text style={styles.noResultsText}>No results found</Text>
              <Text style={styles.noResultsSubtext}>
                {searchQueryParam || localSearchQuery
                  ? 'No cards match your search. Try different keywords.'
                  : 'Try adjusting your filters'}
              </Text>
            </View>
          ) : (
            <View style={styles.cardsContainer}>
              {filteredResults.map((card, index) => {
                const n = styleIndex(index);
                const scale = getScale(card.id);

                return (
                  <AnimatedPressable
                    key={`card-${card.id}-${index}`}
                    onPressIn={() => onPressIn(card.id)}
                    onPressOut={() => onPressOut(card.id)}
                    onPress={() => handleCardPress(card)}
                    style={[getCardStyleByIndex(n), { transform: [{ scale }] }]}
                  >
                    <View style={getTitleRowStyleByIndex(n)}>
                      <Text style={getTitleStyleByIndex(n)} numberOfLines={2}>
                        {card.title || 'No data now'}
                      </Text>
                    </View>
                    <Text style={getSubtextStyleByIndex(n)} numberOfLines={2}>
                      {card.subtext || 'no data now'}
                    </Text>
                  </AnimatedPressable>
                );
              })}
            </View>
          )}
        </ScrollView>

        <CardLoadingIndicator
          visible={isCardLoading}
          onCancel={handleCancelCardLoading}
          title="Loading Card"
          subtitle="Please keep the app open while we prepare your card..."
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
  headerTitle: {
    position: 'absolute',
    marginTop: 40,
    left: 0,
    right: 0,
    color: '#fff',
    fontSize: 18,
    fontWeight: '400',
    textAlign: 'center',
  },
  content: {
    flex: 1,
    paddingTop: 100,
    paddingHorizontal: 0,
  },
  resultsCountContainer: {
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 10,
  },
  resultsCountText: {
    color: '#aaa',
    fontSize: 15,
    fontWeight: '400',
    textAlign: 'center',
  },
  searchBarContainer: {
    backgroundColor: '#050505',
    borderWidth: 1,
    borderColor: '#101010',
    width: '90%',
    alignSelf: 'center',
    borderRadius: 20,
    height: 60,
    marginTop: 0,
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
  noResultsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  noResultsText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '500',
    marginBottom: 8,
  },
  noResultsSubtext: {
    color: '#aaa',
    fontSize: 14,
  },
  cardsContainer: {
    paddingHorizontal: 0,
    paddingBottom: 20,
  },
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
  titleRow1: { marginBottom: 8, flexDirection: 'row', alignItems: 'center' },
  title1: { fontSize: 18, fontWeight: '600', color: '#fff', lineHeight: 24, flex: 1 },
  subtext1: { fontSize: 14, color: '#999', lineHeight: 20 },
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
  title2: { fontSize: 18, fontWeight: '600', color: '#fff', lineHeight: 24, flex: 1 },
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
  titleRow3: { marginBottom: 8, flexDirection: 'row', alignItems: 'center' },
  title3: { fontSize: 18, fontWeight: '600', color: '#fff', lineHeight: 24, flex: 1 },
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
  title4: { fontSize: 18, fontWeight: '600', color: '#fff', lineHeight: 24, flex: 1 },
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
  titleRow5: { marginBottom: 8, flexDirection: 'row', alignItems: 'center' },
  title5: { fontSize: 18, fontWeight: '600', color: '#fff', lineHeight: 24, flex: 1 },
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
  titleRow6: { marginBottom: 8, flexDirection: 'row', alignItems: 'center' },
  title6: { fontSize: 18, fontWeight: '600', color: '#fff', lineHeight: 24, flex: 1 },
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
  title7: { fontSize: 18, fontWeight: '600', color: '#fff', lineHeight: 24, flex: 1 },
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
  titleRow8: { marginBottom: 8, flexDirection: 'row', alignItems: 'center' },
  title8: { fontSize: 18, fontWeight: '600', color: '#fff', lineHeight: 24, flex: 1 },
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
  titleRow9: { marginBottom: 8, flexDirection: 'row', alignItems: 'center' },
  title9: { fontSize: 18, fontWeight: '600', color: '#fff', lineHeight: 24, flex: 1 },
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
  titleRow10: { marginBottom: 8, flexDirection: 'row', alignItems: 'center' },
  title10: { fontSize: 18, fontWeight: '600', color: '#fff', lineHeight: 24, flex: 1 },
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
  titleRow11: { marginBottom: 8, flexDirection: 'row', alignItems: 'center' },
  title11: { fontSize: 18, fontWeight: '600', color: '#fff', lineHeight: 24, flex: 1 },
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
  titleRow12: { marginBottom: 8, flexDirection: 'row', alignItems: 'center' },
  title12: { fontSize: 18, fontWeight: '600', color: '#fff', lineHeight: 24, flex: 1 },
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
  title13: { fontSize: 18, fontWeight: '600', color: '#fff', lineHeight: 24, flex: 1 },
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
  titleRow14: { marginBottom: 8, flexDirection: 'row', alignItems: 'center' },
  title14: { fontSize: 18, fontWeight: '600', color: '#fff', lineHeight: 24, flex: 1 },
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
  titleRow15: { marginBottom: 8, flexDirection: 'row', alignItems: 'center' },
  title15: { fontSize: 18, fontWeight: '600', color: '#fff', lineHeight: 24, flex: 1 },
  subtext15: { fontSize: 14, color: '#999', lineHeight: 20 },
});
