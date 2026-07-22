import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { useAuth } from '../components/AuthProvider';
import { CardGenerationService } from '../services/cardGenerationService';
import { NavigationService } from '../services/navigationService';
import { getSupabaseClient } from '../utils/supabase';

// Simple skeleton loader component
const SkeletonLoader = ({ width = '100%', height = 60 }: { width?: number | `${number}%`, height?: number }) => {
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);
  
  const opacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.6],
  });
  
  return (
    <Animated.View
      style={{
        width,
        height,
        backgroundColor: '#2a2a2a',
        borderRadius: 8,
        opacity,
      }}
    />
  );
};

// Overview component with profile header
const Overview = ({ name, position, billStatus, isLowMateriality, congressLink, prefetchedProfileData }: { name: string; position: string; billStatus?: string; isLowMateriality?: boolean; congressLink?: string; prefetchedProfileData?: any }) => {
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const [congressData, setCongressData] = useState<{congress: string, bill_status: string} | null>(null);
  const [subject, setSubject] = useState<string | null>(null);
  const [latestAction, setLatestAction] = useState<string | null>(null);
  const [committees, setCommittees] = useState<string | null>(null);
  const [actions, setActions] = useState<string | null>(null);
  const [cosponsors, setCosponsors] = useState<string | null>(null);
  const [sponsorProfile, setSponsorProfile] = useState<{ id: string; name: string; sub_name: string } | null>(null);
  const [isSponsorLoading, setIsSponsorLoading] = useState(false);
  const sponsorButtonScale = useRef(new Animated.Value(1)).current;
  const policyTimelineButtonScale = useRef(new Animated.Value(1)).current;
  const cosponsorsButtonScale = useRef(new Animated.Value(1)).current;
  
  // Initialize profileData with prefetched data if available
  const [profileData, setProfileData] = useState<{overview: string, agenda: string, impact: string} | null>(() => {
    if (prefetchedProfileData) {
      return {
        overview: prefetchedProfileData.overview || '',
        agenda: prefetchedProfileData.agenda || '',
        impact: prefetchedProfileData.impact || ''
      };
    }
    return null;
  });
  
  const [fetchedCongressLink, setFetchedCongressLink] = useState<string | null>(null);
  const [isWeak, setIsWeak] = useState(false);
  
  // State for Generate New Cards button
  const [isGeneratingCards, setIsGeneratingCards] = useState(false);
  const [showGenerateButton, setShowGenerateButton] = useState(false);
  const generateButtonScale = useRef(new Animated.Value(1)).current;
  
  // Get the legislation ID from navigation parameters
  const legislationId = typeof params.index === 'string' ? params.index : '';
  
  // Fetch congress, bill_status, subject, latest_action, committees, actions, and cosponsors from legi_index
  useEffect(() => {
    const fetchCongressData = async () => {
      if (legislationId) {
        try {
          const supabase = getSupabaseClient();
          const { data, error } = await supabase
            .from('legi_index')
            .select('congress, bill_status, subject, latest_action, committees, actions, cosponsors')
            .eq('id', parseInt(legislationId))
            .single();
          
          if (!error && data) {
            setCongressData({
              congress: data.congress || '',
              bill_status: data.bill_status || ''
            });
            // Set subject if it exists and is not empty
            if (data.subject && data.subject.trim()) {
              setSubject(data.subject.trim());
            } else {
              setSubject(null);
            }
            // Set latest action if it exists and is not empty
            if (data.latest_action && data.latest_action.trim()) {
              setLatestAction(data.latest_action.trim());
            } else {
              setLatestAction(null);
            }

            // Set committees if it exists and is not empty
            if (data.committees && data.committees.trim()) {
              setCommittees(data.committees.trim());
            } else {
              setCommittees(null);
            }

            // Set actions if it exists and is not empty
            if (data.actions && data.actions.trim()) {
              setActions(data.actions.trim());
            } else {
              setActions(null);
            }

            // Set cosponsors if it exists and is not empty
            if (data.cosponsors && data.cosponsors.trim()) {
              setCosponsors(data.cosponsors.trim());
            } else {
              setCosponsors(null);
            }
          }
        } catch (error) {
          console.error('Error fetching congress data:', error);
        }
      }
    };

    fetchCongressData();
  }, [legislationId]);

  // Derive Committees box title and body text
  const committeesTitle = committees && committees.includes('|') ? 'Committees' : 'Committee';
  const committeesBody = committees ? committees.replace(/\|/g, '') : '';

  const extractSponsorNameFromSubName = (subName: string): string | null => {
    const s = String(subName ?? '').trim();
    if (!s) return null;

    // Expected pattern (per product spec):
    // "<date> | <Sponsor Name> <PARTY-STATE>"
    // Example: "Jan 10, 2024 | Jodey C Arrington R-TX"
    const parts = s.split('|');
    if (parts.length < 2) return null;

    // Take the segment directly after the first divider
    let segment = parts[1].trim();
    if (!segment) return null;

    // If there are more dividers, ignore anything after the next one
    segment = segment.split('|')[0].trim();

    // Remove any trailing party/state tag like "R-TX" or "(R-TX)" or "[R-TX]"
    // Capture the name part before that tag.
    let nameOnly = segment;

    // Strip bracketed/parenthesized suffixes
    nameOnly = nameOnly.replace(/\s*\([^)]*\)\s*$/g, '').replace(/\s*\[[^\]]*\]\s*$/g, '').trim();

    // Strip trailing PARTY-STATE tokens like "R-TX", "D-CA", "I-VT"
    nameOnly = nameOnly.replace(/\s+[A-Z]{1,3}-[A-Z]{2}$/g, '').trim();

    // Remove honorifics/prefixes
    nameOnly = nameOnly.replace(/^(Rep\.|Sen\.|Representative|Senator|Hon\.)\s+/i, '').trim();

    return nameOnly || null;
  };

  const sponsorName = extractSponsorNameFromSubName(position);

  // Lookup sponsor in ppl_index based on extracted sponsor name
  useEffect(() => {
    const fetchSponsor = async () => {
      if (!sponsorName) {
        setSponsorProfile(null);
        return;
      }

      try {
        const supabase = getSupabaseClient();
        // First, try to match the full cleaned sponsor name
        const { data, error } = await supabase
          .from('ppl_index')
          .select('id, name, sub_name, limit_score')
          .or(`name.ilike.%${sponsorName}%,sub_name.ilike.%${sponsorName}%`)
          .order('limit_score', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!error && data?.id) {
          setSponsorProfile({
            id: String(data.id),
            name: String(data.name ?? ''),
            sub_name: String(data.sub_name ?? ''),
          });
          return;
        }

        // If no strong match, fall back to a broader last-name-only search
        const tokens = sponsorName.split(/\s+/).filter(Boolean);
        const lastName = tokens[tokens.length - 1];
        if (!lastName) {
          setSponsorProfile(null);
          return;
        }

        const { data: dataFallback, error: errorFallback } = await supabase
          .from('ppl_index')
          .select('id, name, sub_name, limit_score')
          .or(`name.ilike.%${lastName}%,sub_name.ilike.%${lastName}%`)
          .order('limit_score', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!errorFallback && dataFallback?.id) {
          setSponsorProfile({
            id: String(dataFallback.id),
            name: String(dataFallback.name ?? ''),
            sub_name: String(dataFallback.sub_name ?? ''),
          });
        } else {
          setSponsorProfile(null);
        }
      } catch (error) {
        console.error('Error fetching sponsor profile:', error);
        setSponsorProfile(null);
      }
    };

    fetchSponsor();
  }, [sponsorName]);

  const handleSponsorPress = async () => {
    if (!sponsorProfile || isSponsorLoading) return;

    setIsSponsorLoading(true);
    try {
      await NavigationService.navigateToPoliticianProfile({
        pathname: '/index1',
        params: {
          title: sponsorProfile.name,
          subtitle: sponsorProfile.sub_name,
          imgKey: 'placeholder',
          numbersObj: JSON.stringify({ red: '50%', green: '50%' }),
          index: sponsorProfile.id,
        }
      }, user?.id);
    } catch (error) {
      console.error('Error navigating to sponsor profile:', error);
    } finally {
      setIsSponsorLoading(false);
    }
  };

  const handlePolicyTimelinePress = () => {
    if (!actions) return;

    router.push({
      pathname: '/action',
      params: {
        actions,
        title: name,
      },
    });
  };

  const handleCosponsorsPress = () => {
    if (!cosponsors) return;

    router.push({
      pathname: '/cosponsors',
      params: {
        cosponsors,
        title: name,
      },
    });
  };

  // Check if legislation is weak
  useEffect(() => {
    const checkWeakStatus = async () => {
      if (legislationId) {
        try {
          const weak = await CardGenerationService.isLegislationWeak(parseInt(legislationId));
          setIsWeak(weak);
        } catch (error) {
          console.error('Error checking weak status:', error);
          setIsWeak(false);
        }
      }
    };

    checkWeakStatus();
  }, [legislationId]);

  // Check if Generate New Cards button should be shown
  useEffect(() => {
    const checkGenerateButtonVisibility = async () => {
      if (legislationId) {
        try {
          // Use new button visibility function that checks weak status and card count
          const shouldShow = await CardGenerationService.shouldShowGenerateButtonForOverview(parseInt(legislationId));
          setShowGenerateButton(shouldShow);
        } catch (error) {
          console.error('Error checking generate button visibility:', error);
          setShowGenerateButton(false);
        }
      }
    };

    checkGenerateButtonVisibility();
  }, [legislationId]);

  // Fetch profile data from legi_profiles if not already prefetched
  useEffect(() => {
    const fetchProfileData = async () => {
      if (legislationId) {
        // Skip fetch if we already have prefetched data
        if (profileData) {
          console.log('Using prefetched profile data for legislation');
          return;
        }
        
        try {
          const supabase = getSupabaseClient();
          const { data, error } = await supabase
            .from('legi_profiles')
            .select('overview, agenda, impact')
            .eq('owner_id', parseInt(legislationId))
            .single();
          
          if (!error && data) {
            setProfileData({
              overview: data.overview || '',
              agenda: data.agenda || '',
              impact: data.impact || ''
            });
          }
        } catch (error) {
          console.error('Error fetching profile data:', error);
        }
      }
    };

    fetchProfileData();
  }, [legislationId]);

  // Fetch congress link from web_content
  useEffect(() => {
    const fetchCongressLink = async () => {
      if (legislationId) {
        try {
          const supabase = getSupabaseClient();
          const { data, error } = await supabase
            .from('web_content')
            .select('link')
            .eq('owner_id', parseInt(legislationId))
            .eq('is_ppl', false)
            .ilike('link', '%congress%')
            .limit(1)
            .single();
          
          if (!error && data?.link) {
            setFetchedCongressLink(data.link);
          }
        } catch (error) {
          console.error('Error fetching congress link:', error);
        }
      }
    };

    fetchCongressLink();
  }, [legislationId]);

  // Format the status display
  const getStatusDisplay = () => {
    if (!congressData || !congressData.congress || !congressData.bill_status) {
      return 'Congress session: No Data';
    }
    
    const congressSession = congressData.congress;
    const billStatus = congressData.bill_status;
    
    // Capitalize the first letter of bill status
    const formattedStatus = billStatus.charAt(0).toUpperCase() + billStatus.slice(1);
    
    return `${congressSession} Congress: ${formattedStatus}`;
  };

  // Handler for opening congress link
  const handleCongressLinkPress = async () => {
    const linkToUse = congressLink || fetchedCongressLink;
    if (!linkToUse) return;
    
    try {
      const supported = await Linking.canOpenURL(linkToUse);
      if (supported) {
        await Linking.openURL(linkToUse);
      } else {
        console.log("Can't open URL: " + linkToUse);
      }
    } catch (error) {
      console.error("Error opening URL: ", error);
    }
  };

  // Handler for Generate New Cards button
  const handleGenerateCards = async () => {
    if (!legislationId || isGeneratingCards) return;
    
    setIsGeneratingCards(true);
    try {
      // Execute bill_cards script
      const result = await CardGenerationService.executeBillCards(parseInt(legislationId));
      
      if (result.success) {
        // Check the JSON response to count generated cards
        const cardsGenerated = result.data?.inserted || 0;
        
        console.log(`Generated ${cardsGenerated} cards for legislation ${legislationId}`);
        
        if (cardsGenerated === 0) {
          // Mark legislation as weak (0 cards = full lock)
          await CardGenerationService.markLegislationAsWeak(parseInt(legislationId));
          
          // Show popup for insufficient cards
          Alert.alert(
            'Insufficient Cards',
            'There are not enough cards available to generate a full profile.',
            [{ text: 'OK' }]
          );
          
          // Hide the button after popup
          setShowGenerateButton(false);
        } else if (cardsGenerated < 10) {
          // Less than 10 cards but not 0 - partial lock (only agenda accessible)
          // Don't mark as weak, just show popup and hide button
          Alert.alert(
            'Limited Cards',
            'Limited cards available. Only agenda page will be accessible.',
            [{ text: 'OK' }]
          );
          
          // Hide the button after popup
          setShowGenerateButton(false);
        } else {
          // Unlock profile if it was previously weak
          await CardGenerationService.unlockLegislationProfile(parseInt(legislationId));
          setIsWeak(false);
          
          // Check if button should still be shown using new visibility function
          const shouldShow = await CardGenerationService.shouldShowGenerateButtonForOverview(parseInt(legislationId));
          setShowGenerateButton(shouldShow);
        }
      } else {
        console.error('Card generation failed:', result.message);
      }
    } catch (error) {
      console.error('Error generating cards:', error);
    } finally {
      setIsGeneratingCards(false);
    }
  };

  return (
    <ScrollView 
      style={styles.overviewContainer} 
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Profile Header Container */}
      <View style={styles.profileHeaderContainer}>
        <Text style={styles.nameText}>{name}</Text>
        <Text style={styles.subtitleText}>{position}</Text>
        <Text style={styles.legislationStatusText}>
          {getStatusDisplay()}
        </Text>
        {subject && (
          <Text style={styles.subtitleText}>{subject}</Text>
        )}
      </View>

      {/* Overview Box */}
      <View style={styles.boxRow}>
        <View style={[styles.overviewBox, { flex: 1, marginBottom: 0 }]}> 
          <Text style={styles.boxTitle}>Overview</Text>
          {profileData?.overview ? (
            <Text style={styles.boxContent}>{profileData.overview}</Text>
          ) : (
            <SkeletonLoader height={80} />
          )}
        </View>
      </View>

      {/* Latest Action Box - only show when latestAction is available */}
      {latestAction && (() => {
        // Extract vote numbers from latest_action (format: "X - Y" or "X-Y")
        const voteMatch = latestAction.match(/(\d+)\s*-\s*(\d+)/);
        const voteTitle = voteMatch 
          ? `Latest Action: ${voteMatch[1]} - ${voteMatch[2]}`
          : "Latest Action";
        
        return (
          <View style={styles.boxRow}>
            <View style={[styles.overviewBox, { flex: 1, marginBottom: 0 }]}>
              <Text style={styles.boxTitle}>{voteTitle}</Text>
              <Text style={styles.boxContent}>{latestAction}</Text>
            </View>
          </View>
        );
      })()}

      {/* Agenda Box */}
      <View style={styles.boxRow}>
        <View style={[styles.agendaBox, { flex: 1, marginBottom: 0 }]}> 
          <Text style={styles.boxTitle}>Agenda</Text>
          {profileData?.agenda ? (
            <Text style={styles.boxContent}>{profileData.agenda}</Text>
          ) : (
            <SkeletonLoader height={80} />
          )}
        </View>
      </View>

      {/* Impact Box */}
      <View style={styles.boxRow}>
        <View style={[styles.impactBox, { flex: 1, marginBottom: 0 }]}> 
          <Text style={styles.boxTitle}>Impact</Text>
          {profileData?.impact ? (
            <Text style={styles.boxContent}>{profileData.impact}</Text>
          ) : (
            <SkeletonLoader height={80} />
          )}
        </View>
      </View>

      {/* Committees Box - only show when committees data is available */}
      {committees && committeesBody && (
        <View style={styles.boxRow}>
          <View style={[styles.overviewBox, { flex: 1, marginBottom: 0 }]}>
            <Text style={styles.boxTitle}>{committeesTitle}</Text>
            <Text style={styles.boxContent}>{committeesBody}</Text>
          </View>
        </View>
      )}

      {/* Policy Timeline Button - only when actions are available */}
      {actions && (
        <View style={styles.boxRow}>
          <Animated.View style={{ transform: [{ scale: policyTimelineButtonScale }], alignSelf: 'stretch', width: '100%' }}>
            <Pressable
              onPressIn={() => {
                Haptics.selectionAsync();
                Animated.spring(policyTimelineButtonScale, {
                  toValue: 0.95,
                  friction: 6,
                  useNativeDriver: true,
                }).start();
              }}
              onPressOut={() => {
                Animated.spring(policyTimelineButtonScale, {
                  toValue: 1,
                  friction: 6,
                  useNativeDriver: true,
                }).start();
              }}
              onPress={handlePolicyTimelinePress}
              style={styles.generateButton}
            >
              <Text style={styles.generateButtonText}>Policy Timeline</Text>
            </Pressable>
          </Animated.View>
        </View>
      )}

      {/* Cosponsors Button - only when cosponsors are available */}
      {cosponsors && (
        <View style={styles.boxRow}>
          <Animated.View style={{ transform: [{ scale: cosponsorsButtonScale }], alignSelf: 'stretch', width: '100%' }}>
            <Pressable
              onPressIn={() => {
                Haptics.selectionAsync();
                Animated.spring(cosponsorsButtonScale, {
                  toValue: 0.95,
                  friction: 6,
                  useNativeDriver: true,
                }).start();
              }}
              onPressOut={() => {
                Animated.spring(cosponsorsButtonScale, {
                  toValue: 1,
                  friction: 6,
                  useNativeDriver: true,
                }).start();
              }}
              onPress={handleCosponsorsPress}
              style={styles.generateButton}
            >
              <Text style={styles.generateButtonText}>Cosponsors</Text>
            </Pressable>
          </Animated.View>
        </View>
      )}

      {/* Sponsor Button - copied from History politician button visuals */}
      {sponsorProfile && (
        <View style={styles.boxRow}>
          <Animated.View style={{ width: '100%', transform: [{ scale: sponsorButtonScale }] }}>
            <Pressable
              onPressIn={() => {
                if (!isSponsorLoading) {
                  Haptics.selectionAsync();
                  Animated.spring(sponsorButtonScale, {
                    toValue: 0.95,
                    friction: 6,
                    useNativeDriver: true,
                  }).start();
                }
              }}
              onPressOut={() => {
                if (!isSponsorLoading) {
                  Animated.spring(sponsorButtonScale, {
                    toValue: 1,
                    friction: 6,
                    useNativeDriver: true,
                  }).start();
                }
              }}
              onPress={() => !isSponsorLoading && handleSponsorPress()}
              disabled={isSponsorLoading}
              style={[
                styles.sponsorCard,
                isSponsorLoading && styles.sponsorCardDisabled
              ]}
            >
              <View style={styles.sponsorCardContent}>
                <View style={styles.sponsorTopRow}>
                  <Text
                    style={[
                      styles.sponsorTitle,
                      isSponsorLoading && styles.sponsorTitleDisabled
                    ]}
                    numberOfLines={0}
                    adjustsFontSizeToFit={false}
                  >
                    {isSponsorLoading ? 'Generating...' : sponsorProfile.name}
                  </Text>
                  <View style={styles.sponsorTypeBadge}>
                    <Text style={styles.sponsorTypeText}>Sponsor</Text>
                  </View>
                </View>
                <View style={styles.sponsorBottomRow}>
                  <Text
                    style={[
                      styles.sponsorSubtitle,
                      isSponsorLoading && styles.sponsorSubtitleDisabled
                    ]}
                    numberOfLines={0}
                    adjustsFontSizeToFit={false}
                  >
                    {sponsorProfile.sub_name}
                  </Text>
                </View>
              </View>
            </Pressable>
          </Animated.View>
        </View>
      )}

      {/* Generate New Cards Button */}
      {showGenerateButton && (
        <View style={styles.generateButtonContainer}>
          <Animated.View style={{ transform: [{ scale: generateButtonScale }] }}>
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


      {/* Congress Link Pill - Always show if available */}
      {(congressLink || fetchedCongressLink) && (
        <View style={styles.boxRow}>
          <View style={styles.linksRow}>
            <TouchableOpacity
              style={styles.linkPill}
              onPress={handleCongressLinkPress}
              activeOpacity={0.7}
            >
              <Text style={styles.linkText}>congress.gov</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

    </ScrollView>
  );
};

const styles = StyleSheet.create({
  // Overview specific styles
  overviewContainer: {
    width: '100%',
    paddingTop: 0,
    paddingBottom: 0,
    backgroundColor: '#000',
  },
  scrollContent: {
    alignItems: 'center',
    paddingBottom: 20,
    flexGrow: 1,
  },
  profileHeaderContainer: {
    // You can control the position of the whole block here:
    marginBottom: 2,
    marginTop: 5,
    alignItems: 'flex-start',
    paddingHorizontal: 10,
    width: '95%',
    alignSelf: 'center',
    // Example: marginTop: 20, alignSelf: 'center', etc.
  },
  nameText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '500',
    marginBottom: 2,
    textAlign: 'left',
    flexWrap: 'wrap',
    flexShrink: 1,
  },
  subtitleText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '400',
    marginBottom: 5,
    textAlign: 'left',
  },
  legislationStatusText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '400',
    marginBottom: 5,
    textAlign: 'left',
  },
  numbersRowWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    marginTop: -8,
    width: '100%',
    justifyContent: 'space-between',
  },
  numbersRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
  },
  seeMoreText: {
    color: '#fff',
    fontSize: 12,
    textDecorationLine: 'underline',
    fontWeight: '400',
    marginLeft: -195,
    marginBottom: 2,
  },

  // Box styles
  overviewBox: {
    backgroundColor: '#050505',
    borderRadius: 18,
    borderColor: '#101010',
    borderWidth: 1,
    alignSelf: 'center',
    marginBottom: 15,
    padding: 15,
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
    padding: 15,
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  impactBox: {
    backgroundColor: '#050505',
    borderRadius: 18,
    borderColor: '#101010',
    borderWidth: 1,
    alignSelf: 'center',
    marginBottom: 0,
    padding: 15,
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

  // Sponsor button (copied from History card visuals)
  sponsorCard: {
    backgroundColor: '#050505',
    borderRadius: 22,
    padding: 20,
    width: '100%',
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
  sponsorCardDisabled: {
    backgroundColor: '#333',
    opacity: 0.6,
  },
  sponsorCardContent: {
    width: '100%',
    paddingHorizontal: 0,
    flex: 1,
  },
  sponsorTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    width: '100%',
    marginBottom: 4,
  },
  sponsorBottomRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    width: '100%',
  },
  sponsorTitle: {
    color: '#fff',
    fontWeight: '400',
    fontSize: 20,
    flex: 1,
    flexWrap: 'wrap',
  },
  sponsorTitleDisabled: {
    color: '#999',
  },
  sponsorSubtitle: {
    color: '#898989',
    fontWeight: '400',
    fontSize: 12,
    flexWrap: 'wrap',
  },
  sponsorSubtitleDisabled: {
    color: '#666',
  },
  sponsorTypeBadge: {
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
  sponsorTypeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
    textAlignVertical: 'center',
  },
  lowMaterialityContainer: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
    alignSelf: 'center',
    width: '95%',
  },
  lowMaterialityText: {
    color: '#999',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  linksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 0,
    width: '100%',
  },
  linkPill: {
    backgroundColor: '#0A0A0A',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 4,
    minWidth: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkText: {
    color: '#434343',
    fontSize: 11,
    fontWeight: '400',
  },
  
  // Low Data Message styles (dark theme)
  lowDataContainer: {
    width: '92%',
    alignSelf: 'center',
    marginTop: 20,
    marginBottom: 20,
    padding: 20,
    backgroundColor: '#040404',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#090909',
  },
  lowDataTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  lowDataMessage: {
    fontSize: 14,
    color: '#ddd',
    lineHeight: 20,
    textAlign: 'center',
  },
  // Generate Cards Button styles
  generateButtonContainer: {
    width: '95%',
    alignSelf: 'center',
    marginTop: 20,
    marginBottom: 20,
  },
  generateButton: {
    backgroundColor: '#050505',
    borderRadius: 20,
    borderColor: '#101010',
    borderWidth: 1,
    height: 60,
    width: '100%',
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  generateButtonDisabled: {
    backgroundColor: '#333',
    opacity: 0.6,
  },
  generateButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '400',
    textAlign: 'left',
  },
  generateButtonTextDisabled: {
    color: '#999',
  },
});

export default Overview; 