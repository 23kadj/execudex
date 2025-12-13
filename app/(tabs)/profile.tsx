import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useRef } from 'react';
import { Alert, Animated, Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../../components/AuthProvider';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function Profile() {
  const { signOut, user } = useAuth();
  const router = useRouter();
  
  // Animated scale values for account settings cards
  const accountCard2Scale = useRef(new Animated.Value(1)).current;
  const accountCard3Scale = useRef(new Animated.Value(1)).current;
  const accountCard4Scale = useRef(new Animated.Value(1)).current;
  const historyCardScale = useRef(new Animated.Value(1)).current;
  const signOutScale = useRef(new Animated.Value(1)).current;

  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
              // Navigate to onboarding screen after successful sign out
              router.replace('/');
            } catch (error) {
              console.error('Sign out error:', error);
              Alert.alert('Error', 'Failed to sign out. Please try again.');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Fixed Account Header */}
      <View style={styles.fixedHeaderContainer}>
        <Text style={styles.headerTitle}>Account</Text>
      </View>

      <ScrollView 
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Account Settings Cards */}
        <View style={styles.accountCardsWrapper}>
          <View style={styles.accountCardsContainer}>
            {/* Account Settings Card 1 - Subscription */}
            <AnimatedPressable
              onPress={() => {
                Haptics.selectionAsync();
                router.push('/subscription');
              }}
              style={styles.accountCardNew}
            >
              <View style={styles.accountCardContent}>
                <View style={styles.accountTopRow}>
                  <Image 
                    source={require('../../assets/subs.png')} 
                    style={styles.accountCardIcon}
                  />
                  <Text style={styles.accountTitleNew}>Subscription</Text>
                </View>
                <View style={styles.accountBottomRow}>
                  <Text style={styles.accountSubtitleNew}>Manage your current subscription</Text>
                </View>
              </View>
            </AnimatedPressable>

                         {/* Account Settings Card 2 - Support & Feedback */}
             <AnimatedPressable
               onPress={() => {
                 Haptics.selectionAsync();
                 router.push('/feedback');
               }}
               style={styles.accountCardNew}
             >
               <View style={styles.accountCardContent}>
                 <View style={styles.accountTopRow}>
                   <Image 
                     source={require('../../assets/contact.png')} 
                     style={styles.accountCardIcon}
                   />
                   <Text style={styles.accountTitleNew}>Support & Feedback</Text>
                 </View>
                 <View style={styles.accountBottomRow}>
                   <Text style={styles.accountSubtitleNew}>Get in contact with us</Text>
                 </View>
               </View>
             </AnimatedPressable>

             {/* Account Settings Card 3 - Bookmarks */}
             <AnimatedPressable
               onPress={() => {
                 Haptics.selectionAsync();
                 router.push('/bookmarks');
               }}
               style={styles.accountCardNew}
             >
               <View style={styles.accountCardContent}>
                 <View style={styles.accountTopRow}>
                   <Image 
                     source={require('../../assets/bookmark1.png')} 
                     style={styles.accountCardIcon}
                   />
                   <Text style={styles.accountTitleNew}>Bookmarks</Text>
                 </View>
                 <View style={styles.accountBottomRow}>
                   <Text style={styles.accountSubtitleNew}>View all your profile bookmarks</Text>
                 </View>
               </View>
             </AnimatedPressable>

             {/* Account Settings Card 4 - History */}
             <AnimatedPressable
               onPress={() => {
                 Haptics.selectionAsync();
                 router.push('/history');
               }}
               style={styles.accountCardNew}
             >
               <View style={styles.accountCardContent}>
                 <View style={styles.accountTopRow}>
                   <Image 
                     source={require('../../assets/history.png')} 
                     style={styles.accountCardIcon}
                   />
                   <Text style={styles.accountTitleNew}>History</Text>
                 </View>
                 <View style={styles.accountBottomRow}>
                   <Text style={styles.accountSubtitleNew}>View your profile history</Text>
                 </View>
               </View>
             </AnimatedPressable>

             {/* Account Settings Card 5 - Legal */}
             <AnimatedPressable
               onPress={() => {
                 Haptics.selectionAsync();
                 router.push('/legal');
               }}
               style={styles.accountCardNew}
             >
               <View style={styles.accountCardContent}>
                 <View style={styles.accountTopRow}>
                   <Image 
                     source={require('../../assets/legal.png')} 
                     style={styles.accountCardIcon}
                   />
                   <Text style={styles.accountTitleNew}>Legal</Text>
                 </View>
                 <View style={styles.accountBottomRow}>
                   <Text style={styles.accountSubtitleNew}>View our terms and policies</Text>
                 </View>
               </View>
             </AnimatedPressable>

             {/* Account Settings Card 6 - Account Deletion */}
             <AnimatedPressable
               onPress={() => {
                 Haptics.selectionAsync();
                 router.push('/account-deletion');
               }}
               style={styles.accountCardNew}
             >
               <View style={styles.accountCardContent}>
                 <View style={styles.accountTopRow}>
                   <Image 
                     source={require('../../assets/trash.png')} 
                     style={styles.accountCardIcon}
                   />
                   <Text style={styles.accountTitleNew}>Account Deletion</Text>
                 </View>
                 <View style={styles.accountBottomRow}>
                   <Text style={styles.accountSubtitleNew}>Delete your account</Text>
                 </View>
               </View>
             </AnimatedPressable>

             {/* Sign Out Button */}
             <AnimatedPressable
               onPress={() => {
                 Haptics.selectionAsync();
                 handleSignOut();
               }}
               style={styles.signOutCard}
             >
               <View style={styles.accountCardContent}>
                 <View style={styles.accountTopRow}>
                   <Image 
                     source={require('../../assets/signout.png')} 
                     style={styles.accountCardIcon}
                   />
                   <Text style={styles.signOutTitle}>Sign Out</Text>
                 </View>
                 <View style={styles.accountBottomRow}>
                   <Text style={styles.accountSubtitleNew}>
                     {user?.email ? `Signed in as ${user.email}` : 'Sign out of your account'}
                   </Text>
                 </View>
               </View>
             </AnimatedPressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  scrollContent: {
    paddingHorizontal: 0,
    paddingTop: 70,
    paddingBottom: 20,
  },
  fixedHeaderContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    backgroundColor: '#000',
    width: '100%',
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 15,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '500',
    marginBottom: 4,
  },
  headerLine: {
    width: '100%',
    height: 0.2,
    backgroundColor: '#aaa',
  },
  accountCardsWrapper: {
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 0,
    alignItems: 'center',
  },
  accountCardsContainer: {
    paddingHorizontal: 0,
    paddingBottom: 20,
  },
  accountCardNew: {
    backgroundColor: '#050505',
    borderRadius: 20,
    padding: 15,
    marginBottom: 15,
    width: '95%',
    height: 70,
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: '#101010',
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  accountCardContent: {
    width: '100%',
    paddingHorizontal: 0,
    flex: 1,
    justifyContent: 'center',
  },
  accountTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    width: '100%',
    marginBottom: 4,
  },
  accountBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    width: '100%',
    paddingLeft: 30, // Add left padding to align subtitle with title text
  },
  accountCardIcon: {
    position: 'absolute',
    left: 0,
    top: 10,
    width: 20,
    height: 20,
    tintColor: '#fff',
    marginBottom:0
  },
  accountTitleNew: {
    color: '#fff',
    fontWeight: '400',
    fontSize: 18,
    flex: 1,
    marginLeft: 35,
  },
  accountSubtitleNew: {
    color: '#898989',
    fontWeight: '400',
    fontSize: 12,
    marginLeft: 5
  },
  signOutCard: {
    backgroundColor: '#050505',
    borderRadius: 20,
    padding: 15,
    marginBottom: 15,
    width: '95%',
    height: 70,
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: '#101010',
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  signOutTitle: {
    color: '#fff',
    fontWeight: '400',
    fontSize: 18,
    flex: 1,
    marginLeft: 35,
  },
});
