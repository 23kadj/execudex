import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useRef } from 'react';
import { Animated, Image, Linking, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function Legal() {
  const router = useRouter();

  // Animated scale values for buttons
  const termsButtonScale = useRef(new Animated.Value(1)).current;
  const privacyButtonScale = useRef(new Animated.Value(1)).current;


  const handleTermsLink = () => {
    Linking.openURL('https://execudex.framer.website/terms');
  };

  const handlePrivacyLink = () => {
    Linking.openURL('https://execudex.framer.website/privacy');
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerContainer}>
        <TouchableOpacity
          style={styles.headerIconBtn}
          onPress={() => router.back()}
          hitSlop={{ top: 12, left: 12, right: 12, bottom: 12 }}
        >
          <Image source={require('../assets/back1.png')} style={styles.headerIcon} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Legal</Text>
      </View>
      
      {/* Content */}
      <View style={styles.content}>
        <View style={styles.buttonsWrapper}>
          <View style={styles.buttonsContainer}>
            {/* Terms of Service Button */}
            <AnimatedPressable
              onPressIn={() => {
                Haptics.selectionAsync();
                Animated.spring(termsButtonScale, {
                  toValue: 0.95,
                  friction: 6,
                  useNativeDriver: true,
                }).start();
              }}
              onPressOut={() => {
                Animated.spring(termsButtonScale, {
                  toValue: 1,
                  friction: 6,
                  useNativeDriver: true,
                }).start();
              }}
              onPress={handleTermsLink}
              style={[
                styles.legalButton,
                { transform: [{ scale: termsButtonScale }] }
              ]}
            >
              <View style={styles.buttonContent}>
                <View style={styles.buttonTopRow}>
                  <Text style={styles.buttonTitle}>Terms of Service</Text>
                </View>
              </View>
            </AnimatedPressable>

            {/* Privacy Policy Button */}
            <AnimatedPressable
              onPressIn={() => {
                Haptics.selectionAsync();
                Animated.spring(privacyButtonScale, {
                  toValue: 0.95,
                  friction: 6,
                  useNativeDriver: true,
                }).start();
              }}
              onPressOut={() => {
                Animated.spring(privacyButtonScale, {
                  toValue: 1,
                  friction: 6,
                  useNativeDriver: true,
                }).start();
              }}
              onPress={handlePrivacyLink}
              style={[
                styles.legalButton,
                { transform: [{ scale: privacyButtonScale }] }
              ]}
            >
              <View style={styles.buttonContent}>
                <View style={styles.buttonTopRow}>
                  <Text style={styles.buttonTitle}>Privacy Policy</Text>
                </View>
              </View>
            </AnimatedPressable>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#000' 
  },
  content: {
    flex: 1,
    paddingTop: 100, // Leave space for header
    paddingHorizontal: 0,
  },
  // HEADER
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
  headerTitle: {
    position: 'absolute',
    marginTop: 20,
    left: 0,
    right: 0,
    color: '#fff',
    fontSize: 18,
    fontWeight: '400',
    textAlign: 'center',
  },
  // BUTTONS - Styled like legislation cards from exp1
  buttonsWrapper: {
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 0,
    alignItems: 'center',
  },
  buttonsContainer: {
    paddingHorizontal: 0,
    paddingBottom: 20,
  },
  legalButton: {
    backgroundColor: '#030303',
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginBottom: 10,
    width: '95%',
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    borderWidth: 1,
    borderColor: '#101010',
  },
  buttonContent: {
    width: '100%',
    paddingHorizontal: 0,
  },
  buttonTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    width: '100%',
  },
  buttonTitle: {
    color: '#fff',
    fontWeight: '400',
    fontSize: 17,
    flex: 1,
    flexWrap: 'wrap',
    flexShrink: 1,
  },
});

