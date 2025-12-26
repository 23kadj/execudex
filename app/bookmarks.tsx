import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Image, Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { useAuth } from '../components/AuthProvider';
import { TypeFilterButton } from '../components/TypeFilterButton';
import { NavigationService } from '../services/navigationService';
import { BookmarkData, getUserBookmarks } from '../utils/bookmarkUtils';
import { getSupabaseClient } from '../utils/supabase';

const AnimatedPressable = Animated.createAnimatedComponent(View);



interface ProfileData {
  id: string;
  name: string;
  sub_name: string;
  is_ppl?: boolean; // Optional flag to indicate if this is a politician card
}

type FilterType = 'ppl' | 'legi' | 'card' | null;

export default function Bookmarks() {
  const router = useRouter();
  const { user } = useAuth();
  const [bookmarks, setBookmarks] = useState<BookmarkData[]>([]);
  const [profileData, setProfileData] = useState<{ [key: string]: ProfileData }>({});
  const [loading, setLoading] = useState(true);
  const [loadingCardIds, setLoadingCardIds] = useState<Set<string>>(new Set());
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
      fetchBookmarks();
    } else {
      setLoading(false);
    }
  }, [user]);

  // Refresh bookmarks whenever the page comes into focus
  useFocusEffect(
    useCallback(() => {
      if (user?.id) {
        fetchBookmarks();
      }
    }, [user])
  );

  const fetchBookmarks = async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      // Fetch bookmarks for the current user only
      const bookmarksData = await getUserBookmarks(user.id);
      setBookmarks(bookmarksData);
      
      // Fetch profile data for each bookmark based on type
      const profilePromises = bookmarksData.map(async (bookmark) => {
        try {
          let data;
          let error;
          
          const supabase = getSupabaseClient();
          switch (bookmark.bookmark_type) {
            case 'ppl':
              // Fetch politician data from ppl_index
              const pplResult = await supabase
                .from('ppl_index')
                .select('id, name, sub_name')
                .eq('id', bookmark.owner_id)
                .maybeSingle();
              data = pplResult.data;
              error = pplResult.error;
              break;
              
            case 'legi':
              // Fetch legislation data from legi_index
              const legiResult = await supabase
                .from('legi_index')
                .select('id, name, sub_name')
                .eq('id', bookmark.owner_id)
                .maybeSingle();
              data = legiResult.data;
              error = legiResult.error;
              break;
              
            case 'card':
              // Fetch card data from card_index with owner information
              const cardResult = await supabase
                .from('card_index')
                .select('id, title, subtext, owner_id, is_ppl')
                .eq('id', bookmark.owner_id)
                .maybeSingle();
              if (cardResult.data) {
                const cardData = cardResult.data;
                let ownerName = cardData.title; // fallback to card title
                let ownerSubName = cardData.subtext; // fallback to card subtext
                
                // Fetch owner name from appropriate table based on is_ppl flag
                if (cardData.is_ppl) {
                  // Fetch politician name from ppl_index
                  const pplOwnerResult = await supabase
                    .from('ppl_index')
                    .select('name, sub_name')
                    .eq('id', cardData.owner_id)
                    .maybeSingle();
                  if (pplOwnerResult.data) {
                    ownerName = pplOwnerResult.data.name;
                    ownerSubName = pplOwnerResult.data.sub_name;
                  }
                } else {
                  // Fetch legislation name from legi_index
                  const legiOwnerResult = await supabase
                    .from('legi_index')
                    .select('name, sub_name')
                    .eq('id', cardData.owner_id)
                    .maybeSingle();
                  if (legiOwnerResult.data) {
                    ownerName = legiOwnerResult.data.name;
                    ownerSubName = legiOwnerResult.data.sub_name;
                  }
                }
                
                // Map card data to match ProfileData interface
                data = {
                  id: cardData.id.toString(),
                  name: cardData.title, // Keep card title for display
                  sub_name: ownerName, // Use owner name for subtitle
                  is_ppl: cardData.is_ppl // Store is_ppl flag for navigation routing
                };
              }
              error = cardResult.error;
              break;
              
            default:
              return {};
          }
          
          if (!error && data) {
            return { [bookmark.id]: data };
          }
        } catch (err) {
          console.error('Error fetching profile data for bookmark:', bookmark.id, err);
        }
        return {};
      });

      const profileResults = await Promise.all(profilePromises);
      const combinedProfiles = profileResults.reduce((acc, curr) => ({ ...acc, ...curr }), {});
      setProfileData(combinedProfiles);
    } catch (error) {
      console.error('Error in fetchBookmarks:', error);
    } finally {
      setLoading(false);
    }
  };


  // Filter bookmarks based on selected filter and search query
  const filteredBookmarks = bookmarks
    .filter((bookmark) => {
      if (selectedFilter === null) return true;
      return bookmark.bookmark_type === selectedFilter;
    })
    .filter((bookmark) => {
      const normalizedQuery = searchQuery.trim().toLowerCase();
      if (!normalizedQuery) return true;
      const profile = profileData[bookmark.id];
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

  // Function to convert bookmark type enum to display name
  const getBookmarkTypeDisplayName = (bookmarkType: string): string => {
    switch (bookmarkType) {
      case 'ppl':
        return 'Politician';
      case 'legi':
        return 'Legislation';
      case 'card':
        return 'Info Card';
      default:
        return bookmarkType.toUpperCase();
    }
  };

  const handleBookmarkPress = async (bookmark: BookmarkData) => {
    const profile = profileData[bookmark.id];
    if (!profile) return;
    
    // Prevent clicking the same button twice
    if (loadingCardIds.has(bookmark.id)) return;
    
    // Add this card to the loading set
    setLoadingCardIds(prev => new Set(prev).add(bookmark.id));

    try {
      switch (bookmark.bookmark_type) {
        case 'ppl':
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
          break;
          
        case 'legi':
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
          break;
        
      case 'card':
        // Navigate to appropriate card info card based on card type
        const isPoliticianCard = profile.is_ppl;
        // Ensure cardId is a string
        const cardId = bookmark.owner_id ? String(bookmark.owner_id) : '';
        if (!cardId) {
          console.error('Invalid cardId in bookmark:', bookmark);
          return;
        }
        
        const baseParams = {
          cardTitle: profile.name || 'No Data',
          sourcePage: 'bookmarks',
          originalPage: 'bookmarks',
          isMedia: 'false',
          pageCount: '1',
          cardId: cardId,
        };
        
        if (isPoliticianCard) {
          // Navigate to politician card info card
          router.push({
            pathname: '/profile/sub5',
            params: {
              ...baseParams,
              profileName: profile.sub_name, // Owner name from ppl_index
            }
          });
        } else {
          // Navigate to legislation card info card
          router.push({
            pathname: '/legislation/legi5',
            params: {
              ...baseParams,
              billName: profile.sub_name, // Owner name from legi_index
            }
          });
        }
        break;
      }
    } catch (error) {
      console.error('Error navigating:', error);
    } finally {
      // Remove this card from the loading set
      setLoadingCardIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(bookmark.id);
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
        <Text style={styles.headerTitle}>Bookmarks</Text>
      </View>
      
      {/* Search Bar */}
      {!loading && bookmarks.length > 0 && (
        <View style={styles.searchBarContainer}>
          <View style={styles.searchBarSurface}>
            <Image source={require('../assets/search.png')} style={styles.searchIcon} />
            <TextInput
              style={styles.searchBarInput}
              placeholder="Search Bookmarks"
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
      
      {/* Filter Buttons */}
      {!loading && bookmarks.length > 0 && (
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
            label="Info Cards"
            isSelected={selectedFilter === 'card'}
            onPress={() => handleFilterPress('card')}
          />
        </View>
      )}
      
      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {!user ? (
          <View style={styles.noBookmarksContainer}>
            <Text style={styles.noBookmarksText}>Please sign in to view bookmarks</Text>
            <Text style={styles.noBookmarksSubtext}>Sign in to save and view your bookmarks</Text>
          </View>
        ) : loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading bookmarks...</Text>
          </View>
        ) : bookmarks.length === 0 ? (
          <View style={styles.noBookmarksContainer}>
            <Text style={styles.noBookmarksText}>No bookmarks yet</Text>
            <Text style={styles.noBookmarksSubtext}>Bookmark profiles to see them here</Text>
          </View>
        ) : (
          <View style={styles.bookmarksContainer}>
            {filteredBookmarks.map((bookmark) => {
              const profile = profileData[bookmark.id];
              if (!profile) return null;
              
              const isLoading = loadingCardIds.has(bookmark.id);
              const scale = getScale(bookmark.id);

              return (
                <Animated.View
                  key={bookmark.id}
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
                    onPress={() => !isLoading && handleBookmarkPress(bookmark)}
                    disabled={isLoading}
                    style={[
                      styles.bookmarkCard,
                      isLoading && styles.bookmarkCardDisabled
                    ]}
                  >
                    <View style={styles.bookmarkCardContent}>
                      <View style={styles.bookmarkTopRow}>
                        <Text style={[
                          styles.bookmarkTitle,
                          isLoading && styles.bookmarkTitleDisabled
                        ]} numberOfLines={0} adjustsFontSizeToFit={false}>
                          {isLoading ? 'Generating...' : profile.name}
                        </Text>
                        <View style={styles.bookmarkTypeBadge}>
                          <Text style={styles.bookmarkTypeText}>
                            {getBookmarkTypeDisplayName(bookmark.bookmark_type)}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.bookmarkBottomRow}>
                        <Text style={[
                          styles.bookmarkSubtitle,
                          isLoading && styles.bookmarkSubtitleDisabled
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
  // HEADER - identical to results.tsx
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
  // NO BOOKMARKS
  noBookmarksContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  noBookmarksText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '500',
    marginBottom: 8,
  },
  noBookmarksSubtext: {
    color: '#aaa',
    fontSize: 14,
  },
  // BOOKMARKS LIST - identical to results.tsx
  bookmarksContainer: {
    width: '100%',
    alignItems: 'center',
    paddingBottom: 20,
  },
  bookmarkCard: {
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
  bookmarkCardDisabled: {
    backgroundColor: '#333',
    opacity: 0.6,
  },
  bookmarkCardContent: {
    width: '100%',
    paddingHorizontal: 0,
    flex: 1,
  },
  bookmarkTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    width: '100%',
    marginBottom: 4,
  },
  bookmarkBottomRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    width: '100%',
  },
  bookmarkTitle: {
    color: '#fff',
    fontWeight: '400',
    fontSize: 20,
    flex: 1,
    flexWrap: 'wrap',
  },
  bookmarkTitleDisabled: {
    color: '#999',
  },
  bookmarkSubtitle: {
    color: '#898989',
    fontWeight: '400',
    fontSize: 12,
    flexWrap: 'wrap',
  },
  bookmarkSubtitleDisabled: {
    color: '#666',
  },
  bookmarkTypeBadge: {
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
  bookmarkTypeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
    textAlignVertical: 'center',
  },
});
