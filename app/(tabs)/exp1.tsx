import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Animated, Image, Keyboard, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableWithoutFeedback, View } from 'react-native';
import { useAuth } from '../../components/AuthProvider';
import { CardLoadingIndicator } from '../../components/CardLoadingIndicator';
import { ProfileLoadingIndicator } from '../../components/ProfileLoadingIndicator';
import { NavigationService } from '../../services/navigationService';
import { getConstrainedWidth } from '../../utils/constrainedDimensions';
import { getSupabaseClient } from '../../utils/supabase';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const exp1 = React.memo(() => {
  const router = useRouter();
  const params = useLocalSearchParams();
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

  // State for Update Legislation button
  const [isUpdatingLegislation, setIsUpdatingLegislation] = useState(false);

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
  const [category2Label, setCategory2Label] = useState('Bill Status');
  const [category3Label, setCategory3Label] = useState('Political Party');
  const [category4Label, setCategory4Label] = useState('Political Position');
  const [policyAreaLabel, setPolicyAreaLabel] = useState('Policy Category');
  const [subjectFilter, setSubjectFilter] = useState<string | null>(null);

  // Handle route params from subjects page and AsyncStorage
  useFocusEffect(
    useCallback(() => {
      // Check route params first
      if (params.subject && typeof params.subject === 'string') {
        // Truncate the subject name smartly for display
        const truncated = truncateTextSmartly(params.subject, 30);
        setPolicyAreaLabel(truncated);
      }
      if (params.subjectFilter && typeof params.subjectFilter === 'string') {
        setSubjectFilter(params.subjectFilter);
        // Auto-set Profile Type to Legislation when subject filter is applied
        setCategory1Label('Legislation');
      }
      
      // Also check AsyncStorage for subject selection from back navigation
      const checkAsyncStorage = async () => {
        try {
          const storedSubject = await AsyncStorage.getItem('selectedSubject');
          const storedFilter = await AsyncStorage.getItem('selectedSubjectFilter');
          
          if (storedSubject) {
            const truncated = truncateTextSmartly(storedSubject, 30);
            setPolicyAreaLabel(truncated);
            await AsyncStorage.removeItem('selectedSubject');
          }
          if (storedFilter) {
            setSubjectFilter(storedFilter);
            // Auto-set Profile Type to Legislation when subject filter is applied
            setCategory1Label('Legislation');
            await AsyncStorage.removeItem('selectedSubjectFilter');
          }
        } catch (error) {
          console.error('Error reading AsyncStorage:', error);
        }
      };
      
      checkAsyncStorage();
    }, [params.subject, params.subjectFilter, truncateTextSmartly])
  );

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
  const category2Labels = ['Bill Status', 'Passed', 'Processing'];
  const category3Labels = ['Political Party', 'Democrat', 'Republican', 'Independent', 'Other'];
  const category4Labels = ['Political Position', 'President', 'Vice President', 'Cabinet', 'Senator', 'Representative', 'Governor', 'Mayor', 'Candidate'];

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
    
    // Auto-set Profile Type to Legislation when Bill Status is changed
    if (category2Labels[nextIndex] !== 'Bill Status') {
      setCategory1Label('Legislation');
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


  // Reset all filter buttons to their default values
  const resetFilters = useCallback(() => {
    setCategory1Label('Profile Type');
    setCategory2Label('Bill Status');
    setCategory3Label('Political Party');
    setCategory4Label('Political Position');
    setPolicyAreaLabel('Policy Category');
    setSubjectFilter(null);
  }, []);

  // Helper function to truncate text smartly based on word boundaries
  const truncateTextSmartly = useCallback((text: string, maxChars: number = 30): string => {
    if (text.length <= maxChars) return text;
    
    // Try to break at word boundaries first
    const words = text.split(' ');
    let truncated = '';
    for (const word of words) {
      const testText = truncated ? `${truncated} ${word}` : word;
      if (testText.length <= maxChars - 3) { // Reserve 3 chars for "..."
        truncated = testText;
      } else {
        break;
      }
    }
    // If we have a truncated version, use it, otherwise just cut at maxChars-3 chars
    return truncated ? `${truncated}...` : `${text.substring(0, maxChars - 3)}...`;
  }, []);

  // Handle search profiles with filters only (no search query)
  const handleSearchProfiles = useCallback(async () => {
    // Add re-entrancy guard to prevent double submission
    if (isSearchingRef.current) return;
    
    const q = ''; // Always use empty query for Search Profiles

    isSearchingRef.current = true;
    if (isMountedRef.current) setIsSearchLoading(true);
    
    try {
      // Use lazy-loaded Supabase client
      const supabase = getSupabaseClient();
      
      // Determine which tables to query based on Profile Type filter
      const shouldQueryPpl = category1Label === 'Politician' || category1Label === 'Both' || category1Label === 'Profile Type';
      const shouldQueryLegi = category1Label === 'Legislation' || category1Label === 'Both' || category1Label === 'Profile Type';
      
      // Build politician query with filters
      let politicianResults: any[] = [];
      
      if (shouldQueryPpl) {
        let pplQuery = supabase
          .from('ppl_index')
          .select('id, name, sub_name, limit_score, party_type, office_type');

        // Apply party filter if selected
        if (category3Label !== 'Political Party') {
          let partyValue = '';
          switch (category3Label) {
            case 'Democrat': partyValue = 'D'; break;
            case 'Republican': partyValue = 'R'; break;
            case 'Independent': partyValue = 'I'; break;
            case 'Other': partyValue = 'other'; break;
          }
          if (partyValue) {
            pplQuery = pplQuery.eq('party_type', partyValue);
          }
        }

        // Apply position filter if selected
        if (category4Label !== 'Political Position') {
          let officeTypeValue = '';
          switch (category4Label) {
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

        pplQuery = pplQuery.order('limit_score', { ascending: false });

        const { data: pplData, error: pplError } = await pplQuery;
        if (pplError) throw pplError;

        // Transform politician results to match the expected format
        politicianResults = (pplData || []).map((item: any) => ({
          id: item.id,
          title: item.name,
          subtitle: item.sub_name,
          type: 'politician' as const,
          limit_score: item.limit_score || 0
        }));
      }

      // Build legislation query with filters
      let legislationResults: any[] = [];
      
      if (shouldQueryLegi) {
        let legiQueryWithFilters = supabase
          .from('legi_index')
          .select('id, name, sub_name, congress, bill_status, subject');
        
        // Apply subject filter if selected
        if (subjectFilter) {
          legiQueryWithFilters = legiQueryWithFilters.ilike('subject', `%${subjectFilter}%`);
        }

        // Apply bill status filter if selected
        if (category2Label !== 'Bill Status') {
          let statusValue = '';
          switch (category2Label) {
            case 'Passed': statusValue = 'passed'; break;
            case 'Processing': statusValue = 'processing'; break;
          }
          if (statusValue) {
            legiQueryWithFilters = legiQueryWithFilters.eq('bill_status', statusValue);
          }
        }

        legiQueryWithFilters = legiQueryWithFilters.order('id', { ascending: true });

        const { data: legiData, error: legiError } = await legiQueryWithFilters;
        if (legiError) throw legiError;

        // Transform legislation results to match the expected format (without limit_score)
        legislationResults = (legiData || []).map((item: any) => ({
          id: item.id,
          title: item.name,
          subtitle: item.sub_name,
          type: 'legislation' as const,
          limit_score: 0 // Set to 0 since we're not using limit_score for legislation
        }));
      }

      // Combine both result sets
      const searchResults = [...politicianResults, ...legislationResults];

      // Build filter parameters based on changed categories (for displaying filter count)
      const filters = {
        profileType: category1Label !== 'Profile Type' ? category1Label : null,
        billStatus: category2Label !== 'Bill Status' ? category2Label : null,
        party: category3Label !== 'Political Party' ? category3Label : null,
        position: category4Label !== 'Political Position' ? category4Label : null,
        subject: subjectFilter || null,
      };

      // Navigate to results page with search results and filters
      router.push({
        pathname: '/results',
        params: {
          searchResults: JSON.stringify(searchResults),
          searchQuery: '',
          filters: JSON.stringify(filters)
        }
      });

      // Use Keyboard.dismiss() only, let system handle blur naturally
      Keyboard.dismiss();

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
  }, [router, category1Label, category2Label, category3Label, category4Label, subjectFilter]);

  // Handle search functionality
  const handleSearch = useCallback(async () => {
    // Add re-entrancy guard to prevent double submission
    if (isSearchingRef.current) return;
    
    const q = searchQuery.trim();
    // Allow empty search now - removed the early return

    isSearchingRef.current = true;
    if (isMountedRef.current) setIsSearchLoading(true);
    
    try {
      // Use lazy-loaded Supabase client
      const supabase = getSupabaseClient();
      
      // Determine which tables to query based on Profile Type filter
      const shouldQueryPpl = category1Label === 'Politician' || category1Label === 'Both' || category1Label === 'Profile Type';
      const shouldQueryLegi = category1Label === 'Legislation' || category1Label === 'Both' || category1Label === 'Profile Type';
      
      // Build politician query with filters
      let politicianResults: any[] = [];
      
      if (shouldQueryPpl) {
        let pplQuery = supabase
          .from('ppl_index')
          .select('id, name, sub_name, limit_score, party_type, office_type');
        
        // Only apply name filter if there's a search query
        if (q && q.length > 0) {
          pplQuery = pplQuery.or(`name.ilike.%${q}%,sub_name.ilike.%${q}%`);
        }


        // Apply party filter if selected
        if (category3Label !== 'Political Party') {
          let partyValue = '';
          switch (category3Label) {
            case 'Democrat': partyValue = 'D'; break;
            case 'Republican': partyValue = 'R'; break;
            case 'Independent': partyValue = 'I'; break;
            case 'Other': partyValue = 'other'; break;
          }
          if (partyValue) {
            pplQuery = pplQuery.eq('party_type', partyValue);
          }
        }

        // Apply position filter if selected
        if (category4Label !== 'Political Position') {
          let officeTypeValue = '';
          switch (category4Label) {
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

        pplQuery = pplQuery.order('limit_score', { ascending: false });

        const { data: pplData, error: pplError } = await pplQuery;
        if (pplError) throw pplError;

        // Transform politician results to match the expected format
        politicianResults = (pplData || []).map((item: any) => ({
          id: item.id,
          title: item.name,
          subtitle: item.sub_name,
          type: 'politician' as const,
          limit_score: item.limit_score || 0
        }));
      }

      // Build legislation query with filters
      let legislationResults: any[] = [];
      
      if (shouldQueryLegi) {
        let legiQueryWithFilters = supabase
          .from('legi_index')
          .select('id, name, sub_name, congress, bill_status, subject');
        
        // Only apply name filter if there's a search query
        if (q && q.length > 0) {
          legiQueryWithFilters = legiQueryWithFilters.or(`name.ilike.%${q}%,sub_name.ilike.%${q}%`);
        }

        // Apply subject filter if selected
        if (subjectFilter) {
          legiQueryWithFilters = legiQueryWithFilters.ilike('subject', `%${subjectFilter}%`);
        }

        // Apply bill status filter if selected
        if (category2Label !== 'Bill Status') {
          let statusValue = '';
          switch (category2Label) {
            case 'Passed': statusValue = 'passed'; break;
            case 'Processing': statusValue = 'processing'; break;
          }
          if (statusValue) {
            legiQueryWithFilters = legiQueryWithFilters.eq('bill_status', statusValue);
          }
        }

        legiQueryWithFilters = legiQueryWithFilters.order('id', { ascending: true });

        const { data: legiData, error: legiError } = await legiQueryWithFilters;
        if (legiError) throw legiError;

        // Transform legislation results to match the expected format (without limit_score)
        legislationResults = (legiData || []).map((item: any) => ({
          id: item.id,
          title: item.name,
          subtitle: item.sub_name,
          type: 'legislation' as const,
          limit_score: 0 // Set to 0 since we're not using limit_score for legislation
        }));
      }

      // Combine both result sets
      const searchResults = [...politicianResults, ...legislationResults];

      // Build filter parameters based on changed categories (for displaying filter count)
      const filters = {
        profileType: category1Label !== 'Profile Type' ? category1Label : null,
        billStatus: category2Label !== 'Bill Status' ? category2Label : null,
        party: category3Label !== 'Political Party' ? category3Label : null,
        position: category4Label !== 'Political Position' ? category4Label : null,
        subject: subjectFilter || null,
      };

      // Navigate to results page with search results and filters
      // Allow navigation even with empty search (filters-only search)
      router.push({
        pathname: '/results',
        params: {
          searchResults: JSON.stringify(searchResults),
          searchQuery: q || '',
          filters: JSON.stringify(filters)
        }
      });

      // Use Keyboard.dismiss() only, let system handle blur naturally
      Keyboard.dismiss();

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
  }, [searchQuery, router, category1Label, category2Label, category3Label, category4Label, subjectFilter]);

  // Handle Update Legislation button: manually trigger the Congress.gov legislation
  // update pipeline, subject to the same 7-day cooldown the weekly cron uses.
  const handleUpdateLegislation = useCallback(async () => {
    if (isUpdatingLegislation) return;

    setIsUpdatingLegislation(true);
    try {
      const { data, error } = await getSupabaseClient().functions.invoke('bill_update_trigger', {
        body: {}
      });

      if (error) {
        Alert.alert('Error', 'Failed to update legislation. Please try again later.', [{ text: 'OK' }]);
        return;
      }

      if (data?.blocked) {
        Alert.alert(
          'Update In Progress',
          'A legislation update is already running. Please wait for it to finish before starting another.',
          [{ text: 'OK' }]
        );
        return;
      }

      if (data?.ok) {
        router.push('/most-recent');
      } else {
        Alert.alert('Error', data?.error || 'Failed to update legislation. Please try again later.', [{ text: 'OK' }]);
      }
    } catch (error) {
      console.error('Error triggering legislation update:', error);
      Alert.alert('Error', 'Failed to update legislation. Please try again later.', [{ text: 'OK' }]);
    } finally {
      setIsUpdatingLegislation(false);
    }
  }, [isUpdatingLegislation, router]);

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
  
  // Determine which buttons should be disabled based on Category 1 and subject filter
  const isCategoryDisabled = useCallback((categoryNumber: number) => {
    if (categoryNumber === 1) return false; // Profile Type always enabled
    
    // If subject filter is applied, disable politician-related buttons
    if (subjectFilter) {
      return categoryNumber === 3 || categoryNumber === 4; // Disable politician-only (Political Party, Political Position)
    }
    
    switch (category1Label) {
      case 'Politician':
        return categoryNumber === 2; // Disable Bill Status (legislation-only)
      case 'Legislation':
        return categoryNumber === 3 || categoryNumber === 4; // Disable politician-only (Political Party, Political Position)
      default:
        return false; // Both or default - all enabled
    }
  }, [category1Label, subjectFilter]);

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
  const mostPopularButtonScale = useRef(new Animated.Value(1)).current;
  const mostRecentButtonScale = useRef(new Animated.Value(1)).current;
  const cardSearchButtonScale = useRef(new Animated.Value(1)).current;
  const recommendedCardsButtonScale = useRef(new Animated.Value(1)).current;
  const recommendedProfilesButtonScale = useRef(new Animated.Value(1)).current;
  const updateLegislationButtonScale = useRef(new Animated.Value(1)).current;
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
              placeholder="Search Profiles"
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
                onPress={() => {
                  Haptics.selectionAsync();
                  cycleCategory1();
                }}
                style={styles.searchGridButton1}
              >
                <Text style={styles.searchGridButtonText1}>{category1Label}</Text>
              </AnimatedPressable>
              <AnimatedPressable
                onPress={
                  isCategoryDisabled(2)
                    ? undefined
                    : () => {
                        Haptics.selectionAsync();
                        cycleCategory2();
                      }
                }
                style={[
                  styles.searchGridButton2,
                  isCategoryDisabled(2) && styles.searchGridButtonDisabled,
                ]}
              >
                <Text
                  style={[
                    styles.searchGridButtonText2,
                    isCategoryDisabled(2) && styles.searchGridButtonTextDisabled,
                  ]}
                >
                  {category2Label}
                </Text>
              </AnimatedPressable>
            </View>
            <View style={styles.searchGridRow}>
              <AnimatedPressable
                onPress={
                  isCategoryDisabled(3)
                    ? undefined
                    : () => {
                        Haptics.selectionAsync();
                        cycleCategory3();
                      }
                }
                style={[
                  styles.searchGridButton3,
                  isCategoryDisabled(3) && styles.searchGridButtonDisabled,
                ]}
              >
                <Text
                  style={[
                    styles.searchGridButtonText3,
                    isCategoryDisabled(3) && styles.searchGridButtonTextDisabled,
                  ]}
                >
                  {category3Label}
                </Text>
              </AnimatedPressable>
              <AnimatedPressable
                onPress={
                  isCategoryDisabled(4)
                    ? undefined
                    : () => {
                        Haptics.selectionAsync();
                        cycleCategory4();
                      }
                }
                style={[
                  styles.searchGridButton4,
                  isCategoryDisabled(4) && styles.searchGridButtonDisabled,
                ]}
              >
                <Text
                  style={[
                    styles.searchGridButtonText4,
                    isCategoryDisabled(4) && styles.searchGridButtonTextDisabled,
                  ]}
                >
                  {category4Label}
                </Text>
              </AnimatedPressable>
            </View>
            <View style={styles.searchGridRowFull}>
              <AnimatedPressable
                onPress={
                  category1Label === 'Politician'
                    ? undefined
                    : () => {
                        Haptics.selectionAsync();
                        router.push('/subjects');
                      }
                }
                style={[
                  styles.searchGridButtonFull,
                  category1Label === 'Politician' && styles.searchGridButtonDisabled,
                ]}
              >
                <Text
                  style={[
                    styles.searchGridButtonFullText,
                    category1Label === 'Politician' && styles.searchGridButtonTextDisabled,
                  ]}
                  numberOfLines={1}
                >
                  {policyAreaLabel}
                </Text>
              </AnimatedPressable>
            </View>
            <View style={styles.searchGridRowFull}>
              <AnimatedPressable
                onPress={() => {
                  Haptics.selectionAsync();
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
                  Haptics.selectionAsync();
                  handleSearchProfiles();
                }}
                style={styles.searchGridButtonFull}
              >
                <Text style={styles.searchGridButtonFullText}>Search Profiles</Text>
              </AnimatedPressable>
            </View>
          </View>

          {/* Most Popular Button */}
          <View style={styles.recommendedButtonsWrapper}>
            <Animated.View
              style={{
                transform: [{ scale: mostPopularButtonScale }],
                width: '100%',
                alignItems: 'center',
              }}
            >
              <Pressable
                onPressIn={() => {
                  Haptics.selectionAsync();
                  Animated.spring(mostPopularButtonScale, {
                    toValue: 0.95,
                    useNativeDriver: true,
                  }).start();
                }}
                onPressOut={() => {
                  Animated.spring(mostPopularButtonScale, {
                    toValue: 1,
                    useNativeDriver: true,
                  }).start();
                }}
                onPress={() => {
                  router.push('/mostPopular');
                }}
                style={styles.recommendedButton}
              >
                <View style={styles.recommendedButtonContent}>
                  <View style={styles.legislationTopRow}>
                    <Text style={styles.legislationTitleNew}>Most Popular</Text>
                  </View>
                  <View style={styles.legislationBottomRow}>
                    <Text style={styles.legislationSubtitleNew}>Check our most viewed profiles and cards</Text>
                  </View>
                </View>
              </Pressable>
            </Animated.View>

            {/* Most Recent Button */}
            <Animated.View
              style={{
                transform: [{ scale: mostRecentButtonScale }],
                width: '100%',
                alignItems: 'center',
              }}
            >
              <Pressable
                onPressIn={() => {
                  Haptics.selectionAsync();
                  Animated.spring(mostRecentButtonScale, {
                    toValue: 0.95,
                    useNativeDriver: true,
                  }).start();
                }}
                onPressOut={() => {
                  Animated.spring(mostRecentButtonScale, {
                    toValue: 1,
                    useNativeDriver: true,
                  }).start();
                }}
                onPress={() => {
                  router.push('/most-recent');
                }}
                style={styles.recommendedButton}
              >
                <View style={styles.recommendedButtonContent}>
                  <View style={styles.legislationTopRow}>
                    <Text style={styles.legislationTitleNew}>Most Recent</Text>
                  </View>
                  <View style={styles.legislationBottomRow}>
                    <Text style={styles.legislationSubtitleNew}>Access the most recently added profiles and cards</Text>
                  </View>
                </View>
              </Pressable>
            </Animated.View>

            {/* Card Search Button */}
            <Animated.View
              style={{
                transform: [{ scale: cardSearchButtonScale }],
                width: '100%',
                alignItems: 'center',
              }}
            >
              <Pressable
                onPressIn={() => {
                  Haptics.selectionAsync();
                  Animated.spring(cardSearchButtonScale, {
                    toValue: 0.95,
                    useNativeDriver: true,
                  }).start();
                }}
                onPressOut={() => {
                  Animated.spring(cardSearchButtonScale, {
                    toValue: 1,
                    useNativeDriver: true,
                  }).start();
                }}
                onPress={() => {
                  router.push('/card-search');
                }}
                style={styles.recommendedButton}
              >
                <View style={styles.recommendedButtonContent}>
                  <View style={styles.legislationTopRow}>
                    <Text style={styles.legislationTitleNew}>Card Search</Text>
                  </View>
                  <View style={styles.legislationBottomRow}>
                    <Text style={styles.legislationSubtitleNew}>Find specific cards across various profiles</Text>
                  </View>
                </View>
              </Pressable>
            </Animated.View>

            {/* Recommended Cards Button */}
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

            {/* Update Legislation Button */}
            <Animated.View
              style={{
                transform: [{ scale: updateLegislationButtonScale }],
                width: '100%',
                alignItems: 'center',
              }}
            >
              <Pressable
                onPressIn={() => {
                  Haptics.selectionAsync();
                  Animated.spring(updateLegislationButtonScale, {
                    toValue: 0.95,
                    useNativeDriver: true,
                  }).start();
                }}
                onPressOut={() => {
                  Animated.spring(updateLegislationButtonScale, {
                    toValue: 1,
                    useNativeDriver: true,
                  }).start();
                }}
                onPress={handleUpdateLegislation}
                disabled={isUpdatingLegislation}
                style={styles.recommendedButton}
              >
                <View style={styles.recommendedButtonContent}>
                  <View style={styles.legislationTopRow}>
                    <Text style={styles.legislationTitleNew}>Update Legislation</Text>
                  </View>
                  <View style={styles.legislationBottomRow}>
                    <Text style={styles.legislationSubtitleNew}>Create new legislation profiles for trending bills on Congress.gov</Text>
                  </View>
                </View>
              </Pressable>
            </Animated.View>
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

      <CardLoadingIndicator
        visible={isUpdatingLegislation}
        title="Updating Legislation"
        subtitle="Please keep the app open while we check Congress.gov for new legislation..."
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
    width: getConstrainedWidth() * 0.295,
    alignItems: 'center',
  },
  politicianCard: {
    width: getConstrainedWidth() * 0.295,
    height: getConstrainedWidth() * 0.5,
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
    marginTop: 10,
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
    height: 320,
    marginTop: 0,
    marginBottom: 0,
    paddingTop: 15,
    paddingBottom: 10,
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
    borderColor: '#101010',
    borderWidth: 1,
    height: 50,
    width: '44.5%',
    marginLeft: '4%',
    marginHorizontal: 0,
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
    marginRight: '4%',
    marginHorizontal: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchGridButton3: {
    backgroundColor: '#090909',
    borderRadius: 15,
    borderColor: '#101010',
    borderWidth: 1,
    height: 50,
    width: '44.5%',
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
    width: '44.5%',
    marginRight: '4%',
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

});
