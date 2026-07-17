import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Image, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CardLoadingIndicator } from '../components/CardLoadingIndicator';
import { CardService } from '../services/cardService';
import { getCategoryMapping, getScreenDisplayName } from '../utils/cardData';
import { getSupabaseClient } from '../utils/supabase';

const AnimatedPressable = Animated.createAnimatedComponent(View);

interface CardData {
  id: number;
  name: string;
  sub_name: string;
  is_ppl: boolean;
  item_type: 'card';
  categoryLabel: string;
}

function categoryLabelFor(category: string | null, screen: string | null): string {
  if (!category) return 'Info Card';
  if (category === 'more') return screen ? getScreenDisplayName(screen) : 'Info Card';
  return getCategoryMapping()[category] || category;
}

export default function NewGen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [cards, setCards] = useState<CardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingProfileKeys, setLoadingProfileKeys] = useState<Set<string>>(new Set());
  const [isCardLoading, setIsCardLoading] = useState(false);
  const currentLoadingCardId = useRef<number | null>(null);
  const scalesRef = useRef<{ [key: string]: Animated.Value }>({});

  const rawCardIds = params.cardIds;
  const cardIdsParam = typeof rawCardIds === 'string'
    ? rawCardIds
    : Array.isArray(rawCardIds) && rawCardIds[0]
      ? String(rawCardIds[0])
      : '';

  const getScale = (key: string) => {
    if (!scalesRef.current[key]) {
      scalesRef.current[key] = new Animated.Value(1);
    }
    return scalesRef.current[key];
  };

  const fetchCards = useCallback(async () => {
    if (!cardIdsParam.trim()) {
      setLoading(false);
      setCards([]);
      return;
    }

    setLoading(true);
    try {
      const ids = cardIdsParam
        .split(',')
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !isNaN(n) && n > 0);

      if (ids.length === 0) {
        setCards([]);
        setLoading(false);
        return;
      }

      const supabase = getSupabaseClient();
      const { data: rawCardData, error } = await supabase
        .from('card_index')
        .select('id, title, subtext, owner_id, is_ppl, category, screen, created_at')
        .in('id', ids)
        .eq('is_active', true);

      if (error) {
        console.error('Error fetching new-gen cards:', error);
        setCards([]);
        setLoading(false);
        return;
      }

      if (!rawCardData || rawCardData.length === 0) {
        setCards([]);
        setLoading(false);
        return;
      }

      // `ids` arrives in relevance order (e.g. exact-category match first, then same-page,
      // then everything else -- see CardGenerationService.getGeneratedCardIds), but `.in()`
      // doesn't preserve that order, so restore it here rather than re-sorting by date.
      const idOrder = new Map(ids.map((id, i) => [id, i]));
      const cardData = [...rawCardData].sort(
        (a: any, b: any) => (idOrder.get(a.id) ?? 0) - (idOrder.get(b.id) ?? 0)
      );

      const pplIds = cardData.filter((c: any) => c.is_ppl).map((c: any) => c.owner_id).filter(Boolean);
      const legiIds = cardData.filter((c: any) => !c.is_ppl).map((c: any) => c.owner_id).filter(Boolean);

      let pplNames: Record<number, string> = {};
      if (pplIds.length > 0) {
        const { data: pplOwnerData } = await supabase
          .from('ppl_index')
          .select('id, name')
          .in('id', pplIds);
        if (pplOwnerData) {
          pplOwnerData.forEach((ppl: any) => {
            pplNames[ppl.id] = ppl.name;
          });
        }
      }

      let legiNames: Record<number, string> = {};
      if (legiIds.length > 0) {
        const { data: legiOwnerData } = await supabase
          .from('legi_index')
          .select('id, name')
          .in('id', legiIds);
        if (legiOwnerData) {
          legiOwnerData.forEach((legi: any) => {
            legiNames[legi.id] = legi.name;
          });
        }
      }

      const cardsList: CardData[] = cardData.map((card: any) => ({
        id: card.id,
        name: card.title || 'No Data',
        sub_name: card.is_ppl
          ? (pplNames[card.owner_id] || 'Unknown')
          : (legiNames[card.owner_id] || 'Unknown'),
        is_ppl: card.is_ppl,
        item_type: 'card',
        categoryLabel: categoryLabelFor(card.category, card.screen),
      }));

      setCards(cardsList);
    } catch (error) {
      console.error('Error fetching new-gen cards:', error);
      setCards([]);
    } finally {
      setLoading(false);
    }
  }, [cardIdsParam]);

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  const handleCardPress = async (card: CardData) => {
    const profileKey = `${card.id}-card`;

    if (loadingProfileKeys.has(profileKey)) return;

    setLoadingProfileKeys((prev) => new Set(prev).add(profileKey));

    try {
      const isPoliticianCard = card.is_ppl ?? true;
      const cardId = String(card.id);
      const parsedCardId = parseInt(cardId, 10);
      if (isNaN(parsedCardId) || parsedCardId <= 0) {
        console.error('Invalid cardId:', cardId);
        return;
      }
      currentLoadingCardId.current = parsedCardId;
      let wasCancelled = false;
      try {
        await CardService.generateFullCard(parsedCardId, setIsCardLoading, isPoliticianCard);
      } catch (error: any) {
        if (error?.message === 'CANCELLED') {
          wasCancelled = true;
        } else {
          console.error('Error generating full card:', error);
        }
      }
      if (wasCancelled) return;
      currentLoadingCardId.current = null;
      const baseParams = {
        cardTitle: card.name || 'No Data',
        sourcePage: 'newGen',
        originalPage: 'newGen',
        isMedia: 'false',
        pageCount: '1',
        cardId: cardId,
      };
      if (isPoliticianCard) {
        router.push({
          pathname: '/profile/sub5',
          params: { ...baseParams, profileName: card.sub_name },
        });
      } else {
        router.push({
          pathname: '/legislation/legi5',
          params: { ...baseParams, billName: card.sub_name },
        });
      }
    } catch (error) {
      console.error('Error navigating:', error);
    } finally {
      currentLoadingCardId.current = null;
      setLoadingProfileKeys((prev) => {
        const newSet = new Set(prev);
        newSet.delete(profileKey);
        return newSet;
      });
    }
  };

  const handleCancelCardLoading = () => {
    if (currentLoadingCardId.current !== null) {
      CardService.cancelCardGeneration(currentLoadingCardId.current);
      currentLoadingCardId.current = null;
    }
    setIsCardLoading(false);
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.container}>
        <View style={styles.headerContainer}>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => router.back()}
            hitSlop={{ top: 12, left: 12, right: 12, bottom: 12 }}
          >
            <Image source={require('../assets/back1.png')} style={styles.headerIcon} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Loading new cards...</Text>
            </View>
          ) : cards.length === 0 ? (
            <View style={styles.noProfilesContainer}>
              <Text style={styles.noProfilesText}>
                No new cards to display.
              </Text>
            </View>
          ) : (
            <View style={styles.profilesContainer}>
              {cards.map((card) => {
                const profileKey = `${card.id}-card`;
                const isLoading = loadingProfileKeys.has(profileKey);
                const scale = getScale(profileKey);

                return (
                  <Animated.View key={profileKey} style={[{ transform: [{ scale }] }]}>
                    <Pressable
                      onPressIn={() => {
                        if (!isLoading) {
                          Haptics.selectionAsync();
                          Animated.spring(scale, {
                            toValue: 0.95,
                            friction: 6,
                            useNativeDriver: true,
                          }).start();
                        }
                      }}
                      onPressOut={() => {
                        if (!isLoading) {
                          Animated.spring(scale, {
                            toValue: 1,
                            friction: 6,
                            useNativeDriver: true,
                          }).start();
                        }
                      }}
                      onPress={() => !isLoading && handleCardPress(card)}
                      disabled={isLoading}
                      style={[styles.profileCard, isLoading && styles.profileCardDisabled]}
                    >
                      <View style={styles.profileCardContent}>
                        <View style={styles.profileTopRow}>
                          <Text
                            style={[styles.profileTitle, isLoading && styles.profileTitleDisabled]}
                            numberOfLines={0}
                            adjustsFontSizeToFit={false}
                          >
                            {isLoading ? 'Generating...' : card.name}
                          </Text>
                          <View style={styles.profileTypeBadge}>
                            <Text style={styles.profileTypeText}>{card.categoryLabel}</Text>
                          </View>
                        </View>
                        <View style={styles.profileBottomRow}>
                          <Text
                            style={[
                              styles.profileSubtitle,
                              isLoading && styles.profileSubtitleDisabled,
                            ]}
                            numberOfLines={0}
                            adjustsFontSizeToFit={false}
                          >
                            {card.sub_name}
                          </Text>
                        </View>
                      </View>
                    </Pressable>
                  </Animated.View>
                );
              })}
            </View>
          )}
        </ScrollView>
      </View>
      <CardLoadingIndicator
        visible={isCardLoading}
        onCancel={handleCancelCardLoading}
        title="Loading Card"
        subtitle="Please keep the app open while we prepare your card..."
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  content: {
    flex: 1,
    paddingTop: 90,
    paddingHorizontal: 0,
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  loadingText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '500',
  },
  noProfilesContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
    paddingHorizontal: 20,
  },
  noProfilesText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '500',
    marginBottom: 8,
    textAlign: 'center',
  },
  profilesContainer: {
    width: '100%',
    alignItems: 'center',
    paddingBottom: 20,
  },
  profileCard: {
    backgroundColor: '#050505',
    borderRadius: 22,
    padding: 20,
    marginBottom: 10,
    width: '95%',
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    minHeight: 80,
    borderWidth: 1,
    borderColor: '#101010',
  },
  profileCardDisabled: {
    backgroundColor: '#333',
    opacity: 0.6,
  },
  profileCardContent: {
    width: '100%',
    paddingHorizontal: 0,
    flex: 1,
  },
  profileTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    width: '100%',
    marginBottom: 4,
  },
  profileBottomRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    width: '100%',
  },
  profileTitle: {
    color: '#fff',
    fontWeight: '400',
    fontSize: 20,
    flex: 1,
    flexWrap: 'wrap',
  },
  profileTitleDisabled: {
    color: '#999',
  },
  profileSubtitle: {
    color: '#898989',
    fontWeight: '400',
    fontSize: 12,
    flexWrap: 'wrap',
  },
  profileSubtitleDisabled: {
    color: '#666',
  },
  profileTypeBadge: {
    backgroundColor: '#222',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 10,
    alignSelf: 'flex-start',
    marginTop: 2,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 24,
  },
  profileTypeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
    textAlignVertical: 'center',
  },
});
