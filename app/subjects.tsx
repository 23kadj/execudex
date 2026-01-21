import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useRef } from 'react';
import { Animated, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const subjects = [
  'Agriculture and Food',
  'Animals',
  'Armed Forces and National Security',
  'Arts, Culture, Religion',
  'Civil Rights and Liberties, Minority Issues',
  'Commerce',
  'Congress',
  'Crime and Law Enforcement',
  'Economics and Public Finance',
  'Education',
  'Emergency Management',
  'Energy',
  'Environmental Protection',
  'Families',
  'Finance and Financial Sector',
  'Foreign Trade and International Finance',
  'Government Operations and Politics',
  'Health',
  'Housing and Community Development',
  'Immigration',
  'International Affairs',
  'Labor and Employment',
  'Law',
  'Native Americans',
  'Public Lands and Natural Resources',
  'Science, Technology, Communications',
  'Social Sciences and History',
  'Social Welfare',
  'Sports and Recreation',
  'Taxation',
  'Transportation and Public Works',
  'Water Resources Development',
];

export default function Subjects() {
  const router = useRouter();
  const buttonScales = useRef<{ [key: string]: Animated.Value }>({}).current;

  const getScale = (subject: string) => {
    if (!buttonScales[subject]) {
      buttonScales[subject] = new Animated.Value(1);
    }
    return buttonScales[subject];
  };

  const handleSubjectPress = (subject: string) => {
    // Truncate subject name if too long (approximately 30 characters max for button)
    let displayText = subject;
    if (subject.length > 30) {
      // Try to break at word boundaries first
      const words = subject.split(' ');
      let truncated = '';
      for (const word of words) {
        const testText = truncated ? `${truncated} ${word}` : word;
        if (testText.length <= 27) { // Reserve 3 chars for "..."
          truncated = testText;
        } else {
          break;
        }
      }
      // If we have a truncated version, use it, otherwise just cut at 27 chars
      displayText = truncated ? `${truncated}...` : `${subject.substring(0, 27)}...`;
    }

    // Store subject in AsyncStorage for exp1 to read
    AsyncStorage.setItem('selectedSubject', displayText);
    AsyncStorage.setItem('selectedSubjectFilter', subject);
    
    // Navigate back to exp1 with proper back animation
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
        {subjects.map((subject, index) => {
          const scale = getScale(subject);
          return (
            <AnimatedPressable
              key={subject}
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
              onPress={() => handleSubjectPress(subject)}
              style={[
                styles.subjectButton,
                { transform: [{ scale }] }
              ]}
            >
              <Text style={styles.subjectButtonText} numberOfLines={1}>
                {subject}
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
