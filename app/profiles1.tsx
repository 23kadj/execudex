import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Image, Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { useAuth } from '../components/AuthProvider';
import { TypeFilterButton } from '../components/TypeFilterButton';
import { NavigationService } from '../services/navigationService';
import { getSupabaseClient } from '../utils/supabase';

const AnimatedPressable = Animated.createAnimatedComponent(View);

interface ProfileData {
  id: number;
  name: string;
  sub_name: string;
  is_ppl: boolean;
}

type FilterType = 'ppl' | 'legi' | null;

// Parse onboard data string to extract state code
const parseOnboardStateCode = (onboardData: string | null): string | null => {
  if (!onboardData) return null;
  
  const parts = onboardData.split(' | ');
  for (const part of parts) {
    const colonIndex = part.indexOf(':');
    if (colonIndex > 0) {
      const key = part.substring(0, colonIndex).trim();
      const value = part.substring(colonIndex + 1).trim();
      if (key === 'State Code' && value) {
        return value.toUpperCase(); // Return uppercase state code
      }
    }
  }
  return null;
};

export default function Profiles1() {
  const router = useRouter();
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<ProfileData[]>([]);
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
      fetchRecommendedProfiles();
    } else {
      setLoading(false);
    }
  }, [user]);

  const fetchRecommendedProfiles = async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
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
        setProfiles([]);
        setLoading(false);
        return;
      }

      // Parse state code from onboard data
      const stateCode = parseOnboardStateCode(userData?.onboard || null);
      if (!stateCode) {
        setProfiles([]);
        setLoading(false);
        return;
      }

      const allProfiles: ProfileData[] = [];

      // Fetch politicians matching state code
      const { data: pplData, error: pplError } = await supabase
        .from('ppl_index')
        .select('id, name, sub_name')
        .eq('state_code', stateCode);

      if (pplError) {
        console.error('Error fetching politicians:', pplError);
      } else if (pplData) {
        pplData.forEach((ppl: any) => {
          allProfiles.push({
            id: ppl.id,
            name: ppl.name,
            sub_name: ppl.sub_name || '',
            is_ppl: true,
          });
        });
      }

      // Fetch all legislation and filter by state code in sub_name
      // Pattern to match: (R-TX), (D-CA), (I-TX), etc.
      const { data: legiData, error: legiError } = await supabase
        .from('legi_index')
        .select('id, name, sub_name');

      if (legiError) {
        console.error('Error fetching legislation:', legiError);
      } else if (legiData) {
        // Filter legislation where sub_name contains state code pattern
        // Pattern: (X-XX) where X is R/D/I and XX is the state code
        // Use case-insensitive regex to match patterns like (R-TX), (D-TX), (I-TX)
        const stateCodeRegex = new RegExp(`\\([RDI]-${stateCode}\\)`, 'i');

        legiData.forEach((legi: any) => {
          const subName = String(legi.sub_name || '');
          // Check if state code pattern appears in sub_name
          if (stateCodeRegex.test(subName)) {
            allProfiles.push({
              id: legi.id,
              name: legi.name,
              sub_name: legi.sub_name || '',
              is_ppl: false,
            });
          }
        });
      }

      setProfiles(allProfiles);
    } catch (error) {
      console.error('Error fetching recommended profiles:', error);
      setProfiles([]);
    } finally {
      setLoading(false);
    }
  };

  // Filter profiles based on selected filter and search query
  const filteredProfiles = profiles
    .filter((profile) => {
      if (selectedFilter === null) return true; // Show all when no filter is selected
      return selectedFilter === 'ppl' ? profile.is_ppl : !profile.is_ppl;
    })
    .filter((profile) => {
      const normalizedQuery = searchQuery.trim().toLowerCase();
      if (!normalizedQuery) return true;
      return (
        profile.name.toLowerCase().includes(normalizedQuery) ||
        profile.sub_name.toLowerCase().includes(normalizedQuery)
      );
    });

  // Toggle filter: if clicking the same filter, deselect it
  const handleFilterPress = (filterType: 'ppl' | 'legi') => {
    setSelectedFilter(prev => prev === filterType ? null : filterType);
  };

  const dismissKeyboard = () => Keyboard.dismiss();

  // Function to get profile type display name
  const getProfileTypeDisplayName = (profile: ProfileData): string => {
    return profile.is_ppl ? 'Politician' : 'Legislation';
  };

  const handleProfilePress = async (profile: ProfileData) => {
    const profileKey = `${profile.id}-${profile.is_ppl ? 'ppl' : 'legi'}`;
    
    // Prevent clicking the same button twice
    if (loadingProfileKeys.has(profileKey)) return;
    
    // Add this profile to the loading set
    setLoadingProfileKeys(prev => new Set(prev).add(profileKey));

    try {
      if (profile.is_ppl) {
        // Navigate to politician profile with pre-processing
        await NavigationService.navigateToPoliticianProfile({
          pathname: '/index1',
          params: {
            title: profile.name,
            subtitle: profile.sub_name,
            imgKey: 'placeholder',
            numbersObj: JSON.stringify({ red: '50%', green: '50%' }),
            index: profile.id.toString(),
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
            index: profile.id.toString(),
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
        <Text style={styles.headerTitle}>Recommended Profiles</Text>
      </View>
      
      {/* Search Bar */}
      {!loading && profiles.length > 0 && (
        <View style={styles.searchBarContainer}>
          <View style={styles.searchBarSurface}>
            <Image source={require('../assets/search.png')} style={styles.searchIcon} />
            <TextInput
              style={styles.searchBarInput}
              placeholder="Search Recommended Profiles"
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
      {!loading && profiles.length > 0 && (
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
        </View>
      )}
      
      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {!user ? (
          <View style={styles.noProfilesContainer}>
            <Text style={styles.noProfilesText}>Please sign in to view recommended profiles</Text>
            <Text style={styles.noProfilesSubtext}>Sign in to see profiles relevant to you</Text>
          </View>
        ) : loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading recommended profiles...</Text>
          </View>
        ) : profiles.length === 0 ? (
          <View style={styles.noProfilesContainer}>
            <Text style={styles.noProfilesText}>
              No recommended profiles available at this time, please come back later. You can update your state in the demographic settings page.
            </Text>
          </View>
        ) : filteredProfiles.length === 0 ? (
          <View style={styles.noProfilesContainer}>
            <Text style={styles.noProfilesText}>No profiles match your current filters</Text>
            <Text style={styles.noProfilesSubtext}>Try adjusting your search or filter options</Text>
          </View>
        ) : (
          <View style={styles.profilesContainer}>
            {filteredProfiles.map((profile) => {
              const profileKey = `${profile.id}-${profile.is_ppl ? 'ppl' : 'legi'}`;
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
                    onPress={() => !isLoading && handleProfilePress(profile)}
                    disabled={isLoading}
                    style={[
                      styles.profileCard,
                      isLoading && styles.profileCardDisabled
                    ]}
                  >
                    <View style={styles.profileCardContent}>
                      <View style={styles.profileTopRow}>
                        <Text style={[
                          styles.profileTitle,
                          isLoading && styles.profileTitleDisabled
                        ]} numberOfLines={0} adjustsFontSizeToFit={false}>
                          {isLoading ? 'Generating...' : profile.name}
                        </Text>
                        <View style={styles.profileTypeBadge}>
                          <Text style={styles.profileTypeText}>
                            {getProfileTypeDisplayName(profile)}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.profileBottomRow}>
                        <Text style={[
                          styles.profileSubtitle,
                          isLoading && styles.profileSubtitleDisabled
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
  // HEADER
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
  // FILTER BUTTONS - left aligned
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
  // NO PROFILES
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
  // PROFILES LIST
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
    shadowOpacity: 0.10,
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

