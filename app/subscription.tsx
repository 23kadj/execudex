import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Image, Linking, Pressable, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../components/AuthProvider';
import { Typography } from '../constants/Typography';
import { initIap, restorePurchases } from '../iap.apple';
import { iapService } from '../services/iapService';
import { getWeeklyProfileUsage } from '../services/profileAccessService';
import { isIAPAvailable } from '../utils/iapAvailability';
import { getSupabaseClient } from '../utils/supabase';

// Subscription box content - EDIT THESE TO CHANGE TEXT
const BOX_1_CONTENT = {
  title: 'Execudex Basic',
  feature1: 'Access 10 profiles a week',
  feature2: '3 Day Trial then $4.99 a month',
};

const BOX_2_CONTENT = {
  title: 'Execudex Plus',
  feature1: 'Access unlimited profiles',
  feature2: '$7.99 every month',
};

const BOX_3_CONTENT = {
  title: 'Execudex Basic 3 Month Plan',
  feature1: 'Access 10 profiles a week',
  feature2: '$12.99 every 3 months',
};

const BOX_4_CONTENT = {
  title: 'Execudex Plus 3 Month Plan',
  feature1: 'Access unlimited profiles',
  feature2: '$14.99 every 3 months',
};

export default function Subscription() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [profileUsage, setProfileUsage] = useState<{
    profilesUsed: number;
    plan: string;
    cycle?: string;
  } | null>(null);
  const [loadingUsage, setLoadingUsage] = useState(true);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  
  // State for selected subscription (for switching)
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [selectedCycle, setSelectedCycle] = useState<string | null>(null);
  
  // Flag to prevent duplicate purchase processing
  const [isProcessingPurchase, setIsProcessingPurchase] = useState(false);
  
  // Animation values for bounce effect
  const box1Scale = useRef(new Animated.Value(1)).current;
  const box2Scale = useRef(new Animated.Value(1)).current;
  const box3Scale = useRef(new Animated.Value(1)).current;

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

    const checkAndEnforceDowngrade = async () => {
      if (!user?.id) return;
      
      try {
        const supabase = getSupabaseClient();
        const { data: userData, error } = await supabase
          .from('users')
          .select('plus_til, plan')
          .eq('uuid', user.id)
          .single();

        if (error) {
          console.error('Error checking plus_til:', error);
          return;
        }

        // If plus_til is set and current time has passed it, enforce downgrade
        if (userData?.plus_til) {
          const plusTilDate = new Date(userData.plus_til);
          const now = new Date();
          
          if (now >= plusTilDate && userData.plan === 'plus') {
            console.log('🔽 Enforcing automatic downgrade to basic');
            
            // Update user to basic plan
            const { error: updateError } = await supabase
              .from('users')
              .update({
                plan: 'basic',
                plus_til: null,
                cycle: null
              })
              .eq('uuid', user.id);

            if (updateError) {
              console.error('Error enforcing downgrade:', updateError);
            } else {
              console.log('✅ Automatic downgrade completed');
            }
          }
        }
      } catch (error) {
        console.error('Error in downgrade enforcement:', error);
      }
    };

    const fetchUsage = async () => {
      if (user?.id) {
        try {
          // Check and enforce downgrade first
          await checkAndEnforceDowngrade();
          
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
        // Prevent duplicate processing
        if (isProcessingPurchase) {
          console.log('⚠️ Already processing a purchase, ignoring duplicate');
          return;
        }
        
        setIsProcessingPurchase(true);
        
        try {
          console.log('Purchase successful:', purchase);
          
          if (!user?.id) {
            throw new Error('User not authenticated');
          }
          
          // Parse transaction data from Apple
          await handlePurchaseSuccess(purchase);
          
        } catch (error) {
          console.error('❌ Error processing purchase:', error);
          Alert.alert('Error', 'Failed to activate subscription. Please contact support.');
        } finally {
          setIsPurchasing(false);
          // Reset processing flag after a delay to prevent rapid retriggers
          setTimeout(() => setIsProcessingPurchase(false), 2000);
        }
      },
      (error) => {
        console.error('Purchase error:', error);
        iapService.showPurchaseError(error);
        setIsPurchasing(false);
        setIsProcessingPurchase(false);
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
      // Check for all Execudex subscriptions (Basic and Plus), prioritize Plus if both exist
      const allExecudexProducts = ['execudex.basic', 'execudex.plus.monthly', 'execudex.plus.quarterly'];
      const matchingPurchases = (purchases ?? []).filter((p: any) =>
        allExecudexProducts.includes(p?.productId)
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

      // Separate Plus and Basic purchases, prioritize Plus
      const plusPurchases = matchingPurchases.filter((p: any) => 
        p?.productId?.includes('plus')
      );
      const basicPurchases = matchingPurchases.filter((p: any) => 
        p?.productId === 'execudex.basic'
      );

      // Use Plus if available, otherwise Basic
      const purchasesToCheck = plusPurchases.length > 0 ? plusPurchases : basicPurchases;
      const bestPurchase =
        purchasesToCheck
          .slice()
          .sort((a: any, b: any) => parseTs(b) - parseTs(a))[0] ?? null;

      if (bestPurchase) {
        const productId = bestPurchase.productId;
        const plan = productId === 'execudex.basic' ? 'basic' : 'plus';
        const cycle = String(productId).includes('quarterly') ? 'quarterly' : 'monthly';

        // Update user subscription using the Edge Function (Supabase is the source of truth)
        await iapService.updateUserSubscription(user.id, {
          plan,
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

  const handleSubscriptionSelect = (plan: string, cycle: string) => {
    // Check if this is the current subscription
    const isCurrentSubscription = 
      profileUsage?.plan === plan && 
      (cycle === 'monthly' ? profileUsage?.cycle === 'monthly' : profileUsage?.cycle === 'quarterly');
    
    // Don't allow selecting current subscription
    if (isCurrentSubscription) {
      return;
    }

    // Toggle selection - if clicking the same one, deselect
    if (selectedPlan === plan && selectedCycle === cycle) {
      setSelectedPlan(null);
      setSelectedCycle(null);
    } else {
      setSelectedPlan(plan);
      setSelectedCycle(cycle);
    }
  };

  const handlePurchaseSuccess = async (purchase: any) => {
    if (!user?.id) return;

    try {
      // Parse Apple transaction data
      const productId = purchase.productId;
      const transactionId = purchase.transactionId || purchase.originalTransactionId;
      
      // Determine cycle from product ID
      const newCycle = productId.includes('quarterly') ? 'quarterly' : 'monthly';
      
      // Update Supabase - Only Basic → Plus upgrades allowed
      await updateSubscriptionInSupabase(newCycle, transactionId, purchase);

      // Show success alert
      Alert.alert(
        'Purchase Successful',
        'Your subscription has been activated! You now have access to unlimited profiles.',
        [{ text: 'OK' }]
      );

      // Refresh usage data
      const usage = await getWeeklyProfileUsage(user.id);
      setProfileUsage({
        profilesUsed: usage.profilesUsed,
        plan: usage.plan,
        cycle: usage.cycle,
      });

      // Clear selection
      setSelectedPlan(null);
      setSelectedCycle(null);

    } catch (error) {
      console.error('❌ Error in handlePurchaseSuccess:', error);
      throw error;
    }
  };

  const updateSubscriptionInSupabase = async (
    newCycle: string,
    transactionId: string,
    purchase: any
  ) => {
    if (!user?.id) return;

    const supabase = getSupabaseClient();
    
    try {
      // Upgrade: Basic → Plus (immediate)
      const { error } = await supabase
        .from('users')
        .update({
          plan: 'plus' as const,
          cycle: newCycle as 'monthly' | 'quarterly',
          plus_til: null,
          last_transaction_id: transactionId
        })
        .eq('uuid', user.id);

      if (error) throw error;
      console.log('✅ Upgraded to Plus');

      // Log to sub_logs
      const currentLogs = (await supabase
        .from('users')
        .select('sub_logs')
        .eq('uuid', user.id)
        .single()).data?.sub_logs || '';

      const newLog = `${new Date().toISOString()} | UPGRADE | Basic → Plus ${newCycle} | TxnID: ${transactionId}`;
      const updatedLogs = currentLogs ? `${currentLogs}\n${newLog}` : newLog;

      await supabase
        .from('users')
        .update({ sub_logs: updatedLogs })
        .eq('uuid', user.id);

    } catch (error) {
      console.error('❌ Supabase update failed:', error);
      
      // Retry once
      try {
        console.log('🔄 Retrying Supabase update...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const { error: retryError } = await supabase
          .from('users')
          .update({
            plan: 'plus' as const,
            cycle: newCycle as 'monthly' | 'quarterly',
            plus_til: null,
            last_transaction_id: transactionId
          })
          .eq('uuid', user.id);

        if (retryError) {
          throw retryError;
        }
        
        console.log('✅ Retry successful');
      } catch (retryError) {
        console.error('❌ Retry failed:', retryError);
        Alert.alert(
          'Purchase Successful',
          'Purchase successful. If your account does not update soon, contact Execudex Support.'
        );
      }
    }
  };

  const handlePurchaseButtonPress = async () => {
    if (!selectedPlan || !selectedCycle || !user?.id) {
      return;
    }

    const currentPlan = profileUsage?.plan || 'basic';

    // ONLY allow Basic → Plus upgrades
    if (currentPlan !== 'basic') {
      Alert.alert(
        'Manage Subscription',
        'To make changes to your subscription, please use the "Manage Subscription" button to go to the App Store.',
        [{ text: 'OK' }]
      );
      return;
    }

    // User is on Basic, only allow Plus selection
    if (selectedPlan !== 'plus') {
      Alert.alert(
        'Invalid Selection',
        'Please select a Plus subscription to upgrade.',
        [{ text: 'OK' }]
      );
      return;
    }

    if (!isIAPAvailable()) {
      Alert.alert(
        'In-App Purchases Unavailable',
        'Please switch to a production build to complete the purchase.'
      );
      return;
    }

    setIsPurchasing(true);
    
    try {
      // Determine product ID based on cycle
      const productId = selectedCycle === 'quarterly' 
        ? 'execudex.plus.quarterly' 
        : 'execudex.plus.monthly';

      console.log('🛒 Initiating purchase for:', productId);
      
      // Call the existing StoreKit purchase flow
      await iapService.purchaseSubscription(productId as any);
      
      // Success/error handled by purchase listeners
      
    } catch (error: any) {
      console.error('❌ Purchase failed:', error);
      setIsPurchasing(false);
      
      if (error.message !== 'Purchase was cancelled by user') {
        Alert.alert('Purchase Error', error.message || 'Purchase failed. Please try again.');
      }
    }
  };

  // Helper function to render a subscription box
  const renderSubscriptionBox = (plan: string, cycle: string, boxContent: typeof BOX_1_CONTENT, scaleAnim: Animated.Value) => {
    const isCurrentSubscription = 
      profileUsage?.plan === plan && 
      (cycle === 'monthly' ? profileUsage?.cycle === 'monthly' : profileUsage?.cycle === 'quarterly');
    const isSelected = selectedPlan === plan && selectedCycle === cycle;

    return (
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <Pressable
          onPress={() => handleSubscriptionSelect(plan, cycle)}
          onPressIn={() => {
            if (!isCurrentSubscription) {
              Haptics.selectionAsync();
              Animated.spring(scaleAnim, { toValue: 0.95, friction: 6, useNativeDriver: true }).start();
            }
          }}
          onPressOut={() => {
            Animated.spring(scaleAnim, { toValue: 1, friction: 6, useNativeDriver: true }).start();
          }}
          style={[
            styles.subscriptionBox,
            isSelected && styles.subscriptionBoxSelected,
            isCurrentSubscription && styles.subscriptionBoxCurrent
          ]}
          disabled={isCurrentSubscription}
        >
          <View style={styles.subscriptionBoxContent}>
            <Text style={styles.subscriptionBoxTitle}>{boxContent.title}</Text>
            
            <View style={styles.subscriptionFeatureRow}>
              <Image 
                source={require('../assets/check.png')} 
                style={styles.subscriptionCheckIcon}
              />
              <Text style={styles.subscriptionFeatureText}>
                {boxContent.feature1}
              </Text>
            </View>
            
            <View style={[styles.subscriptionFeatureRow, { marginBottom: 2 }]}>
              <Image 
                source={require('../assets/check.png')} 
                style={styles.subscriptionCheckIcon}
              />
              <Text style={styles.subscriptionFeatureText}>
                {boxContent.feature2}
              </Text>
            </View>
          </View>
        </Pressable>
      </Animated.View>
    );
  };

  // Helper function to get subscription boxes in order (current subscription first)
  const getOrderedSubscriptionBoxes = () => {
    const boxes = [
      { plan: 'basic', cycle: 'monthly', content: BOX_1_CONTENT, scale: box1Scale },
      { plan: 'plus', cycle: 'monthly', content: BOX_2_CONTENT, scale: box2Scale },
      { plan: 'plus', cycle: 'quarterly', content: BOX_4_CONTENT, scale: box3Scale },
    ];

    // Sort so current subscription is first
    return boxes.sort((a, b) => {
      const aIsCurrent = profileUsage?.plan === a.plan && 
        (a.cycle === 'monthly' ? profileUsage?.cycle === 'monthly' : profileUsage?.cycle === 'quarterly');
      const bIsCurrent = profileUsage?.plan === b.plan && 
        (b.cycle === 'monthly' ? profileUsage?.cycle === 'monthly' : profileUsage?.cycle === 'quarterly');
      
      if (aIsCurrent) return -1;
      if (bIsCurrent) return 1;
      return 0;
    });
  };

  const HEADER_BAR_HEIGHT = 60;
  const headerTotalHeight = HEADER_BAR_HEIGHT + insets.top;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      {/* Header */}
      <View style={[styles.headerContainer, { paddingTop: insets.top, height: headerTotalHeight }]}>
        <TouchableOpacity
          style={styles.headerIconBtn}
          onPress={() => router.back()}
          hitSlop={{ top: 12, left: 12, right: 12, bottom: 12 }}
        >
          <Image source={require('../assets/back1.png')} style={styles.headerIcon} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Subscription</Text>
        <View style={styles.headerRightSpacer} />
      </View>
      
      {/* Scrollable Content */}
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingTop: headerTotalHeight + 24 }]}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="never"
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
                      {profileUsage.profilesUsed} / 10 profiles 
                    </Text>
                    <View style={styles.progressBarContainer}>
                      <View 
                        style={[
                          styles.progressBar, 
                          { 
                            width: `${(profileUsage.profilesUsed / 10) * 100}%`,
                            backgroundColor: profileUsage.profilesUsed >= 8 ? '#ef4444' : '#22c55e'
                          }
                        ]} 
                      />
                    </View>
                    <Text style={styles.usageSubtext}>
                      {profileUsage.profilesUsed >= 10 
                        ? 'You\'ve reached your weekly limit. Resets on Sunday.' 
                        : `${10 - profileUsage.profilesUsed} profile${10 - profileUsage.profilesUsed === 1 ? '' : 's'} remaining this week.`}
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
                
                {/* Subscription Renewal Disclaimer */}
                <Text style={styles.renewalDisclaimerText}>
                  Subscriptions automatically renew unless canceled at least 24 hours before the end of the current period. Payment will be charged to your Apple ID account. You can manage or cancel your subscription in your Apple ID settings.
                </Text>
              </>
            )}
          </View>
        )}

        {/* Subscription Boxes - Ordered with current subscription first */}
        {getOrderedSubscriptionBoxes().map((box, index) => (
          <React.Fragment key={`${box.plan}-${box.cycle}`}>
            {renderSubscriptionBox(box.plan, box.cycle, box.content, box.scale)}
          </React.Fragment>
        ))}

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

        {/* Purchase Subscription Button */}
        <TouchableOpacity
          style={[
            styles.submitButton, 
            (!selectedPlan || !selectedCycle || isPurchasing) && styles.submitButtonDisabled
          ]}
          onPress={handlePurchaseButtonPress}
          disabled={!selectedPlan || !selectedCycle || isPurchasing}
          activeOpacity={0.7}
        >
          {isPurchasing ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={[
              styles.submitButtonText,
              (!selectedPlan || !selectedCycle) && styles.submitButtonTextDisabled
            ]}>
              {(() => {
                // Determine button text based on upgrade/downgrade
                if (!selectedPlan || !selectedCycle) {
                  return 'Purchase Subscription';
                }
                
                const currentPlan = profileUsage?.plan;
                
                // User is on Plus and selected Basic → Downgrade
                if (currentPlan === 'plus' && selectedPlan === 'basic') {
                  return 'Downgrade Subscription';
                }
                
                // User is on Basic and selected Plus → Upgrade
                if (currentPlan === 'basic' && selectedPlan === 'plus') {
                  return 'Upgrade Subscription';
                }
                
                // Default (e.g., switching between monthly/quarterly on same tier)
                return 'Purchase Subscription';
              })()}
            </Text>
          )}
        </TouchableOpacity>

        {/* Manage Subscription Button */}
        <TouchableOpacity
          style={[styles.submitButton, styles.submitButtonClose]}
          onPress={handleManageSubscription}
          activeOpacity={0.7}
        >
          <Text style={styles.submitButtonText}>
            Manage Subscription
          </Text>
        </TouchableOpacity>

        {/* Terms and Privacy Links */}
        <View style={styles.termsAgreementContainer}>
          <Text style={styles.termsAgreementText}>
            By subscribing, you agree to the{' '}
            <Text 
              style={styles.termsLink}
              onPress={() => Linking.openURL('https://www.apple.com/legal/internet-services/itunes/dev/stdeula/')}
            >
              Terms of Use
            </Text>
            {' '}and{' '}
            <Text 
              style={styles.termsLink}
              onPress={() => Linking.openURL('https://execudex.dev/privacy')}
            >
              Privacy Policy
            </Text>
          </Text>
        </View>
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
    backgroundColor: '#000',
  },

  content: {
    paddingHorizontal: 10,
    paddingBottom: 40,
  },

  // Subscription Boxes
  subscriptionBox: {
    width: '100%',
    backgroundColor: '#000',
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

  subscriptionBoxSelected: {
    borderColor: '#fff',
  },

  subscriptionBoxCurrent: {
    // Current subscription - visually the same but not clickable
  },

  // USAGE BOX
  usageBox: {
    width: '100%',
    backgroundColor: '#000',
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
  renewalDisclaimerText: {
    fontSize: 11,
    color: '#666',
    fontWeight: '400',
    marginTop: 5,
    lineHeight: 16,
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
    backgroundColor: '#000',
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
  submitButtonClose: {
    marginTop: -13,  // Reduce space between Purchase and Manage buttons
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  submitButtonTextDisabled: {
    color: '#666',
  },

  // HEADER - identical to feedback.tsx
  headerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
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
    flex: 1,
    color: '#fff',
    fontSize: 18,
    fontWeight: '400',
    textAlign: 'center',
  },
  headerRightSpacer: {
    width: 48, // keeps title centered vs back button (matches icon button width incl. margin)
  },

  // Terms Agreement
  termsAgreementContainer: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    alignItems: 'center',
  },
  termsAgreementText: {
    color: '#888',
    fontSize: Typography.termsAgreementFontSize,
    textAlign: 'center',
    lineHeight: Typography.termsAgreementLineHeight,
  },
  termsLink: {
    color: '#fff',
    fontWeight: 'bold',
  },
});

