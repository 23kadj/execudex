// AsyncStorage is lazy-loaded to prevent crashes in preview/release builds
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Animated, Image, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Sentry from '@sentry/react-native';
import { CardGenerationService } from '../../services/cardGenerationService';
import { PoliticianProfileService } from '../../services/politicianProfileService';
import { CardData } from '../../utils/cardData';
import { getSupabaseClient } from '../../utils/supabase';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const STAR_COUNT = 5;

// #region agent log - crash isolation: disable haptics
// Apple crash logs show turbomodule exception conversion + hapticd involvement; isolate by disabling haptics.
const __DISABLE_HAPTICS_FOR_CRASH_TEST = true;
if (__DISABLE_HAPTICS_FOR_CRASH_TEST) {
  try {
    // Avoid calling into the Haptics TurboModule at all.
    (Haptics as any).selectionAsync = async () => {};
    (Haptics as any).impactAsync = async () => {};
    (Haptics as any).notificationAsync = async () => {};
    Sentry.addBreadcrumb({ category: 'crash-test', message: 'Haptics disabled in synop', level: 'info' });
  } catch {}
}
// #endregion
interface SynopProps {
  scrollY: Animated.Value;
  goToTab: (idx: number) => void;
  name: string;
  position: string;
  submittedStars?: number;
  approvalPercentage?: number;
  disapprovalPercentage?: number;
  profileData?: any;
  index?: string;
  scrollRef?: React.RefObject<ScrollView>;
  refetchLockStatus?: () => Promise<void>;
  triggerCardRefresh?: () => void;
}

