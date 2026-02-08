import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useRef } from 'react';
import { Animated, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const POLITICIAN_UNAVAILABLE_CATEGORIES = ['action', 'scope', 'process', 'exceptions', 'sectors', 'demographics', 'regions', 'aftermath', 'backers', 'opposers', 'narratives'];
const LEGISLATION_UNAVAILABLE_CATEGORIES = ['economy', 'immigration', 'healthcare', 'defense', 'environment', 'education', 'background', 'career', 'public image', 'accomplishments', 'statements', 'awards', 'party', 'organizations', 'businesses', 'politicians', 'medias', 'donors', 'more', 'social programs', 'national security', 'beliefs', 'enterprises'];

const ALL_CARD_CATEGORIES = [
  'Economy', 'Immigration', 'Healthcare', 'Defense', 'Environment', 'Education',
  'Background', 'Career', 'Public Image', 'Accomplishments', 'Statements', 'Awards',
  'Party', 'Organizations', 'Businesses', 'Politicians', 'Medias', 'Donors', 'More',
  'Social Programs', 'National Security', 'Beliefs', 'Enterprises',
  'Action', 'Scope', 'Process', 'Exceptions', 'Sectors', 'Demographics', 'Regions',
  'Aftermath', 'Backers', 'Opposers', 'Narratives',
];

export default function CardSubjects() {
  const router = useRouter();
  const { profileType } = useLocalSearchParams<{ profileType?: string }>();
  const buttonScales = useRef<{ [key: string]: Animated.Value }>({}).current;

  const cardCategories = useMemo(() => {
    if (!profileType || profileType === 'Profile Type' || profileType === 'Both') {
      return ALL_CARD_CATEGORIES;
    }
    if (profileType === 'Politician') {
      return ALL_CARD_CATEGORIES.filter(
        (c) => !POLITICIAN_UNAVAILABLE_CATEGORIES.includes(c.toLowerCase())
      );
    }
    if (profileType === 'Legislation') {
      return ALL_CARD_CATEGORIES.filter(
        (c) => !LEGISLATION_UNAVAILABLE_CATEGORIES.includes(c.toLowerCase())
      );
    }
    return ALL_CARD_CATEGORIES;
  }, [profileType]);

  const getScale = (category: string) => {
    if (!buttonScales[category]) {
      buttonScales[category] = new Animated.Value(1);
    }
    return buttonScales[category];
  };

  const handleCategoryPress = (category: string) => {
    // Truncate category name if too long (approximately 30 characters max for button)
    let displayText = category;
    if (category.length > 30) {
      // Try to break at word boundaries first
      const words = category.split(' ');
      let truncated = '';
      for (const word of words) {
        const testText = truncated ? `${truncated} ${word}` : word;
        if (testText.length <= 27) {
          // Reserve 3 chars for "..."
          truncated = testText;
        } else {
          break;
        }
      }
      // If we have a truncated version, use it, otherwise just cut at 27 chars
      displayText = truncated ? `${truncated}...` : `${category.substring(0, 27)}...`;
    }

    // Store selected card category in AsyncStorage for Card Search page to read (value = lowercase for DB)
    AsyncStorage.setItem('selectedCardCategoryLabel', displayText);
    AsyncStorage.setItem('selectedCardCategoryValue', category.toLowerCase());

    // Navigate back to previous page with proper back animation
    router.back();
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerContainer}>
        <Pressable
          style={styles.headerIconBtn}
          onPress={() => router.back()}
          hitSlop={{ top: 12, left: 12, right: 12, bottom: 12 }}
        >
          <Image source={require('../assets/back1.png')} style={styles.headerIcon} />
        </Pressable>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {cardCategories.map((category) => {
          const scale = getScale(category);
          return (
            <AnimatedPressable
              key={category}
              onPressIn={() => {
                Haptics.selectionAsync();
                Animated.spring(scale, {
                  toValue: 0.95,
                  friction: 6,
                  useNativeDriver: true,
                }).start();
              }}
              onPressOut={() => {
                Animated.spring(scale, {
                  toValue: 1,
                  friction: 6,
                  useNativeDriver: true,
                }).start();
              }}
              onPress={() => handleCategoryPress(category)}
              style={[
                styles.subjectButton,
                { transform: [{ scale }] },
              ]}
            >
              <Text style={styles.subjectButtonText} numberOfLines={1}>
                {category}
              </Text>
            </AnimatedPressable>
          );
        })}
      </ScrollView>
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
  content: {
    flex: 1,
    paddingTop: 100, // Leave space for header
    paddingHorizontal: 0,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  subjectButton: {
    backgroundColor: '#050505',
    borderWidth: 1,
    borderColor: '#101010',
    borderRadius: 16,
    height: 45,
    justifyContent: 'center',
    alignItems: 'flex-start',
    width: '100%',
    marginBottom: 10,
    paddingHorizontal: 20,
  },
  subjectButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '400',
    textAlign: 'left',
    width: '100%',
  },
});

