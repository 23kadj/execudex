import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Image, Keyboard, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableWithoutFeedback, View } from 'react-native';
import { useAuth } from '../../components/AuthProvider';
import { ProfileLoadingIndicator } from '../../components/ProfileLoadingIndicator';
import { NavigationService } from '../../services/navigationService';
import { getSupabaseClient } from '../../utils/supabase';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const exp1 = React.memo(() => {
  const router = useRouter();
  const { user } = useAuth();

  const formatTrendingPoliticianName = useCallback((fullName?: string) => {
    const cleaned = (fullName || '').trim().replace(/\s+/g, ' ');
    if (!cleaned) return '';
    const parts = cleaned.split(' ');
    if (parts.length < 2) return cleaned;
    const first = parts[0];
    const last = parts[parts.length - 1];
    const initial = first[0] ? first[0].toUpperCase() : '';
    return initial ? `${initial}. ${last}` : last;
  }, []);

  // State for search input
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [isProcessingProfile, setIsProcessingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Ref for search input to handle keyboard dismissal
  const searchInputRef = useRef<TextInput>(null);
  const isMountedRef = useRef(true);

  // Set up navigation service loading callback
  useEffect(() => {
    NavigationService.setLoadingCallback(setIsProcessingProfile);
    NavigationService.setErrorCallback(setProfileError);
  }, []);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  
  // Handle cancel profile loading
  const handleCancelProfileLoading = () => {
    NavigationService.cancelProcessing();
  };

  // State for button label cycling
  const [category1Label, setCategory1Label] = useState('Profile Type');
  const [category2Label, setCategory2Label] = useState('Influence');
  const [category3Label, setCategory3Label] = useState('Political Party');
  const [category4Label, setCategory4Label] = useState('Political Position');
  const [category5Label, setCategory5Label] = useState('Bill Status');
  const [category6Label, setCategory6Label] = useState('Congress');

  // State for politician data from ppl_index
  const [politicianData, setPoliticianData] = useState([
    { id: 11, name: 'Loading...', sub_name: 'Loading...', approval: '50.0%', disapproval: '50.0%' },
    { id: 12, name: 'Loading...', sub_name: 'Loading...', approval: '50.0%', disapproval: '50.0%' },
    { id: 13, name: 'Loading...', sub_name: 'Loading...', approval: '50.0%', disapproval: '50.0%' },
    { id: 14, name: 'Loading...', sub_name: 'Loading...', approval: '50.0%', disapproval: '50.0%' },
    { id: 15, name: 'Loading...', sub_name: 'Loading...', approval: '50.0%', disapproval: '50.0%' },
  ]);

  // State for legislation data from legi_index
  const [legislationData, setLegislationData] = useState([
    { id: 13, title: 'Loading...', subtitle: 'Loading...' },
    { id: 14, title: 'Loading...', subtitle: 'Loading...' },
    { id: 15, title: 'Loading...', subtitle: 'Loading...' },
    { id: 16, title: 'Loading...', subtitle: 'Loading...' },
    { id: 17, title: 'Loading...', subtitle: 'Loading...' },
    { id: 18, title: 'Loading...', subtitle: 'Loading...' },
    { id: 19, title: 'Loading...', subtitle: 'Loading...' },
    { id: 20, title: 'Loading...', subtitle: 'Loading...' },
  ]);

  // Fetch politician data from ppl_index when component mounts
  useEffect(() => {
    const fetchPoliticianData = async () => {
      try {
        console.log('Fetching politician data for exp1 page...');
        
        // Fetch politician data for IDs 11-15 from ppl_index
        const supabase = getSupabaseClient();
        const { data: allData, error } = await supabase
          .from('ppl_index')
          .select('id, name, sub_name')
          .in('id', [11, 12, 13, 14, 15])
          .order('id', { ascending: true });
        
        if (error) {
          console.error('Error fetching politician data:', error);
          return;
        }
        
        // Fetch approval/disapproval data from ppl_profiles
        const { data: profileData, error: profileError } = await supabase
          .from('ppl_profiles')
          .select('index_id, approval, disapproval')
          .in('index_id', [11, 12, 13, 14, 15]);
        
        if (profileError) {
          console.error('Error fetching profile data:', profileError);
        }
        
        if (allData && allData.length > 0) {
          console.log('Successfully fetched politician data from ppl_index:', allData);
          
          // Update politician data
          const newPoliticianData = [...politicianData];
          allData.forEach((politician) => {
            const index = politician.id - 11; // Convert ID to array index (11->0, 12->1, etc.)
            const profile = profileData?.find(p => p.index_id === politician.id);
            if (index >= 0 && index < newPoliticianData.length) {
              newPoliticianData[index] = {
                id: politician.id,
                name: politician.name || 'No Data Available',
                sub_name: politician.sub_name || 'No Data Available',
                approval: profile?.approval ? `${parseFloat(profile.approval.toString()).toFixed(1)}%` : '50.0%',
                disapproval: profile?.disapproval ? `${parseFloat(profile.disapproval.toString()).toFixed(1)}%` : '50.0%',
              };
            }
          });
          setPoliticianData(newPoliticianData);
        }
      } catch (err) {
        console.error('Error in fetchPoliticianData:', err);
      }
    };
    
    fetchPoliticianData();
  }, []);

  // Fetch legislation data from legi_index when component mounts
  useEffect(() => {
    const fetchLegislationData = async () => {
      try {
        console.log('Fetching legislation data for exp1 page...');
        
        // Fetch legislation data for IDs 13-20 from legi_index
        const supabase = getSupabaseClient();
        const { data: allData, error } = await supabase
          .from('legi_index')
          .select('id, name, sub_name')
          .in('id', [13, 14, 15, 16, 17, 18, 19, 20])
          .order('id', { ascending: true });
        
        if (error) {
          console.error('Error fetching legislation data:', error);
          return;
        }
        
        if (allData && allData.length > 0) {
          console.log('Successfully fetched legislation data from legi_index:', allData);
          
          // Update legislation data
          const newLegislationData = [...legislationData];
          allData.forEach((legislation) => {
            const index = legislation.id - 13; // Convert ID to array index (13->0, 14->1, etc.)
            if (index >= 0 && index < newLegislationData.length) {
              newLegislationData[index] = {
                id: legislation.id,
                title: legislation.name || 'No Data Available',
                subtitle: legislation.sub_name || 'No Data Available',
              };
            }
          });
          setLegislationData(newLegislationData);
        }
      } catch (err) {
        console.error('Error in fetchLegislationData:', err);
      }
    };
    
    fetchLegislationData();
  }, []);

  // Predefined cycling lists for each button
  const category1Labels = ['Profile Type', 'Politician', 'Legislation', 'Both'];
  const category2Labels = ['Influence', 'Low', 'Moderate', 'High'];
  const category3Labels = ['Political Party', 'Democrat', 'Republican', 'Independent', 'Other'];
  const category4Labels = ['Political Position', 'President', 'Vice President', 'Cabinet', 'Senator', 'Representative', 'Governor', 'Mayor', 'Candidate'];
  const category5Labels = ['Bill Status', 'Passed', 'Processing'];
  const category6Labels = ['Congress', '115th - Present', '110th - 114th', '100th - 109th', '1st - 99th']; // Now rotates through Congress options

  // Cycling functions for each button
  const cycleCategory1 = () => {
    const currentIndex = category1Labels.indexOf(category1Label);
    const nextIndex = (currentIndex + 1) % category1Labels.length;
    setCategory1Label(category1Labels[nextIndex]);
  };

  const cycleCategory2 = () => {
    const currentIndex = category2Labels.indexOf(category2Label);
    const nextIndex = (currentIndex + 1) % category2Labels.length;
    setCategory2Label(category2Labels[nextIndex]);
    
    // Auto-set Profile Type to Politician when Influence is changed
    if (category2Labels[nextIndex] !== 'Influence') {
      setCategory1Label('Politician');
    }
  };

  const cycleCategory3 = () => {
    const currentIndex = category3Labels.indexOf(category3Label);
    const nextIndex = (currentIndex + 1) % category3Labels.length;
    setCategory3Label(category3Labels[nextIndex]);
    
    // Auto-set Profile Type to Politician when Political Party is changed
    if (category3Labels[nextIndex] !== 'Political Party') {
      setCategory1Label('Politician');
    }
  };

  const cycleCategory4 = () => {
    const currentIndex = category4Labels.indexOf(category4Label);
    const nextIndex = (currentIndex + 1) % category4Labels.length;
    setCategory4Label(category4Labels[nextIndex]);
    
    // Auto-set Profile Type to Politician when Political Position is changed
    if (category4Labels[nextIndex] !== 'Political Position') {
      setCategory1Label('Politician');
    }
  };

  const cycleCategory5 = () => {
    const currentIndex = category5Labels.indexOf(category5Label);
    const nextIndex = (currentIndex + 1) % category5Labels.length;
    setCategory5Label(category5Labels[nextIndex]);
    
    // Auto-set Profile Type to Legislation when Bill Status is changed
    if (category5Labels[nextIndex] !== 'Bill Status') {
      setCategory1Label('Legislation');
    }
  };

  const cycleCategory6 = () => {
    const currentIndex = category6Labels.indexOf(category6Label);
    const nextIndex = (currentIndex + 1) % category6Labels.length;
    setCategory6Label(category6Labels[nextIndex]);
    
    // Auto-set Profile Type to Legislation when Congress is changed
    if (category6Labels[nextIndex] !== 'Congress') {
      setCategory1Label('Legislation');
    }
  };

  // Reset all filter buttons to their default values
  const resetFilters = useCallback(() => {
    setCategory1Label('Profile Type');
    setCategory2Label('Influence');
    setCategory3Label('Political Party');
    setCategory4Label('Political Position');
    setCategory5Label('Bill Status');
    setCategory6Label('Congress');
  }, []);

  // Handle search functionality
  const handleSearch = useCallback(async () => {
    // Add re-entrancy guard to prevent double submission
    if (isSearchingRef.current) return;
    
    const q = searchQuery.trim();
    if (!q || q.length < 1) return;

    // Additional validation to prevent search with invalid characters
    if (q.length < 2) return; // Require at least 2 characters

    isSearchingRef.current = true;
    if (isMountedRef.current) setIsSearchLoading(true);
    
    try {
      // Use lazy-loaded Supabase client
      const supabase = getSupabaseClient();
      
      // Search in ppl_index by name and sub_name (politicians)
      const { data: pplData, error: pplError } = await supabase
        .from('ppl_index')
        .select('id, name, sub_name, limit_score')
        .or(`name.ilike.%${q}%,sub_name.ilike.%${q}%`)
        .order('limit_score', { ascending: false });

      if (pplError) throw pplError;


      // Transform politician results to match the expected format
      const politicianResults = (pplData || []).map((item: any) => ({
        id: item.id,
        title: item.name,
        subtitle: item.sub_name,
        type: 'politician' as const,
        limit_score: item.limit_score || 0
      }));

      // Helper function to generate congress value arrays for filtering
      const generateCongressValues = (filterRange: string): string[] => {
        const getOrdinalSuffix = (num: number): string => {
          const lastDigit = num % 10;
          const lastTwoDigits = num % 100;
          
          if (lastTwoDigits >= 11 && lastTwoDigits <= 13) {
            return 'th';
          }
          
          switch (lastDigit) {
            case 1: return 'st';
            case 2: return 'nd';
            case 3: return 'rd';
            default: return 'th';
          }
        };

        switch (filterRange) {
          case '1st - 99th':
            return Array.from({ length: 99 }, (_, i) => `${i + 1}${getOrdinalSuffix(i + 1)}`);
          case '100th - 109th':
            return Array.from({ length: 10 }, (_, i) => `${100 + i}${getOrdinalSuffix(100 + i)}`);
          case '110th - 114th':
            return Array.from({ length: 5 }, (_, i) => `${110 + i}${getOrdinalSuffix(110 + i)}`);
          case '115th - Present':
            // Generate from 115th to current congress (119th) and beyond for future-proofing
            const currentCongress = 119; // This could be made dynamic based on current year
            return Array.from({ length: currentCongress - 114 }, (_, i) => `${115 + i}${getOrdinalSuffix(115 + i)}`);
          default:
            return [];
        }
      };

      // Apply congress filtering using Supabase .in() query for better performance
      let legiQueryWithFilters = supabase
        .from('legi_index')
        .select('id, name, sub_name, congress, bill_status')
        .or(`name.ilike.%${q}%,sub_name.ilike.%${q}%`)
        .order('id', { ascending: true });

      // Apply congress filter if selected
      if (category6Label !== 'Congress') {
        const congressValues = generateCongressValues(category6Label);
        legiQueryWithFilters = legiQueryWithFilters.in('congress', congressValues);
      }

      // Apply bill status filter if selected
      if (category5Label !== 'Bill Status') {
        let statusValue = '';
        switch (category5Label) {
          case 'Passed': statusValue = 'passed'; break;
          case 'Processing': statusValue = 'processing'; break;
        }
        if (statusValue) {
          legiQueryWithFilters = legiQueryWithFilters.eq('bill_status', statusValue);
        }
      }

      const { data: legiData, error: legiError } = await legiQueryWithFilters;
      if (legiError) throw legiError;

      // Transform legislation results to match the expected format (without limit_score)
      const legislationResults = (legiData || []).map((item: any) => ({
        id: item.id,
        title: item.name,
        subtitle: item.sub_name,
        type: 'legislation' as const,
        limit_score: 0 // Set to 0 since we're not using limit_score for legislation
      }));

      // Combine both result sets
      const searchResults = [...politicianResults, ...legislationResults];

      // Only navigate if we have valid results or if it's an intentional search
      if (searchResults.length > 0 || q.length > 0) {
        // Navigate to results page with search results
        router.push({
          pathname: '/results',
          params: {
            searchResults: JSON.stringify(searchResults),
            searchQuery: q
          }
        });

        // Use Keyboard.dismiss() only, let system handle blur naturally
        Keyboard.dismiss();
      }

    } catch (error) {
      console.error('Search error:', error);
      // You could add error handling here (e.g., show a toast message)
    } finally {
      if (isMountedRef.current) setIsSearchLoading(false);
      // Add a small delay before allowing the next search to prevent rapid successive searches
      setTimeout(() => {
        isSearchingRef.current = false;
      }, 100);
    }
  }, [searchQuery, router, category5Label, category6Label]);

  // Animated scale values for cards
  const card1Scale = useRef(new Animated.Value(1)).current;
  const card2Scale = useRef(new Animated.Value(1)).current;
  const card3Scale = useRef(new Animated.Value(1)).current;
  const card4Scale = useRef(new Animated.Value(1)).current;
  const card5Scale = useRef(new Animated.Value(1)).current;
  const card6Scale = useRef(new Animated.Value(1)).current;
  
  // Animated scale values for politician cards
  const politicianCard1Scale = useRef(new Animated.Value(1)).current;
  const politicianCard2Scale = useRef(new Animated.Value(1)).current;
  const politicianCard3Scale = useRef(new Animated.Value(1)).current;
  const politicianCard4Scale = useRef(new Animated.Value(1)).current;
  const politicianCard5Scale = useRef(new Animated.Value(1)).current;
  
  // Animated scale values for search category grid buttons (first grid)
  const searchGrid1Button1Scale = useRef(new Animated.Value(1)).current;
  const searchGrid1Button2Scale = useRef(new Animated.Value(1)).current;
  const searchGrid1Button3Scale = useRef(new Animated.Value(1)).current;
  const searchGrid1Button4Scale = useRef(new Animated.Value(1)).current;
  const searchGrid1Button5Scale = useRef(new Animated.Value(1)).current;
  const searchGrid1Button6Scale = useRef(new Animated.Value(1)).current;
  const searchGridResetButtonScale = useRef(new Animated.Value(1)).current;
  const searchGrid1ButtonFullScale = useRef(new Animated.Value(1)).current;

  // Determine which buttons should be disabled based on Category 1
  const isCategoryDisabled = useCallback((categoryNumber: number) => {
    if (categoryNumber === 1) return false; // Profile Type always enabled
    
    switch (category1Label) {
      case 'Politician':
        return categoryNumber === 5 || categoryNumber === 6; // Disable legislation-only
      case 'Legislation':
        return categoryNumber === 2 || categoryNumber === 3 || categoryNumber === 4; // Disable influence, politician-only
      default:
        return false; // Both or default - all enabled
    }
  }, [category1Label]);

  // Add re-entrancy guard ref
  const isSearchingRef = useRef(false);

  // Keyboard dismissal functions - remove manual blur to prevent conflicts
  const dismissKeyboard = useCallback(() => {
    Keyboard.dismiss();
  }, []);

  const handleScreenPress = useCallback(() => {
    dismissKeyboard();
  }, [dismissKeyboard]);
  
  // Animated scale values for recommended buttons
  const recommendedCardsButtonScale = useRef(new Animated.Value(1)).current;
  const recommendedProfilesButtonScale = useRef(new Animated.Value(1)).current;
  // Animated scale values for legislation cards (matching home.tsx format)
  const legislationCard1Scale = useRef(new Animated.Value(1)).current;
  const legislationCard2Scale = useRef(new Animated.Value(1)).current;
  const legislationCard3Scale = useRef(new Animated.Value(1)).current;
  const legislationCard4Scale = useRef(new Animated.Value(1)).current;
  const legislationCard5Scale = useRef(new Animated.Value(1)).current;
  const legislationCard6Scale = useRef(new Animated.Value(1)).current;
  const legislationCard7Scale = useRef(new Animated.Value(1)).current;
  const legislationCard8Scale = useRef(new Animated.Value(1)).current;



  return (
    <SafeAreaView style={styles.container}>
      <TouchableWithoutFeedback onPress={handleScreenPress}>
        <ScrollView 
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          scrollEventThrottle={16}
        >
          {/* Search Bar */}
          <View style={styles.searchBarContainer}>
            <Image source={require('../../assets/search.png')} style={styles.searchIcon} />
            <TextInput
              ref={searchInputRef}
              style={styles.searchBarInput}
              placeholder="Search Explore Page"
              placeholderTextColor="#666"
              value={String(searchQuery ?? '')}
              onChangeText={(text) => setSearchQuery(String(text ?? ''))}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
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

          {/* First Search Category Grid */}
          <View style={styles.searchGridContainer}>
            <View style={styles.searchGridRow}>
              <AnimatedPressable
                onPressIn={() => {
                  Haptics.selectionAsync();
                  Animated.spring(searchGrid1Button1Scale, {
                    toValue: 0.95,
                    friction: 6,
                    useNativeDriver: true,
                  }).start();
                }}
                onPressOut={() => {
                  Animated.spring(searchGrid1Button1Scale, {
                    toValue: 1,
                    friction: 6,
                    useNativeDriver: true,
                  }).start();
                }}
                onPress={cycleCategory1}
                style={[
                  styles.searchGridButton1,
                  { transform: [{ scale: searchGrid1Button1Scale }] }
                ]}
              >
                <Text style={styles.searchGridButtonText1}>{category1Label}</Text>
              </AnimatedPressable>
              <AnimatedPressable
                onPressIn={() => {
                  if (!isCategoryDisabled(2)) {
                    Haptics.selectionAsync();
                    Animated.spring(searchGrid1Button2Scale, {
                      toValue: 0.95,
                      friction: 6,
                      useNativeDriver: true,
                    }).start();
                  }
                }}
                onPressOut={() => {
                  if (!isCategoryDisabled(2)) {
                    Animated.spring(searchGrid1Button2Scale, {
                      toValue: 1,
                      friction: 6,
                      useNativeDriver: true,
                    }).start();
                  }
                }}
                onPress={isCategoryDisabled(2) ? undefined : cycleCategory2}
                style={[
                  styles.searchGridButton2,
                  isCategoryDisabled(2) && styles.searchGridButtonDisabled,
                  { transform: [{ scale: searchGrid1Button2Scale }] }
                ]}
              >
                <Text style={[
                  styles.searchGridButtonText2,
                  isCategoryDisabled(2) && styles.searchGridButtonTextDisabled
                ]}>{category2Label}</Text>
              </AnimatedPressable>
            </View>
            <View style={styles.searchGridRow}>
              <AnimatedPressable
                onPressIn={() => {
                  if (!isCategoryDisabled(3)) {
                    Haptics.selectionAsync();
                    Animated.spring(searchGrid1Button3Scale, {
                      toValue: 0.95,
                      friction: 6,
                      useNativeDriver: true,
                    }).start();
                  }
                }}
                onPressOut={() => {
                  if (!isCategoryDisabled(3)) {
                    Animated.spring(searchGrid1Button3Scale, {
                      toValue: 1,
                      friction: 6,
                      useNativeDriver: true,
                    }).start();
                  }
                }}
                onPress={isCategoryDisabled(3) ? undefined : cycleCategory3}
                style={[
                  styles.searchGridButton3,
                  isCategoryDisabled(3) && styles.searchGridButtonDisabled,
                  { transform: [{ scale: searchGrid1Button3Scale }] }
                ]}
              >
                <Text style={[
                  styles.searchGridButtonText3,
                  isCategoryDisabled(3) && styles.searchGridButtonTextDisabled
                ]}>{category3Label}</Text>
              </AnimatedPressable>
              <AnimatedPressable
                onPressIn={() => {
                  if (!isCategoryDisabled(4)) {
                    Haptics.selectionAsync();
                    Animated.spring(searchGrid1Button4Scale, {
                      toValue: 0.95,
                      friction: 6,
                      useNativeDriver: true,
                    }).start();
                  }
                }}
                onPressOut={() => {
                  if (!isCategoryDisabled(4)) {
                    Animated.spring(searchGrid1Button4Scale, {
                      toValue: 1,
                      friction: 6,
                      useNativeDriver: true,
                    }).start();
                  }
                }}
                onPress={isCategoryDisabled(4) ? undefined : cycleCategory4}
                style={[
                  styles.searchGridButton4,
                  isCategoryDisabled(4) && styles.searchGridButtonDisabled,
                  { transform: [{ scale: searchGrid1Button4Scale }] }
                ]}
              >
                <Text style={[
                  styles.searchGridButtonText4,
                  isCategoryDisabled(4) && styles.searchGridButtonTextDisabled
                ]}>{category4Label}</Text>
              </AnimatedPressable>
            </View>
            <View style={styles.searchGridRow}>
              <AnimatedPressable
                onPressIn={() => {
                  if (!isCategoryDisabled(5)) {
                    Haptics.selectionAsync();
                    Animated.spring(searchGrid1Button5Scale, {
                      toValue: 0.95,
                      friction: 6,
                      useNativeDriver: true,
                    }).start();
                  }
                }}
                onPressOut={() => {
                  if (!isCategoryDisabled(5)) {
                    Animated.spring(searchGrid1Button5Scale, {
                      toValue: 1,
                      friction: 6,
                      useNativeDriver: true,
                    }).start();
                  }
                }}
                onPress={isCategoryDisabled(5) ? undefined : cycleCategory5}
                style={[
                  styles.searchGridButton5,
                  isCategoryDisabled(5) && styles.searchGridButtonDisabled,
                  { transform: [{ scale: searchGrid1Button5Scale }] }
                ]}
              >
                <Text style={[
                  styles.searchGridButtonText5,
                  isCategoryDisabled(5) && styles.searchGridButtonTextDisabled
                ]}>{category5Label}</Text>
              </AnimatedPressable>
              <AnimatedPressable
                onPressIn={() => {
                  if (!isCategoryDisabled(6)) {
                    Haptics.selectionAsync();
                    Animated.spring(searchGrid1Button6Scale, {
                      toValue: 0.95,
                      friction: 6,
                      useNativeDriver: true,
                    }).start();
                  }
                }}
                onPressOut={() => {
                  if (!isCategoryDisabled(6)) {
                    Animated.spring(searchGrid1Button6Scale, {
                      toValue: 1,
                      friction: 6,
                      useNativeDriver: true,
                    }).start();
                  }
                }}
                onPress={isCategoryDisabled(6) ? undefined : cycleCategory6}
                style={[
                  styles.searchGridButton6,
                  isCategoryDisabled(6) && styles.searchGridButtonDisabled,
                  { transform: [{ scale: searchGrid1Button6Scale }] }
                ]}
              >
                <Text style={[
                  styles.searchGridButtonText6,
                  isCategoryDisabled(6) && styles.searchGridButtonTextDisabled
                ]}>{category6Label}</Text>
              </AnimatedPressable>
            </View>
            <View style={styles.searchGridRowFull}>
              <AnimatedPressable
                onPressIn={() => {
                  Haptics.selectionAsync();
                  Animated.spring(searchGridResetButtonScale, {
                    toValue: 0.95,
                    friction: 6,
                    useNativeDriver: true,
                  }).start();
                }}
                onPressOut={() => {
                  Animated.spring(searchGridResetButtonScale, {
                    toValue: 1,
                    friction: 6,
                    useNativeDriver: true,
                  }).start();
                }}
                onPress={resetFilters}
                style={[
                  styles.searchGridButtonFull,
                  { transform: [{ scale: searchGridResetButtonScale }] }
                ]}
              >
                <Text style={styles.searchGridButtonFullText}>Reset Filter</Text>
              </AnimatedPressable>
            </View>
            <View style={styles.searchGridRowFull}>
              <AnimatedPressable
                onPressIn={() => {
                  Haptics.selectionAsync();
                  Animated.spring(searchGrid1ButtonFullScale, {
                    toValue: 0.95,
                    friction: 6,
                    useNativeDriver: true,
                  }).start();
                }}
                onPressOut={() => {
                  Animated.spring(searchGrid1ButtonFullScale, {
                    toValue: 1,
                    friction: 6,
                    useNativeDriver: true,
                  }).start();
                }}
                onPress={() => {
                  // Build filter parameters based on changed categories
                  const filters = {
                    profileType: category1Label !== 'Profile Type' ? category1Label : null,
                    influence: category2Label !== 'Influence' ? category2Label : null,
                    party: category3Label !== 'Political Party' ? category3Label : null,
                    position: category4Label !== 'Political Position' ? category4Label : null,
                    billStatus: category5Label !== 'Bill Status' ? category5Label : null,
                    congress: category6Label !== 'Congress' ? category6Label : null,
                  };
                  
                  router.push({
                    pathname: '/results',
                    params: { filters: JSON.stringify(filters) }
                  });
                }}
                style={[
                  styles.searchGridButtonFull,
                  { transform: [{ scale: searchGrid1ButtonFullScale }] }
                ]}
              >
                <Text style={styles.searchGridButtonFullText}>Show Results</Text>
              </AnimatedPressable>
            </View>
          </View>
          
          {/* Trending Politicians Text */}
          <View style={styles.sectionHeader}>
            <Text style={styles.trendingPoliticiansTitle}>Trending Politicians</Text>
          </View>
          
          {/* Politician Cards */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.politicianCardsContainer}
            scrollEventThrottle={16}
          >
            {/* Politician Card 1 */}
            <View style={styles.politicianCardItem}>
              <AnimatedPressable
                onPressIn={() => {
                  Haptics.selectionAsync();
                  Animated.spring(politicianCard1Scale, {
                    toValue: 0.95,
                    friction: 6,
                    useNativeDriver: true,
                  }).start();
                }}
                onPressOut={() => {
                  Animated.spring(politicianCard1Scale, {
                    toValue: 1,
                    friction: 6,
                    useNativeDriver: true,
                  }).start();
                }}
                onPress={async () => {
                  await NavigationService.navigateToPoliticianProfile({
                    pathname: '/index1',
                    params: {
                      title: politicianData[0]?.name || 'No Data Available',
                      subtitle: politicianData[0]?.sub_name || 'No Data Available',
                      imgKey: 'trending1',
                      numbersObj: JSON.stringify({ red: politicianData[0]?.disapproval || '50.0%', green: politicianData[0]?.approval || '50.0%' }),
                      index: '11',
                    }
                  }, user?.id);
                }}
                style={[
                  styles.politicianCard,
                  { transform: [{ scale: politicianCard1Scale }] }
                ]}
              >
                <Image 
                  source={require('../../assets/trending1.png')} 
                  style={styles.politicianCardImage}
                />
              </AnimatedPressable>
              <Text style={styles.politicianCardLabel}>
                {formatTrendingPoliticianName(politicianData[0]?.name)}
              </Text>
            </View>

            {/* Politician Card 2 */}
            <View style={styles.politicianCardItem}>
              <AnimatedPressable
                onPressIn={() => {
                  Haptics.selectionAsync();
                  Animated.spring(politicianCard2Scale, {
                    toValue: 0.95,
                    friction: 6,
                    useNativeDriver: true,
                  }).start();
                }}
                onPressOut={() => {
                  Animated.spring(politicianCard2Scale, {
                    toValue: 1,
                    friction: 6,
                    useNativeDriver: true,
                  }).start();
                }}
                onPress={async () => {
                  await NavigationService.navigateToPoliticianProfile({
                    pathname: '/index1',
                    params: {
                      title: politicianData[1]?.name || 'No Data Available',
                      subtitle: politicianData[1]?.sub_name || 'No Data Available',
                      imgKey: 'trending2',
                      numbersObj: JSON.stringify({ red: politicianData[1]?.disapproval || '50.0%', green: politicianData[1]?.approval || '50.0%' }),
                      index: '12',
                    }
                  }, user?.id);
                }}
                style={[
                  styles.politicianCard,
                  { transform: [{ scale: politicianCard2Scale }] }
                ]}
              >
                <Image 
                  source={require('../../assets/trending2.png')} 
                  style={styles.politicianCardImage}
                />
              </AnimatedPressable>
              <Text style={styles.politicianCardLabel}>
                {formatTrendingPoliticianName(politicianData[1]?.name)}
              </Text>
            </View>

            {/* Politician Card 3 */}
            <View style={styles.politicianCardItem}>
              <AnimatedPressable
                onPressIn={() => {
                  Haptics.selectionAsync();
                  Animated.spring(politicianCard3Scale, {
                    toValue: 0.95,
                    friction: 6,
                    useNativeDriver: true,
                  }).start();
                }}
                onPressOut={() => {
                  Animated.spring(politicianCard3Scale, {
                    toValue: 1,
                    friction: 6,
                    useNativeDriver: true,
                  }).start();
                }}
                onPress={async () => {
                  await NavigationService.navigateToPoliticianProfile({
                    pathname: '/index1',
                    params: {
                      title: politicianData[2]?.name || 'No Data Available',
                      subtitle: politicianData[2]?.sub_name || 'No Data Available',
                      imgKey: 'trending3',
                      numbersObj: JSON.stringify({ red: politicianData[2]?.disapproval || '50.0%', green: politicianData[2]?.approval || '50.0%' }),
                      index: '13',
                    }
                  }, user?.id);
                }}
                style={[
                  styles.politicianCard,
                  { transform: [{ scale: politicianCard3Scale }] }
                ]}
              >
                <Image 
                  source={require('../../assets/trending3.png')} 
                  style={styles.politicianCardImage}
                />
              </AnimatedPressable>
              <Text style={styles.politicianCardLabel}>
                {formatTrendingPoliticianName(politicianData[2]?.name)}
              </Text>
            </View>

            {/* Politician Card 4 */}
            <View style={styles.politicianCardItem}>
              <AnimatedPressable
                onPressIn={() => {
                  Haptics.selectionAsync();
                  Animated.spring(politicianCard4Scale, {
                    toValue: 0.95,
                    friction: 6,
                    useNativeDriver: true,
                  }).start();
                }}
                onPressOut={() => {
                  Animated.spring(politicianCard4Scale, {
                    toValue: 1,
                    friction: 6,
                    useNativeDriver: true,
                  }).start();
                }}
                onPress={async () => {
                  await NavigationService.navigateToPoliticianProfile({
                    pathname: '/index1',
                    params: {
                      title: politicianData[3]?.name || 'No Data Available',
                      subtitle: politicianData[3]?.sub_name || 'No Data Available',
                      imgKey: 'trending4',
                      numbersObj: JSON.stringify({ red: politicianData[3]?.disapproval || '50.0%', green: politicianData[3]?.approval || '50.0%' }),
                      index: '14',
                    }
                  }, user?.id);
                }}
                style={[
                  styles.politicianCard,
                  { transform: [{ scale: politicianCard4Scale }] }
                ]}
              >
                <Image 
                  source={require('../../assets/trending4.png')} 
                  style={styles.politicianCardImage}
                />
              </AnimatedPressable>
              <Text style={styles.politicianCardLabel}>
                {formatTrendingPoliticianName(politicianData[3]?.name)}
              </Text>
            </View>

            {/* Politician Card 5 */}
            <View style={styles.politicianCardItem}>
              <AnimatedPressable
                onPressIn={() => {
                  Haptics.selectionAsync();
                  Animated.spring(politicianCard5Scale, {
                    toValue: 0.95,
                    friction: 6,
                    useNativeDriver: true,
                  }).start();
                }}
                onPressOut={() => {
                  Animated.spring(politicianCard5Scale, {
                    toValue: 1,
                    friction: 6,
                    useNativeDriver: true,
                  }).start();
                }}
                onPress={async () => {
                  await NavigationService.navigateToPoliticianProfile({
                    pathname: '/index1',
                    params: {
                      title: politicianData[4]?.name || 'No Data Available',
                      subtitle: politicianData[4]?.sub_name || 'No Data Available',
                      imgKey: 'trending5',
                      numbersObj: JSON.stringify({ red: politicianData[4]?.disapproval || '50.0%', green: politicianData[4]?.approval || '50.0%' }),
                      index: '15',
                    }
                  }, user?.id);
                }}
                style={[
                  styles.politicianCard,
                  { transform: [{ scale: politicianCard5Scale }] }
                ]}
              >
                <Image 
                  source={require('../../assets/trending5.png')} 
                  style={styles.politicianCardImage}
                />
              </AnimatedPressable>
              <Text style={styles.politicianCardLabel}>
                {formatTrendingPoliticianName(politicianData[4]?.name)}
              </Text>
            </View>


          </ScrollView>

          {/* Recommended Cards Button */}
          <View style={styles.recommendedButtonsWrapper}>
            <Animated.View
              style={{
                transform: [{ scale: recommendedCardsButtonScale }],
                width: '100%',
                alignItems: 'center',
              }}
            >
              <Pressable
                onPressIn={() => {
                  Haptics.selectionAsync();
                  Animated.spring(recommendedCardsButtonScale, {
                    toValue: 0.95,
                    useNativeDriver: true,
                  }).start();
                }}
                onPressOut={() => {
                  Animated.spring(recommendedCardsButtonScale, {
                    toValue: 1,
                    useNativeDriver: true,
                  }).start();
                }}
                onPress={() => {
                  router.push('/cards');
                }}
                style={styles.recommendedButton}
              >
                <View style={styles.recommendedButtonContent}>
                  <View style={styles.legislationTopRow}>
                    <Text style={styles.legislationTitleNew}>Recommended Cards</Text>
                  </View>
                  <View style={styles.legislationBottomRow}>
                    <Text style={styles.legislationSubtitleNew}>View cards potentially matching your interests</Text>
                  </View>
                </View>
              </Pressable>
            </Animated.View>

            {/* Recommended Profiles Button */}
            <Animated.View
              style={{
                transform: [{ scale: recommendedProfilesButtonScale }],
                width: '100%',
                alignItems: 'center',
              }}
            >
              <Pressable
                onPressIn={() => {
                  Haptics.selectionAsync();
                  Animated.spring(recommendedProfilesButtonScale, {
                    toValue: 0.95,
                    useNativeDriver: true,
                  }).start();
                }}
                onPressOut={() => {
                  Animated.spring(recommendedProfilesButtonScale, {
                    toValue: 1,
                    useNativeDriver: true,
                  }).start();
                }}
                onPress={() => {
                  router.push('/profiles1');
                }}
                style={styles.recommendedButton}
              >
                <View style={styles.recommendedButtonContent}>
                  <View style={styles.legislationTopRow}>
                    <Text style={styles.legislationTitleNew}>Recommended Profiles</Text>
                  </View>
                  <View style={styles.legislationBottomRow}>
                    <Text style={styles.legislationSubtitleNew}>View which profiles are relevant to you</Text>
                  </View>
                </View>
              </Pressable>
            </Animated.View>
          </View>
      
      {/* Trending Legislation Text */}
      <View style={styles.sectionHeader}>
            <Text style={styles.trendingLegislationTitle}>Trending Legislation</Text>
          </View>

                    {/* Legislation Cards - Matching home.tsx format */}
          <View style={styles.legislationCardsWrapper}>
            <View style={styles.legislationCardsContainer}>
              {/* Legislation Card 1 */}
              <AnimatedPressable
                onPressIn={() => {
                  Haptics.selectionAsync();
                  Animated.spring(legislationCard1Scale, {
                    toValue: 0.95,
                    friction: 6,
                    useNativeDriver: true,
                  }).start();
                }}
                onPressOut={() => {
                  Animated.spring(legislationCard1Scale, {
                    toValue: 1,
                    friction: 6,
                    useNativeDriver: true,
                  }).start();
                }}
                onPress={async () => {
                  await NavigationService.navigateToLegislationProfile({
                    pathname: '/index2',
                    params: {
                      title: legislationData[0]?.title || 'No Data Available',
                      subtitle: legislationData[0]?.subtitle || 'No Data Available',
                      imgKey: 'placeholder',
                      numbersObj: JSON.stringify({ red: '', green: '' }),
                      returnTab: '0',
                      returnMode: 'legi',
                      index: legislationData[0]?.id?.toString() || '13',
                    }
                  }, user?.id);
                }}
                style={[
                  styles.legislationCardNew,
                  { transform: [{ scale: legislationCard1Scale }] }
                ]}
              >
                <View style={styles.legislationCardContent}>
                  <View style={styles.legislationTopRow}>
                    <Text style={styles.legislationTitleNew}>{legislationData[0]?.title || 'Loading...'}</Text>
                  </View>
                  <View style={styles.legislationBottomRow}>
                    <Text style={styles.legislationSubtitleNew}>{legislationData[0]?.subtitle || 'Loading...'}</Text>
                  </View>
                </View>
              </AnimatedPressable>

              {/* Legislation Card 2 */}
              <AnimatedPressable
                onPressIn={() => {
                  Haptics.selectionAsync();
                  Animated.spring(legislationCard2Scale, {
                    toValue: 0.95,
                    friction: 6,
                    useNativeDriver: true,
                  }).start();
                }}
                onPressOut={() => {
                  Animated.spring(legislationCard2Scale, {
                    toValue: 1,
                    friction: 6,
                    useNativeDriver: true,
                  }).start();
                }}
                onPress={async () => {
                  await NavigationService.navigateToLegislationProfile({
                    pathname: '/index2',
                    params: {
                      title: legislationData[1]?.title || 'No Data Available',
                      subtitle: legislationData[1]?.subtitle || 'No Data Available',
                      imgKey: 'placeholder',
                      numbersObj: JSON.stringify({ red: '', green: '' }),
                      returnTab: '0',
                      returnMode: 'legi',
                      index: legislationData[1]?.id?.toString() || '14',
                    }
                  }, user?.id);
                }}
                style={[
                  styles.legislationCardNew,
                  { transform: [{ scale: legislationCard2Scale }] }
                ]}
              >
                <View style={styles.legislationCardContent}>
                  <View style={styles.legislationTopRow}>
                    <Text style={styles.legislationTitleNew}>{legislationData[1]?.title || 'Loading...'}</Text>
                  </View>
                  <View style={styles.legislationBottomRow}>
                    <Text style={styles.legislationSubtitleNew}>{legislationData[1]?.subtitle || 'Loading...'}</Text>
                  </View>
                </View>
              </AnimatedPressable>

              {/* Legislation Card 3 */}
              <AnimatedPressable
                onPressIn={() => {
                  Haptics.selectionAsync();
                  Animated.spring(legislationCard3Scale, {
                    toValue: 0.95,
                    friction: 6,
                    useNativeDriver: true,
                  }).start();
                }}
                onPressOut={() => {
                  Animated.spring(legislationCard3Scale, {
                    toValue: 1,
                    friction: 6,
                    useNativeDriver: true,
                  }).start();
                }}
                onPress={async () => {
                  await NavigationService.navigateToLegislationProfile({
                    pathname: '/index2',
                    params: {
                      title: legislationData[2]?.title || 'No Data Available',
                      subtitle: legislationData[2]?.subtitle || 'No Data Available',
                      imgKey: 'placeholder',
                      numbersObj: JSON.stringify({ red: '', green: '' }),
                      returnTab: '0',
                      returnMode: 'legi',
                      index: legislationData[2]?.id?.toString() || '15',
                    }
                  }, user?.id);
                }}
                style={[
                  styles.legislationCardNew,
                  { transform: [{ scale: legislationCard3Scale }] }
                ]}
              >
                <View style={styles.legislationCardContent}>
                  <View style={styles.legislationTopRow}>
                    <Text style={styles.legislationTitleNew}>{legislationData[2]?.title || 'Loading...'}</Text>
                  </View>
                  <View style={styles.legislationBottomRow}>
                    <Text style={styles.legislationSubtitleNew}>{legislationData[2]?.subtitle || 'Loading...'}</Text>
                  </View>
                </View>
              </AnimatedPressable>

              {/* Legislation Card 4 */}
              <AnimatedPressable
                onPressIn={() => {
                  Haptics.selectionAsync();
                  Animated.spring(legislationCard4Scale, {
                    toValue: 0.95,
                    friction: 6,
                    useNativeDriver: true,
                  }).start();
                }}
                onPressOut={() => {
                  Animated.spring(legislationCard4Scale, {
                    toValue: 1,
                    friction: 6,
                    useNativeDriver: true,
                  }).start();
                }}
                onPress={async () => {
                  await NavigationService.navigateToLegislationProfile({
                    pathname: '/index2',
                    params: {
                      title: legislationData[3]?.title || 'No Data Available',
                      subtitle: legislationData[3]?.subtitle || 'No Data Available',
                      imgKey: 'placeholder',
                      numbersObj: JSON.stringify({ red: '', green: '' }),
                      returnTab: '0',
                      returnMode: 'legi',
                      index: legislationData[3]?.id?.toString() || '16',
                    }
                  }, user?.id);
                }}
                style={[
                  styles.legislationCardNew,
                  { transform: [{ scale: legislationCard4Scale }] }
                ]}
              >
                <View style={styles.legislationCardContent}>
                  <View style={styles.legislationTopRow}>
                    <Text style={styles.legislationTitleNew}>{legislationData[3]?.title || 'Loading...'}</Text>
                  </View>
                  <View style={styles.legislationBottomRow}>
                    <Text style={styles.legislationSubtitleNew}>{legislationData[3]?.subtitle || 'Loading...'}</Text>
                  </View>
                </View>
              </AnimatedPressable>

              {/* Legislation Card 5 */}
              <AnimatedPressable
                onPressIn={() => {
                  Haptics.selectionAsync();
                  Animated.spring(legislationCard5Scale, {
                    toValue: 0.95,
                    friction: 6,
                    useNativeDriver: true,
                  }).start();
                }}
                onPressOut={() => {
                  Animated.spring(legislationCard5Scale, {
                    toValue: 1,
                    friction: 6,
                    useNativeDriver: true,
                  }).start();
                }}
                onPress={async () => {
                  await NavigationService.navigateToLegislationProfile({
                    pathname: '/index2',
                    params: {
                      title: legislationData[4]?.title || 'No Data Available',
                      subtitle: legislationData[4]?.subtitle || 'No Data Available',
                      imgKey: 'placeholder',
                      numbersObj: JSON.stringify({ red: '', green: '' }),
                      returnTab: '0',
                      returnMode: 'legi',
                      index: legislationData[4]?.id?.toString() || '17',
                    }
                  }, user?.id);
                }}
                style={[
                  styles.legislationCardNew,
                  { transform: [{ scale: legislationCard5Scale }] }
                ]}
              >
                <View style={styles.legislationCardContent}>
                  <View style={styles.legislationTopRow}>
                    <Text style={styles.legislationTitleNew}>{legislationData[4]?.title || 'Loading...'}</Text>
                  </View>
                  <View style={styles.legislationBottomRow}>
                    <Text style={styles.legislationSubtitleNew}>{legislationData[4]?.subtitle || 'Loading...'}</Text>
                  </View>
                </View>
              </AnimatedPressable>

              {/* Legislation Card 6 */}
              <AnimatedPressable
                onPressIn={() => {
                  Haptics.selectionAsync();
                  Animated.spring(legislationCard6Scale, {
                    toValue: 0.95,
                    friction: 6,
                    useNativeDriver: true,
                  }).start();
                }}
                onPressOut={() => {
                  Animated.spring(legislationCard6Scale, {
                    toValue: 1,
                    friction: 6,
                    useNativeDriver: true,
                  }).start();
                }}
                onPress={async () => {
                  await NavigationService.navigateToLegislationProfile({
                    pathname: '/index2',
                    params: {
                      title: legislationData[5]?.title || 'No Data Available',
                      subtitle: legislationData[5]?.subtitle || 'No Data Available',
                      imgKey: 'placeholder',
                      numbersObj: JSON.stringify({ red: '', green: '' }),
                      returnTab: '0',
                      returnMode: 'legi',
                      index: legislationData[5]?.id?.toString() || '18',
                    }
                  }, user?.id);
                }}
                style={[
                  styles.legislationCardNew,
                  { transform: [{ scale: legislationCard6Scale }] }
                ]}
              >
                <View style={styles.legislationCardContent}>
                  <View style={styles.legislationTopRow}>
                    <Text style={styles.legislationTitleNew}>{legislationData[5]?.title || 'Loading...'}</Text>
                  </View>
                  <View style={styles.legislationBottomRow}>
                    <Text style={styles.legislationSubtitleNew}>{legislationData[5]?.subtitle || 'Loading...'}</Text>
                  </View>
                </View>
              </AnimatedPressable>

              {/* Legislation Card 7 */}
              <AnimatedPressable
                onPressIn={() => {
                  Haptics.selectionAsync();
                  Animated.spring(legislationCard7Scale, {
                    toValue: 0.95,
                    friction: 6,
                    useNativeDriver: true,
                  }).start();
                }}
                onPressOut={() => {
                  Animated.spring(legislationCard7Scale, {
                    toValue: 1,
                    friction: 6,
                    useNativeDriver: true,
                  }).start();
                }}
                onPress={async () => {
                  await NavigationService.navigateToLegislationProfile({
                    pathname: '/index2',
                    params: {
                      title: legislationData[6]?.title || 'No Data Available',
                      subtitle: legislationData[6]?.subtitle || 'No Data Available',
                      imgKey: 'placeholder',
                      numbersObj: JSON.stringify({ red: '', green: '' }),
                      returnTab: '0',
                      returnMode: 'legi',
                      index: legislationData[6]?.id?.toString() || '19',
                    }
                  }, user?.id);
                }}
                style={[
                  styles.legislationCardNew,
                  { transform: [{ scale: legislationCard7Scale }] }
                ]}
              >
                <View style={styles.legislationCardContent}>
                  <View style={styles.legislationTopRow}>
                    <Text style={styles.legislationTitleNew}>{legislationData[6]?.title || 'Loading...'}</Text>
                  </View>
                  <View style={styles.legislationBottomRow}>
                    <Text style={styles.legislationSubtitleNew}>{legislationData[6]?.subtitle || 'Loading...'}</Text>
                  </View>
                </View>
              </AnimatedPressable>

              {/* Legislation Card 8 */}
              <AnimatedPressable
                onPressIn={() => {
                  Haptics.selectionAsync();
                  Animated.spring(legislationCard8Scale, {
                    toValue: 0.95,
                    friction: 6,
                    useNativeDriver: true,
                  }).start();
                }}
                onPressOut={() => {
                  Animated.spring(legislationCard8Scale, {
                    toValue: 1,
                    friction: 6,
                    useNativeDriver: true,
                  }).start();
                }}
                onPress={async () => {
                  await NavigationService.navigateToLegislationProfile({
                    pathname: '/index2',
                    params: {
                      title: legislationData[7]?.title || 'No Data Available',
                      subtitle: legislationData[7]?.subtitle || 'No Data Available',
                      imgKey: 'placeholder',
                      numbersObj: JSON.stringify({ red: '', green: '' }),
                      returnTab: '0',
                      returnMode: 'legi',
                      index: legislationData[7]?.id?.toString() || '20',
                    }
                  }, user?.id);
                }}
                style={[
                  styles.legislationCardNew,
                  { transform: [{ scale: legislationCard8Scale }] }
                ]}
              >
                <View style={styles.legislationCardContent}>
                  <View style={styles.legislationTopRow}>
                    <Text style={styles.legislationTitleNew}>{legislationData[7]?.title || 'Loading...'}</Text>
                  </View>
                  <View style={styles.legislationBottomRow}>
                    <Text style={styles.legislationSubtitleNew}>{legislationData[7]?.subtitle || 'Loading...'}</Text>
                  </View>
                </View>
              </AnimatedPressable>
            </View>
          </View>
        </ScrollView>
      </TouchableWithoutFeedback>
      
      <ProfileLoadingIndicator 
        visible={isProcessingProfile} 
        error={profileError}
        onCancel={handleCancelProfileLoading}
        title="Loading Profile"
        subtitle="Please keep the app open while we prepare your profile..."
      />

      <ProfileLoadingIndicator 
        visible={isSearchLoading && !isProcessingProfile}
        title="Searching"
        subtitle="Please keep the app open while we prepare your results..."
      />
    </SafeAreaView>
  );
});

export default exp1;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  cardsContainer: {
    width: '95%',
    alignSelf: 'center',
  },
  scrollContent: {
    paddingHorizontal: 0,
    paddingBottom: 20,
  },
  cardPlaceholder: {
    width: 120,
    height: 160,
    backgroundColor: '#090909',
    borderRadius: 16,
    marginRight: 12,
  },
  politicianCardsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16.5,
    marginBottom: 0,
    gap: 12,
    left: -4,
  },
  politicianCardItem: {
    width: Dimensions.get('window').width * 0.295,
    alignItems: 'center',
  },
  politicianCard: {
    width: Dimensions.get('window').width * 0.295,
    height: Dimensions.get('window').width * 0.5,
    backgroundColor: '#030303',
    borderWidth: 1,
    borderColor: '#101010',
    borderRadius: 16,
  },
  politicianCardImage: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
  },
  politicianCardLabel: {
    marginTop: 6,
    color: '#aaa',
    fontSize: 12,
    fontWeight: '400',
    textAlign: 'center',
  },
  sectionHeader: {
    alignItems: 'center',

  },
  sectionTitle: {
    color: '#aaa',
    fontSize: 15,
    fontWeight: '400',
    textAlign: 'center',
  },
  trendingPoliticiansTitle: {
    color: '#aaa',
    fontSize: 15,
    marginTop: 10,
    marginBottom: 10,
    fontWeight: '400',
    textAlign: 'center',
  },
  trendingLegislationTitle: {
    color: '#aaa',
    fontSize: 15,
    marginBottom: 10,
    marginTop: 20,
    fontWeight: '400',
    textAlign: 'center',
  },
  recommendedButtonsWrapper: {
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 0,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  recommendedButton: {
    width: '95%',
    height: 75,
    backgroundColor: '#040404',
    borderRadius: 22,
    marginVertical: 5,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#101010',
  },
  recommendedButtonContent: {
    width: '100%',
    paddingHorizontal: 20,
  },
  legislationCardsWrapper: {
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 0,
    alignItems: 'center',
  },
  legislationCardsContainer: {
    paddingHorizontal: 0,
    paddingBottom: 20,
  },
  legislationCard: {
    backgroundColor: '#030303',
    borderRadius: 28,
    padding: 20,
    marginBottom: 15,
    width: '95%',
    height: 100,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    borderWidth: 1,
    borderColor: '#101010',
  },
  // New legislation card styles matching home.tsx format
  legislationCardNew: {
    backgroundColor: '#030303',
    borderRadius: 22,
    padding: 20,
    marginBottom: 10,
    width: '95%',
    minHeight: 80,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    borderWidth: 1,
    borderColor: '#101010',
  },
  legislationCardContent: {
    width: '100%',
    paddingHorizontal: 0,
  },
  legislationTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    width: '100%',
    marginBottom: 4,
  },
  legislationBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    width: '100%',
  },
  legislationTitleNew: {
    color: '#fff',
    fontWeight: '400',
    fontSize: 20,
    flex: 1,
    flexWrap: 'wrap',
    flexShrink: 1,
  },
  legislationSubtitleNew: {
    color: '#898989',
    fontWeight: '400',
    fontSize: 12,
    flexWrap: 'wrap',
    flexShrink: 1,
  },
  legislationTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginBottom: 0,
  },
  legislationTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '500',
  },
  legislationSubtext: {
    color: '#ccc',
    fontSize: 14,
    marginTop: 6,
    fontWeight: '400',
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
    height: 365,
    marginTop: 0,
    marginBottom: 5,
    paddingTop: 18,
    paddingBottom: 18,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#101010',
  },
  searchGridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
    paddingHorizontal: 0,
  },
  searchGridButton1: {
    backgroundColor: '#090909',
    borderRadius: 15,
    height: 58,
    width: '43%',
    marginLeft: 20,
    marginHorizontal: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchGridButton2: {
    backgroundColor: '#090909',
    borderRadius: 15,
    height: 58,
    width: '43%',
    marginRight: 20,
    marginHorizontal: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchGridButton3: {
    backgroundColor: '#090909',
    borderRadius: 15,
    height: 58,
    width: '43%',
    marginLeft: 20,
    marginHorizontal: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchGridButton4: {
    backgroundColor: '#090909',
    borderRadius: 15,
    height: 58,
    width: '43%',
    marginRight: 20,
    marginHorizontal: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchGridButton5: {
    backgroundColor: '#090909',
    borderRadius: 15,
    height: 58,
    width: '43%',
    marginLeft: 20,
    marginHorizontal: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchGridButton6: {
    backgroundColor: '#090909',
    borderRadius: 15,
    height: 58,
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
  searchGridButtonText5: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '400',
    textAlign: 'center',
  },
  searchGridButtonText6: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '400',
    textAlign: 'center',
  },
  // Disabled button styles
  searchGridButtonDisabled: {
    backgroundColor: '#050505',
    opacity: 0.5,
  },
  searchGridButtonTextDisabled: {
    color: '#666',
  },
  searchGridRowFull: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 5,
    paddingHorizontal: 0,
  },
  searchGridButtonFull: {
    backgroundColor: '#090909',
    borderRadius: 15,
    height: 54,
    width: '90%',
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

});
