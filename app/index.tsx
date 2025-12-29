// app/index.tsx
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Image,
  Keyboard,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../components/AuthProvider';
import { ProfileLoadingIndicator } from '../components/ProfileLoadingIndicator';
import { SearchFilterButton } from '../components/SearchFilterButton';
import { Typography } from '../constants/Typography';
import { iapService } from '../services/iapService';
import { SUBSCRIPTION_PRODUCTS } from '../types/iapTypes';
import { isIAPAvailable } from '../utils/iapAvailability';
import { getSupabaseClient } from '../utils/supabase';

// Payment Plan Subscription Box Content - EDIT THESE TO CHANGE TEXT
const BOX_1_CONTENT = {
  title: 'Execudex Basic',
  feature1: 'Access 10 profiles a week',
  feature2: '3 Day Trial then $4.99 a month',
};

const BOX_2_CONTENT = {
  title: 'Execudex Plus',
  feature1: 'Access unlimited profiles',
  feature2: '$7.99 a month',
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

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const AnimatedSafeAreaView = Animated.createAnimatedComponent(SafeAreaView);
export default function Onboarding() {
  const { session, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams();

const steps = ['getStarted','ageGender','nextScreenKey','hearAbout','stayInformed','unsatisfiedReason','alignment','valueProp','profileHighlight', 'paymentPlan'];
type StepKey = typeof steps[number];
const [stepIndex, setStepIndex] = useState(0);
const previousSessionRef = useRef<boolean>(false); // Track previous session state

// Original onboarding flow - no overrides
const progressAnim = useRef(new Animated.Value(0)).current;


  const [containerWidth, setContainerWidth] = useState(0);
  // measure how wide our bar‐card actually is:
  const [barContainerWidth, setBarContainerWidth] = useState(0);
  // guard so the value‐prop animation only ever runs once:
  const hasValuePropAnimated = useRef(false);
  const [valuePropAnimComplete, setValuePropAnimComplete] = useState(false);

const step: StepKey = steps[stepIndex];

  const [age, setAge]       = useState<string>('');
  const [gender, setGender] = useState<string>('');
  const [involvement, setInvolvement] = useState<string>('');
  const { signUpWithEmail, signInWithEmail } = useAuth();
  
  // Sign-up form state
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);
  const [signUpEmailError, setSignUpEmailError] = useState('');
  const [signUpPasswordError, setSignUpPasswordError] = useState('');
  const [isSignUpLoading, setIsSignUpLoading] = useState(false);
  const [accountCreated, setAccountCreated] = useState(false);
  
  // Helper function to call edge function to save onboard data
  const saveOnboardData = async (userId: string, onboardData: string, plan?: string, cycle?: string) => {
    try {
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        console.error('No active session found');
        return false;
      }

      console.log('Calling save_onboard_data edge function...');
      console.log('UUID:', userId);
      console.log('Onboard Data:', onboardData);
      console.log('Plan:', plan);
      console.log('Cycle:', cycle);
      
      const response = await supabase.functions.invoke('save_onboard_data', {
        body: {
          uuid: userId,
          onboardData: onboardData,
          plan: plan,
          cycle: cycle,
        },
      });

      console.log('Full edge function response:', JSON.stringify(response, null, 2));

      if (response.error) {
        console.error('Error calling save_onboard_data function:');
        console.error('Error object:', response.error);
        console.error('Error message:', response.error.message);
        console.error('Response data:', response.data);
        return false;
      }

      console.log('Edge function success! Response data:', response.data);
      return true;
    } catch (error) {
      console.error('Exception in saveOnboardData:', error);
      return false;
    }
  };

  const buildOnboardData = () => {
    const parts: string[] = [];
    
    // Original onboarding questions with prompts
    if (age) parts.push(`Age: ${age}`);
    if (gender) parts.push(`Gender: ${gender}`);
    if (involvement) parts.push(`Political Involvement: ${involvement}`);
    if (heardFrom.length > 0) parts.push(`Where did you hear about us: ${heardFrom.join(', ')}`);
    if (informedFrom.length > 0) parts.push(`How do you usually stay informed: ${informedFrom.join(', ')}`);
    if (reason.length > 0) parts.push(`Why were you unsatisfied: ${reason.join(', ')}`);
    
    // Demographic indicators section
    if (stateCode) parts.push(`State Code: ${stateCode}`);
    if (politicalStanding) parts.push(`Political Standing: ${politicalStanding}`);
    if (educationLevel) parts.push(`Highest Education Level: ${educationLevel}`);
    if (employmentStatus.length > 0) parts.push(`Employment Status: ${employmentStatus.join(', ')}`);
    if (incomeLevel) parts.push(`Income Level: ${incomeLevel}`);
    if (raceEthnicity) parts.push(`Race & Ethnicity: ${raceEthnicity}`);
    if (dependentStatus) parts.push(`Dependent Status: ${dependentStatus}`);
    if (militaryStatus) parts.push(`Military Status: ${militaryStatus}`);
    if (immigrationStatus) parts.push(`Immigration Status: ${immigrationStatus}`);
    if (governmentBenefits.length > 0) parts.push(`Government Benefits: ${governmentBenefits.join(', ')}`);
    if (sexualOrientation) parts.push(`Sexual Orientation: ${sexualOrientation}`);
    if (voterEligibility) parts.push(`Voter Eligibility: ${voterEligibility}`);
    if (disabilityStatus.length > 0) parts.push(`Disability Status: ${disabilityStatus.join(', ')}`);
    if (industryOfWork.length > 0) parts.push(`Industry of Work or Study: ${industryOfWork.join(', ')}`);
    if (additionalInformation) parts.push(`Additional Information: ${additionalInformation}`);
    
    return parts.join(' | ');
  };

  // Only redirect to home if user is authenticated AND has completed onboarding (has a plan)
  // Don't redirect if user is currently on the payment plan step (they're selecting a plan)
  // Also reset to first step if user logs out (detect session transition from true to false)
  useEffect(() => {
    // CHECK FOR LOGOUT FLAG FIRST
    // If we just came from the profile screen, ignore any lingering session data
    if (params.logout === 'true') {
      console.log('[Onboarding] Explicit logout detected. Skipping auto-redirect.');
      // Ensure we reset to the first step
      if (stepIndex !== 0) {
        setStepIndex(0);
      }
      // Update ref to reflect no session
      previousSessionRef.current = false;
      return; // Skip all redirect logic
    }

    const hadSession = previousSessionRef.current;
    const hasSession = !!session?.user?.id;
    
    // Detect logout: had session before, but no session now
    if (!authLoading && hadSession && !hasSession) {
      console.log('[Onboarding] User logged out - resetting to first step');
      setStepIndex(0);
      // Update ref immediately after detecting logout
      previousSessionRef.current = false;
      // Don't check for plan if user just logged out - stay on onboarding
      return;
    }
    
    // Update the ref for next comparison
    previousSessionRef.current = hasSession;
    
    // If no session, don't check for plan or redirect
    if (!hasSession) {
      return;
    }
    
    // Don't check/redirect if user is on payment plan step (stepIndex 8) - let them complete it
    if (stepIndex === 8) {
      return;
    }
    
    // Only check if we have a valid session and auth is not loading
    if (!authLoading && hasSession) {
      const checkUserPlan = async () => {
        try {
          const supabase = getSupabaseClient();
          const { data, error } = await supabase
            .from('users')
            .select('plan')
            .eq('uuid', session.user.id)
            .maybeSingle();
          
          if (error) {
            console.error('[Onboarding] Error checking user plan:', error);
            return; // Stay on onboarding if we can't check
          }
          
          // Only redirect if user has a plan (has completed onboarding)
          const userData = data as { plan?: string } | null;
          if (userData?.plan && userData.plan.trim() !== '') {
            console.log('[Onboarding] User has plan, redirecting to home');
            router.replace('/(tabs)/home');
          } else {
            console.log('[Onboarding] User authenticated but no plan found - staying on onboarding to complete plan selection');
          }
        } catch (error) {
          console.error('[Onboarding] Exception checking user plan:', error);
          // Stay on onboarding if there's an error
        }
      };
      
      checkUserPlan();
    }
  }, [session, authLoading, router, stepIndex, params.logout]);

  // Set up purchase listeners once (on demand initialization happens in handler)
  useEffect(() => {
    if (!isIAPAvailable()) {
      return;
    }

    const cleanup = iapService.setupPurchaseListeners(
      async (purchase) => {
        try {
          setPurchaseError(null);
          const supabase = getSupabaseClient();
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) {
            throw new Error('No authenticated user found');
          }

          // Save onboard data immediately after purchase
          const onboardData = buildOnboardData();
          const currentPlan = selectedPlanRef.current || 'basic';
          const currentCycle = selectedCycleRef.current === 'quarterly' ? 'quarterly' : 'monthly';
          await saveOnboardData(user.id, onboardData, currentPlan, currentCycle);

          // Navigate to home
          router.replace('/(tabs)/home');

          // Show success alert
          iapService.showPurchaseSuccess();
        } catch (error: any) {
          console.error('❌ Error processing purchase:', error);
          Alert.alert('Error', error?.message || 'Failed to activate subscription. Please try again.');
        } finally {
          setIsPurchasing(false);
        }
      },
      (error) => {
        console.error('Purchase error:', error);
        setPurchaseError(error.message || 'Purchase failed. Please try again.');
        iapService.showPurchaseError(error);
        setIsPurchasing(false);
      }
    );

    return cleanup;
  }, []);

  // Email validation
  const validateSignUpEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Password validation
  const validateSignUpPassword = (password: string) => {
    if (password.length < 6) {
      return 'Password must be at least 6 characters long';
    }
    return '';
  };

  // Helper function to check if subscription is expired
  const isSubscriptionExpired = (userData: any): boolean => {
    // Plan is null/empty
    if (!userData?.plan || userData.plan === '' || userData.plan === null) {
      return true;
    }
    
    // If last_purchase_date exists, check if plus_til has passed (for Plus subscriptions)
    if (userData.last_purchase_date && userData.plus_til) {
      const plusTilDate = new Date(userData.plus_til);
      const now = new Date();
      if (now >= plusTilDate) {
        return true;
      }
    }
    
    return false;
  };

  // Helper function to check if subscription is valid
  const hasValidSubscription = (userData: any): boolean => {
    // Plan must be non-null and non-empty
    if (!userData?.plan || userData.plan === '' || userData.plan === null) {
      return false;
    }
    
    // Cycle must be non-null or non-empty
    if (!userData?.cycle || userData.cycle === '' || userData.cycle === null) {
      return false;
    }
    
    return true;
  };

  // Helper function to check if onboarding data exists
  const hasOnboardingData = (userData: any): boolean => {
    return !!(userData?.onboard && userData.onboard.trim() !== '');
  };

  // Handle email sign up
  const handleEmailSignUp = async () => {
    // Clear previous errors
    setSignUpEmailError('');
    setSignUpPasswordError('');

    // Validate email
    if (!signUpEmail) {
      setSignUpEmailError('Email is required');
      return;
    }
    if (!validateSignUpEmail(signUpEmail)) {
      setSignUpEmailError('Please enter a valid email address');
      return;
    }

    // Validate password
    if (!signUpPassword) {
      setSignUpPasswordError('Password is required');
      return;
    }
    const passwordValidationError = validateSignUpPassword(signUpPassword);
    if (passwordValidationError) {
      setSignUpPasswordError(passwordValidationError);
      return;
    }

    setIsSignUpLoading(true);
    try {
      await signUpWithEmail(signUpEmail, signUpPassword);
      // Mark account as created
      setAccountCreated(true);
      // Clear form
      setSignUpEmail('');
      setSignUpPassword('');
      // Automatically move to next step
      setStepIndex(stepIndex + 1);
    } catch (error: any) {
      console.error('Sign up error:', error);
      
      // Check if error is due to existing account
      const isExistingAccountError = error.message?.includes('already registered') || 
                                     error.message?.includes('already exists') ||
                                     error.message?.includes('User already registered');
      
      if (isExistingAccountError) {
        // Try to sign in with the provided credentials
        try {
          const user = await signInWithEmail(signUpEmail, signUpPassword);
          
          if (user) {
            // Check if account is missing both onboarding and subscription data
            const { data: userData, error: userError } = await getSupabaseClient()
              .from('users')
              .select('plan, onboard, cycle, plus_til, last_purchase_date')
              .eq('uuid', user.id)
              .maybeSingle();

            if (userError) {
              console.error('Error checking user data:', userError);
              Alert.alert(
                'Sign Up Error',
                'Failed to check account status. Please try again.',
                [{ text: 'OK' }]
              );
              return;
            }

            const hasOnboarding = hasOnboardingData(userData);
            const hasValidSub = hasValidSubscription(userData);
            const isExpired = isSubscriptionExpired(userData);

            // If account is missing BOTH onboarding AND subscription data, allow overwrite
            if (!hasOnboarding && (!hasValidSub || isExpired)) {
              // Mark account as created and proceed with onboarding
              setAccountCreated(true);
              setSignUpEmail('');
              setSignUpPassword('');
              setStepIndex(stepIndex + 1);
              return;
            } else {
              // Account has some data, show error
              Alert.alert(
                'Account Exists',
                'An account with this email already exists. Please sign in instead.',
                [{ text: 'OK' }]
              );
            }
          }
        } catch (signInError: any) {
          // Sign in failed - wrong password or other error
          Alert.alert(
            'Sign Up Error',
            signInError.message || 'An account with this email already exists. Please sign in instead.',
            [{ text: 'OK' }]
          );
        }
      } else {
        // Other error
        Alert.alert(
          'Sign Up Error',
          error.message || 'Failed to create account. Please try again.',
          [{ text: 'OK' }]
        );
      }
    } finally {
      setIsSignUpLoading(false);
    }
  };
  
  // Age options and scale anim values
  const ageOptions = ['Below 24','25-35','36-48','49+'];
  const ageScaleAnims = useRef(ageOptions.map(() => new Animated.Value(1))).current;
  const genderOptions = ['Male','Female','Other'];
  const genderScaleAnims = useRef(genderOptions.map(() => new Animated.Value(1))).current;
    const involvementOptions = [
    'Not at all',
    'Minimally involved',
    'Decently involved',
    'Very involved',
    'As involved as possible',
  ];
  const involvementScaleAnims = useRef(
    involvementOptions.map(() => new Animated.Value(1))
  ).current;
