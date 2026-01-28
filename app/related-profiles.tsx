import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../components/AuthProvider';
import { ProfileLoadingIndicator } from '../components/ProfileLoadingIndicator';
import { NavigationService } from '../services/navigationService';
import { getSupabaseClient } from '../utils/supabase';

interface RelatedEntry {
  rawName: string;
  profileId?: string;
  profileName?: string;
  profileSubName?: string;
}

export default function RelatedProfiles() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user } = useAuth();

  const relatedRaw = typeof params.related === 'string' ? params.related : '';

  const [entries, setEntries] = useState<RelatedEntry[]>([]);
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
  const [isProcessingProfile, setIsProcessingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const buttonScales = useRef([...Array(100)].map(() => new Animated.Value(1))).current;

  useEffect(() => {
    NavigationService.setLoadingCallback(setIsProcessingProfile);
    NavigationService.setErrorCallback(setProfileError);
  }, []);

  const parsedNames = useMemo(() => {
    if (!relatedRaw) return [];
    return relatedRaw
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }, [relatedRaw]);

  useEffect(() => {
    const fetchMatches = async () => {
      const supabase = getSupabaseClient();
      const updated: RelatedEntry[] = [];

      for (const rawName of parsedNames) {
        if (!rawName) continue;

        try {
          const { data, error } = await supabase
            .from('ppl_index')
            .select('id, name, sub_name, limit_score')
            .or(`name.ilike.%${rawName}%,sub_name.ilike.%${rawName}%`)
            .order('limit_score', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (!error && data?.id) {
            updated.push({
              rawName,
              profileId: String(data.id),
              profileName: String(data.name ?? ''),
              profileSubName: String(data.sub_name ?? ''),
            });
            continue;
          }

          const tokens = rawName.split(/\s+/).filter(Boolean);
          const lastName = tokens[tokens.length - 1];
          if (!lastName) continue;

          const { data: dataFallback, error: errorFallback } = await supabase
            .from('ppl_index')
            .select('id, name, sub_name, limit_score')
            .or(`name.ilike.%${lastName}%,sub_name.ilike.%${lastName}%`)
            .order('limit_score', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (!errorFallback && dataFallback?.id) {
            updated.push({
              rawName,
              profileId: String(dataFallback.id),
              profileName: String(dataFallback.name ?? ''),
              profileSubName: String(dataFallback.sub_name ?? ''),
            });
          }
          // Skip unmatched names (do not add to list)
        } catch (error) {
          console.error('Error fetching related profile:', error);
        }
      }

      setEntries(updated);
    };

    fetchMatches();
  }, [parsedNames]);

  const handleProfilePress = async (entry: RelatedEntry, index: number) => {
    if (!entry.profileId || loadingIds.has(entry.profileId)) return;

    setLoadingIds((prev) => new Set(prev).add(entry.profileId!));
    try {
      await NavigationService.navigateToPoliticianProfile(
        {
          pathname: '/index1',
          params: {
            title: entry.profileName || entry.rawName,
            subtitle: entry.profileSubName || '',
            imgKey: 'placeholder',
            numbersObj: JSON.stringify({ red: '50%', green: '50%' }),
            index: entry.profileId,
          },
        },
        user?.id
      );
    } catch (error) {
      console.error('Error navigating to related profile:', error);
    } finally {
      setLoadingIds((prev) => {
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
      <View style={styles.headerContainer}>
        <Pressable
          style={styles.headerIconBtn}
          onPress={() => router.back()}
          hitSlop={{ top: 12, left: 12, right: 12, bottom: 12 }}
        >
          <Image source={require('../assets/back1.png')} style={styles.headerIcon} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {entries.map((entry, index) => {
          const key = `related-${index}-${entry.profileId ?? entry.rawName}`;
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
                onPress={() => isClickable && handleProfilePress(entry, index)}
                style={styles.profileCard}
              >
                <View style={styles.profileCardContent}>
                  <View style={styles.profileTopRow}>
                    <Text style={styles.profileTitle} numberOfLines={0}>
                      {entry.profileName || entry.rawName}
                    </Text>
                  </View>
                  {!!entry.profileSubName && (
                    <View style={styles.profileBottomRow}>
                      <Text style={styles.profileSubtitle} numberOfLines={0}>
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
  profileCard: {
    backgroundColor: '#050505',
    borderRadius: 22,
    padding: 20,
    marginBottom: 10,
    width: '100%',
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    minHeight: 80,
    borderWidth: 1,
    borderColor: '#101010',
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
  profileSubtitle: {
    color: '#898989',
    fontWeight: '400',
    fontSize: 12,
    flexWrap: 'wrap',
  },
});
