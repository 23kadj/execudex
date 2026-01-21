import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../components/AuthProvider';
import { ProfileLoadingIndicator } from '../components/ProfileLoadingIndicator';
import { NavigationService } from '../services/navigationService';
import { getSupabaseClient } from '../utils/supabase';

interface CosponsorEntry {
  rawName: string;
  date: string;
  profileId?: string;
  profileName?: string;
  profileSubName?: string;
}

export default function Cosponsors() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user } = useAuth();

  const cosponsorsRaw = typeof params.cosponsors === 'string' ? params.cosponsors : '';

  const [entries, setEntries] = useState<CosponsorEntry[]>([]);
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
  const [isProcessingProfile, setIsProcessingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  
  // Animated scales for each cosponsor button - initialize with enough scales
  const buttonScales = useRef([...Array(100)].map(() => new Animated.Value(1))).current;
  
  // Set up navigation service loading callback
  useEffect(() => {
    NavigationService.setLoadingCallback(setIsProcessingProfile);
    NavigationService.setErrorCallback(setProfileError);
  }, []);

  const parsedEntries = useMemo(() => {
    if (!cosponsorsRaw) return [];

    return cosponsorsRaw
      .split(',')
      .map(item => item.trim())
      .filter(Boolean)
      .map(item => {
        // Expect pattern: "Name 03/10/2025"
        const match = item.match(/^(.*?)(\d{2}\/\d{2}\/\d{4})$/);
        if (!match) {
          return {
            rawName: item,
            date: '',
          } as CosponsorEntry;
        }

        const namePart = match[1].trim();
        const datePart = match[2].trim();

        return {
          rawName: namePart,
          date: datePart,
        } as CosponsorEntry;
      });
  }, [cosponsorsRaw]);

  useEffect(() => {
    const fetchMatches = async () => {
      const supabase = getSupabaseClient();
      const updated: CosponsorEntry[] = [];

      for (const entry of parsedEntries) {
        const sponsorName = entry.rawName;
        if (!sponsorName) {
          updated.push(entry);
          continue;
        }

        try {
          // First, try to match the full name
          const { data, error } = await supabase
            .from('ppl_index')
            .select('id, name, sub_name, limit_score')
            .or(`name.ilike.%${sponsorName}%,sub_name.ilike.%${sponsorName}%`)
            .order('limit_score', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (!error && data?.id) {
            updated.push({
              ...entry,
              profileId: String(data.id),
              profileName: String(data.name ?? ''),
              profileSubName: String(data.sub_name ?? ''),
            });
            continue;
          }

          // Fallback to last name only
          const tokens = sponsorName.split(/\s+/).filter(Boolean);
          const lastName = tokens[tokens.length - 1];
          if (!lastName) {
            updated.push(entry);
            continue;
          }

          const { data: dataFallback, error: errorFallback } = await supabase
            .from('ppl_index')
            .select('id, name, sub_name, limit_score')
            .or(`name.ilike.%${lastName}%,sub_name.ilike.%${lastName}%`)
            .order('limit_score', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (!errorFallback && dataFallback?.id) {
            updated.push({
              ...entry,
              profileId: String(dataFallback.id),
              profileName: String(dataFallback.name ?? ''),
              profileSubName: String(dataFallback.sub_name ?? ''),
            });
          } else {
            updated.push(entry);
          }
        } catch (error) {
          console.error('Error fetching cosponsor profile:', error);
          updated.push(entry);
        }
      }

      setEntries(updated);
    };

    fetchMatches();
  }, [parsedEntries]);

  const handleCosponsorPress = async (entry: CosponsorEntry, index: number) => {
    if (!entry.profileId || loadingIds.has(entry.profileId)) return;

    setLoadingIds(prev => new Set(prev).add(entry.profileId!));
    try {
      await NavigationService.navigateToPoliticianProfile({
        pathname: '/index1',
        params: {
          title: entry.profileName || entry.rawName,
          subtitle: entry.profileSubName || '',
          imgKey: 'placeholder',
          numbersObj: JSON.stringify({ red: '50%', green: '50%' }),
          index: entry.profileId,
        }
      }, user?.id);
    } catch (error) {
      console.error('Error navigating to cosponsor profile:', error);
    } finally {
      setLoadingIds(prev => {
        const next = new Set(prev);
        next.delete(entry.profileId!);
        return next;
      });
    }
  };
  
  const handleCancelProfileLoading = () => {
    NavigationService.cancelProcessing();
  };

  return (
    <View style={styles.container}>
      {/* Header with back button only */}
      <View style={styles.headerContainer}>
        <Pressable
          style={styles.headerIconBtn}
          onPress={() => router.back()}
          hitSlop={{ top: 12, left: 12, right: 12, bottom: 12 }}
        >
          <Image source={require('../assets/back1.png')} style={styles.headerIcon} />
        </Pressable>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
        {entries.map((entry, index) => {
          const key = entry.profileId || `${entry.rawName}-${entry.date}-${index}`;
          const isClickable = !!entry.profileId;
          const scale = buttonScales[index];

          return (
            <Animated.View 
              key={key} 
              style={{ 
                transform: [{ scale }],
                width: '100%',
                alignItems: 'center',
              }}
            >
              <Pressable
                onPressIn={() => {
                  if (isClickable) {
                    Haptics.selectionAsync();
                    Animated.spring(scale, {
                      toValue: 0.95,
                      useNativeDriver: true,
                    }).start();
                  }
                }}
                onPressOut={() => {
                  if (isClickable) {
                    Animated.spring(scale, {
                      toValue: 1,
                      useNativeDriver: true,
                    }).start();
                  }
                }}
                onPress={() => isClickable && handleCosponsorPress(entry, index)}
                style={styles.sponsorCard}
              >
                <View style={styles.sponsorCardContent}>
                  <View style={styles.sponsorTopRow}>
                    <Text style={styles.sponsorTitle} numberOfLines={0}>
                      {entry.rawName}
                    </Text>
                    <View style={styles.sponsorTypeBadge}>
                      <Text style={styles.sponsorTypeText}>Cosponsor</Text>
                    </View>
                  </View>
                  {!!entry.profileSubName && (
                    <View style={styles.sponsorBottomRow}>
                      <Text style={styles.sponsorSubtitle} numberOfLines={0}>
                        {entry.profileSubName}
                      </Text>
                    </View>
                  )}
                </View>
              </Pressable>
            </Animated.View>
          );
        })}
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
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  headerContainer: {
    height: 80,
    paddingTop: 44,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#000',
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
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 20,
  },
  sponsorCard: {
    backgroundColor: '#050505',
    borderRadius: 22,
    padding: 20,
    marginBottom: 10,
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
  sponsorSubtitle: {
    color: '#898989',
    fontWeight: '400',
    fontSize: 12,
    flexWrap: 'wrap',
  },
});