const hearOptions = [
  'Instagram',
  'Tiktok',
  'Linkedin',
  'Youtube',
  'X (Twitter)',
  'Other',
];
const hearScaleAnims = useRef(hearOptions.map(() => new Animated.Value(1))).current;
const [heardFrom, setHeardFrom] = useState<string[]>([]);
// ─── STEP 5: How do you usually stay informed? ───
const informOptions = [
  'Databases, records, studies',
  'Social media',
  'Televised news',
  'Articles, blogs, community posts',
  'Word of mouth',
  'Other',
];
const informScaleAnims = useRef(
  informOptions.map(() => new Animated.Value(1))
).current;
const [informedFrom, setInformedFrom] = useState<string[]>([]);
const reasonOptions = [
  'Too much bias',
  'Lack of perspective',
  'Too much misinformation',
  'Overly complicated',
  'Not enough information',
  'Other',
];
const alignmentOptions = [
  'Democrat',
  'Republican',
  'Centrist',
  'Left Leaning',
  'Right Leaning',
  'Other',
];
const alignmentScaleAnims = useRef(
  alignmentOptions.map(() => new Animated.Value(1))
).current;
const [alignment, setAlignment] = useState<string>('');
const [stateCode, setStateCode] = useState<string>('');
const [politicalStanding, setPoliticalStanding] = useState<string>('');
const [educationLevel, setEducationLevel] = useState<string>('');
const [employmentStatus, setEmploymentStatus] = useState<string[]>([]);
const [incomeLevel, setIncomeLevel] = useState<string>('');
const [raceEthnicity, setRaceEthnicity] = useState<string>('');
const [dependentStatus, setDependentStatus] = useState<string>('');
const [militaryStatus, setMilitaryStatus] = useState<string>('');
const [immigrationStatus, setImmigrationStatus] = useState<string>('');
const [governmentBenefits, setGovernmentBenefits] = useState<string[]>([]);
const [sexualOrientation, setSexualOrientation] = useState<string>('');
const [voterEligibility, setVoterEligibility] = useState<string>('');
const [disabilityStatus, setDisabilityStatus] = useState<string[]>([]);
const [industryOfWork, setIndustryOfWork] = useState<string[]>([]);
const [additionalInformation, setAdditionalInformation] = useState<string>('');
const [hasInteractedWithAlignment, setHasInteractedWithAlignment] = useState(false);
const [alignmentTimerComplete, setAlignmentTimerComplete] = useState(false);
const [hasEnteredInformation, setHasEnteredInformation] = useState(false);
const alignmentTimerRef = useRef<NodeJS.Timeout | null>(null);
const alignmentInitializedRef = useRef<boolean>(false);
const biasAnim      = useRef(new Animated.Value(0)).current;

// Track interactions on alignment step
const markAlignmentInteraction = () => {
  if (!hasInteractedWithAlignment) {
    setHasInteractedWithAlignment(true);
    if (alignmentTimerRef.current) {
      clearTimeout(alignmentTimerRef.current);
      alignmentTimerRef.current = null;
    }
  }
};

// Valid US state codes
const validStateCodes = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
  'DC' // District of Columbia
];

// Validate state code
const isValidStateCode = (code: string) => {
  if (code.length === 0) return true; // Empty is valid (optional field)
  if (code.length !== 2) return false;
  return validStateCodes.includes(code.toUpperCase());
};
const neutralAnim   = useRef(new Animated.Value(0)).current;
const bottomBarAnim = useRef(new Animated.Value(0)).current;
const topBarAnim    = useRef(new Animated.Value(0)).current;
const tradAnim      = useRef(new Animated.Value(0)).current;
const execAnim      = useRef(new Animated.Value(0)).current;
const descAnim      = useRef(new Animated.Value(0)).current;
const black1Anim = useRef(new Animated.Value(0)).current;
const black2Anim = useRef(new Animated.Value(0)).current;
const hasProfileAnimated = useRef(false);

const profileImg1Anim   = useRef(new Animated.Value(0)).current;
const profileImg2Anim   = useRef(new Animated.Value(0)).current;
const profileDescAnim   = useRef(new Animated.Value(0)).current;




const reasonScaleAnims = useRef(
  reasonOptions.map(() => new Animated.Value(1))
).current;
const [reason, setReason] = useState<string[]>([]);

  // Referral code state
  const [referralCode, setReferralCode] = useState<string>('');
  const [referralCodeApplied, setReferralCodeApplied] = useState<boolean>(false);
  const [referralStatus, setReferralStatus] = useState<string>('');

  // Plan and cycle state (following same pattern as other onboarding steps)
  const [plan, setPlan] = useState<string>('');
  const [cycle, setCycle] = useState<string>('');
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const selectedPlanRef = useRef<string>('');
  const selectedCycleRef = useRef<string>('');
  
  // Animation refs for subscription boxes
  const box1Scale = useRef(new Animated.Value(1)).current;
  const box2Scale = useRef(new Animated.Value(1)).current;
  const box3Scale = useRef(new Animated.Value(1)).current;
  const box4Scale = useRef(new Animated.Value(1)).current;

  // Functions to handle plan and cycle selection (following same pattern as other onboarding steps)
  const handlePlanSelect = (selectedPlan: string, selectedCycle: string) => {
    console.log('🔘 Plan selected:', selectedPlan);
    console.log('🔘 Cycle selected:', selectedCycle);
    setPlan(selectedPlan);
    setCycle(selectedCycle);
    selectedPlanRef.current = selectedPlan;
    selectedCycleRef.current = selectedCycle;
  };

  // Referral code validation function
  const handleReferralSubmit = async () => {
    if (!referralCode.trim()) {
      setReferralStatus('Please enter a referral code');
      return;
    }

    try {
      // Query the referrals table for the entered code (case-insensitive)
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('referrals')
        .select('referral_code')
        .ilike('referral_code', referralCode.trim())
        .maybeSingle();

      if (error) {
        console.error('Database error:', error);
        setReferralStatus('Code not valid');
        setReferralCodeApplied(false);
      } else if (data) {
        setReferralStatus('Referral code applied');
        setReferralCodeApplied(true);
      } else {
        setReferralStatus('Code not valid');
        setReferralCodeApplied(false);
      }
    } catch (error) {
      console.error('Error in referral validation:', error);
      setReferralStatus('Code not valid');
      setReferralCodeApplied(false);
    }
  };


  // fly-in animation values
  const gs1X = useRef(new Animated.Value(-1600)).current;
  const gs1Y = useRef(new Animated.Value(-1600)).current;
  const gs2X = useRef(new Animated.Value( 1600)).current;
  const gs2Y = useRef(new Animated.Value(-1600)).current;
  const gs3X = useRef(new Animated.Value( 1600)).current;
  const gs3Y = useRef(new Animated.Value(-1600)).current;
