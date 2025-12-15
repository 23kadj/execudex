import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Image, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { deleteAccountOnServer } from '../services/accountDeletionService';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function AccountDeletion() {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  // Animated scale value for delete button
  const deleteButtonScale = useRef(new Animated.Value(1)).current;


  const confirmAndDelete = () => {
    Alert.alert(
      "Delete Account",
      "Are you sure you want to permanently delete your account? This cannot be undone.\n\nDeleting your Execudex account doesn't cancel your Apple subscription. You can manage or cancel it in your Apple settings.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: handleDelete,
        },
      ],
      { cancelable: true }
    );
  };

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      await deleteAccountOnServer();
      
      // Send the user to onboarding as a fresh app state; replace prevents back navigation
      router.replace({ pathname: '/', params: { logout: 'true' } });
    } catch (e: any) {
      Alert.alert("Delete failed", e?.message ?? "Please try again.");
    } finally {
      setIsDeleting(false);
    }
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
        <Text style={styles.headerTitle}>Account Deletion</Text>
      </View>
      
      {/* Content */}
      <View style={styles.content}>
        <View style={styles.buttonWrapper}>
          <View style={styles.buttonContainer}>
            {/* Delete Account Button */}
            <AnimatedPressable
              onPressIn={() => {
                Haptics.selectionAsync();
                Animated.spring(deleteButtonScale, {
                  toValue: 0.95,
                  friction: 6,
                  useNativeDriver: true,
                }).start();
              }}
              onPressOut={() => {
                Animated.spring(deleteButtonScale, {
                  toValue: 1,
                  friction: 6,
                  useNativeDriver: true,
                }).start();
              }}
              onPress={() => {
                Haptics.selectionAsync();
                confirmAndDelete();
              }}
              disabled={isDeleting}
              style={[
                styles.deleteButton,
                { transform: [{ scale: deleteButtonScale }] }
              ]}
            >
              <View style={styles.buttonContent}>
                <View style={styles.buttonTopRow}>
                  <Text style={styles.buttonTitle}>
                    {isDeleting ? 'Deleting account...' : 'Delete your account?'}
                  </Text>
                </View>
                <View style={styles.buttonBottomRow}>
                  <Text style={styles.buttonSubtitle}>
                    {isDeleting ? 'Please wait' : 'This action is irreversible'}
                  </Text>
                </View>
                {isDeleting && (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color="#ff0000" />
                  </View>
                )}
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
  // BUTTON - Red styled version
  buttonWrapper: {
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 0,
    alignItems: 'center',
  },
  buttonContainer: {
    paddingHorizontal: 0,
    paddingBottom: 20,
  },
  deleteButton: {
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
    borderColor: '#ff0000', // Red border
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
    marginBottom: 4,
  },
  buttonBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    width: '100%',
  },
  buttonTitle: {
    color: '#fff', // White text for visibility on dark background
    fontWeight: '400',
    fontSize: 20,
    flex: 1,
    flexWrap: 'wrap',
    flexShrink: 1,
  },
  buttonSubtitle: {
    color: '#fff', // White subtitle text for visibility on dark background
    fontWeight: '400',
    fontSize: 12,
    flexWrap: 'wrap',
    flexShrink: 1,
  },
  loadingContainer: {
    marginTop: 8,
    alignItems: 'center',
  },
});

