import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../components/AuthProvider';
import { initIap, restorePurchases } from '../iap.apple';
import { iapService } from '../services/iapService';
import { getWeeklyProfileUsage } from '../services/profileAccessService';
import { isIAPAvailable } from '../utils/iapAvailability';
import { getSupabaseClient } from '../utils/supabase';

// Subscription box content - EDIT THESE TO CHANGE TEXT
const BOX_1_CONTENT = {
  title: 'Execudex Basic',
  feature1: 'Access 5 profiles a week',
  feature2: 'Free',
};

const BOX_2_CONTENT = {
  title: 'Execudex Plus',
  feature1: 'Access unlimited profiles',
  feature2: '$7.99 every month',
};

const BOX_3_CONTENT = {
  title: 'Execudex Basic 3 Month Plan',
  feature1: 'Access 5 profiles a week',
  feature2: '$12.99 every 3 months',
};

const BOX_4_CONTENT = {
  title: 'Execudex Plus 3 Month Plan',
  feature1: 'Access unlimited profiles',
  feature2: '$14.99 every 3 months',
};

export default function Subscription() {
  const router = useRouter();
  const { user } = useAuth();
  const [profileUsage, setProfileUsage] = useState<{
    profilesUsed: number;
    plan: string;
    cycle?: string;
  } | null>(null);
  const [loadingUsage, setLoadingUsage] = useState(true);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  // Initialize IAP service and fetch usage data
  // Delay IAP initialization slightly to ensure UI is fully mounted (prevents release crashes)
  useEffect(() => {
    const initializeIAP = async () => {
      // Small delay to ensure UI is fully mounted before initializing IAP
      // This prevents crashes in release builds from initializing too early
      await new Promise(resolve => setTimeout(resolve, 100));
      
      try {
        await iapService.initialize();
        await initIap(); // Initialize the MVP IAP module
        console.log('✅ IAP service initialized');
      } catch (error) {
        console.error('❌ Failed to initialize IAP service:', error);
      }
    };

    const fetchUsage = async () => {
      if (user?.id) {
        try {
          const usage = await getWeeklyProfileUsage(user.id);
          setProfileUsage({
            profilesUsed: usage.profilesUsed,
            plan: usage.plan,
            cycle: usage.cycle,
          });
        } catch (error) {
          console.error('Error fetching profile usage:', error);
        } finally {
          setLoadingUsage(false);
        }
      }
    };

    initializeIAP();
    fetchUsage();

    // Set up purchase listeners
    const cleanup = iapService.setupPurchaseListeners(
      async (purchase) => {
        try {
          console.log('Purchase successful:', purchase);
          
          // Validate receipt with Apple for security
          if (user?.id && (purchase as any).transactionReceipt) {
            const { data, error } = await getSupabaseClient().functions.invoke('verify_receipt', {
              body: {
                receiptData: (purchase as any).transactionReceipt,
                userId: user.id
              }
            });

            if (error) {
              console.error('❌ Receipt validation failed:', error);
              Alert.alert('Error', 'Failed to validate purchase. Please contact support.');
              return;
            }

            console.log('✅ Receipt validated successfully:', data);
          }
          
          // Show success message
          iapService.showPurchaseSuccess();
          
          // Refresh profile usage to reflect new plan
          fetchUsage();
          
        } catch (error) {
          console.error('❌ Error processing purchase:', error);
          Alert.alert('Error', 'Failed to activate subscription. Please contact support.');
        } finally {
          setIsPurchasing(false);
        }
      },
      (error) => {
        console.error('Purchase error:', error);
        iapService.showPurchaseError(error);
        setIsPurchasing(false);
      }
    );

    return cleanup;
  }, [user]);


  const handlePurchase = async (productId: string) => {
    if (!user?.id) {
      Alert.alert('Error', 'You must be logged in to make a purchase.');
      return;
    }

    setIsPurchasing(true);
    try {
      await iapService.purchaseSubscription(productId as any);
    } catch (error: any) {
      console.error('Purchase failed:', error);
      setIsPurchasing(false);
      if (error.message !== 'Purchase was cancelled by user') {
        Alert.alert('Purchase Error', error.message || 'Purchase failed. Please try again.');
      }
    }
  };

  const handleRestorePurchases = async () => {
    if (!user?.id) {
      Alert.alert('Error', 'You must be logged in to restore purchases.');
      return;
    }

    setIsRestoring(true);
    try {
      const purchases = await restorePurchases();
      // If we see ANY Execudex Plus purchase, restore Plus (and derive the billing cycle from the SKU).
      const matchingPurchases = (purchases ?? []).filter((p: any) =>
        ['execudex.plus.monthly', 'execudex.plus.quarterly'].includes(p?.productId)
      );

      const parseTs = (p: any): number => {
        const raw =
          p?.transactionDate ??
          p?.originalTransactionDate ??
          p?.purchaseDate ??
          p?.purchaseTime ??
          0;
        const n = typeof raw === 'string' ? parseInt(raw, 10) : Number(raw);
        return Number.isFinite(n) ? n : 0;
      };

      const bestPurchase =
        matchingPurchases
          .slice()
          .sort((a: any, b: any) => parseTs(b) - parseTs(a))[0] ?? null;

      if (bestPurchase) {
        const cycle = String(bestPurchase.productId).includes('quarterly') ? 'quarterly' : 'monthly';

        // Update user subscription using the Edge Function (Supabase is the source of truth)
        await iapService.updateUserSubscription(user.id, {
          plan: 'plus',
          cycle,
          transactionId: bestPurchase?.transactionId,
          purchaseDate: bestPurchase?.transactionDate
            ? new Date(parseTs(bestPurchase)).toISOString()
            : undefined,
        });
        
        Alert.alert('Restored', 'Your subscription has been restored.');
        
        // Refresh profile usage
        const usage = await getWeeklyProfileUsage(user.id);
        setProfileUsage({
          profilesUsed: usage.profilesUsed,
          plan: usage.plan,
          cycle: usage.cycle,
        });
      } else {
        Alert.alert('No purchases found', 'We couldn\'t find prior subscriptions for this Apple ID.');
      }
    } catch (e: any) {
      Alert.alert('Restore failed', e?.message ?? 'Please try again.');
    } finally {
      setIsRestoring(false);
    }
  };

  const handleManageSubscription = async () => {
    const url = "https://apps.apple.com/account/subscriptions";
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    } else {
      console.warn("Cannot open App Store subscriptions page");
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
        <Text style={styles.headerTitle}>Subscription</Text>
      </View>
      
      {/* Scrollable Content */}
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Usage Display - For Both Basic and Plus Plans */}
        {profileUsage && (
          <View style={styles.usageBox}>
            <Text style={styles.usageTitle}>Weekly Profile Usage</Text>
            {loadingUsage ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                {profileUsage.plan === 'basic' ? (
                  <>
                    {/* Basic Plan Display */}
                    <Text style={styles.usageCount}>
                      {profileUsage.profilesUsed} / 5 profiles 
                    </Text>
                    <View style={styles.progressBarContainer}>
                      <View 
                        style={[
                          styles.progressBar, 
                          { 
                            width: `${(profileUsage.profilesUsed / 5) * 100}%`,
                            backgroundColor: profileUsage.profilesUsed >= 4 ? '#ef4444' : '#22c55e'
                          }
                        ]} 
                      />
                    </View>
                    <Text style={styles.usageSubtext}>
                      {profileUsage.profilesUsed >= 5 
                        ? 'You\'ve reached your weekly limit. Resets on Sunday.' 
                        : `${5 - profileUsage.profilesUsed} profile${5 - profileUsage.profilesUsed === 1 ? '' : 's'} remaining this week.`}
                    </Text>
                  </>
                ) : (
                  <>
                    {/* Plus Plan Display */}
                    <Text style={styles.usageCount}>
                      {profileUsage.profilesUsed} profiles this week
                    </Text>
                    <View style={styles.progressBarContainer}>
                      <View 
                        style={[
                          styles.progressBar, 
                          { 
                            width: '100%',
                            backgroundColor: '#22c55e'
                          }
                        ]} 
                      />
                    </View>
                    <Text style={styles.usageSubtext}>
                      {`Execudex Plus${profileUsage.cycle ? ` (${profileUsage.cycle})` : ''} — unlimited profiles`}
                    </Text>
                  </>
                )}
              </>
            )}
          </View>
        )}

        {/* First Rectangle - Execudex Basic */}
        <View style={styles.subscriptionBox}>
          <View style={styles.subscriptionBoxContent}>
            <Text style={styles.subscriptionBoxTitle}>{BOX_1_CONTENT.title}</Text>
            
            <View style={styles.subscriptionFeatureRow}>
              <Image 
                source={require('../assets/check.png')} 
                style={styles.subscriptionCheckIcon}
              />
              <Text style={styles.subscriptionFeatureText}>
                {BOX_1_CONTENT.feature1}
              </Text>
            </View>
            
            <View style={[styles.subscriptionFeatureRow, { marginBottom: 2 }]}>
              <Image 
                source={require('../assets/check.png')} 
                style={styles.subscriptionCheckIcon}
              />
              <Text style={styles.subscriptionFeatureText}>
                {BOX_1_CONTENT.feature2}
              </Text>
            </View>
          </View>
        </View>

        {/* Second Rectangle - Execudex Plus */}
        <View style={styles.subscriptionBox}>
          <View style={styles.subscriptionBoxContent}>
            <Text style={styles.subscriptionBoxTitle}>{BOX_2_CONTENT.title}</Text>
            
            <View style={styles.subscriptionFeatureRow}>
              <Image 
                source={require('../assets/check.png')} 
                style={styles.subscriptionCheckIcon}
              />
              <Text style={styles.subscriptionFeatureText}>
                {BOX_2_CONTENT.feature1}
              </Text>
            </View>
            
            <View style={[styles.subscriptionFeatureRow, { marginBottom: 2 }]}>
              <Image 
                source={require('../assets/check.png')} 
                style={styles.subscriptionCheckIcon}
              />
              <Text style={styles.subscriptionFeatureText}>
                {BOX_2_CONTENT.feature2}
              </Text>
            </View>
          </View>
        </View>

        {/* Third Rectangle - Execudex Plus 3 Month Plan */}
        <View style={styles.subscriptionBox}>
          <View style={styles.subscriptionBoxContent}>
            <Text style={styles.subscriptionBoxTitle}>{BOX_4_CONTENT.title}</Text>
            
            <View style={styles.subscriptionFeatureRow}>
              <Image 
                source={require('../assets/check.png')} 
                style={styles.subscriptionCheckIcon}
              />
              <Text style={styles.subscriptionFeatureText}>
                {BOX_4_CONTENT.feature1}
              </Text>
            </View>
            
            <View style={[styles.subscriptionFeatureRow, { marginBottom: 2 }]}>
              <Image 
                source={require('../assets/check.png')} 
                style={styles.subscriptionCheckIcon}
              />
              <Text style={styles.subscriptionFeatureText}>
                {BOX_4_CONTENT.feature2}
              </Text>
            </View>
          </View>
        </View>

        {/* Restore Purchases Button */}
        {isIAPAvailable() && (
          <TouchableOpacity
            style={[styles.submitButton, isRestoring && styles.submitButtonDisabled]}
            onPress={handleRestorePurchases}
            disabled={isRestoring || isPurchasing}
            activeOpacity={0.7}
          >
            {isRestoring ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.submitButtonText}>
                Restore Purchases
              </Text>
            )}
          </TouchableOpacity>
        )}

        {/* Manage Subscription Button */}
        <TouchableOpacity
          style={styles.submitButton}
          onPress={handleManageSubscription}
          activeOpacity={0.7}
        >
          <Text style={styles.submitButtonText}>
            Manage Subscription
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#000' 
  },

  scrollView: {
    flex: 1,
  },

  content: {
    paddingTop: 100, // Leave space for header
    paddingHorizontal: 10,
    paddingBottom: 40,
  },

  // Subscription Boxes
  subscriptionBox: {
    width: '100%',
    backgroundColor: '#0',
    borderRadius: 20,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#101010',
    padding: 20,
    justifyContent: 'center',
    height: 105,
  },

  subscriptionBoxContent: {
    justifyContent: 'space-between',
  },

  subscriptionBoxTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },

  subscriptionFeatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },

  subscriptionCheckIcon: {
    width: 16,
    height: 16,
    marginRight: 10,
    tintColor: '#22c55e',
  },

  subscriptionFeatureText: {
    fontSize: 14,
    color: '#aaa',
    fontWeight: '400',
  },

  // USAGE BOX
  usageBox: {
    width: '100%',
    backgroundColor: '#0',
    borderRadius: 20,
    marginBottom: 20,
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: '#1a1a1a',
    padding: 20,
  },
  usageTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  usageCount: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 12,
  },
  progressBarContainer: {
    width: '100%',
    height: 8,
    backgroundColor: '#1a1a1a',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
  usageSubtext: {
    fontSize: 13,
    color: '#888',
    fontWeight: '400',
  },

  // PURCHASE BUTTON
  purchaseButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  purchaseButtonDisabled: {
    backgroundColor: '#4A4A4A',
    opacity: 0.6,
  },
  purchaseButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },

  // SUBMIT BUTTON
  submitButton: {
    backgroundColor: '#0',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
    marginBottom: 20,
    borderColor: '#101010',
    borderWidth: 1,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

  // HEADER - identical to feedback.tsx
  headerContainer: {
    position: 'absolute',
    top: 30, // edit this to move header up/down
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
  // HEADER TITLE - identical to feedback.tsx
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
});