// Function to run the intro fly-in animations
const runStaggerAnimation = () => {
  // ── RESET positions back off-screen ──
  gs1X.setValue(-1600);
  gs1Y.setValue(-1600);
  gs2X.setValue(1600);
  gs2Y.setValue(-1600);
  gs3X.setValue(1600);
  gs3Y.setValue(-1600);

  Animated.stagger(150, [
    Animated.parallel([
      Animated.timing(gs1X, { toValue: 0, duration: 3000, useNativeDriver: true, easing: Easing.out(Easing.exp) }),
      Animated.timing(gs1Y, { toValue: 0, duration: 3000, useNativeDriver: true, easing: Easing.out(Easing.exp) }),
    ]),
    Animated.parallel([
      Animated.timing(gs2X, { toValue: 0, duration: 3000, useNativeDriver: true, easing: Easing.out(Easing.exp) }),
      Animated.timing(gs2Y, { toValue: 0, duration: 3000, useNativeDriver: true, easing: Easing.out(Easing.exp) }),
    ]),
    Animated.parallel([
      Animated.timing(gs3X, { toValue: 0, duration: 3000, useNativeDriver: true, easing: Easing.out(Easing.exp) }),
      Animated.timing(gs3Y, { toValue: 0, duration: 3000, useNativeDriver: true, easing: Easing.out(Easing.exp) }),
    ]),
  ]).start();
};


  // Run intro animations on mount
  useEffect(() => { 
    runStaggerAnimation(); 
  }, []);

    // Animate progress bar when stepIndex changes
  useEffect(() => {
    Animated.timing(progressAnim, {
   toValue: stepIndex * 0.125,

      duration: 250,
      useNativeDriver: false,
    }).start();
  }, [stepIndex]);
    // Re-run intro when navigating back to the first screen
  useEffect(() => {
    if (stepIndex === 0) {
      runStaggerAnimation();
    }
  }, [stepIndex]);
    
  // Timer and interaction tracking for alignment step
  useEffect(() => {
    if (step === 'alignment') {
      // Only reset state on first visit to alignment step
      if (!alignmentInitializedRef.current) {
        setHasInteractedWithAlignment(false);
        setAlignmentTimerComplete(false);
        setHasEnteredInformation(false);
        
        // Clear any existing timer
        if (alignmentTimerRef.current) {
          clearTimeout(alignmentTimerRef.current);
        }
        
        // Set 3 second timer only on first visit
        alignmentTimerRef.current = setTimeout(() => {
          setAlignmentTimerComplete(true);
          alignmentTimerRef.current = null;
        }, 3000);
        
        alignmentInitializedRef.current = true;
      }
      
      // Cleanup on unmount or step change
      return () => {
        if (alignmentTimerRef.current) {
          clearTimeout(alignmentTimerRef.current);
          alignmentTimerRef.current = null;
        }
      };
    }
  }, [step]);









  // ——— STEP 1: Get Started ———
