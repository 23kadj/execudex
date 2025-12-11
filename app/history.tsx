import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Image, Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { useAuth } from '../components/AuthProvider';
import { TypeFilterButton } from '../components/TypeFilterButton';
import { NavigationService } from '../services/navigationService';
import { getHistory, ProfileHistoryItem } from '../utils/historyUtils';
import { supabase } from '../utils/supabase';

const AnimatedPressable = Animated.createAnimatedComponent(View);

interface ProfileData {
  id: string;
  name: string;
  sub_name: string;
  is_ppl: boolean;
  item_type?: 'ppl' | 'legi' | 'card';
}

type FilterType = 'ppl' | 'legi' | 'card' | null;

export default function History() {
  const router = useRouter();
  const { user } = useAuth();
  const [history, setHistory] = useState<ProfileHistoryItem[]>([]);
  const [profileData, setProfileData] = useState<{ [key: string]: ProfileData }>({});
  const [loading, setLoading] = useState(true);
  const [loadingProfileKeys, setLoadingProfileKeys] = useState<Set<string>>(new Set());
  const [selectedFilter, setSelectedFilter] = useState<FilterType>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Create animated values for each card
  const scalesRef = useRef<{ [key: string]: Animated.Value }>({});
  
  // Initialize scale for a card if it doesn't exist
  const getScale = (key: string) => {
    if (!scalesRef.current[key]) {
      scalesRef.current[key] = new Animated.Value(1);
    }
    return scalesRef.current[key];
  };

  useEffect(() => {
    if (user?.id) {
      fetchHistory();
    } else {
      setLoading(false);
    }
  }, [user]);

  const fetchHistory = async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      const historyData = await getHistory(user.id);
      setHistory(historyData);
      
      // Fetch profile data for each history item from the database
      const profilePromises = historyData.map(async (historyItem) => {
        try {
          let data;
          let error;
          
          // Determine item type (use item_type if available, otherwise fall back to is_ppl)
          const itemType = historyItem.item_type || (historyItem.is_ppl ? 'ppl' : 'legi');
          
          if (itemType === 'card') {
            // Fetch card data from card_index
            const cardResult = await supabase
              .from('card_index')
              .select('id, title, subtext, owner_id, is_ppl')
              .eq('id', historyItem.id)
              .single();
            
            if (cardResult.data) {
              const cardData = cardResult.data;
              let ownerName = cardData.title; // fallback to card title
              let ownerSubName = cardData.subtext; // fallback to card subtext
              
              // Fetch owner name from appropriate table based on is_ppl flag
              if (cardData.is_ppl) {
                const pplOwnerResult = await supabase
                  .from('ppl_index')
                  .select('name, sub_name')
                  .eq('id', cardData.owner_id)
                  .single();
                if (pplOwnerResult.data) {
                  ownerName = pplOwnerResult.data.name;
                  ownerSubName = pplOwnerResult.data.sub_name;
                }
              } else {
                const legiOwnerResult = await supabase
                  .from('legi_index')
                  .select('name, sub_name')
                  .eq('id', cardData.owner_id)
                  .single();
                if (legiOwnerResult.data) {
                  ownerName = legiOwnerResult.data.name;
                  ownerSubName = legiOwnerResult.data.sub_name;
                }
              }
              
              data = {
                id: cardData.id.toString(),
                name: cardData.title,
                sub_name: ownerName,
                is_ppl: cardData.is_ppl,
                item_type: 'card' as const
              };
            }
            error = cardResult.error;
          } else if (itemType === 'ppl') {
            // Fetch politician data from ppl_index
            const pplResult = await supabase
              .from('ppl_index')
              .select('id, name, sub_name')
              .eq('id', historyItem.id)
              .single();
            data = pplResult.data ? { ...pplResult.data, is_ppl: true, item_type: 'ppl' as const } : null;
            error = pplResult.error;
          } else {
            // Fetch legislation data from legi_index
            const legiResult = await supabase
              .from('legi_index')
              .select('id, name, sub_name')
              .eq('id', historyItem.id)
              .single();
            data = legiResult.data ? { ...legiResult.data, is_ppl: false, item_type: 'legi' as const } : null;
            error = legiResult.error;
          }
          
          if (!error && data) {
            return {
              [`${historyItem.id}-${itemType}`]: data
            };
          }
        } catch (err) {
          console.error('Error fetching profile data for history item:', historyItem.id, err);
        }
        return {};
      });

      const profileResults = await Promise.all(profilePromises);
      const combinedProfiles = profileResults.reduce((acc, curr) => ({ ...acc, ...curr }), {});
      setProfileData(combinedProfiles);
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setLoading(false);
    }
  };


  // Filter history based on selected filter and search query
  const filteredHistory = history
    .filter((historyItem) => {
      if (selectedFilter === null) return true; // Show all when no filter is selected
      const itemType = historyItem.item_type || (historyItem.is_ppl ? 'ppl' : 'legi');
      return itemType === selectedFilter;
    })
    .filter((historyItem) => {
      const normalizedQuery = searchQuery.trim().toLowerCase();
      if (!normalizedQuery) return true;
      const itemType = historyItem.item_type || (historyItem.is_ppl ? 'ppl' : 'legi');
      const profileKey = `${historyItem.id}-${itemType}`;
      const profile = profileData[profileKey];
      if (!profile) return false;
      return (
        profile.name.toLowerCase().includes(normalizedQuery) ||
        profile.sub_name.toLowerCase().includes(normalizedQuery)
      );
    });

  // Toggle filter: if clicking the same filter, deselect it
  const handleFilterPress = (filterType: 'ppl' | 'legi' | 'card') => {
    setSelectedFilter(prev => prev === filterType ? null : filterType);
  };

  const dismissKeyboard = () => Keyboard.dismiss();

  // Function to convert history type enum to display name
  const getHistoryTypeDisplayName = (historyItem: ProfileHistoryItem): string => {
    const itemType = historyItem.item_type || (historyItem.is_ppl ? 'ppl' : 'legi');
    switch (itemType) {
      case 'ppl':
        return 'Politician';
      case 'legi':
        return 'Legislation';
      case 'card':
        return 'Info Page';
      default:
        return historyItem.is_ppl ? 'Politician' : 'Legislation';
    }
  };

  const handleHistoryPress = async (historyItem: ProfileHistoryItem) => {
    const itemType = historyItem.item_type || (historyItem.is_ppl ? 'ppl' : 'legi');
    const profileKey = `${historyItem.id}-${itemType}`;
    const profile = profileData[profileKey];
    if (!profile) return;
    
    // Prevent clicking the same button twice
    if (loadingProfileKeys.has(profileKey)) return;
    
    // Add this profile to the loading set
    setLoadingProfileKeys(prev => new Set(prev).add(profileKey));

    try {
      if (itemType === 'card') {
        // Navigate to card info page based on card type
        const isPoliticianCard = profile.is_ppl;
        const baseParams = {
          cardTitle: profile.name,
          sourcePage: 'history',
          originalPage: 'history',
          isMedia: 'false',
          pageCount: '1',
          cardId: historyItem.id,
        };
        
        if (isPoliticianCard) {
          // Navigate to politician card info page
          router.push({
            pathname: '/profile/sub5',
            params: {
              ...baseParams,
              profileName: profile.sub_name,
            }
          });
        } else {
          // Navigate to legislation card info page
          router.push({
            pathname: '/legislation/legi5',
            params: {
              ...baseParams,
              billName: profile.sub_name,
            }
          });
        }
      } else if (itemType === 'ppl') {
        // Navigate to politician profile with pre-processing
        await NavigationService.navigateToPoliticianProfile({
          pathname: '/index1',
          params: {
            title: profile.name,
            subtitle: profile.sub_name,
            imgKey: 'placeholder',
            numbersObj: JSON.stringify({ red: '50%', green: '50%' }),
            index: profile.id,
          }
        }, user?.id);
      } else {
        // Navigate to legislation profile with pre-processing
        await NavigationService.navigateToLegislationProfile({
          pathname: '/index2',
          params: {
            title: profile.name,
            subtitle: profile.sub_name,
            imgKey: 'placeholder',
            numbersObj: JSON.stringify({ red: '', green: '' }),
            returnTab: '0',
            returnMode: 'legi',
            index: profile.id,
          }
        }, user?.id);
      }
    } catch (error) {
      console.error('Error navigating:', error);
    } finally {
      // Remove this profile from the loading set
      setLoadingProfileKeys(prev => {
        const newSet = new Set(prev);
        newSet.delete(profileKey);
        return newSet;
      });
    }
  };

  return (
    <TouchableWithoutFeedback onPress={dismissKeyboard} accessible={false}>
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
        <Text style={styles.headerTitle}>History</Text>
      </View>
      
      {/* Search Bar */}
      {!loading && history.length > 0 && (
        <View style={styles.searchBarContainer}>
          <View style={styles.searchBarSurface}>
            <Image source={require('../assets/search.png')} style={styles.searchIcon} />
            <TextInput
              style={styles.searchBarInput}
              placeholder="Search History"
              placeholderTextColor="#666"
              value={searchQuery}
              onChangeText={setSearchQuery}
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
      
      {/* Filter Buttons */}
      {!loading && history.length > 0 && (
        <View style={styles.filterContainer}>
          <TypeFilterButton
            label="Politicians"
            isSelected={selectedFilter === 'ppl'}
            onPress={() => handleFilterPress('ppl')}
          />
          <TypeFilterButton
            label="Legislation"
            isSelected={selectedFilter === 'legi'}
            onPress={() => handleFilterPress('legi')}
          />
          <TypeFilterButton
            label="Info Pages"
            isSelected={selectedFilter === 'card'}
            onPress={() => handleFilterPress('card')}
          />
        </View>
      )}
      
      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {!user ? (
          <View style={styles.noHistoryContainer}>
            <Text style={styles.noHistoryText}>Please sign in to view history</Text>
            <Text style={styles.noHistorySubtext}>Sign in to save and view your history</Text>
          </View>
        ) : loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading history...</Text>
          </View>
        ) : history.length === 0 ? (
          <View style={styles.noHistoryContainer}>
            <Text style={styles.noHistoryText}>No history yet</Text>
            <Text style={styles.noHistorySubtext}>View profiles to see them here</Text>
          </View>
        ) : (
          <View style={styles.historyContainer}>
            {filteredHistory.map((historyItem) => {
              const itemType = historyItem.item_type || (historyItem.is_ppl ? 'ppl' : 'legi');
              const profileKey = `${historyItem.id}-${itemType}`;
              const profile = profileData[profileKey];
              if (!profile) return null;
              
              const isLoading = loadingProfileKeys.has(profileKey);
              const scale = getScale(profileKey);

              return (
                <Animated.View
                  key={profileKey}
                  style={[
                    { transform: [{ scale }] }
                  ]}
                >
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
                    onPress={() => !isLoading && handleHistoryPress(historyItem)}
                    disabled={isLoading}
                    style={[
                      styles.historyCard,
                      isLoading && styles.historyCardDisabled
                    ]}
                  >
                    <View style={styles.historyCardContent}>
                      <View style={styles.historyTopRow}>
                        <Text style={[
                          styles.historyTitle,
                          isLoading && styles.historyTitleDisabled
                        ]} numberOfLines={0} adjustsFontSizeToFit={false}>
                          {isLoading ? 'Generating...' : profile.name}
                        </Text>
                        <View style={styles.historyTypeBadge}>
                          <Text style={styles.historyTypeText}>
                            {getHistoryTypeDisplayName(historyItem)}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.historyBottomRow}>
                        <Text style={[
                          styles.historySubtitle,
                          isLoading && styles.historySubtitleDisabled
                        ]} numberOfLines={0} adjustsFontSizeToFit={false}>
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
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#000' 
  },
  content: {
    flex: 1,
    paddingTop: 227, // Leave space for header, search, and filter buttons
    paddingHorizontal: 0,
  },
  // HEADER - identical to bookmarks.tsx
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
  // SEARCH BAR
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
  // FILTER BUTTONS
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
  // LOADING
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
  // NO HISTORY
  noHistoryContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  noHistoryText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '500',
    marginBottom: 8,
  },
  noHistorySubtext: {
    color: '#aaa',
    fontSize: 14,
  },
  // HISTORY LIST - identical to bookmarks.tsx
  historyContainer: {
    width: '100%',
    alignItems: 'center',
    paddingBottom: 20,
  },
  historyCard: {
    backgroundColor: '#050505',
    borderRadius: 22,
    padding: 20,
    marginBottom: 10,
    width: '95%',
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    minHeight: 80,
    borderWidth: 1,
    borderColor: '#101010',
  },
  historyCardDisabled: {
    backgroundColor: '#333',
    opacity: 0.6,
  },
  historyCardContent: {
    width: '100%',
    paddingHorizontal: 0,
    flex: 1,
  },
  historyTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    width: '100%',
    marginBottom: 4,
  },
  historyBottomRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    width: '100%',
  },
  historyTitle: {
    color: '#fff',
    fontWeight: '400',
    fontSize: 20,
    flex: 1,
    flexWrap: 'wrap',
  },
  historyTitleDisabled: {
    color: '#999',
  },
  historySubtitle: {
    color: '#898989',
    fontWeight: '400',
    fontSize: 12,
    flexWrap: 'wrap',
  },
  historySubtitleDisabled: {
    color: '#666',
  },
  historyTypeBadge: {
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
  historyTypeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
    textAlignVertical: 'center',
  },
});
