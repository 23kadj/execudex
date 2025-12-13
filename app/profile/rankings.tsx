import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../components/AuthProvider';
import { getSupabaseClient } from '../../utils/supabase';

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);
const STAR_COUNT = 5;

// Storage keys for persistence
const STORAGE_KEYS = {
  SUBMITTED_RANKING: 'submittedRanking',
  SUBMITTED_STARS: 'submittedStars',
};

export default function Rankings() {
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  // Get current stars from params, default to 0
  const currentStars = typeof params.currentStars === 'string' ? parseInt(params.currentStars) : 0;
  // Get the politician index from params
  const politicianIndex = typeof params.index === 'string' ? params.index : undefined;
  // State to track which stars are filled (1-based indexing) - initialize with current stars
  const [filledStars, setFilledStars] = useState(currentStars);
  // State to track if score has been submitted
  const [isSubmitted, setIsSubmitted] = useState(false);
  // State to track the submitted ranking text - initialize with 'No Data'
  const [submittedRanking, setSubmittedRanking] = useState('No Data');
  // State to track the average ranking
  const [averageRanking, setAverageRanking] = useState('No Data');
  // Animated scale value for button bounce
  const buttonScale = useRef(new Animated.Value(1)).current;

  // Load persisted data when component mounts and when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      const loadStoredData = async () => {
        try {
          const storedRanking = await AsyncStorage.getItem(STORAGE_KEYS.SUBMITTED_RANKING);
          const storedStars = await AsyncStorage.getItem(STORAGE_KEYS.SUBMITTED_STARS);
          
          if (storedRanking && storedRanking !== 'No Data') {
            setSubmittedRanking(storedRanking);
            setIsSubmitted(true);
          }
          
          if (storedStars) {
            const starsCount = parseInt(storedStars);
            setFilledStars(starsCount);
          }

          // Load user's submitted stars from database if authenticated
          if (user?.id && politicianIndex) {
            try {
              const { data: userScore, error } = await supabase
                .from('ppl_scores')
                .select('score')
                .eq('user_id', user.id)
                .eq('index_id', parseInt(politicianIndex))
                .single();

              if (!error && userScore) {
                setFilledStars(userScore.score);
                setSubmittedRanking(userScore.score.toString());
                setIsSubmitted(true);
              } else {
                // No matching row found - reset to default values
                setSubmittedRanking('No Data');
                setIsSubmitted(false);
                setFilledStars(0);
              }
            } catch (error) {
              console.error('Error loading user score from database:', error);
              // Reset to default values on error
              setSubmittedRanking('No Data');
              setIsSubmitted(false);
              setFilledStars(0);
            }
          } else {
            // User not authenticated or no politician index - reset to default values
            setSubmittedRanking('No Data');
            setIsSubmitted(false);
            setFilledStars(0);
          }
        } catch (error) {
          console.error('Failed to load ranking data:', error);
        }
      };

      loadStoredData();
    }, [user, politicianIndex])
  );

  // Fetch average ranking when component mounts or politician index changes
  useEffect(() => {
    if (politicianIndex) {
      fetchAverageRanking();
    }
  }, [politicianIndex]);

  // Refresh user's ranking when user or politician index changes
  useEffect(() => {
    const refreshUserRanking = async () => {
      if (user?.id && politicianIndex) {
        try {
          const { data: userScore, error } = await supabase
            .from('ppl_scores')
            .select('score')
            .eq('user_id', user.id)
            .eq('index_id', parseInt(politicianIndex))
            .single();

          if (!error && userScore) {
            setSubmittedRanking(userScore.score.toString());
            setIsSubmitted(true);
            setFilledStars(userScore.score);
          } else {
            setSubmittedRanking('No Data');
            setIsSubmitted(false);
            setFilledStars(0);
          }
        } catch (error) {
          console.error('Error refreshing user ranking:', error);
          setSubmittedRanking('No Data');
          setIsSubmitted(false);
          setFilledStars(0);
        }
      } else {
        setSubmittedRanking('No Data');
        setIsSubmitted(false);
        setFilledStars(0);
      }
    };

    refreshUserRanking();
  }, [user, politicianIndex]);

  // Function to fetch and calculate average ranking
  const fetchAverageRanking = async () => {
    if (!politicianIndex) return;
    
    try {
      // Query all scores for the current politician
      const { data: scores, error } = await supabase
        .from('ppl_scores')
        .select('score')
        .eq('index_id', parseInt(politicianIndex));
      
      if (error) {
        console.error('Error fetching scores:', error);
        setAverageRanking('No Data');
        return;
      }
      
      if (scores && scores.length > 0) {
        // Calculate average
        const totalScore = scores.reduce((sum, item) => sum + item.score, 0);
        const average = totalScore / scores.length;
        setAverageRanking(average.toFixed(1));
        
        // Update ppl_profiles with the new average
        await updateProfileScore(parseInt(politicianIndex), average);
      } else {
        setAverageRanking('No Data');
      }
    } catch (error) {
      console.error('Error calculating average ranking:', error);
      setAverageRanking('No Data');
    }
  };

  // Function to update profile score in ppl_profiles
  const updateProfileScore = async (indexId: number, score: number) => {
    try {
      const { error } = await supabase
        .from('ppl_profiles')
        .update({ score: score })
        .eq('index_id', indexId);
      
      if (error) {
        console.error('Error updating profile score:', error);
      }
    } catch (error) {
      console.error('Error updating profile score:', error);
    }
  };

  // Function to get the next available ID for ppl_scores
  const getNextAvailableId = async (): Promise<number> => {
    try {
      const { data: scores, error } = await supabase
        .from('ppl_scores')
        .select('id')
        .order('id', { ascending: true });
      
      if (error) {
        console.error('Error fetching scores for ID calculation:', error);
        return 1; // Fallback to 1
      }
      
      if (!scores || scores.length === 0) {
        return 1; // No scores exist, start with 1
      }
      
      // Find the first missing ID
      let expectedId = 1;
      for (const score of scores) {
        if (score.id !== expectedId) {
          return expectedId; // Found a gap
        }
        expectedId++;
      }
      
      // No gaps found, return max + 1
      return scores[scores.length - 1].id + 1;
    } catch (error) {
      console.error('Error calculating next available ID:', error);
      return 1; // Fallback to 1
    }
  };

  // Reset submission state when stars change (only if not already submitted)
  useEffect(() => {
    if (!isSubmitted) {
      setIsSubmitted(false);
    }
  }, [filledStars, isSubmitted]);

  const handleBackPress = () => {
    Haptics.selectionAsync();
    // Navigate back to the original page
    router.back();
  };

  // Handler for star press (same as synop)
  const handleStarPress = (starIndex: number) => {
    Haptics.selectionAsync();
    setFilledStars(starIndex + 1); // Convert to 1-based indexing
    setIsSubmitted(false);
  };

  // Handler for submit button press
  const handleSubmitPress = async () => {
    if (!isSubmitted && politicianIndex) {
      try {
        const newSubmittedRanking = filledStars.toString();
        setSubmittedRanking(newSubmittedRanking);
        setIsSubmitted(true);
        
        // Persist the data to AsyncStorage
        await AsyncStorage.setItem(STORAGE_KEYS.SUBMITTED_RANKING, newSubmittedRanking);
        await AsyncStorage.setItem(STORAGE_KEYS.SUBMITTED_STARS, filledStars.toString());
        
        // Submit score to database
        await submitScoreToDatabase(parseInt(politicianIndex), filledStars);
        
        // Refresh average ranking after submission
        await fetchAverageRanking();
      } catch (error) {
        console.error('Failed to save ranking data:', error);
      }
    }
  };

  // Function to submit score to database
  const submitScoreToDatabase = async (indexId: number, score: number) => {
    if (!user?.id) {
      console.error('User not authenticated, cannot submit score');
      return;
    }

    try {
      // Check if a score already exists for this user and politician
      const { data: existingScore, error: checkError } = await supabase
        .from('ppl_scores')
        .select('id')
        .eq('user_id', user.id)
        .eq('index_id', indexId)
        .single();
      
      if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error checking existing score:', checkError);
        return;
      }
      
      if (existingScore) {
        // Update existing score
        const { error: updateError } = await supabase
          .from('ppl_scores')
          .update({ 
            score: score,
            created_at: new Date().toISOString()
          })
          .eq('id', existingScore.id);
        
        if (updateError) {
          console.error('Error updating score:', updateError);
        }
      } else {
        // Insert new score
        const nextId = await getNextAvailableId();
        const { error: insertError } = await supabase
          .from('ppl_scores')
          .insert({
            id: nextId,
            user_id: user.id,
            index_id: indexId,
            score: score,
            created_at: new Date().toISOString()
          });
        
        if (insertError) {
          console.error('Error inserting score:', insertError);
        }
      }
    } catch (error) {
      console.error('Error submitting score to database:', error);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerContainer}>
        <TouchableOpacity
          style={styles.headerIconBtn}
          onPress={handleBackPress}
          hitSlop={{ top: 12, left: 12, right: 12, bottom: 12 }}
        >
          <Image source={require('../../assets/back1.png')} style={styles.headerIcon} />
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
      </View>

      {/* Content */}
      <View style={styles.contentContainer}>
        {/* Profile Header Container (from sub4, title only) */}
        <View style={styles.profileHeaderContainer}>
          <Text style={styles.nameText}>Rankings</Text>
          
          {/* Stars Row (from synop, centered left, 50% width) */}
          <View style={styles.starsRowContainer}>
            <View style={styles.starsRow}>
              {[...Array(STAR_COUNT)].map((_, i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => handleStarPress(i)}
                  activeOpacity={0.7}
                  hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
                >
                  <Image 
                    source={i < filledStars ? require('../../assets/star1.png') : require('../../assets/star.png')} 
                    style={styles.starIcon} 
                  />
                </TouchableOpacity>
              ))}
            </View>
          </View>
          
          {/* Submit Score Button */}
          <AnimatedTouchableOpacity
            onPressIn={() => {
              if (!isSubmitted) {
                Animated.spring(buttonScale, {
                  toValue: 0.95,
                  friction: 6,
                  useNativeDriver: true,
                }).start();
              }
            }}
            onPressOut={() => {
              if (!isSubmitted) {
                Animated.spring(buttonScale, {
                  toValue: 1,
                  friction: 6,
                  useNativeDriver: true,
                }).start();
              }
            }}
            onPress={handleSubmitPress}
            style={[
              styles.submitButton,
              { transform: [{ scale: buttonScale }] }
            ]}
            disabled={isSubmitted}
          >
            <Text style={styles.submitButtonText}>
              {isSubmitted ? 'Submitted' : 'Submit Score'}
            </Text>
          </AnimatedTouchableOpacity>
          
          {/* Subtitle under stars */}
          <View style={styles.subtitleContainer}>
            <Text style={styles.subtitleText}>Your Ranking: </Text>
            <Text style={styles.subtitleText}>{submittedRanking}</Text>
          </View>
          <View style={styles.subtitleContainer}>
            <Text style={styles.subtitleText}>Average Ranking: </Text>
            <Text style={styles.subtitleText}>{averageRanking}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  headerContainer: {
    position: 'absolute',
    top: 30,
    left: 0,
    right: 0,
    height: 60,
    paddingTop: 16,
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
  contentContainer: {
    flex: 1,
    paddingTop: 100, // Leave space for header
    paddingHorizontal: 18,
  },
  // Profile Header Container (from sub4, title only)
  profileHeaderContainer: {
    marginBottom: 2,
    marginTop: 0,
    alignItems: 'flex-start',
    paddingHorizontal: 10,
    width: '100%',
    alignSelf: 'center',
  },
  nameText: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '500',
    marginBottom: 20,
    textAlign: 'left',
  },
  // Stars Row Container (centered left, 50% width)
  starsRowContainer: {
    width: '50%',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 0,
    marginTop: 0,
  },
  starIcon: {
    width: 45,
    height: 45,
    resizeMode: 'contain',
    marginHorizontal: 1,
  },
  // Submit Score Button
  submitButton: {
    backgroundColor: '#050505',
    borderRadius: 20,
    width: '50%',
    height: '15%',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  subtitleText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'left',
  },
  subtitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
}); 