useEffect(() => {
  if (step !== 'valueProp') return;               // only run on valueProp

  if (!hasValuePropAnimated.current) {
    // ─ reset all anim values to 0 ─
    black1Anim.setValue(0);
    black2Anim.setValue(0);
    biasAnim.setValue(0);
    neutralAnim.setValue(0);
    bottomBarAnim.setValue(0);
    topBarAnim.setValue(0);
    tradAnim.setValue(0);
    execAnim.setValue(0);
    descAnim.setValue(0);
    setValuePropAnimComplete(false);  // reset state

    // ─ run your sequence once ─
    Animated.sequence([
      Animated.parallel([
        Animated.timing(black1Anim, { toValue: 1, duration: 300, useNativeDriver: false }),
        Animated.timing(black2Anim, { toValue: 1, duration: 300, useNativeDriver: false }),
      ]),
      Animated.timing(biasAnim,    { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(neutralAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(bottomBarAnim,{ toValue: 1, duration: 800, useNativeDriver: false }),
      Animated.timing(topBarAnim,   { toValue: 1, duration:1000,useNativeDriver: false }),
      Animated.parallel([
        Animated.timing(tradAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(execAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]),
      Animated.timing(descAnim,     { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start(() => {
      hasValuePropAnimated.current = true;  // mark complete
      setValuePropAnimComplete(true);  // enable continue button
    });
  } else {
    // ─ snap everything to 1 ─
    black1Anim.setValue(1);
    black2Anim.setValue(1);
    biasAnim.setValue(1);
    neutralAnim.setValue(1);
    bottomBarAnim.setValue(1);
    topBarAnim.setValue(1);
    tradAnim.setValue(1);
    execAnim.setValue(1);
    descAnim.setValue(1);
    setValuePropAnimComplete(true);  // already animated, enable button
  }
}, [step]);


// just above your `if (step === 'profileHighlight') {`
const isProfileDone = step === 'profileHighlight' && hasProfileAnimated.current;


useLayoutEffect(() => {
  // only run when we hit the profileHighlight step
  if (step !== 'profileHighlight') return;

  if (!hasProfileAnimated.current) {
    // 1) hide both images + desc
    profileImg1Anim.setValue(0);
    profileImg2Anim.setValue(0);
    profileDescAnim.setValue(0);

    // 2) fade them in, one after the other
    Animated.sequence([
      Animated.timing(profileImg1Anim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(profileImg2Anim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(profileDescAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start(() => {
      hasProfileAnimated.current = true;  // mark “played”
    });

  } else {
    // on every subsequent entry, snap straight to fully visible
    profileImg1Anim.setValue(1);
    profileImg2Anim.setValue(1);
    profileDescAnim.setValue(1);
  }
}, [step]);

  // Show nothing while checking auth
  // Don't return null if user has session - let them complete onboarding (payment plan step)
  // The useEffect above will handle redirecting users who have completed onboarding
  if (authLoading) {
    return null;
  }

  if (step === 'getStarted') {
  return (
      <AnimatedSafeAreaView style={[styles.container, { backgroundColor: '#000' }]}>
              {/* HEADER */}
      <View style={styles.headerRow}>
        {stepIndex > 0 && (
          <Pressable
            style={styles.backButton}
            onPress={() => setStepIndex(stepIndex - 1)}
          >
            <Text style={styles.backButtonText}>←</Text>
          </Pressable>
        )}

      {stepIndex > 0 && (
        <View
          style={styles.progressContainer}
          onLayout={e => setContainerWidth(e.nativeEvent.layout.width)}
        >

        <Animated.View
          style={[
            styles.progressFill,
            {
              width: progressAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, containerWidth],
              }),
            },
          ]}
        />
      </View>
    )}
  </View>
      {/* ────── */}

 <View style={[
   styles.mockupRow,
   { position:'absolute', top: 80, left:0, right:0, justifyContent:'center' }
 ]}>
          <Animated.Image
            source={require('../assets/GS1.png')}
            style={[
              styles.largeMockup,
             {
               transform: [
                 { scale: 1.3 },
                 { translateX: gs1X },
                 { translateY: gs1Y },
               ]
             }
            ]}
            resizeMode="contain"
          />
          <View style={styles.sideImages}>
            <Animated.Image
              source={require('../assets/GS2.png')}
              style={[
                styles.smallMockup,
               {
                 transform: [
                   { scale: 1.3 },
                   { translateX: gs2X },
                   { translateY: gs2Y },
                 ]
               }
              ]}
              resizeMode="contain"
            />
            <Animated.Image
              source={require('../assets/GS3.png')}
              style={[
                styles.smallMockup,
                styles.smallMockupSpacing,
               {
                 transform: [
                   { scale: 1.3 },
                   { translateX: gs3X },
                   { translateY: gs3Y },
                 ]
               }
              ]}
              resizeMode="contain"
            />
          </View>
        </View>

        <Text style={styles.subtitle}>
          Verify politicians, track{'\n'}legislation, stay connected.
        </Text>

        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            if (stepIndex < steps.length - 1) {
              setStepIndex(stepIndex + 1);
            } else {
              // last step, leave the questionnaire
              router.replace('/(tabs)/home');
            }
          }}
          style={({ pressed }) => [
            styles.getStartedButton,
            { position: 'absolute', bottom: 100 },
            pressed && styles.getStartedButtonPressed,
          ]}
        >
          {({ pressed }) => (
            <Text style={[
              styles.getStartedText,
              pressed && styles.getStartedTextPressed
            ]}>
              Get Started
            </Text>
          )}
        </Pressable>


      {/* ─── Sign In Link ─── */}
      <Pressable
        style={[styles.signInText, { position: 'absolute', bottom: 80 }]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          // Navigate to sign-in screen
          router.push('/signin');
        }}
      >
        <Text style={styles.signInText}>
          Already purchased? <Text style={styles.signInLink}>Sign In Here</Text>
        </Text>
      </Pressable>

<StatusBar style="light" backgroundColor="#000" translucent={false} />    
  </AnimatedSafeAreaView>
    );
  }

  // ——— STEP 2: Age & Gender ———
  if (step === 'ageGender') {
    return (
    <AnimatedSafeAreaView style={[styles.container, { backgroundColor: '#000' }]}>
            {/* HEADER */}
      <View style={styles.headerRow}>
    {stepIndex > 0 && (
<Pressable
  onPressIn={() => Haptics.selectionAsync()}
  style={styles.backButton}
  onPress={() => setStepIndex(stepIndex - 1)}
>
        <Text style={styles.backButtonText}>←</Text>
      </Pressable>
    )}

        <View
          style={styles.progressContainer}
          onLayout={e => setContainerWidth(e.nativeEvent.layout.width)}
        >
          <Animated.View
            style={[
              styles.progressFill,
              {
                width: progressAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, containerWidth],
                }),
              },
            ]}
          />
        </View>
      </View>
      {/* ────── */}

      {/* Title & Subtitle */}
      <Text style={styles.title}>Choose your age and gender</Text>
      <Text style={styles.subtitleText}>
        This helps us design your tools and
        keep{'\n'}track of who joins the platform.
      </Text>

      {/* Age Options */}
            {/* Age Options */}
{/* Age Options */}
{ageOptions.map((option, idx) => {
  const scaleAnim = ageScaleAnims[idx];
  return (
    <AnimatedPressable
      key={option}
      onPress={() => setAge(age === option ? '' : option)}
      onPressIn={() => {
        Haptics.selectionAsync();
        Animated.spring(scaleAnim, {
          toValue: 0.85,       // how small on press
          friction: 6,
          useNativeDriver: true,
        }).start();
      }}
      onPressOut={() => {
        Animated.spring(scaleAnim, {
          toValue: 1,          // back to original
          friction: 6,
          useNativeDriver: true,
        }).start();
      }}
      style={[
        styles.choice,                 // your 94% width + padding
        age === option && styles.choiceSelected,
        { transform: [{ scale: scaleAnim }] }  // animated shrink
      ]}
    >
      <Text style={[styles.choiceText, age === option && styles.choiceTextSelected]}>
        {option}
      </Text>
    </AnimatedPressable>
  );
})}




      {/* Gender Options */}
      {/* Gender Options */}
      <View style={styles.genderRow}>
        {genderOptions.map((opt, idx) => {
          const scaleAnim = genderScaleAnims[idx];
          return (
            <AnimatedPressable
              key={opt}
              onPress={() => setGender(gender === opt ? '' : opt)}
              onPressIn={() => {
                Haptics.selectionAsync();
                Animated.spring(scaleAnim, {
                  toValue: 0.85,
                  friction: 6,
                  useNativeDriver: true,
                }).start();
              }}
              onPressOut={() => {
                Animated.spring(scaleAnim, {
                  toValue: 1,
                  friction: 6,
                  useNativeDriver: true,
                }).start();
              }}
              style={[
                styles.choice1,
                { transform: [{ scale: scaleAnim }] },
                gender === opt && styles.choiceSelected,
              ]}
            >
              <Text style={[styles.choiceText, gender === opt && styles.choiceTextSelected]}>
                {opt}
              </Text>
            </AnimatedPressable>
          );
        })}
      </View>


      {/* Continue Button */}
      <Pressable
        disabled={!age || !gender}
        onPressIn={() => (age && gender) && Haptics.selectionAsync()}
        style={[
          styles.continueButton,
          (!age || !gender) && styles.continueButtonDisabled
        ]}
        onPress={() => {
          setStepIndex(stepIndex + 1);
        }}
      >
        <Text style={[
          styles.continueButtonText,
          (!age || !gender) && styles.continueButtonTextDisabled
        ]}>
          Continue
        </Text>
      </Pressable>
      

    </AnimatedSafeAreaView>
  );
}
  // ——— STEP 3: Politically Involved ———
  if (step === 'nextScreenKey') {
    return (
    <AnimatedSafeAreaView style={[styles.container, { backgroundColor: '#000' }]}>
        {/* HEADER */}
        <View style={styles.headerRow}>
          {stepIndex > 0 && (
<Pressable
  onPressIn={() => Haptics.selectionAsync()}
  style={styles.backButton}
  onPress={() => setStepIndex(stepIndex - 1)}
>
              <Text style={styles.backButtonText}>←</Text>
            </Pressable>
          )}
          {stepIndex > 0 && (
            <View
              style={styles.progressContainer}
              onLayout={e => setContainerWidth(e.nativeEvent.layout.width)}
            >
              <Animated.View
                style={[
                  styles.progressFill,
                  {
                    width: progressAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, containerWidth],
                    }),
                  },
                ]}
              />
    </View>
          )}
        </View>

        {/* Title & Subtitle */}
        <Text style={styles.title1}>How politically involved are you?</Text>
        <Text style={styles.subtitleText}>
          Help us understand and know our{'\n'}userbase more.
        </Text>

        {/* Involvement Options */}
        {involvementOptions.map((opt, idx) => {
          const anim = involvementScaleAnims[idx];
          return (
<AnimatedPressable
  key={opt}
  onPress={() => setInvolvement(involvement === opt ? '' : opt)}
  onPressIn={() => {
    Haptics.selectionAsync();
    Animated.spring(anim, { toValue: 0.85, friction: 6, useNativeDriver: true }).start();
  }}
  onPressOut={() => {
    Animated.spring(anim, { toValue: 1, friction: 6, useNativeDriver: true }).start();
  }}
              style={[
                styles.choice,
                { transform: [{ scale: anim }] },
                involvement === opt && styles.choiceSelected,
              ]}
            >
              <Text
                style={[
                  styles.choiceText,
                  involvement === opt && styles.choiceTextSelected,
                ]}
              >
                {opt}
              </Text>
            </AnimatedPressable>
          );
        })}

        {/* Continue Button */}
        <Pressable
          disabled={!involvement}
          onPressIn={() => involvement && Haptics.selectionAsync()}
          style={[
            styles.continueButton,
            !involvement && styles.continueButtonDisabled
          ]}
          onPress={() => {
            setStepIndex(stepIndex + 1);
          }}
        >
          <Text style={[
            styles.continueButtonText,
            !involvement && styles.continueButtonTextDisabled
          ]}>
            Continue
          </Text>
        </Pressable>
      </AnimatedSafeAreaView>
    );
  }
  // ——— STEP 4: Where did you hear about us? ———
if (step === 'hearAbout') {
  return (
    <AnimatedSafeAreaView style={[styles.container, { backgroundColor: '#000' }]}>
      {/* HEADER */}
      <View style={styles.headerRow}>
        {stepIndex > 0 && (
          <Pressable
            onPressIn={() => Haptics.selectionAsync()}
            style={styles.backButton}
            onPress={() => setStepIndex(stepIndex - 1)}
          >
            <Text style={styles.backButtonText}>←</Text>
          </Pressable>
        )}
        {stepIndex > 0 && (
          <View
            style={styles.progressContainer}
            onLayout={e => setContainerWidth(e.nativeEvent.layout.width)}
          >
            <Animated.View
              style={[
                styles.progressFill,
                {
                  width: progressAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, containerWidth],
                  }),
                },
              ]}
            />
          </View>
        )}
      </View>

      {/* QUESTION */}
      <Text style={[styles.title2, ]}>
        Where did you hear about us?
      </Text>

      {/* OPTIONS */}
      {hearOptions.map((opt, idx) => {
        const anim = hearScaleAnims[idx];
        const logoSrc =
          idx === 0 ? require('../assets/logo1.png') :
          idx === 1 ? require('../assets/logo2.png') :
          idx === 2 ? require('../assets/logo3.png') :
          idx === 3 ? require('../assets/logo4.png') :
          idx === 4 ? require('../assets/logo5.png') :
          null;
        const isSelected = heardFrom.includes(opt);
        return (
          <AnimatedPressable
            key={opt}
            onPress={() => {
              if (isSelected) {
                setHeardFrom(heardFrom.filter(item => item !== opt));
              } else {
                setHeardFrom([...heardFrom, opt]);
              }
            }}
            onPressIn={() => {
              Haptics.selectionAsync();
              Animated.spring(anim, {
                toValue: 0.85,
                friction: 6,
                useNativeDriver: true,
              }).start();
            }}
            onPressOut={() => {
              Animated.spring(anim, {
                toValue: 1,
                friction: 6,
                useNativeDriver: true,
              }).start();
            }}
     style={[
       // if this is the "Other" option, use choiceOther; otherwise use choice3
       opt === 'Other' ? styles.choice6 : styles.choice6,
       { transform: [{ scale: anim }] },
       isSelected && styles.choiceSelected,
     ]}
          >
            <View style={styles.optionRow}>
              {logoSrc && (
                <Image source={logoSrc} style={styles.logo} />
              )}
              <Text
                style={[
                  styles.choiceText,
                  isSelected && styles.choiceTextSelected,
                ]}
              >
                {opt}
              </Text>
            </View>
          </AnimatedPressable>
        );
      })}

      {/* CONTINUE */}
      <Pressable
        disabled={heardFrom.length === 0}
        onPressIn={() => heardFrom.length > 0 && Haptics.selectionAsync()}
        style={[
          styles.continueButton,
          heardFrom.length === 0 && styles.continueButtonDisabled
        ]}
        onPress={() => setStepIndex(stepIndex + 1)}
      >
        <Text style={[
          styles.continueButtonText,
          heardFrom.length === 0 && styles.continueButtonTextDisabled
        ]}>
          Continue
        </Text>
      </Pressable>
    </AnimatedSafeAreaView>
  );
}
// ——— STEP 5: How do you usually stay informed? ———
if (step === 'stayInformed') {
  return (
    <AnimatedSafeAreaView style={[styles.container, { backgroundColor: '#000' }]}>
      {/* HEADER */}
      <View style={styles.headerRow}>
        {stepIndex > 0 && (
          <Pressable
            onPressIn={() => Haptics.selectionAsync()}
            style={styles.backButton}
            onPress={() => setStepIndex(stepIndex - 1)}
          >
            <Text style={styles.backButtonText}>←</Text>
          </Pressable>
        )}
        {stepIndex > 0 && (
          <View
            style={styles.progressContainer}
            onLayout={e => setContainerWidth(e.nativeEvent.layout.width)}
          >
            <Animated.View
              style={[
                styles.progressFill,
                {
                  width: progressAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, containerWidth],
                  }),
                },
              ]}
            />
          </View>
        )}
      </View>

      {/* QUESTION */}
      <Text style={styles.title4}>
        How do you usually stay informed?
      </Text>

      {/* OPTIONS */}
      {informOptions.map((opt, idx) => {
        const anim = informScaleAnims[idx];
        const isSelected = informedFrom.includes(opt);
 const iconSrc =
   idx === 0
     ? (isSelected
         ? require('../assets/icons1.png')
         : require('../assets/icon1.png'))
   : idx === 1
     ? (isSelected
         ? require('../assets/icons2.png')
         : require('../assets/icon2.png'))
   : idx === 2
     ? (isSelected
         ? require('../assets/icons3.png')
         : require('../assets/icon3.png'))
   : idx === 3
     ? (isSelected
         ? require('../assets/icons4.png')
         : require('../assets/icon4.png'))
   : idx === 4
     ? (isSelected
         ? require('../assets/icons5.png')
         : require('../assets/icon5.png'))
   : null;
        return (
          <AnimatedPressable
            key={opt}
            onPress={() => {
              if (isSelected) {
                setInformedFrom(informedFrom.filter(item => item !== opt));
              } else {
                setInformedFrom([...informedFrom, opt]);
              }
            }}
            onPressIn={() => {
              Haptics.selectionAsync();
              Animated.spring(anim, {
                toValue: 0.85,
                friction: 6,
                useNativeDriver: true,
              }).start();
            }}
            onPressOut={() => {
              Animated.spring(anim, {
                toValue: 1,
                friction: 6,
                useNativeDriver: true,
              }).start();
            }}
            style={[
              opt === 'Other' ? styles.choice6 : styles.choice6,
              { transform: [{ scale: anim }] },
              isSelected && styles.choiceSelected,
            ]}
          >
            <View style={styles.optionRow}>
              {iconSrc && <Image source={iconSrc} style={styles.logo} />}
              <Text
                style={[
                  styles.choiceText,
                  isSelected && styles.choiceTextSelected,
                ]}
              >
                {opt}
              </Text>
            </View>
          </AnimatedPressable>
        );
      })}

      {/* CONTINUE */}
      <Pressable
        disabled={informedFrom.length === 0}
        onPressIn={() => informedFrom.length > 0 && Haptics.selectionAsync()}
        style={[
          styles.continueButton,
          informedFrom.length === 0 && styles.continueButtonDisabled
        ]}
        onPress={() => setStepIndex(stepIndex + 1)}
      >
        <Text style={[
          styles.continueButtonText,
          informedFrom.length === 0 && styles.continueButtonTextDisabled
        ]}>
          Continue
        </Text>
      </Pressable>
    </AnimatedSafeAreaView>
  );
}
// ——— STEP 5: Why were you unsatisfied? ———
if (step === 'unsatisfiedReason') {
  return (
<AnimatedSafeAreaView style={[styles.container, { backgroundColor: '#000' }]}>
      {/* HEADER */}
      <View style={styles.headerRow}>
        {stepIndex > 0 && (
          <Pressable
            onPressIn={() => Haptics.selectionAsync()}
            style={styles.backButton}
            onPress={() => setStepIndex(stepIndex - 1)}
          >
            <Text style={styles.backButtonText}>←</Text>
          </Pressable>
        )}
        {stepIndex > 0 && (
          <View
            style={styles.progressContainer}
            onLayout={e => setContainerWidth(e.nativeEvent.layout.width)}
          >
            <Animated.View
              style={[
                styles.progressFill,
                {
                  width: progressAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, containerWidth],
                  }),
                },
              ]}
            />
          </View>
        )}
      </View>

      {/* QUESTION */}
      <Text style={styles.title3}>Why were you unsatisfied?</Text>
  


      {/* OPTIONS */}
      {reasonOptions.map((opt, idx) => {
        const anim = reasonScaleAnims[idx];
        const isSelected = reason.includes(opt);
        return (
          <AnimatedPressable
            key={opt}
            onPress={() => {
              if (isSelected) {
                setReason(reason.filter(item => item !== opt));
              } else {
                setReason([...reason, opt]);
              }
            }}
            onPressIn={() => {
              Haptics.selectionAsync();
              Animated.spring(anim, {
                toValue: 0.85,
                friction: 6,
                useNativeDriver: true,
              }).start();
            }}
            onPressOut={() => {
              Animated.spring(anim, {
                toValue: 1,
                friction: 6,
                useNativeDriver: true,
              }).start();
            }}
            style={[
              styles.choice6,
              { transform: [{ scale: anim }], paddingLeft: 24 },
              isSelected && styles.choiceSelected,
            ]}
          >
            <Text
              style={[
                styles.choiceText,
                isSelected && styles.choiceTextSelected,
              ]}
            >
              {opt}
            </Text>
          </AnimatedPressable>
        );
      })}


      {/* CONTINUE */}
      <Pressable
        disabled={reason.length === 0}
        onPressIn={() => reason.length > 0 && Haptics.selectionAsync()}
        style={[
          styles.continueButton,
          reason.length === 0 && styles.continueButtonDisabled
        ]}
        onPress={() => setStepIndex(stepIndex + 1)}
      >
        <Text style={[
          styles.continueButtonText,
          reason.length === 0 && styles.continueButtonTextDisabled
        ]}>
          Continue
        </Text>
      </Pressable>
