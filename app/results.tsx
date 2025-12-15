import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Image, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../components/AuthProvider';
import { ProfileLoadingIndicator } from '../components/ProfileLoadingIndicator';
import { NavigationService } from '../services/navigationService';
import { getSupabaseClient } from '../utils/supabase';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface FilterParams {
  profileType: string | null;
  influence: string | null;
  party: string | null;
  position: string | null;
  billStatus: string | null;
  congress: string | null;
}

interface ResultItem {
  id: string;
  title: string;
  subtitle: string;
  type: 'politician' | 'legislation';
  limit_score: number;
}

// Header component moved outside to prevent re-creation on each render
const Header = React.memo(({ onBack, searchQuery }: { onBack: () => void; searchQuery?: string }) => {
  return (
    <View style={styles.headerContainer}>
      <View
        style={styles.headerIconBtn}
        onStartShouldSetResponder={() => true}
        onResponderRelease={onBack}
        hitSlop={{ top: 12, left: 12, right: 12, bottom: 12 }}
      >
        <Image source={require('../assets/back1.png')} style={styles.headerIcon} />
      </View>
      <Text style={styles.headerTitle}>
        {searchQuery ? `Search: ${searchQuery}` : 'Results'}
      </Text>
    </View>
  );
});

export default function Results() {
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const [results, setResults] = useState<ResultItem[]>([]);
  const [isLoadingLegislation, setIsLoadingLegislation] = useState(false);
  const [isLoadingResults, setIsLoadingResults] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isProcessingProfile, setIsProcessingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Animated scale values for result buttons
  const resultButtonScales = useRef<{ [key: string]: Animated.Value }>({}).current;
  
  // Animated scale value for load legislation button
  const loadLegislationScale = useRef(new Animated.Value(1)).current;

  // Parse filters from route params and derive stable values
  const filtersJson = typeof params.filters === 'string' ? params.filters : '{}';
  const searchResultsJson = typeof params.searchResults === 'string' ? params.searchResults : '';
  const searchQueryParam = typeof params.searchQuery === 'string' ? params.searchQuery : '';
  
  // Parse filters once and memoize to prevent recreation on every render
  const filters: FilterParams = React.useMemo(() => {
    try {
      return JSON.parse(filtersJson);
    } catch {
      return {};
    }
  }, [filtersJson]);

  // Determine which tables to query based on Profile Type - memoize to prevent recalculation
  const shouldQueryPpl = React.useMemo(() => {
    return filters.profileType === 'Politician' || filters.profileType === 'Both' || !filters.profileType;
  }, [filters.profileType]);
  
  const shouldQueryLegi = React.useMemo(() => {
    return filters.profileType === 'Legislation' || filters.profileType === 'Both' || !filters.profileType;
  }, [filters.profileType]);

  // Determine if Load Legislation button should be visible
  const shouldShowLoadLegislationButton = React.useCallback(() => {
    // Completely disable Load Legislation button for now
    return false;
  }, []);

  const fetchResults = useCallback(async () => {
    setIsLoadingResults(true);
    setError(null);
    
    try {
      const supabase = getSupabaseClient();
      
      let pplResults: ResultItem[] = [];
      let legiResults: ResultItem[] = [];

      // Query ppl_index if needed
      if (shouldQueryPpl) {
        let pplQuery = supabase
          .from('ppl_index')
          .select('id, name, sub_name, limit_score');

        // Apply filters relevant to ppl_index
        if (filters.influence) {
          let tierValue = '';
          switch (filters.influence) {
            case 'Low': tierValue = 'base'; break;
            case 'Moderate': tierValue = 'soft'; break;
            case 'High': tierValue = 'hard'; break;
          }
          if (tierValue) {
            pplQuery = pplQuery.eq('tier', tierValue);
          }
        }

        if (filters.party) {
          let partyValue = '';
          switch (filters.party) {
            case 'Democrat': partyValue = 'D'; break;
            case 'Republican': partyValue = 'R'; break;
            case 'Independent': partyValue = 'I'; break;
            case 'Other': partyValue = 'other'; break;
          }
          if (partyValue) {
            pplQuery = pplQuery.eq('party_type', partyValue);
          }
        }

        if (filters.position) {
          let officeTypeValue = '';
          switch (filters.position) {
            case 'President': officeTypeValue = 'president'; break;
            case 'Vice President': officeTypeValue = 'vice_president'; break;
            case 'Cabinet': officeTypeValue = 'cabinet'; break;
            case 'Senator': officeTypeValue = 'senator'; break;
            case 'Representative': officeTypeValue = 'representative'; break;
            case 'Governor': officeTypeValue = 'governor'; break;
            case 'Mayor': officeTypeValue = 'mayor'; break;
            case 'Candidate': officeTypeValue = 'candidate'; break;
          }
          if (officeTypeValue) {
            pplQuery = pplQuery.eq('office_type', officeTypeValue);
          }
        }

        const { data: pplData, error: pplError } = await pplQuery;
        if (pplError) throw pplError;
        
        pplResults = (pplData || []).map(item => ({
          id: item.id,
          title: item.name,
          subtitle: item.sub_name,
          type: 'politician' as const,
          limit_score: item.limit_score || 0
        }));
      }

      // Query legi_index if needed
      if (shouldQueryLegi) {
        let legiQuery = supabase
          .from('legi_index')
          .select('id, name, sub_name');

        // Apply filters relevant to legi_index
        if (filters.billStatus) {
          let statusValue = '';
          switch (filters.billStatus) {
            case 'Passed': statusValue = 'passed'; break;
            case 'Processing': statusValue = 'processing'; break;
          }
          if (statusValue) {
            legiQuery = legiQuery.eq('bill_status', statusValue);
          }
        }

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
        if (filters.congress) {
          const congressValues = generateCongressValues(filters.congress);
          legiQuery = legiQuery.in('congress', congressValues);
        }

        const { data: legiData, error: legiError } = await legiQuery;
        if (legiError) throw legiError;
        
        legiResults = (legiData || []).map(item => ({
          id: item.id,
          title: item.name,
          subtitle: item.sub_name,
          type: 'legislation' as const,
          limit_score: 0
        }));
      }

      // Combine and merge results
      const combinedResults = [...pplResults, ...legiResults];
      
      // Sort results by limit_score in descending order (highest first)
      const sortedResults = combinedResults.sort((a, b) => b.limit_score - a.limit_score);
      
      setResults(sortedResults);
      setError(null);

    } catch (err) {
      console.error('Error fetching results:', err);
      setError('Failed to load results. Please try again.');
      setResults([]);
    } finally {
      setIsLoadingResults(false);
    }
  }, [filters, shouldQueryPpl, shouldQueryLegi]);

  useEffect(() => {
    // If we have search results, use them directly
    if (searchResultsJson) {
      try {
        const parsedResults = JSON.parse(searchResultsJson);
        setResults(prev => {
          // Only update if the results are actually different
          if (JSON.stringify(prev) === searchResultsJson) {
            return prev;
          }
          return parsedResults;
        });
        return;
      } catch (error) {
        console.error('Error parsing search results:', error);
      }
    }
    
    // Otherwise, fetch results based on filters
    fetchResults();
  }, [searchResultsJson, filtersJson, fetchResults]); // Use stable primitive values

  const loadMoreLegislation = useCallback(async () => {
    if (isLoadingLegislation || !shouldShowLoadLegislationButton()) return;
    
    setIsLoadingLegislation(true);
    try {
      const supabase = getSupabaseClient();
      let legiQuery = supabase
        .from('legi_index')
        .select('id, name, sub_name')
        .order('id', { ascending: true })
        .range(results.length, results.length + 9); // Load next 10 items

      // Apply filters relevant to legi_index
      if (filters.billStatus) {
        let statusValue = '';
        switch (filters.billStatus) {
          case 'Passed': statusValue = 'passed'; break;
          case 'Processing': statusValue = 'processing'; break;
        }
        if (statusValue) {
          legiQuery = legiQuery.eq('bill_status', statusValue);
        }
      }

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
      if (filters.congress) {
        const congressValues = generateCongressValues(filters.congress);
        legiQuery = legiQuery.in('congress', congressValues);
      }

      const { data: legiData, error: legiError } = await legiQuery;
      if (legiError) throw legiError;
      
      if (legiData && legiData.length > 0) {
        const newLegislationResults = legiData.map(item => ({
          id: item.id,
          title: item.name,
          subtitle: item.sub_name,
          type: 'legislation' as const,
          limit_score: 0
        }));

        // Add new legislation results to existing results
        const updatedResults = [...results, ...newLegislationResults];
        
        // Sort by limit_score to maintain order
        const sortedResults = updatedResults.sort((a, b) => b.limit_score - a.limit_score);
        
        setResults(sortedResults);
      }
    } catch (err) {
      console.error('Error loading more legislation:', err);
    } finally {
      setIsLoadingLegislation(false);
    }
  }, [isLoadingLegislation, shouldShowLoadLegislationButton, results.length, filters.billStatus, filters.congress]);

  // Get or create animated scale value for a result button
  const getResultButtonScale = useCallback((itemId: string) => {
    if (!resultButtonScales[itemId]) {
      resultButtonScales[itemId] = new Animated.Value(1);
    }
    return resultButtonScales[itemId];
  }, [resultButtonScales]);

  // Helper function to validate profile data before navigation
  const validateProfileData = useCallback((item: ResultItem): boolean => {
    // Check if item has required fields
    if (!item || typeof item !== 'object') {
      console.error('Invalid item: item is not an object');
      return false;
    }
    
    if (!item.id || item.id === '') {
      console.error('Invalid item: missing or empty ID');
      return false;
    }
    
    if (!item.title || item.title === '') {
      console.error('Invalid item: missing or empty title');
      return false;
    }
    
    if (!item.type || !['politician', 'legislation'].includes(item.type)) {
      console.error('Invalid item: missing or invalid type');
      return false;
    }
    
    // Additional validation for specific types
    if (item.type === 'politician') {
      // Ensure politician has valid data
      console.log('Validating politician profile:', {
        id: item.id,
        title: item.title,
        subtitle: item.subtitle,
        limitScore: item.limit_score
      });
    } else if (item.type === 'legislation') {
      // Ensure legislation has valid data
      console.log('Validating legislation profile:', {
        id: item.id,
        title: item.title,
        subtitle: item.subtitle,
        limitScore: item.limit_score
      });
    }
    
    return true;
  }, []);

  const handleResultPress = useCallback(async (item: ResultItem) => {
    console.log('handleResultPress called with item:', item);
    
    try {
      // Validate profile data before proceeding
      if (!validateProfileData(item)) {
        console.error('Profile data validation failed for item:', item);
        return;
      }

      // Log the navigation attempt for debugging
      console.log('Navigating to profile:', {
        type: item.type,
        id: item.id,
        title: item.title,
        subtitle: item.subtitle,
        limitScore: item.limit_score
      });

      if (item.type === 'politician') {
        // For politician profiles, navigate to index1 with pre-processing
        const navigationParams = {
          title: item.title,
          subtitle: item.subtitle || 'No Data Available',
          imgKey: 'placeholder',
          numbersObj: JSON.stringify({ red: '50%', green: '50%' }),
          index: item.id.toString(), // Ensure ID is passed as string
          // Add additional context for politician profiles
          profileType: 'politician',
          limitScore: item.limit_score?.toString() || '0'
        };
        
        console.log('Navigating to politician profile with pre-processing:', navigationParams);
        
        // Use navigation service with pre-processing
        await NavigationService.navigateToPoliticianProfile({
          pathname: '/index1',
          params: navigationParams
        }, user?.id);
        
        console.log('Navigation service called successfully');
        
      } else if (item.type === 'legislation') {
        // For legislation profiles, navigate to index2 with pre-processing
        const params = {
          title: item.title,
          subtitle: item.subtitle || 'No Data Available',
          imgKey: 'placeholder',
          numbersObj: JSON.stringify({ red: '', green: '' }),
          returnTab: '0',
          returnMode: 'legi',
          index: item.id.toString(), // Use 'index' key for consistency with politician profiles
          // Add additional context for legislation profiles
          profileType: 'legislation',
          limitScore: item.limit_score?.toString() || '0'
        };
        
        console.log('Navigating to legislation profile with pre-processing:', params);
        
        // Use navigation service with pre-processing
        await NavigationService.navigateToLegislationProfile({
          pathname: '/index2',
          params
        }, user?.id);
        
        console.log('Navigation service called successfully');
        
      } else {
        console.error('Unknown profile type:', item.type);
      }
    } catch (error) {
      console.error('Error navigating to profile:', error);
      console.error('Error details:', error);
    }
  }, [router, validateProfileData]);

  // Set up navigation service loading callback
  useEffect(() => {
    NavigationService.setLoadingCallback(setIsProcessingProfile);
    NavigationService.setErrorCallback(setProfileError);
  }, []);
  
  // Handle cancel profile loading
  const handleCancelProfileLoading = () => {
    NavigationService.cancelProcessing();
  };

  // Memoized back handler to prevent unnecessary re-renders
  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  // Results count display
  const ResultsCount = useCallback(() => {
    // If this is a search result, show search-specific text
    if (searchQueryParam) {
      return (
        <View style={styles.resultsCountContainer}>
          <Text style={styles.resultsCountText}>
            {results.length} result{results.length !== 1 ? 's' : ''} found for "{searchQueryParam}"
          </Text>
        </View>
      );
    }
    
    // Otherwise, show filter-based text
    const activeFilters = Object.values(filters).filter(f => f !== null);
    const filterText = activeFilters.length > 0 
      ? `(${activeFilters.length} filter${activeFilters.length > 1 ? 's' : ''} applied)`
      : '(No filters applied)';
    
    return (
      <View style={styles.resultsCountContainer}>
        <Text style={styles.resultsCountText}>
          {results.length} result{results.length !== 1 ? 's' : ''} found {filterText}
        </Text>
      </View>
    );
  }, [searchQueryParam, results.length, filters]);

  return (
    <View style={styles.container}>
              <Header onBack={handleBack} searchQuery={searchQueryParam} />
      
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <ResultsCount />
        
        {isLoadingResults && results.length === 0 ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading results...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : results.length === 0 ? (
          <View style={styles.noResultsContainer}>
            <Text style={styles.noResultsText}>No results found</Text>
            <Text style={styles.noResultsSubtext}>
              {searchQueryParam 
                ? `No results found for "${searchQueryParam}".`
                : 'Try adjusting your filters'
              }
            </Text>
          </View>
        ) : (
          <View style={styles.resultsContainer}>
            {results.map((item, index) => {
              // Validate item before rendering
              if (!validateProfileData(item)) {
                console.warn('Skipping invalid item in results:', item);
                return null;
              }
              
              const buttonScale = getResultButtonScale(item.id);
              
              // Ensure we have a valid scale value
              if (!buttonScale) {
                console.warn('Failed to get button scale for item:', item);
                return null;
              }
              
              return (
                <TouchableOpacity
                  key={`${item.type}-${item.id}-${index}`}
                  style={[
                    styles.resultCard,
                    { transform: [{ scale: buttonScale }] }
                  ]}
                  onPressIn={() => {
                    try {
                      // Consistent haptic feedback
                      Haptics.selectionAsync();
                      // Consistent bounce animation
                      Animated.spring(buttonScale, {
                        toValue: 0.95,
                        friction: 6,
                        tension: 100,
                        useNativeDriver: true,
                      }).start();
                    } catch (error) {
                      console.error('Error in onPressIn:', error);
                    }
                  }}
                  onPressOut={() => {
                    try {
                      // Smooth return animation
                      Animated.spring(buttonScale, {
                        toValue: 1,
                        friction: 8,
                        tension: 100,
                        useNativeDriver: true,
                      }).start();
                    } catch (error) {
                      console.error('Error in onPressOut:', error);
                    }
                  }}
                  onPress={() => {
                    // Navigate to profile immediately on press
                    console.log('Button pressed for item:', item);
                    handleResultPress(item);
                  }}
                  activeOpacity={0.8}
                >
                  <View style={styles.resultCardContent}>
                    <View style={styles.resultTopRow}>
                      <Text style={styles.resultTitle}>{item.title || 'No Title'}</Text>
                    </View>
                    <View style={styles.resultBottomRow}>
                      <Text style={styles.resultSubtitle}>{item.subtitle || 'No Subtitle'}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
            
            {/* Load Legislation Button */}
            {shouldShowLoadLegislationButton() && (
              <TouchableOpacity
                onPressIn={() => {
                  try {
                    // Consistent haptic feedback
                    Haptics.selectionAsync();
                    // Consistent bounce animation
                    Animated.spring(loadLegislationScale, {
                      toValue: 0.95,
                      friction: 6,
                      tension: 100,
                      useNativeDriver: true,
                    }).start();
                  } catch (error) {
                    console.error('Error in Load Legislation onPressIn:', error);
                  }
                }}
                onPressOut={() => {
                  try {
                    // Smooth return animation
                    Animated.spring(loadLegislationScale, {
                      toValue: 1,
                      friction: 8,
                      tension: 100,
                      useNativeDriver: true,
                    }).start();
                  } catch (error) {
                    console.error('Error in Load Legislation onPressOut:', error);
                  }
                }}
                onPress={() => {
                  // Load more legislation immediately on press
                  console.log('Load Legislation button pressed');
                  loadMoreLegislation();
                }}
                activeOpacity={0.8}
                style={[
                  styles.loadLegislationButton,
                  { transform: [{ scale: loadLegislationScale }] }
                ]}
              >
                <Text style={styles.loadLegislationText}>
                  {isLoadingLegislation ? 'Loading...' : 'Load Legislation'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>
      
      <ProfileLoadingIndicator 
        visible={isProcessingProfile} 
        error={profileError}
        onCancel={handleCancelProfileLoading}
      />
    </View>
  );
}

const styles = StyleSheet.create({
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

  // MAIN
  container: { 
    flex: 1, 
    backgroundColor: '#000' 
  },
  content: {
    flex: 1,
    paddingTop: 100, // Leave space for header
    paddingHorizontal: 0,
  },

  // RESULTS COUNT
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

  // NO RESULTS
  noResultsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
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

  // RESULTS LIST
  resultsContainer: {
    width: '100%',
    alignItems: 'center',
    paddingBottom: 20,
  },
  resultCard: {
    backgroundColor: '#050505',
    borderRadius: 22,
    padding: 20,
    marginBottom: 10,
    width: '95%',
    height: 80,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    borderWidth: 1,
    borderColor: '#101010',
  },
  resultCardContent: {
    width: '100%',
    paddingHorizontal: 0,
  },
  resultTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    width: '100%',
    marginBottom: 4,
  },
  resultBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    width: '100%',
  },
  resultTitle: {
    color: '#fff',
    fontWeight: '400',
    fontSize: 20,
    flex: 1,
  },
  resultSubtitle: {
    color: '#898989',
    fontWeight: '400',
    fontSize: 12,
  },

  // Load Legislation Button (identical to sub5.tsx Load More button)
  loadLegislationButton: {
    backgroundColor: '#050505',
    borderRadius: 25,
    padding: 0,
    marginTop: 0,
    width: '90%',
    height: 70,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadLegislationText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '400',
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  errorText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '500',
    textAlign: 'center',
  },
});


