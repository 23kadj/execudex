import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import { Animated, Image, Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { useAuth } from '../components/AuthProvider';
import { CardLoadingIndicator } from '../components/CardLoadingIndicator';
import { TypeFilterButton } from '../components/TypeFilterButton';
import { CardService } from '../services/cardService';
import { NavigationService } from '../services/navigationService';
import { getSupabaseClient } from '../utils/supabase';

const AnimatedPressable = Animated.createAnimatedComponent(View);

interface ProfileData {
  id: number;
  name: string;
  sub_name: string;
  is_ppl: boolean;
  item_type: 'ppl' | 'legi' | 'card';
  created_at: string;
}

export default function MostRecent() {
  const router = useRouter();
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<ProfileData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingProfileKeys, setLoadingProfileKeys] = useState<Set<string>>(new Set());
  const [isCardLoading, setIsCardLoading] = useState(false);
  const currentLoadingCardId = useRef<number | null>(null);
  const [selectedFilters, setSelectedFilters] = useState<Set<'ppl' | 'legi' | 'card'>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  const scalesRef = useRef<{ [key: string]: Animated.Value }>({});

  const getScale = (key: string) => {
    if (!scalesRef.current[key]) {
      scalesRef.current[key] = new Animated.Value(1);
    }
    return scalesRef.current[key];
  };

  const fetchMostRecent = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const allItems: ProfileData[] = [];

      const isValidCreatedAt = (raw: unknown): boolean => {
        if (raw == null || raw === '') return false;
        const ms = typeof raw === 'string' ? Date.parse(raw) : raw instanceof Date ? raw.getTime() : NaN;
        return Number.isFinite(ms);
      };

      const [pplRes, legiRes, cardRes] = await Promise.all([
        supabase
          .from('ppl_index')
          .select('id, name, sub_name, created_at')
          .order('created_at', { ascending: false, nullsFirst: false })
          .limit(200),
        supabase
          .from('legi_index')
          .select('id, name, sub_name, created_at')
          .order('created_at', { ascending: false, nullsFirst: false })
          .limit(200),
        supabase
          .from('card_index')
          .select('id, title, subtext, owner_id, is_ppl, created_at')
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(20),
      ]);

      if (pplRes.error) {
        console.error('Error fetching recent politicians:', pplRes.error);
      } else if (pplRes.data) {
        const validPpl = pplRes.data.filter((ppl: any) => isValidCreatedAt(ppl.created_at));
        validPpl.slice(0, 20).forEach((ppl: any) => {
          allItems.push({
            id: ppl.id,
            name: ppl.name,
            sub_name: ppl.sub_name || '',
            is_ppl: true,
            item_type: 'ppl',
            created_at: String(ppl.created_at),
          });
        });
      }

      if (legiRes.error) {
        console.error('Error fetching recent legislation:', legiRes.error);
      } else if (legiRes.data) {
        const validLegi = legiRes.data.filter((legi: any) => isValidCreatedAt(legi.created_at));
        validLegi.slice(0, 20).forEach((legi: any) => {
          allItems.push({
            id: legi.id,
            name: legi.name,
            sub_name: legi.sub_name || '',
            is_ppl: false,
            item_type: 'legi',
            created_at: String(legi.created_at),
          });
        });
      }

      if (cardRes.error) {
        console.error('Error fetching recent cards:', cardRes.error);
      } else if (cardRes.data && cardRes.data.length > 0) {
        const cardData = cardRes.data;
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

        cardData.forEach((card: any) => {
          const ownerName = card.is_ppl
            ? (pplNames[card.owner_id] || 'Unknown')
            : (legiNames[card.owner_id] || 'Unknown');
          allItems.push({
            id: card.id,
            name: card.title || 'No Data',
            sub_name: ownerName,
            is_ppl: card.is_ppl,
            item_type: 'card',
            created_at: card.created_at || '',
          });
        });
      }

      const createdAtMs = (x: ProfileData) => {
        const raw = x?.created_at;
        const ms = typeof raw === 'string' ? Date.parse(raw) : raw instanceof Date ? raw.getTime() : NaN;
        return Number.isFinite(ms) ? ms : -Infinity;
      };
      allItems.sort((a, b) => {
        const ta = createdAtMs(a);
        const tb = createdAtMs(b);
        if (ta !== tb) return tb - ta;
        return (b?.id ?? 0) - (a?.id ?? 0);
      });

      const validItems = allItems.filter((item) => {
        const sub = (item.sub_name || '').trim();
        return sub.length > 0;
      });

      setProfiles(validItems);
    } catch (error) {
      console.error('Error fetching most recent:', error);
      setProfiles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchMostRecent();
    }, [fetchMostRecent])
  );

  const filteredProfiles = profiles
    .filter((profile) => {
      if (selectedFilters.size === 0) return true;
      return selectedFilters.has(profile.item_type);
    })
    .filter((profile) => {
      const normalizedQuery = searchQuery.trim().toLowerCase();
      if (!normalizedQuery) return true;
      return (
        profile.name.toLowerCase().includes(normalizedQuery) ||
        profile.sub_name.toLowerCase().includes(normalizedQuery)
      );
    });

  const handleFilterPress = (filterType: 'ppl' | 'legi' | 'card') => {
    setSelectedFilters((prev) => {
      const next = new Set(prev);
      if (next.has(filterType)) {
        next.delete(filterType);
      } else {
        next.add(filterType);
      }
      return next;
    });
  };

  const dismissKeyboard = () => Keyboard.dismiss();

  const getProfileTypeDisplayName = (profile: ProfileData): string => {
    switch (profile.item_type) {
      case 'ppl':
        return 'Politician';
      case 'legi':
        return 'Legislation';
      case 'card':
        return 'Info Card';
      default:
        return profile.is_ppl ? 'Politician' : 'Legislation';
    }
  };

  const handleProfilePress = async (profile: ProfileData) => {
    const profileKey = `${profile.id}-${profile.item_type}`;

    if (loadingProfileKeys.has(profileKey)) return;

    setLoadingProfileKeys((prev) => new Set(prev).add(profileKey));

    try {
      if (profile.item_type === 'card') {
        const isPoliticianCard = profile.is_ppl ?? true;
        const cardId = String(profile.id);
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
          cardTitle: profile.name || 'No Data',
          sourcePage: 'mostRecent',
          originalPage: 'mostRecent',
          isMedia: 'false',
          pageCount: '1',
          cardId: cardId,
        };
        if (isPoliticianCard) {
          router.push({
            pathname: '/profile/sub5',
            params: { ...baseParams, profileName: profile.sub_name },
          });
        } else {
          router.push({
            pathname: '/legislation/legi5',
            params: { ...baseParams, billName: profile.sub_name },
          });
        }
      } else if (profile.item_type === 'ppl') {
        await NavigationService.navigateToPoliticianProfile(
          {
            pathname: '/index1',
            params: {
              title: profile.name,
              subtitle: profile.sub_name,
              imgKey: 'placeholder',
              numbersObj: JSON.stringify({ red: '50%', green: '50%' }),
              index: profile.id.toString(),
            },
          },
          user?.id
        );
      } else {
        await NavigationService.navigateToLegislationProfile(
          {
            pathname: '/index2',
            params: {
              title: profile.name,
              subtitle: profile.sub_name,
              imgKey: 'placeholder',
              numbersObj: JSON.stringify({ red: '', green: '' }),
              returnTab: '0',
              returnMode: 'legi',
              index: profile.id.toString(),
            },
          },
          user?.id
        );
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
    <TouchableWithoutFeedback onPress={dismissKeyboard} accessible={false}>
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

          {!loading && profiles.length > 0 && (
            <View style={styles.searchBarContainer}>
              <View style={styles.searchBarSurface}>
                <Image source={require('../assets/search.png')} style={styles.searchIcon} />
                <TextInput
                  style={styles.searchBarInput}
                  placeholder="Search Most Recent"
                  placeholderTextColor="#666"
                  value={String(searchQuery ?? '')}
                  onChangeText={(text) => setSearchQuery(String(text ?? ''))}
                  blurOnSubmit
                />
                {searchQuery.length > 0 && (
                  <Pressable onPress={() => setSearchQuery('')} style={styles.clearButton}>
                    <Text style={styles.clearButtonText}>✕</Text>
                  </Pressable>
                )}
              </View>
            </View>
          )}

          {!loading && profiles.length > 0 && (
            <View style={styles.filterContainer}>
              <TypeFilterButton
                label="Politicians"
                isSelected={selectedFilters.has('ppl')}
                onPress={() => handleFilterPress('ppl')}
              />
              <TypeFilterButton
                label="Legislation"
                isSelected={selectedFilters.has('legi')}
                onPress={() => handleFilterPress('legi')}
              />
              <TypeFilterButton
                label="Info Cards"
                isSelected={selectedFilters.has('card')}
                onPress={() => handleFilterPress('card')}
              />
            </View>
          )}

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {loading ? (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Loading most recent...</Text>
              </View>
            ) : profiles.length === 0 ? (
              <View style={styles.noProfilesContainer}>
                <Text style={styles.noProfilesText}>
                  No recent content available at this time, please come back later.
                </Text>
              </View>
            ) : filteredProfiles.length === 0 ? (
              <View style={styles.noProfilesContainer}>
                <Text style={styles.noProfilesText}>No items match your current filters</Text>
                <Text style={styles.noProfilesSubtext}>Try adjusting your search or filter options</Text>
              </View>
            ) : (
              <View style={styles.profilesContainer}>
                {filteredProfiles.map((profile) => {
                  const profileKey = `${profile.id}-${profile.item_type}`;
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
                        onPress={() => !isLoading && handleProfilePress(profile)}
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
                              {isLoading ? 'Generating...' : profile.name}
                            </Text>
                            <View style={styles.profileTypeBadge}>
                              <Text style={styles.profileTypeText}>
                                {getProfileTypeDisplayName(profile)}
                              </Text>
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
                              {profile.sub_name}
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
    </TouchableWithoutFeedback>
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
    paddingTop: 227,
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
  searchBarContainer: {
    position: 'absolute',
    top: 90,
    left: 0,
    right: 0,
    backgroundColor: '#000',
    paddingVertical: 6,
    paddingHorizontal: 20,
    zIndex: 100,
  },
  searchBarSurface: {
    backgroundColor: '#050505',
    borderWidth: 1,
    borderColor: '#101010',
    width: '100%',
    alignSelf: 'center',
    borderRadius: 20,
    height: 60,
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
  filterContainer: {
    position: 'absolute',
    top: 162,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    backgroundColor: '#000',
    paddingVertical: 10,
    paddingHorizontal: 20,
    zIndex: 99,
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
  noProfilesSubtext: {
    color: '#aaa',
    fontSize: 14,
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