</AnimatedSafeAreaView>

  );
}
// ——— STEP 7: Which do you most align with? ———
  if (step === 'alignment') {
  const canContinue = hasInteractedWithAlignment || alignmentTimerComplete;
  const buttonText = hasEnteredInformation ? 'Continue' : 'Skip';
  return (
    <AnimatedSafeAreaView style={[styles.container, { backgroundColor: '#000' }]}>
      {/* HEADER */}
      <View style={styles.headerRow}>
        {stepIndex > 0 && (
          <Pressable
            onPressIn={() => Haptics.selectionAsync()}
            style={styles.backButton}
            onPress={() => setStepIndex(stepIndex - 1)}
          >
            <Text style={styles.backButtonText}>←</Text>
          </Pressable>
        )}
        <View
          style={styles.progressContainer}
          onLayout={e => setContainerWidth(e.nativeEvent.layout.width)}
        >
          <Animated.View
            style={[
              styles.progressFill,
              {
                width: progressAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, containerWidth],
                }),
              },
            ]}
          />
        </View>
      </View>

      {/* Scrollable Content */}
      <TouchableWithoutFeedback onPress={() => {
        markAlignmentInteraction();
        Keyboard.dismiss();
      }}>
        <ScrollView
          style={{ flex: 1, width: '100%' }}
          contentContainerStyle={{ paddingBottom: 20 }}
          showsVerticalScrollIndicator={false}
          onScrollBeginDrag={Keyboard.dismiss}
          keyboardShouldPersistTaps="handled"
        >
        {/* Title & Subtitle */}
        <Text style={styles.title1}>Demographic Indicators</Text>
        <Text style={styles.subtitleText}>
          We use this information to tell you exactly how certain policies and political actions impact you specifically. You can fill out as little or as much as you want, or skip it entirely.
        </Text>

        {/* State Code Input */}
        <View style={styles.stateCodeWrapper}>
          <View style={styles.stateCodeContainer}>
            <Text style={styles.stateCodeLabel}>State Code</Text>
            <TextInput
              style={styles.stateCodeInput}
              placeholder="Ex: WA"
              placeholderTextColor="#666"
              value={stateCode}
            onChangeText={(text) => {
              markAlignmentInteraction();
              // Only allow letters, max 2 characters, auto-capitalize
              const filtered = text.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 2);
              setStateCode(filtered);
              if (filtered.length > 0) {
                setHasEnteredInformation(true);
              }
            }}
              maxLength={2}
              autoCapitalize="characters"
              keyboardType="default"
              blurOnSubmit={true}
            />
          </View>
          {stateCode.length === 2 && !isValidStateCode(stateCode) && (
            <Text style={styles.stateCodeError}>Invalid state code</Text>
          )}
        </View>

        {/* Political Standing Label */}
        <Text style={styles.educationLabel}>Political Standing</Text>

        {/* Political Standing Filter Buttons */}
        <View style={styles.educationButtonsContainer}>
          {['Democrat', 'Republican', 'Centrist', 'Left Leaning', 'Right Leaning', 'Other'].map((option) => (
            <SearchFilterButton
              key={option}
              word={option}
              isSelected={politicalStanding === option}
              onPress={(word) => {
                markAlignmentInteraction();
                const newValue = politicalStanding === word ? '' : word;
                setPoliticalStanding(newValue);
                if (newValue.length > 0) {
                  setHasEnteredInformation(true);
                }
              }}
            />
          ))}
        </View>

        {/* Education Level Label */}
        <Text style={styles.educationLabel}>Highest Education Level</Text>

        {/* Education Level Filter Buttons */}
        <View style={styles.educationButtonsContainer}>
          {['None', 'High School', 'College/University In Progress', 'Bachelors/Associates', 'Masters/PHD'].map((option) => (
            <SearchFilterButton
              key={option}
              word={option}
              isSelected={educationLevel === option}
              onPress={(word) => {
                markAlignmentInteraction();
                const newValue = educationLevel === word ? '' : word;
                setEducationLevel(newValue);
                if (newValue.length > 0) {
                  setHasEnteredInformation(true);
                }
              }}
            />
          ))}
        </View>

        {/* Employment Status Label */}
        <Text style={styles.educationLabel}>Employment Status</Text>

        {/* Employment Status Filter Buttons */}
        <View style={styles.educationButtonsContainer}>
          {['Employed full-time', 'Part-time', 'Gig / Freelance work', 'Student', 'Unemployed', 'Retired'].map((option) => {
            const isSelected = employmentStatus.includes(option);
        return (
              <SearchFilterButton
                key={option}
                word={option}
                isSelected={isSelected}
                onPress={(word) => {
                  markAlignmentInteraction();
                  if (isSelected) {
                    setEmploymentStatus(employmentStatus.filter(item => item !== word));
                  } else {
                    setEmploymentStatus([...employmentStatus, word]);
                    setHasEnteredInformation(true);
                  }
                }}
              />
            );
          })}
        </View>

        {/* Income Level Label */}
        <Text style={styles.educationLabel}>Income Level</Text>

        {/* Income Level Filter Buttons */}
        <View style={styles.educationButtonsContainer}>
          {['Under $25,000', '$25,000 – $49,999', '$50,000 – $99,999', '$100k – $199,999', '$200k or more'].map((option) => (
            <SearchFilterButton
              key={option}
              word={option}
              isSelected={incomeLevel === option}
              onPress={(word) => {
                markAlignmentInteraction();
                const newValue = incomeLevel === word ? '' : word;
                setIncomeLevel(newValue);
                if (newValue.length > 0) {
                  setHasEnteredInformation(true);
                }
              }}
            />
          ))}
        </View>

        {/* Race & Ethnicity Label */}
        <Text style={styles.educationLabel}>Race & Ethnicity</Text>

        {/* Race & Ethnicity Filter Buttons */}
        <View style={styles.educationButtonsContainer}>
          {['Black or African American', 'White', 'Hispanic or Latino', 'Asian', 'Middle Eastern or North African', 'Native American or Alaska Native', 'Islander', 'Multiracial'].map((option) => (
            <SearchFilterButton
              key={option}
              word={option}
              isSelected={raceEthnicity === option}
              onPress={(word) => {
                markAlignmentInteraction();
                const newValue = raceEthnicity === word ? '' : word;
                setRaceEthnicity(newValue);
                if (newValue.length > 0) {
                  setHasEnteredInformation(true);
                }
              }}
            />
          ))}
        </View>

        {/* Dependent Status Label */}
        <Text style={styles.educationLabel}>Dependent Status</Text>

        {/* Dependent Status Filter Buttons */}
        <View style={styles.educationButtonsContainer}>
          {['Children', 'Elderly family member', 'Disabled Dependent', 'No Dependents'].map((option) => (
            <SearchFilterButton
              key={option}
              word={option}
              isSelected={dependentStatus === option}
              onPress={(word) => {
                markAlignmentInteraction();
                const newValue = dependentStatus === word ? '' : word;
                setDependentStatus(newValue);
                if (newValue.length > 0) {
                  setHasEnteredInformation(true);
                }
              }}
            />
          ))}
        </View>

        {/* Military Status Label */}
        <Text style={styles.educationLabel}>Military Status</Text>

        {/* Military Status Filter Buttons */}
        <View style={styles.educationButtonsContainer}>
          {['No military affiliation', 'Active duty', 'National Guard or Reserve', 'Veteran', 'Military Dependent'].map((option) => (
            <SearchFilterButton
              key={option}
              word={option}
              isSelected={militaryStatus === option}
              onPress={(word) => {
                markAlignmentInteraction();
                const newValue = militaryStatus === word ? '' : word;
                setMilitaryStatus(newValue);
                if (newValue.length > 0) {
                  setHasEnteredInformation(true);
                }
              }}
            />
          ))}
        </View>

        {/* Immigration Status Label */}
        <Text style={styles.educationLabel}>Immigration Status</Text>

        {/* Immigration Status Filter Buttons */}
        <View style={styles.educationButtonsContainer}>
          {['U.S. Citizen', 'Green Card', 'Visa Holder', 'Non-Citizen Status'].map((option) => (
            <SearchFilterButton
              key={option}
              word={option}
              isSelected={immigrationStatus === option}
              onPress={(word) => {
                markAlignmentInteraction();
                const newValue = immigrationStatus === word ? '' : word;
                setImmigrationStatus(newValue);
                if (newValue.length > 0) {
                  setHasEnteredInformation(true);
                }
              }}
            />
          ))}
        </View>

        {/* Government Benefits Label */}
        <Text style={styles.educationLabel}>Government Benefits</Text>

        {/* Government Benefits Filter Buttons */}
        <View style={styles.educationButtonsContainer}>
          {['None', 'SNAP / Food Assistance', 'Medicaid or Medicare', 'SSI / SSDI', 'Housing', 'Unemployment', 'Education', 'Other Assistance'].map((option) => {
            const isSelected = governmentBenefits.includes(option);
            return (
              <SearchFilterButton
                key={option}
                word={option}
                isSelected={isSelected}
                onPress={(word) => {
                  markAlignmentInteraction();
                  if (isSelected) {
                    setGovernmentBenefits(governmentBenefits.filter(item => item !== word));
                  } else {
                    setGovernmentBenefits([...governmentBenefits, word]);
                    setHasEnteredInformation(true);
                  }
                }}
              />
            );
          })}
        </View>

        {/* Sexual Orientation Label */}
        <Text style={styles.educationLabel}>Sexual Orientation</Text>

        {/* Sexual Orientation Filter Buttons */}
        <View style={styles.educationButtonsContainer}>
          {['Heterosexual', 'Homosexual', 'Bisexual', 'Asexual', 'Other'].map((option) => (
            <SearchFilterButton
              key={option}
              word={option}
              isSelected={sexualOrientation === option}
              onPress={(word) => {
                markAlignmentInteraction();
                const newValue = sexualOrientation === word ? '' : word;
                setSexualOrientation(newValue);
                if (newValue.length > 0) {
                  setHasEnteredInformation(true);
                }
              }}
            />
          ))}
        </View>

        {/* Voter Eligibility Label */}
        <Text style={styles.educationLabel}>Voter Eligibility</Text>

        {/* Voter Eligibility Filter Buttons */}
        <View style={styles.educationButtonsContainer}>
          {['Registered and Eligible', 'Eligible, Not Registered', 'Not Eligible'].map((option) => (
            <SearchFilterButton
              key={option}
              word={option}
              isSelected={voterEligibility === option}
              onPress={(word) => {
                markAlignmentInteraction();
                const newValue = voterEligibility === word ? '' : word;
                setVoterEligibility(newValue);
                if (newValue.length > 0) {
                  setHasEnteredInformation(true);
                }
              }}
            />
          ))}
        </View>

        {/* Disability Status Label */}
        <Text style={styles.educationLabel}>Disability Status</Text>

        {/* Disability Status Filter Buttons */}
        <View style={styles.educationButtonsContainer}>
          {['None', 'Physical Disability', 'Cognitive or Learning Disability', 'Mental Health Condition', 'Multiple Disabilities'].map((option) => {
            const isSelected = disabilityStatus.includes(option);
            return (
              <SearchFilterButton
                key={option}
                word={option}
                isSelected={isSelected}
                onPress={(word) => {
                  markAlignmentInteraction();
                  if (isSelected) {
                    setDisabilityStatus(disabilityStatus.filter(item => item !== word));
                  } else {
                    setDisabilityStatus([...disabilityStatus, word]);
                    setHasEnteredInformation(true);
                  }
                }}
              />
            );
          })}
        </View>

        {/* Industry of Work or Study Label */}
        <Text style={styles.educationLabel}>Industry of Work or Study</Text>

        {/* Industry of Work or Study Filter Buttons */}
        <View style={styles.educationButtonsContainer}>
          {['Healthcare', 'Technology', 'Education', 'Finance / Business', 'Government', 'Public Sector', 'Military / Defense', 'Manufacturing', 'Trades', 'Politics', 'Service / Hospitality', 'Retail', 'Transportation', 'Logistics', 'Creative', 'Agriculture / Environment', 'Other'].map((option) => {
            const isSelected = industryOfWork.includes(option);
            return (
              <SearchFilterButton
                key={option}
                word={option}
                isSelected={isSelected}
                onPress={(word) => {
                  markAlignmentInteraction();
                  if (isSelected) {
                    setIndustryOfWork(industryOfWork.filter(item => item !== word));
                  } else {
                    setIndustryOfWork([...industryOfWork, word]);
                    setHasEnteredInformation(true);
                  }
                }}
              />
            );
          })}
        </View>

        {/* Additional Information Label */}
        <Text style={styles.educationLabel}>Additional Information</Text>

        {/* Additional Information Text Input */}
        <TextInput
          style={styles.additionalInfoInput}
          placeholder="This helps improve how accurate we are in determining how political events personally impact you."
          placeholderTextColor="#666"
          value={additionalInformation}
          onChangeText={(text) => {
            markAlignmentInteraction();
            setAdditionalInformation(text);
            if (text.length > 0) {
              setHasEnteredInformation(true);
            }
          }}
          multiline={true}
          textAlignVertical="top"
          blurOnSubmit={true}
        />
        </ScrollView>
      </TouchableWithoutFeedback>

      {/* CONTINUE */}
      <Pressable
        disabled={!canContinue}
        onPressIn={() => canContinue && Haptics.selectionAsync()}
        style={[
          styles.continueButton,
          !canContinue && styles.continueButtonDisabled
        ]}
        onPress={() => setStepIndex(stepIndex + 1)}
      >
        <Text style={[
          styles.continueButtonText,
          !canContinue && styles.continueButtonTextDisabled
        ]}>
          {buttonText}
        </Text>
      </Pressable>
    </AnimatedSafeAreaView>
  );
}
// ——— STEP 8: Value Proposition ———
if (step === 'valueProp') {
  return (
    <AnimatedSafeAreaView style={[styles.container, { backgroundColor: '#000' }]}>
      {/* HEADER */}
      <View style={styles.headerRow}>
        {stepIndex > 0 && (
          <Pressable
            onPressIn={() => Haptics.selectionAsync()}
            style={styles.backButton}
            onPress={() => setStepIndex(stepIndex - 1)}
          >
            <Text style={styles.backButtonText}>←</Text>
          </Pressable>
        )}
        <View
          style={styles.progressContainer}
          onLayout={e => setContainerWidth(e.nativeEvent.layout.width)}
        >
          <Animated.View
            style={[
              styles.progressFill,
              {
                width: progressAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, containerWidth],
                }),
              },
            ]}
          />
        </View>
      </View>

      {/* TITLE */}
      <Text style={styles.title5}>
        Don’t pick between{'\n'}convenience and credibility,{'\n'}Execudex brings you both.
      </Text>

      {/* ─── Bars Card Background ─── */}
      <View
        onLayout={e => setBarContainerWidth(e.nativeEvent.layout.width)}
        style={{
          width: '96%',
          backgroundColor: '#090909',
          borderRadius: 24,
          alignItems: 'center',
          height: '58%',
        }}
      >

        {/* BARS & DOTS */}
        <View style={{ width: '100%', alignItems: 'flex-start' }}>
          {/* full-width black base */}
