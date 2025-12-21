import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Image, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
  feature2: 'Free of Charge',
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
  
  // State for selected subscription (for switching)
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [selectedCycle, setSelectedCycle] = useState<string | null>(null);
  
  // Modal state for subscription status
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState<{
    currentPlan: string;
    currentExpiration: string;
    nextPlan: string;
    nextBegins: string;
  } | null>(null);
  
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
          .eq('id', user.id)
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
              .eq('id', user.id);

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
      // Validate receipt with Apple for security
      let validatedData = null;
      if (purchase.transactionReceipt) {
        const { data, error } = await getSupabaseClient().functions.invoke('verify_receipt', {
          body: {
            receiptData: purchase.transactionReceipt,
            userId: user.id
          }
        });

        if (error) {
          console.error('❌ Receipt validation failed:', error);
        } else {
          validatedData = data;
          console.log('✅ Receipt validated successfully:', data);
        }
      }

      // Parse Apple transaction data
      const productId = purchase.productId;
      const transactionDate = purchase.transactionDate ? new Date(parseInt(purchase.transactionDate)) : new Date();
      
      // Determine cycle from product ID
      const newCycle = productId.includes('quarterly') ? 'quarterly' : 'monthly';
      const newPlan = 'plus'; // Always plus since we're purchasing
      
      // Calculate expiration date (approximate - Apple will provide actual)
      // For now, use standard periods: monthly = 30 days, quarterly = 90 days
      const expirationDate = new Date(transactionDate);
      if (newCycle === 'quarterly') {
        expirationDate.setDate(expirationDate.getDate() + 90);
      } else {
        expirationDate.setDate(expirationDate.getDate() + 30);
      }

      const currentPlan = profileUsage?.plan || 'basic';
      const currentCycle = profileUsage?.cycle || 'monthly';
      
      // Determine if this is an upgrade or switch
      // Note: Downgrade (Plus → Basic) is handled via Apple subscription cancellation, not purchase
      const isUpgrade = currentPlan === 'basic' && newPlan === 'plus';
      const isSwitch = currentPlan === 'plus' && newPlan === 'plus' && currentCycle !== newCycle;

      // Update Supabase based on transaction type
      await updateSubscriptionInSupabase(newPlan, newCycle, isUpgrade, expirationDate, purchase);

      // Prepare status modal data
      const formatDate = (date: Date) => {
        return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
      };

      const currentPlanName = isUpgrade 
        ? `Plus ${newCycle === 'quarterly' ? 'Quarterly' : 'Monthly'}` 
        : `${currentPlan === 'plus' ? 'Plus' : 'Basic'} ${currentCycle === 'quarterly' ? 'Quarterly' : 'Monthly'}`;
      
      const nextPlanName = `Plus ${newCycle === 'quarterly' ? 'Quarterly' : 'Monthly'}`;

      setSubscriptionStatus({
        currentPlan: currentPlanName,
        currentExpiration: formatDate(isUpgrade ? new Date() : expirationDate),
        nextPlan: nextPlanName,
        nextBegins: formatDate(isUpgrade ? new Date() : expirationDate)
      });

      // Show modal
      setShowStatusModal(true);

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
    newPlan: string, 
    newCycle: string, 
    isUpgrade: boolean,
    expirationDate: Date,
    purchase: any
  ) => {
    if (!user?.id) return;

    const supabase = getSupabaseClient();
    
    try {
      if (isUpgrade) {
        // Upgrade: Basic → Plus (immediate)
        const { error } = await supabase
          .from('users')
          .update({
            plan: 'plus' as const,
            cycle: newCycle as 'monthly' | 'quarterly',
            plus_til: null
          })
          .eq('id', user.id);

        if (error) throw error;
        console.log('✅ Upgraded to Plus');

      } else {
        // Switch: Plus Monthly ↔ Plus Quarterly
        const { error } = await supabase
          .from('users')
          .update({
            plan: 'plus' as const,
            cycle: newCycle as 'monthly' | 'quarterly',
            plus_til: null
          })
          .eq('id', user.id);

        if (error) throw error;
        console.log('✅ Switched Plus subscription type');
      }

      // Also call the update subscription Edge Function if it exists
      try {
        await iapService.updateUserSubscription(user.id, {
          plan: newPlan as 'basic' | 'plus',
          cycle: newCycle as 'monthly' | 'quarterly',
          transactionId: purchase.transactionId,
          purchaseDate: purchase.transactionDate 
            ? new Date(parseInt(purchase.transactionDate)).toISOString()
            : new Date().toISOString()
        });
      } catch (edgeFnError) {
        console.warn('⚠️ Edge function update failed (non-critical):', edgeFnError);
      }

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
            plus_til: null
          })
          .eq('id', user.id);

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

    if (!isIAPAvailable()) {
      Alert.alert(
        'In-App Purchases Unavailable',
        'Please switch to a production build to complete the purchase.'
      );
      return;
    }

    setIsPurchasing(true);
    
    try {
      // Determine product ID based on selection
      let productId: string;
      
      if (selectedPlan === 'plus' && selectedCycle === 'monthly') {
        productId = 'execudex.plus.monthly';
      } else if (selectedPlan === 'plus' && selectedCycle === 'quarterly') {
        productId = 'execudex.plus.quarterly';
      } else {
        // Basic selected - this means downgrade
        // For downgrade, we don't purchase anything - user cancels their subscription
        Alert.alert(
          'Downgrade to Basic',
          'To downgrade to Basic, please cancel your current subscription using the "Manage Subscription" button. Your Plus access will continue until the end of your billing period.',
          [{ text: 'OK' }]
        );
        setIsPurchasing(false);
        return;
      }

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
      </ScrollView>

      {/* Subscription Status Modal */}
      <Modal
        visible={showStatusModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowStatusModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Subscription Status</Text>
            
            {subscriptionStatus && (
              <>
                <Text style={styles.modalStatusText}>
                  Current: {subscriptionStatus.currentPlan} (Active Until {subscriptionStatus.currentExpiration})
                </Text>
                <Text style={styles.modalStatusText}>
                  Next: {subscriptionStatus.nextPlan} (Begins {subscriptionStatus.nextBegins})
                </Text>
              </>
            )}
            
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => setShowStatusModal(false)}
            >
              <Text style={styles.modalButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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

  subscriptionBoxSelected: {
    borderColor: '#fff',
  },

  subscriptionBoxCurrent: {
    // Current subscription - visually the same but not clickable
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
  submitButtonClose: {
    marginTop: -10,  // Reduce space between Purchase and Manage buttons
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

  // SUBSCRIPTION STATUS MODAL
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    padding: 30,
    width: '90%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#333',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalStatusText: {
    fontSize: 15,
    color: '#ddd',
    marginBottom: 12,
    lineHeight: 22,
  },
  modalButton: {
    backgroundColor: '#0',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignItems: 'center',
    marginTop: 20,
    borderColor: '#444',
    borderWidth: 1,
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