export default function Synop({ scrollY, goToTab, name, position, submittedStars = 0, approvalPercentage = 50, disapprovalPercentage = 50, profileData, index, scrollRef, refetchLockStatus, triggerCardRefresh }: SynopProps) {
  const router = useRouter();
  const params = useLocalSearchParams();
  
  // Log entry to metrics page (crash point)
  useEffect(() => {
    console.log('[Synop] Entering metrics page', {
      screen: 'synop',
      profileId: index,
      name: name?.substring(0, 20)
    });
  }, [index, name]);
  
  // Debug logging for profileData prop
  useEffect(() => {
    console.log('Synop component received profileData:', profileData);
    console.log('profileData.score:', profileData?.score);
  }, [profileData]);
  
  // State to track which stars are filled (1-based indexing) - now based on submitted count
  const [filledStars, setFilledStars] = useState(submittedStars);
  
  // Local state for approval/disapproval data
  const [localApproval, setLocalApproval] = useState(Number(approvalPercentage ?? 0));
  const [localDisapproval, setLocalDisapproval] = useState(Number(disapprovalPercentage ?? 0));
  
  // State for votes data from ppl_profiles
  const [votes, setVotes] = useState<number | null>(null);
  
  // State for average score from ppl_profiles
  const [averageScore, setAverageScore] = useState<number | null>(null);

  // State for poll summary and link (for see-more page)
  const [pollSummary, setPollSummary] = useState<string>('');
  const [pollLink, setPollLink] = useState<string>('');

  // State for Generate New Cards button
  const [isGeneratingCards, setIsGeneratingCards] = useState(false);
  const [showGenerateButton, setShowGenerateButton] = useState(false);
  const generateButtonScale = useRef(new Animated.Value(1)).current;

  // State for Generate Metrics button
  const [isGeneratingMetrics, setIsGeneratingMetrics] = useState(false);
  const [showGenerateMetricsButton, setShowGenerateMetricsButton] = useState(false);
  const generateMetricsButtonScale = useRef(new Animated.Value(1)).current;

  // State for generated cards display
  const [generatedCards, setGeneratedCards] = useState<CardData[]>([]);
  
  // Animated scales for cards
  const card1Scale = useRef(new Animated.Value(1)).current;
  const card2Scale = useRef(new Animated.Value(1)).current;
  const card3Scale = useRef(new Animated.Value(1)).current;
  const card4Scale = useRef(new Animated.Value(1)).current;
  const card5Scale = useRef(new Animated.Value(1)).current;
  const card6Scale = useRef(new Animated.Value(1)).current;
  const card7Scale = useRef(new Animated.Value(1)).current;
  const card8Scale = useRef(new Animated.Value(1)).current;

  // Debug logging for averageScore changes
  useEffect(() => {
    console.log('averageScore state changed to:', averageScore);
  }, [averageScore]);

  // Set poll data from profileData prop if available
  useEffect(() => {
    if (profileData) {
      // Set poll summary and link from prop
      if (profileData.poll_summary) {
        setPollSummary(profileData.poll_summary);
      }
      if (profileData.poll_link) {
        setPollLink(profileData.poll_link);
      }
    }
  }, [profileData]);

  // Fetch approval/disapproval data from ppl_profiles when component mounts
  useEffect(() => {
    const fetchProfileData = async () => {
      if (index) {
        try {
          console.log('Fetching profile data for index:', index);
          
          const supabase = getSupabaseClient();
          const { data: profileData, error } = await supabase
            .from('ppl_profiles')
            .select('approval, disapproval, votes, poll_summary, poll_link')
            .eq('index_id', parseInt(index))
            .maybeSingle();
          
          if (error) {
            console.error('Error fetching profile data:', error);
            // Keep the fallback values
            return;
          }
          
          if (profileData) {
            console.log('Successfully fetched profile data:', profileData);
            
            // Update local state with fetched data
            if (profileData.approval !== null && profileData.disapproval !== null) {
              setLocalApproval(Number(profileData.approval));
              setLocalDisapproval(Number(profileData.disapproval));
            }
            
            // Set votes data if available
            if (profileData.votes !== null && profileData.votes !== undefined) {
              setVotes(Number(profileData.votes));
            }

            // Set poll summary and link if available
            if (profileData.poll_summary) {
              setPollSummary(profileData.poll_summary);
            }
            if (profileData.poll_link) {
              setPollLink(profileData.poll_link);
            }
          }
        } catch (err) {
          console.error('Error in fetchProfileData:', err);
        }
      }
    };

    fetchProfileData();
  }, [index]);

  // Fetch and calculate average score from ppl_scores table when component mounts
  useEffect(() => {
    const fetchAverageScore = async () => {
      if (index) {
        try {
          console.log('Fetching scores from ppl_scores for index:', index);
          
          const supabase = getSupabaseClient();
          const { data: scores, error } = await supabase
            .from('ppl_scores')
            .select('score')
            .eq('index_id', parseInt(index));
          
          if (error) {
            console.error('Error fetching scores:', error);
            return;
          }
          
          if (scores && scores.length > 0) {
            // Calculate average of all scores
            const sum = scores.reduce((acc, curr) => acc + (curr.score || 0), 0);
            const average = sum / scores.length;
            console.log(`Calculated average score: ${average} from ${scores.length} scores`);
            setAverageScore(average);
          } else {
            console.log('No scores found in ppl_scores for this politician');
            setAverageScore(null);
          }
        } catch (err) {
          console.error('Error in fetchAverageScore:', err);
        }
      }
    };

    fetchAverageScore();
  }, [index]);

  // Check if Generate New Cards button should be shown
  useEffect(() => {
    const checkGenerateButtonVisibility = async () => {
      if (index) {
        try {
          // Use new button visibility function that checks weak status and card count
          const shouldShow = await CardGenerationService.shouldShowGenerateButtonForSynopsis(parseInt(index));
          setShowGenerateButton(shouldShow);
        } catch (error) {
          console.error('Error checking generate button visibility:', error);
          setShowGenerateButton(false);
        }
      }
    };

    checkGenerateButtonVisibility();
  }, [index]);

  // Check if Generate Metrics button should be shown
  useEffect(() => {
    const checkMetricsButtonVisibility = async () => {
      if (index) {
        try {
          // Fetch current metrics data
          const supabase = getSupabaseClient();
          const { data: profileData } = await supabase
            .from('ppl_profiles')
            .select('approval, disapproval, votes')
            .eq('index_id', parseInt(index))
            .maybeSingle();
          
          // Show button if ALL three metrics are null/undefined/0
          const hasNoMetrics = 
            (!profileData?.approval || profileData?.approval === 0) &&
            (!profileData?.disapproval || profileData?.disapproval === 0) &&
            (!profileData?.votes || profileData?.votes === 0);
          
          setShowGenerateMetricsButton(hasNoMetrics);
        } catch (error) {
          console.error('Error checking metrics button visibility:', error);
          setShowGenerateMetricsButton(false);
        }
      }
    };

    checkMetricsButtonVisibility();
  }, [index, localApproval, localDisapproval, votes]);

  // Update filled stars when submittedStars prop changes
  useEffect(() => {
    setFilledStars(submittedStars);
  }, [submittedStars]);

  // Check for submitted stars when the screen comes into focus (when returning from rankings)
  useFocusEffect(
    useCallback(() => {
      // Check if we have submitted stars in the navigation state
      const checkSubmittedStars = () => {
        if (params.currentSubmittedStars) {
          const newSubmittedStars = parseInt(params.currentSubmittedStars as string);
          setFilledStars(newSubmittedStars);
        }
      };
      
      // Load stored stars from AsyncStorage
      const loadStoredStars = async () => {
        try {
          // Lazy-load AsyncStorage
          const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
          const storedStars = await AsyncStorage.getItem('submittedStars');
          if (storedStars) {
            setFilledStars(parseInt(storedStars));
          }
        } catch (e) {
          console.error('Failed to load stars from storage:', e);
        }
      };

      // Refetch average score from ppl_scores when returning to page
      const refetchAverageScore = async () => {
        if (index) {
          try {
            const supabase = getSupabaseClient();
            const { data: scores, error } = await supabase
              .from('ppl_scores')
              .select('score')
              .eq('index_id', parseInt(index));
            
            if (!error && scores && scores.length > 0) {
              const sum = scores.reduce((acc, curr) => acc + (curr.score || 0), 0);
              const average = sum / scores.length;
              console.log(`Refetched average score: ${average} from ${scores.length} scores`);
              setAverageScore(average);
            }
          } catch (err) {
            console.error('Error refetching average score:', err);
          }
        }
      };
      
      // Check immediately
      checkSubmittedStars();
      loadStoredStars();
      refetchAverageScore();
      
      // Also check after a short delay to ensure navigation state is updated
      const timer = setTimeout(() => {
        checkSubmittedStars();
        loadStoredStars();
        refetchAverageScore();
      }, 200);
      
      return () => clearTimeout(timer);
    }, [params.currentSubmittedStars, params.currentSubmittedRanking, index])
  );

  // Function to check if poll/vote data is valid
  const hasValidPollData = () => {
    // Check if values are not null/undefined, not empty, and not the default fallback value of 50
    const hasValidApproval = localApproval !== null && localApproval !== undefined && localApproval !== 50 && localApproval !== 0;
    const hasValidDisapproval = localDisapproval !== null && localDisapproval !== undefined && localDisapproval !== 50 && localDisapproval !== 0;
    const hasValidVotes = votes !== null && votes !== undefined && votes !== 0;
    
    // Return true if at least one value exists
    return hasValidApproval || hasValidDisapproval || hasValidVotes;
  };

  // Function to check if we should show votes-only mode (when approval/disapproval are missing but votes exist)
  const isVotesOnlyMode = () => {
    const hasValidApproval = localApproval !== null && localApproval !== undefined && localApproval !== 50 && localApproval !== 0;
    const hasValidDisapproval = localDisapproval !== null && localDisapproval !== undefined && localDisapproval !== 50 && localDisapproval !== 0;
    const hasValidVotes = votes !== null && votes !== undefined && votes !== 0;
    
    // Show votes-only mode when votes exist but approval/disapproval don't
    return hasValidVotes && !hasValidApproval && !hasValidDisapproval;
  };

  // Handler for haptic feedback
  const handleHaptic = () => {
    Haptics.selectionAsync();
  };

  // Handler for see more button
  const handleSeeMore = () => {
    Sentry.addBreadcrumb({ category: 'nav', message: 'Synop -> see-more (tap)', level: 'info' });
    router.push({
      pathname: '/profile/see-more',
      params: { 
        id: index || '', // Add politician ID
        name: name,
        position: position,
        approval: Number(localApproval ?? 0).toString(),
        disapproval: Number(localDisapproval ?? 0).toString(),
        votes: Number(votes ?? 0).toString(),
        pollSummary: pollSummary || '',
        pollLink: pollLink || ''
      }
    });
  };

  // Handler for star press - only navigate to rankings, don't fill stars
  const handleStarPress = (starIndex: number) => {
    Sentry.addBreadcrumb({ category: 'nav', message: 'Synop -> rankings (star tap)', level: 'info' });
    // Navigate to rankings page with current filled stars count and original params
    router.push({
      pathname: '/profile/rankings',
      params: { 
        currentStars: filledStars.toString(),
        originalTitle: name,
        originalPosition: position,
        currentSubmittedRanking: params.currentSubmittedRanking || 'No Data',
        index: index
      }
    });
    // Set the current stars in navigation state for when we return
    router.setParams({ currentSubmittedStars: filledStars.toString() });
  };

  // Handler for see rankings button
  const handleSeeRankings = () => {
    Sentry.addBreadcrumb({ category: 'nav', message: 'Synop -> rankings (button tap)', level: 'info' });
    router.push({
      pathname: '/profile/rankings',
      params: { 
        currentStars: filledStars.toString(),
        originalTitle: name,
        originalPosition: position,
        currentSubmittedRanking: params.currentSubmittedRanking || 'No Data',
        index: index
      }
    });
    // Set the current stars in navigation state for when we return
    router.setParams({ currentSubmittedStars: filledStars.toString() });
  };

  // Handler for Generate New Cards button
  const handleGenerateCards = async () => {
    if (!index || isGeneratingCards) return;
    
    setIsGeneratingCards(true);
    
    // Haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    // Scale animation
    Animated.sequence([
      Animated.timing(generateButtonScale, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(generateButtonScale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
    
    try {
      // Execute card generation (checks existing content, runs ppl_round2 if needed, then ppl_card_gen)
      const result = await CardGenerationService.generatePoliticianCards(parseInt(index), 'sub1') as any;
      
      if (result.success) {
        // Check the JSON response to count generated cards
        const cardsGenerated = result.data?.inserted || 0;
        
        console.log(`Generated ${cardsGenerated} cards for politician ${index}`);
        
        if (cardsGenerated > 8) {
          // More than 8 cards - unlock profile and make all pages accessible
          await CardGenerationService.unlockPoliticianProfile(parseInt(index));
          
          // Hide the button after successful generation
          setShowGenerateButton(false);
          
          // Refetch the profile lock status to update UI (show tab bar, unlock other pages)
          if (refetchLockStatus) {
            await refetchLockStatus();
          }
          
          // Trigger card refresh for sub1, sub2, sub3 pages
          if (triggerCardRefresh) {
            triggerCardRefresh();
          }
          
          // Show success alert
          Alert.alert(
            'Success',
            `Generated ${cardsGenerated} card${cardsGenerated !== 1 ? 's' : ''} successfully!`,
            [{ text: 'OK' }]
          );
        } else {
          // 8 or fewer cards - keep profile locked
          // Mark as weak if not already marked
          await CardGenerationService.markPoliticianAsWeak(parseInt(index));
          
          // Fetch the generated cards to display them
          try {
            const supabase = getSupabaseClient();
            const { data: cards, error } = await supabase
              .from('card_index')
              .select('id, title, subtext, category, screen, opens_7d, score')
              .eq('owner_id', parseInt(index))
              .eq('is_ppl', true)
              .order('created_at', { ascending: false })
              .limit(cardsGenerated);
            
            if (!error && cards && cards.length > 0) {
              setGeneratedCards(cards as CardData[]);
            }
          } catch (error) {
            console.error('Error fetching generated cards:', error);
          }
          
          // Trigger card refresh for sub1, sub2, sub3 pages (even if locked)
          if (triggerCardRefresh) {
            triggerCardRefresh();
          }
          
          // Show popup for insufficient cards
          Alert.alert(
            'Insufficient Information',
            `Generated ${cardsGenerated} card${cardsGenerated !== 1 ? 's' : ''}. There is not enough information available to generate a full profile, but you can view the cards below.`,
            [{ text: 'OK' }]
          );
          
          // Hide the button after popup
          setShowGenerateButton(false);
        }
      } else {
        // Card generation failed
        console.error('Card generation failed:', result.message);
        Alert.alert(
          'Error',
          result.message || 'Failed to generate cards. Please try again.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error generating cards:', error);
      Alert.alert(
        'Error',
        'An error occurred while generating cards. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsGeneratingCards(false);
    }
  };

  // Handler for Generate Metrics button
  const handleGenerateMetrics = async () => {
    if (!index || isGeneratingMetrics) return;
    
    setIsGeneratingMetrics(true);
    
    // Haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    // Scale animation
    Animated.sequence([
      Animated.timing(generateMetricsButtonScale, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(generateMetricsButtonScale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
    
    try {
      // Call the metrics generation service
      const result = await PoliticianProfileService.generateMetricsManually(
        parseInt(index)
      );
      
      if (result.success) {
        // Success - refetch profile data to update UI
        // Re-run the fetchProfileData logic - NOW INCLUDING poll_summary and poll_link
        const supabase = getSupabaseClient();
        const { data: profileData, error } = await supabase
          .from('ppl_profiles')
          .select('approval, disapproval, votes, poll_summary, poll_link')
          .eq('index_id', parseInt(index))
          .maybeSingle();

        if (profileData && !error) {
          // Update state with new metrics
          setLocalApproval(Number(profileData.approval ?? 0));
          setLocalDisapproval(Number(profileData.disapproval ?? 0));
          setVotes(profileData.votes);
          
          // Update poll summary and link for see-more page
          if (profileData.poll_summary) {
            setPollSummary(profileData.poll_summary);
          }
          if (profileData.poll_link) {
            setPollLink(profileData.poll_link);
          }
          
          console.log('Metrics updated successfully:', {
            approval: profileData.approval,
            disapproval: profileData.disapproval,
            votes: profileData.votes,
            poll_summary: profileData.poll_summary,
            poll_link: profileData.poll_link
          });
        }
        
        // Hide the button since metrics now exist
        setShowGenerateMetricsButton(false);
        
        // Show success message
        Alert.alert('Success', 'Metrics generated successfully');
      } else {
        // Failed or No Data
        Alert.alert(
          'No Data Available',
          result.message || 'Unable to find polling data for this politician.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error generating metrics:', error);
      Alert.alert(
        'Error',
        'An error occurred while generating metrics. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsGeneratingMetrics(false);
    }
  };

  // Render generated cards
  const renderCards = () => {
    if (!generatedCards || generatedCards.length === 0) {
      return null;
    }

    const cards = [];
    const cardScales = [card1Scale, card2Scale, card3Scale, card4Scale, card5Scale, card6Scale, card7Scale, card8Scale];
    
    for (let i = 0; i < Math.min(8, generatedCards.length); i++) {
      const cardNumber = i + 1;
      const cardScale = cardScales[i];
      const cardItem = generatedCards[i];
      
      cards.push(
        <AnimatedPressable
          key={`synop-card-${cardNumber}`}
          onPressIn={() => {
            Haptics.selectionAsync();
            Animated.spring(cardScale, {
              toValue: 0.95,
              friction: 6,
              useNativeDriver: true,
            }).start();
          }}
          onPressOut={() => {
            Animated.spring(cardScale, {
              toValue: 1,
              friction: 6,
              useNativeDriver: true,
            }).start();
          }}
          onPress={() => {
            // Navigate to card detail view
            router.push({
              pathname: '/profile/sub5',
              params: { 
                cardTitle: cardItem.title || `Card ${cardNumber}`,
                profileName: name,
                sourcePage: 'synop',
                pageCount: String(1),
                cardId: String(cardItem.id)
              }
            });
          }}
          style={[
            styles.generatedCard,
            { transform: [{ scale: cardScale }] }
          ]}
        >
          <View style={styles.generatedCardTitleRow}>
            <Text style={styles.generatedCardTitle}>
              {cardItem.title || `Card ${cardNumber} Title`}
            </Text>
          </View>
          <Text style={styles.generatedCardSubtext}>
            {cardItem.subtext || `Card ${cardNumber} subtitle text`}
          </Text>
        </AnimatedPressable>
      );
    }
    
    return <View style={styles.generatedCardsContainer}>{cards}</View>;
  };

  // Function to render star based on average score
  const renderStar = (starIndex: number) => {
    if (!averageScore) {
      // No score data, show empty star
      return require('../../assets/star.png');
    }
    
    const roundedScore = Math.round(averageScore * 2) / 2; // Round to nearest 0.5
    const starPosition = starIndex + 1; // Convert to 1-based indexing
    
    if (roundedScore >= starPosition) {
      // Full star
      return require('../../assets/star1.png');
    } else if (roundedScore >= starPosition - 0.5) {
      // Half star
      return require('../../assets/lefthalf.png');
    } else {
      // Empty star
      return require('../../assets/star.png');
    }
  };

  return (
    <Animated.ScrollView
      ref={scrollRef}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
      scrollEventThrottle={16}
      onScroll={Animated.event(
        [{ nativeEvent: { contentOffset: { y: scrollY } } }],
        { useNativeDriver: false }
      )}
    >
      {/* Profile Header Container */}
      <View style={styles.profileHeaderContainer}>
        {/* Left Column - 75% width */}
        <View style={styles.leftColumn}>
          <Text style={styles.nameText}>{name}</Text>
          <Text style={styles.subtitleText}>{position}</Text>
          <View style={styles.numbersRowWrap}>
            <View style={[styles.numbersRow, { opacity: hasValidPollData() ? 1 : 0 }]}>
              {/* Red arrow and disapproval - only show when NOT in votes-only mode */}
              {!isVotesOnlyMode() && (
                <>
                  <Image 
                    source={require('../../assets/redDown.png')} 
                    style={styles.arrowIcon} 
                  />
                  <Text style={styles.redNum}>
                    {Number(localDisapproval ?? 0).toFixed(1)}%
                  </Text>
                </>
              )}
              
              {/* Green arrow and approval/votes */}
              <Image 
                source={require('../../assets/greenUp.png')} 
                style={styles.arrowIcon} 
              />
              <Text style={styles.greenNum}>
                {isVotesOnlyMode() ? `${votes?.toLocaleString()}` : `${Number(localApproval ?? 0).toFixed(1)}%`}
              </Text>
              
              {/* See more button - only show when there's valid data */}
              {hasValidPollData() && (
                <TouchableOpacity 
                  activeOpacity={0.7} 
                  onPress={handleSeeMore} 
                  style={styles.seeMoreBtn}
                >
                  <Text style={styles.seeMoreText}>See Metrics</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {/* Right Column - 25% width */}
        <View style={styles.rightColumn}>
          <Text style={styles.popularityTitle} numberOfLines={1} ellipsizeMode="tail">Popularity Score</Text>
          <View style={styles.starsRow}>
            {[...Array(STAR_COUNT)].map((_, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => handleStarPress(i)}
                activeOpacity={0.7}
                hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
              >
                <Image 
                  source={renderStar(i)} 
                  style={styles.starIcon} 
                />
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity activeOpacity={0.7} onPress={handleSeeRankings} style={styles.seeRankingsBtn}>
            <Text style={styles.seeRankingsText}>See Scoring</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Synopsis Box */}
      <View style={styles.boxRow}>
        <View style={[styles.synopsisBox, { flex: 1, marginBottom: 0 }]}> 
          <Text style={styles.boxTitle}>Synopsis</Text>
          <Text style={styles.boxContent}>{profileData?.synopsis || 'No Data Available'}</Text>
        </View>
      </View>

      {/* Agenda Overview Box */}
      <View style={styles.boxRow}>
        <View style={[styles.agendaBox, { flex: 1, marginBottom: 0 }]}> 
          <Text style={styles.boxTitle}>Agenda Overview</Text>
          <Text style={styles.boxContent}>{profileData?.agenda || 'No Data Available'}</Text>
        </View>
      </View>

      {/* Personal & Political History Box */}
      <View style={styles.boxRow}>
        <View style={[styles.historyBox, { flex: 1, marginBottom: 0 }]}> 
          <Text style={styles.boxTitle}>Personal & Political History</Text>
          <Text style={styles.boxContent}>{profileData?.identity || 'No Data Available'}</Text>
        </View>
      </View>

      {/* Affiliates Box */}
      <View style={styles.boxRow}>
        <View style={[styles.affiliatesBox, { flex: 1, marginBottom: 0 }]}> 
          <Text style={styles.boxTitle}>Affiliates</Text>
          <Text style={styles.boxContent}>{profileData?.affiliates || 'No Data Available'}</Text>
        </View>
      </View>

      {/* Generate New Cards Button */}
      {showGenerateButton && (
        <View style={styles.generateButtonContainer}>
          <Animated.View style={{ transform: [{ scale: generateButtonScale }], alignSelf: 'stretch' }}>
            <Pressable
              onPressIn={() => {
                Haptics.selectionAsync();
                Animated.spring(generateButtonScale, {
                  toValue: 0.95,
                  friction: 6,
                  useNativeDriver: true,
                }).start();
              }}
              onPressOut={() => {
                Animated.spring(generateButtonScale, {
                  toValue: 1,
                  friction: 6,
                  useNativeDriver: true,
                }).start();
              }}
              onPress={handleGenerateCards}
              disabled={isGeneratingCards}
              style={[
                styles.generateButton,
                isGeneratingCards && styles.generateButtonDisabled
              ]}
            >
              <Text style={[
                styles.generateButtonText,
                isGeneratingCards && styles.generateButtonTextDisabled
              ]}>
                {isGeneratingCards ? 'Generating...' : 'Generate New Cards'}
              </Text>
            </Pressable>
          </Animated.View>
        </View>
      )}

      {/* Render generated cards */}
      {renderCards()}

      {/* Generate Metrics Button */}
      {showGenerateMetricsButton && (
        <View style={[styles.generateButtonContainer, { marginTop: 5, marginBottom: 50 }]}>
          <Animated.View style={{ transform: [{ scale: generateMetricsButtonScale }], alignSelf: 'stretch' }}>
            <Pressable
              onPressIn={() => {
                Haptics.selectionAsync();
                Animated.spring(generateMetricsButtonScale, {
                  toValue: 0.95,
                  friction: 6,
                  useNativeDriver: true,
                }).start();
              }}
              onPressOut={() => {
                Animated.spring(generateMetricsButtonScale, {
                  toValue: 1,
                  friction: 6,
                  useNativeDriver: true,
                }).start();
              }}
              onPress={handleGenerateMetrics}
              disabled={isGeneratingMetrics}
              style={[
                styles.generateButton,
                isGeneratingMetrics && styles.generateButtonDisabled
              ]}
            >
              <Text style={[
                styles.generateButtonText,
                isGeneratingMetrics && styles.generateButtonTextDisabled
              ]}>
                {isGeneratingMetrics ? 'Generating...' : 'Generate Metrics'}
              </Text>
            </Pressable>
          </Animated.View>
        </View>
      )}

    </Animated.ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingTop: 0,
    paddingBottom: 0,
    backgroundColor: '#000',
    alignItems: 'center',
  },
  profileHeaderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
    marginTop: 0,
    paddingHorizontal: 10,
    width: '95%',
    alignSelf: 'center',
  },
  leftColumn: {
    flex: 2,
    alignItems: 'flex-start',
    marginTop: -5,
  },
  rightColumn: {
    flex: 1,
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    marginTop: 0,
  },
  nameText: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '500',
    marginBottom: 2,
    textAlign: 'left',
  },
  subtitleText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '400',
    marginBottom: 0,
    textAlign: 'left',
  },
  numbersRowWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    marginTop: 0,
    width: '100%',
    justifyContent: 'flex-start',
  },
  numbersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  arrowIcon: {
    width: 14,
    height: 14,
    resizeMode: 'contain',
    marginRight: 2,
  },
  redNum: {
    color: '#8F0000',
    fontWeight: '700',
    fontSize: 13,
    marginRight: 12,
    marginLeft: 2,
  },
  greenNum: {
    color: '#008610',
    fontWeight: '700',
    fontSize: 13,
    marginLeft: 2,
  },
  seeMoreBtn: {
    padding: 2,
    marginLeft: 8,
  },
  seeMoreText: {
    color: '#fff',
    fontSize: 12,
    textDecorationLine: 'underline',
    fontWeight: '400',
    marginBottom: 2,
  },
  popularityTitle: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
    textAlign: 'right',
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 0,
    marginTop: 3,
  },
  starIcon: {
    width: 22,
    height: 22,
    resizeMode: 'contain',
    marginHorizontal: 1,
  },

  seeRankingsBtn: {
    padding: 2,
  },
  seeRankingsText: {
    color: '#fff',
    fontSize: 12,
    textDecorationLine: 'underline',
    fontWeight: '400',
    textAlign: 'right',
    marginTop: 2, 
  },
  synopsisBox: {
    backgroundColor: '#050505',
    borderRadius: 18,
    borderColor: '#101010',
    borderWidth: 1,
    alignSelf: 'center',
    marginBottom: 15,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  agendaBox: {
    backgroundColor: '#050505',
    borderRadius: 18,
    borderColor: '#101010',
    borderWidth: 1,
    alignSelf: 'center',
    marginBottom: 15,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  historyBox: {
    backgroundColor: '#050505',
    borderRadius: 18,
    borderColor: '#101010',
    borderWidth: 1,
    alignSelf: 'center',
    marginBottom: 15,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  affiliatesBox: {
    backgroundColor: '#050505',
    borderRadius: 18,
    borderColor: '#101010',
    borderWidth: 1,
    alignSelf: 'center',
    marginBottom: 0,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  boxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    alignSelf: 'center',
    width: '95%',
  },
  boxTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '500',
    marginBottom: 8,
    textAlign: 'left',
  },
  boxContent: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '400',
    textAlign: 'left',
  },
  // Generate Cards Button styles
  generateButtonContainer: {
    width: 370,
    alignSelf: 'center',
    marginTop: 0,
    marginBottom: 10,
  },
  generateButton: {
    backgroundColor: '#050505',
    borderRadius: 20,
    borderColor: '#101010',
    borderWidth: 1,
    height: 60,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  generateButtonDisabled: {
    backgroundColor: '#333',
    opacity: 0.6,
  },
  generateButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '400',
    textAlign: 'center',
  },
  generateButtonTextDisabled: {
    color: '#999',
  },
  // Generated Cards styles
  generatedCardsContainer: {
    width: 370,
    alignSelf: 'center',
    marginTop: 0,
    marginBottom: 10,
  },
  generatedCard: {
    backgroundColor: '#050505',
    borderRadius: 28,
    padding: 20,
    marginBottom: 15,
    width: '100%',
    minHeight: 100,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    borderWidth: 1,
    borderColor: '#101010',
  },
  generatedCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginBottom: 0,
  },
  generatedCardTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '500',
  },
  generatedCardSubtext: {
    color: '#ccc',
    fontSize: 14,
    marginTop: 6,
    fontWeight: '400',
  },
});