<Animated.View
  style={{
    backgroundColor: '#000',
    height: 90,
    borderRadius: 24,
    alignSelf: 'flex-start',
    width: black1Anim.interpolate({
      inputRange: [0, 1],
      outputRange: [0, barContainerWidth * 0.97],
    }),
    marginTop: 180,
  }}
/>

          {/* shorter white bar */}
          <Animated.View
            style={{
              backgroundColor: '#fff',
              height: 90,
              borderRadius: 24,
              alignSelf: 'flex-start',
    width: bottomBarAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0, barContainerWidth * 0.90],
          }),
      marginTop: -90,
            }}
          />
          {/* full-width black base (upper) */}
<Animated.View
  style={{
    backgroundColor: '#000',
    height: 90,
    borderRadius: 24,
    alignSelf: 'flex-start',
    width: black2Anim.interpolate({
      inputRange: [0, 1],
      outputRange: [0, barContainerWidth * 0.97],
    }),
    marginTop: -215,
  }}
/>

          {/* shorter grey bar */}
          <Animated.View
  style={{
    backgroundColor: '#474747',
    height: 90,
    borderRadius: 24,
    alignSelf: 'flex-start',
    width: topBarAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0, barContainerWidth * 0.68],
    }),
    marginTop: -90,
  }}
          />

                  {/* DOTS */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: '15%' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Animated.View
              style={{
                width: 8, height: 8, borderRadius: 4,
                backgroundColor: '#474747',
                marginRight: 8,
                bottom: 50,
                left: 10,
                opacity: tradAnim,
              }}
            />
            <Animated.Text
              style={{
                opacity: tradAnim, color: '#474747', fontSize: 13, bottom: 50, left: 10,
              }}
            >
              With traditional news sources
            </Animated.Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Animated.View
              style={{
                width: 8, height: 8, borderRadius: 4,
                backgroundColor: '#fff',
                marginRight: 8,
                opacity: execAnim,
                bottom: 50,
                right: 40,
              }}
            />
            <Animated.Text
              style={{
                opacity: execAnim, color: '#FFF', fontSize: 13, bottom: 50, right: 40,
              }}
            >
              With Execudex
            </Animated.Text>
          </View>
        </View>
        </View>
      </View>

      {/* ─── LABELS & DOTS ─── */}
      <>
        {/* Bias & misinformation */}
        <Animated.Text
          style={{
            position: 'absolute', top: 325, left: 35,
            opacity: biasAnim, color: '#fff', fontSize: 18,
          }}
        >
          Bias and misinformation
        </Animated.Text>

        {/* Neutrality, reliability, simplicity */}
        <Animated.Text
          style={{
            position: 'absolute', top: 450, left: 50,
            opacity: neutralAnim, color: '#w', fontSize: 18,
          }}
        >
          Neutrality, reliability, simplicity
        </Animated.Text>

        {/* Grey dot + “With traditional news sources” */}




      </>

      {/* ─── Description Card Background ─── */}
      <View
        style={{
          width: '92%',
          backgroundColor: '#090909',
          borderRadius: 24,
          paddingTop: 33,
          alignItems: 'center',
          height: 120,
          position: 'absolute',
          bottom: 132,
        }}
      >
        {/* DESC FADE IN */}
        <Animated.View style={{ opacity: descAnim }}>
          <Text style={[styles.subtitleText1, { marginBottom: 0 }]}>
            Execudex makes politics easier, no matter what side you’re on.
          </Text>
        </Animated.View>
      </View>

      {/* CONTINUE */}
      <Pressable
        disabled={!valuePropAnimComplete}
        onPressIn={() => valuePropAnimComplete && Haptics.selectionAsync()}
        style={[
          styles.continueButton,
          !valuePropAnimComplete && styles.continueButtonDisabled
        ]}
        onPress={() => setStepIndex(stepIndex + 1)}
      >
        <Text style={[
          styles.continueButtonText,
          !valuePropAnimComplete && styles.continueButtonTextDisabled
        ]}>
          Continue
        </Text>
      </Pressable>
    </AnimatedSafeAreaView>
  );
}


 if (step === 'profileHighlight') {
   return (
     <AnimatedSafeAreaView style={[styles.container, { backgroundColor: '#000' }]}>
      
      {/* HEADER */}
      <View style={styles.headerRow}>
        {stepIndex > 0 && (
          <Pressable
            onPressIn={() => Haptics.selectionAsync()}
            style={styles.backButton}
            onPress={() => setStepIndex(stepIndex - 1)}
          >
            <Text style={styles.backButtonText}>←</Text>
          </Pressable>
        )}
        <View
          style={styles.progressContainer}
 onLayout={e => {
   // only set it the first time, so we don’t re-render again below
   if (containerWidth === 0) {
     setContainerWidth(e.nativeEvent.layout.width);
   }
 }}
        >
          <Animated.View
            style={[
              styles.progressFill,
              {
                width: progressAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, containerWidth],
                }),
              },
            ]}
          />
        </View>
      </View>

      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={{ flex: 1, width: '100%', alignItems: 'center' }}>
          {/* TITLE TEXT */}
          <Text style={styles.title5}>
            Create your account
          </Text>

          {/* Email/Password Form */}
          <View style={styles.signupFormContainer}>
            <TextInput
              style={[
                styles.signupInput,
                signUpEmailError && { borderColor: '#ff4444' }
              ]}
              placeholder="Email"
              placeholderTextColor="#666"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={signUpEmail}
              onChangeText={(text) => {
                setSignUpEmail(text);
                if (signUpEmailError) setSignUpEmailError('');
              }}
            />
            {signUpEmailError ? (
              <Text style={styles.signupErrorText}>{signUpEmailError}</Text>
            ) : null}
            
            <View style={styles.signupPasswordContainer}>
              <TextInput
                style={[
                  styles.signupPasswordInput,
                  signUpPasswordError && { borderColor: '#ff4444' }
                ]}
                placeholder="Password"
                placeholderTextColor="#666"
                secureTextEntry={!showSignUpPassword}
                autoCapitalize="none"
                autoCorrect={false}
                value={signUpPassword}
                onChangeText={(text) => {
                  setSignUpPassword(text);
                  if (signUpPasswordError) setSignUpPasswordError('');
                }}
              />
              <Pressable 
                style={styles.signupShowPasswordButton}
                onPress={() => setShowSignUpPassword(!showSignUpPassword)}
              >
                <Text style={styles.signupShowPasswordText}>
                  {showSignUpPassword ? 'Hide' : 'Show'}
                </Text>
              </Pressable>
            </View>
            {signUpPasswordError ? (
              <Text style={styles.signupErrorText}>{signUpPasswordError}</Text>
            ) : null}

            <Pressable 
              style={[
                styles.signupEmailButton,
                isSignUpLoading && { opacity: 0.6 }
              ]}
              onPress={handleEmailSignUp}
              disabled={isSignUpLoading}
            >
              {isSignUpLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.signupEmailButtonText}>Sign Up</Text>
              )}
            </Pressable>
          </View>

          {/* Social sign-up buttons hidden per user request */}
        </View>
      </TouchableWithoutFeedback>

      {/* TERMS AGREEMENT TEXT */}
      <View style={styles.termsAgreementContainer}>
        <Text style={styles.termsAgreementText}>
          Continuing means you agree to the{' '}
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

      {/* CONTINUE BUTTON */}
      <Pressable
        onPressIn={() => accountCreated && Haptics.selectionAsync()}
        style={[
          styles.continueButton,
          !accountCreated && styles.continueButtonDisabled
        ]}
        onPress={() => accountCreated && setStepIndex(stepIndex + 1)}
        disabled={!accountCreated}
      >
        <Text style={[
          styles.continueButtonText,
          !accountCreated && styles.continueButtonTextDisabled
        ]}>
          Continue
        </Text>
      </Pressable>

    </AnimatedSafeAreaView>
  );
}
if (step === 'paymentPlan') {
  return (
    <AnimatedSafeAreaView style={[styles.container, { backgroundColor: '#000' }]}>
      {/* HEADER & PROGRESS identical to other screens */}
      <View style={styles.headerRow}>
{stepIndex > 0 && (
  <Pressable
    onPressIn={() => Haptics.selectionAsync()}
    onPress={() => setStepIndex(stepIndex - 1)}
    style={styles.backButton}
  >
    <Text style={styles.backButtonText}>←</Text>
  </Pressable>
)}

        <View style={styles.progressContainer} onLayout={e => setContainerWidth(e.nativeEvent.layout.width)}>
          <Animated.View
            style={[
              styles.progressFill,
              { width: progressAnim.interpolate({
                  inputRange: [0,1],
                  outputRange: [0, containerWidth],
                })
              }
            ]}
          />
        </View>
      </View>

      {/* Content Container with flex to push description box above button */}
      <View style={{ flex: 1, width: '100%', alignItems: 'center', paddingHorizontal: 16 }}>
        {/* TITLE */}
        <Text style={styles.title10}>Choose your payment plan</Text>

        {/* Subscription Boxes Container */}
        <View style={{ width: '100%', marginTop: 20 }}>
          {/* First Rectangle - Execudex Basic */}
          <Animated.View style={{ transform: [{ scale: box1Scale }] }}>
            <Pressable
              onPress={() => handlePlanSelect('basic', 'monthly')}
              onPressIn={() => {
                Haptics.selectionAsync();
                Animated.spring(box1Scale, { toValue: 0.95, friction: 6, useNativeDriver: true }).start();
              }}
              onPressOut={() => {
                Animated.spring(box1Scale, { toValue: 1, friction: 6, useNativeDriver: true }).start();
              }}
              style={[
                styles.subscriptionBox,
                (plan === 'basic' && cycle === 'monthly') && styles.subscriptionBoxSelected
              ]}
            >
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
            </Pressable>
          </Animated.View>

          {/* Second Rectangle - Execudex Plus */}
          <Animated.View style={{ transform: [{ scale: box2Scale }] }}>
            <Pressable
              onPress={() => handlePlanSelect('plus', 'monthly')}
              onPressIn={() => {
                Haptics.selectionAsync();
                Animated.spring(box2Scale, { toValue: 0.95, friction: 6, useNativeDriver: true }).start();
              }}
              onPressOut={() => {
                Animated.spring(box2Scale, { toValue: 1, friction: 6, useNativeDriver: true }).start();
              }}
              style={[
                styles.subscriptionBox,
                (plan === 'plus' && cycle === 'monthly') && styles.subscriptionBoxSelected
              ]}
            >
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
            </Pressable>
          </Animated.View>

          {/* Third Rectangle - Execudex Plus (Copy) */}
          <Animated.View style={{ transform: [{ scale: box4Scale }] }}>
            <Pressable
              onPress={() => handlePlanSelect('plus', 'quarterly')}
              onPressIn={() => {
                Haptics.selectionAsync();
                Animated.spring(box4Scale, { toValue: 0.95, friction: 6, useNativeDriver: true }).start();
              }}
              onPressOut={() => {
                Animated.spring(box4Scale, { toValue: 1, friction: 6, useNativeDriver: true }).start();
              }}
              style={[
                styles.subscriptionBox,
                (plan === 'plus' && cycle === 'quarterly') && styles.subscriptionBoxSelected
              ]}
            >
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
            </Pressable>
          </Animated.View>
        </View>

        {/* DESCRIPTION */}
        <View style={styles.descriptionBox}>
          <Text style={styles.description}>
            You can change your subscription plan at any time
          </Text>
        </View>

        {/* Spacer to push terms text down */}
        <View style={{ flex: 1 }} />
      </View>

      {/* TERMS AGREEMENT TEXT */}
      <View style={[styles.termsAgreementContainer, { position: 'relative', bottom: 'auto' }]}>
        <Text style={styles.termsAgreementText}>
          Continuing means you agree to the{' '}
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

      {/* CONTINUE */}
      <Pressable
        disabled={!plan || !cycle}
        onPress={async () => {
          try {
            // Get the current user's UUID from Supabase Auth
            const supabase = getSupabaseClient();
          const { data: { user } } = await supabase.auth.getUser();
            
            if (user) {
              const onboardData = buildOnboardData();
              console.log('📋 Continue button pressed!');
              console.log('📋 Current plan state:', plan);
              console.log('📋 Current cycle state:', cycle);
              console.log('📤 About to call saveOnboardData with:');
              console.log('   - plan:', plan);
              console.log('   - cycle:', cycle);

              // Both Basic and Plus now require IAP purchase
              if (!isIAPAvailable()) {
                Alert.alert(
                  'In-App Purchases Unavailable',
                  'Please switch to a production build to complete the purchase.'
                );
                return;
              }

              try {
                setPurchaseError(null);
                setIsPurchasing(true);
                await iapService.initialize();

                // Determine product ID based on plan and cycle
                let productId: string;
                if (plan === 'basic') {
                  // Basic is monthly only (product ID: execudex.basic)
                  productId = SUBSCRIPTION_PRODUCTS.BASIC_MONTHLY;
                } else if (plan === 'plus') {
                  // Plus has monthly and quarterly options
                  productId = cycle === 'quarterly'
                    ? SUBSCRIPTION_PRODUCTS.PLUS_QUARTERLY
                    : SUBSCRIPTION_PRODUCTS.PLUS_MONTHLY;
                } else {
                  throw new Error('Invalid plan selected');
                }

                await iapService.purchaseSubscription(productId as any);
                // Success path handled by purchase listener (save + navigate)
              } catch (purchaseErr: any) {
                console.error('Purchase failed:', purchaseErr);
                setIsPurchasing(false);
                Alert.alert(
                  'Purchase Error',
                  purchaseErr?.message || 'Purchase failed. Please try again.'
                );
              }
            }
          } catch (error) {
            console.error('Error saving onboard data:', error);
          }
        }}
        onPressIn={() => (plan && cycle) && Haptics.selectionAsync()}
        style={[
          styles.continueButton,
          (!plan || !cycle) && styles.continueButtonDisabled
        ]}
      >
        <Text style={[
          styles.continueButtonText,
          (!plan || !cycle) && styles.continueButtonTextDisabled
        ]}>
          Continue
        </Text>
      </Pressable>

      <ProfileLoadingIndicator
        visible={isPurchasing}
        title={purchaseError ? 'Purchase Error' : 'Processing purchase...'}
        subtitle={purchaseError || 'Confirm with Apple Pay to finish your subscription signup.'}
        error={purchaseError}
        onCancel={() => {
          setIsPurchasing(false);
          setPurchaseError(null);
        }}
      />

    </AnimatedSafeAreaView>
  );
}

  // Fallback return for unexpected states
  return (
    <AnimatedSafeAreaView style={[styles.container, { backgroundColor: '#000' }]}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    </AnimatedSafeAreaView>
  );
}


const styles = StyleSheet.create({

  profileContainer: {
    width: 380,
    height: 320,
    backgroundColor: '#090909',
    borderRadius: 30,
    alignSelf: 'center',
    marginTop: 60,
    marginBottom: 10,
    position: 'relative',
  },

  // Plan Type Slider Styles
  planSliderContainer: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 20,
  },
  planSliderPill: {
    backgroundColor: '#151515',
    borderRadius: 28,
    paddingVertical: 4,
    paddingHorizontal: 10,
    minWidth: 170,
    shadowColor: '#000',
    shadowOpacity: 0.13,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  planSlider: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  planAnimatedPill: {
    position: 'absolute',
    backgroundColor: '#fff',
    borderRadius: 18,
    paddingHorizontal: 10,
    paddingVertical: 3,
    minWidth: 50,
    height: 32,
    left: 0,
    top: 0,
    zIndex: 1,
  },
  planTabButton: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 32,
    minWidth: 75,
    marginHorizontal: 2,
    zIndex: 2,
  },
  planTabText: {
    color: '#fff',
    fontWeight: '500',
    fontSize: 14,
  },
  planTabTextActive: {
    color: '#000',
  },

  // New Plan Button Styles
  planButtonsScrollView: {
    flex: 1,
    marginTop: 0,
  },
  planPage: {
    width: 380,
    height: 400,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  planButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingHorizontal: 20,
  },
  newPlanButton: {
    backgroundColor: '#090909',
    padding: 16,
    borderRadius: 20,
    height: 220,
    marginTop: 0,
    width: 150,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 0,
  },
      newPlanButtonSelected: {
      backgroundColor: '#fff',
    },
  newPlanButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  newPlanButtonTextSelected: {
    color: '#000',
  },
  newPlanButtonPrice: {
    color: '#fff',
    fontSize: 40,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  newPlanButtonSubtext: {
    color: '#ccc',
    fontSize: 12,
    fontWeight: '400',
    textAlign: 'center',
  },

  descriptionBox: {
    backgroundColor: '#090909',
    width: '100%',
    alignSelf: 'center',
    borderRadius: 20,
    marginBottom: 0,
    paddingVertical: 15,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
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

  subscriptionBoxSelected: {
    borderColor: '#fff',
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

  // Container
  container: {
    flex:           1,
    backgroundColor:'#000',
   paddingTop:    Platform.OS === 'ios' ? 80 : 60,   // leave room for header
   paddingBottom: 100, 
    alignItems:     'center',
    justifyContent: 'flex-start',
  },
planButton: {
  padding: 16,
  borderRadius: 20,
  height: 100,
  width: 380,
},
planTitle: {
  color: '#fff',
  fontSize: 20,
  fontWeight: '600',
  left: 4,
  top: 2
},
planTitlePressed: {
  color: '#000',
},
planSubtitle: {
  color: '#fff',
  fontSize: 16,
  top: 9,
  left: 4
},
planSubtitle1: {
  color: '#fff',
  fontSize: 12,
  fontStyle: 'italic',
  top:15,
  left: 5 

},
planSubtitlePressed: {
  color: '#333',
},
planDiscount: {
  color: '#fff',
  fontSize: 10,
  fontStyle: 'italic',
  left: 180,
  bottom: 30,
},
planDiscountPressed: {
  color: '#333',
},

description: {
  color: '#ccc',
  fontSize: 13,
  fontWeight: '400',
  textAlign: 'center',
  marginBottom: 0,
},

  // — STEP 1 Styles —
  mockupRow:          { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginBottom: '0%', 
    height: '100%' 
  },
  largeMockup:        { 
    width: '50%', 
    height: '65%', 
    marginBottom: '15%', 
    marginLeft: '20%'
  },
    sideImages:         { 
    marginLeft: '0%', 
    justifyContent: 'center', 
    alignItems: 'center',
    width: '50%', 
    height: '50%'
  },
  smallMockup:        { 
    width: '45%', 
    height: '62%', 
    marginBottom: '25%', 
    marginRight: '13%'
  },
  smallMockupSpacing: { 
    marginTop: '10%' 
  },
  subtitle:           { color:'#fff', fontSize:22, fontWeight:'bold', textAlign:'center', 
    position: 'absolute', bottom: 190,
   },

  getStartedButton:        {
    backgroundColor:'#090909',
    paddingVertical:14,
    paddingHorizontal:36,
    borderRadius:32,
    width:'85%',
    alignItems:'center',
    justifyContent:'center',
    marginBottom:'3%',
    height:'10%',
  },
  getStartedButtonPressed: { backgroundColor:'#fff' },
  getStartedText:           { color:'#fff', fontSize:18, fontWeight:'600', textAlign:'center' },
  getStartedTextPressed:    { color:'#000' },

  signInText: { color:'#aaa', fontSize:14, marginTop:'5%' },
  signInLink: { color:'#fff', fontWeight:'600' },

  // — STEP 2 Styles —


  title10:         {
    alignSelf:'flex-start',
    textAlign:'left',
    color:'#fff',
    fontSize:25,
    fontWeight:'medium',
    marginTop: 0,
    marginBottom: 0,
  },

  title:         {
    alignSelf:'flex-start',
    textAlign:'left',
    color:'#fff',
    fontSize:25,
    fontWeight:'medium',
    marginBottom:'2%',
    paddingLeft: '5%',
    paddingTop: '0%',
  },

  title1:         {
    alignSelf:'flex-start',
    textAlign:'left',
    color:'#fff',
    fontSize:23,
    fontWeight:'medium',
    marginBottom:'2%',
    paddingLeft: '5%',
    paddingTop: '0%',
  },
  title2:         {
    alignSelf:'flex-start',
    textAlign:'left',
    color:'#fff',
    fontSize:23,
    fontWeight:'medium',
    marginBottom:'2%',
    paddingLeft: '5%',
    paddingTop: '0%',
  },
    title3:         {
    alignSelf:'flex-start',
    textAlign:'left',
    color:'#fff',
    fontSize:23,
    fontWeight:'medium',
    marginBottom:'2%',
    paddingLeft: '5%',
    paddingTop: '0%',
  },
    title4:         {
    alignSelf:'flex-start',
    textAlign:'left',
    color:'#fff',
    fontSize:22,
    fontWeight:'medium',
    marginBottom:'2%',
    paddingLeft: '5%',
    paddingTop: '0%',
  },
    title5:         {
    alignSelf:'flex-start',
    textAlign:'left',
    color:'#fff',
    fontSize:26,
    fontWeight:'medium',
    marginBottom:'4%',
    paddingLeft: '5%',
    paddingTop:'0%',
  },

  subtitleText:  {
    alignSelf:'flex-start',
    textAlign:'left',
    color:'#888',
    fontSize:16,
    marginBottom:'3%',
    paddingLeft: '5%'
  },

  subtitleText1:  {
    alignSelf:'flex-start',
    textAlign:'center',
    color:'#fff',
    fontSize:20,
    marginBottom:'15%',
  },

  choice:           {
    backgroundColor:'#090909',
    paddingVertical:'8%',
    borderRadius:20,
    width:'92%',
    alignItems:'center',
    marginVertical:'2%',
  },
    choice1:           {
    backgroundColor:'#090909',
    paddingVertical:'9%',
    borderRadius:20,
    width:'31%',
    alignItems:'center',
    marginVertical: 8,

      },
    choice3:           {
      backgroundColor:'#090909',
      paddingVertical:'9%',
      borderRadius:20,
      width:'31%',
      alignItems:'center',
      marginVertical: 8,
  },
    choice4:           {
      backgroundColor:'#090909',
      paddingVertical:'9%',
      borderRadius:20,
      width:'31%',
      alignItems:'center',
      marginVertical: 8,
  },
  choice5:           {
    backgroundColor:'#090909',
    paddingVertical:'7%',
    borderRadius:20,
    width:'92%',
    alignItems:'center',
    marginVertical:'2%',
},
choice6:           {
  backgroundColor:'#090909',
  paddingVertical:'6.5%',
  borderRadius:20,
  width:'95%',
  alignItems:'flex-start',
  marginVertical: '2%',
},
  choiceSelected:   { backgroundColor:'#fff' },
  choiceText:       { color:'#fff', fontSize:18 },
  choiceText2:       { color:'#fff', fontSize:18 },
  choiceText3:       { color:'#fff', fontSize:18 },
  choiceTextSelected:{ color:'#000' },

  genderRow:     {
    flexDirection:'row',
    justifyContent:'space-between',
    width:'92%',
    marginBottom: '0%',

  },
  continueButton:      {
   position:    'absolute',
   bottom:      Platform.OS === 'ios' ? 50 : 20, // above safe area
   alignSelf:   'center',
   backgroundColor:'#090909',
    paddingVertical:14,
    paddingHorizontal:36,
    borderRadius:100,
    width:'90%',
    alignItems:'center',
    justifyContent:'center',
    height:65,
    
  },
  continueButtonDisabled: {
    backgroundColor: '#090909',
    opacity: 0.4,
  },
  continueButtonTextDisabled: {
    opacity: 0.5,
  },
  headerRow: {
   position: 'absolute',
   top:      Platform.OS === 'ios' ? 75 : 20,  // below status bar
   left:     0,
   right:    0,
   flexDirection: 'row',
   justifyContent: 'flex-start',
   alignItems: 'center',
   paddingHorizontal: 16,
   zIndex:   10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#090909',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    fontSize: 20,
    color: '#fff',
    fontWeight: 'bold',
  },
  progressContainer: {
    width: '75%',
    height: 6,
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    marginLeft: 12,
    backgroundColor: '#363636',
    alignSelf: 'center',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: '#fff',
  },
  // ── New styles for “hear about us” page
 optionRow: {
     flexDirection: 'row',
   alignItems: 'center',
   marginLeft: '6%',
 },
 logo: {
   width: 24,
   height: 24,
   marginRight: 12,
 },

  
  
  continueButtonText:{ color:'#fff', fontSize:15, fontWeight:'600' },

  // Sign up form styles
  signupFormContainer: {
    width: '90%',
    marginBottom: 0,
  },
  signupInput: {
    backgroundColor: '#090909',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    fontSize: 16,
    color: '#fff',
    marginBottom: 16,
  },
  signupErrorText: {
    color: '#ff4444',
    fontSize: 12,
    marginTop: -12,
    marginBottom: 12,
    marginLeft: 4,
  },
  signupPasswordContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  signupPasswordInput: {
    backgroundColor: '#090909',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    paddingRight: 80,
    fontSize: 16,
    color: '#fff',
  },
  signupShowPasswordButton: {
    position: 'absolute',
    right: 16,
    top: 16,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  signupShowPasswordText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  signupEmailButton: {
    backgroundColor: '#090909',
    borderWidth: 1,
    borderColor: '#111111',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 10,
  },
  signupEmailButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  termsAgreementContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 130 : 100,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
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
  stateCodeWrapper: {
    width: '90%',
    alignSelf: 'center',
    marginVertical: '2%',
  },
  stateCodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stateCodeLabel: {
    color: '#fff',
    fontSize: 18,
    marginRight: 10,
    minWidth: 100,
  },
  stateCodeInput: {
    width: 100,
    backgroundColor: '#090909',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 20,
    paddingHorizontal: 0,
    color: '#fff',
    height: 50,
    fontSize: 18,
    textAlign: 'center',
  },
  stateCodeError: {
    color: '#ff4444',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 0,
  },
  educationLabel: {
    color: '#fff',
    fontSize: 18,
    width: '90%',
    alignSelf: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  educationButtonsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    alignItems: 'center',
    width: '90%',
    alignSelf: 'center',
    marginBottom: 10,
  },
  additionalInfoInput: {
    width: '90%',
    alignSelf: 'center',
    backgroundColor: '#090909',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 16,
    color: '#fff',
    fontSize: 16,
    minHeight: 240,
    marginTop: 10,
    marginBottom: 200,
  },
});