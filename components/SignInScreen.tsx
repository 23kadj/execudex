import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ProfileLoadingIndicator } from './ProfileLoadingIndicator';
import { initIap, restorePurchases } from '../iap.apple';
import { isIAPAvailable } from '../utils/iapAvailability';
import { getSupabaseClient } from '../utils/supabase';
import { useAuth } from './AuthProvider';

export default function SignInScreen() {
  const { signInWithEmail, resetPassword } = useAuth();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [busy, setBusy] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const router = useRouter();
  const params = useLocalSearchParams<{ fromSignOut?: string }>();

  // Removed early IAP initialization - IAP will only initialize when user clicks "Restore Purchase"
  // This prevents crashes in release builds from initializing IAP too early

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePassword = (password: string) => {
    if (password.length < 6) {
      return 'Password must be at least 6 characters long';
    }
    return '';
  };

  const handleEmailChange = (text: string) => {
    setEmail(text);
    if (emailError) setEmailError('');
  };

  const handlePasswordChange = (text: string) => {
    setPassword(text);
    if (passwordError) setPasswordError('');
  };

  const handleEmailAuth = async () => {
    // Clear previous errors
    setEmailError('');
    setPasswordError('');

    // Validate email
    if (!email) {
      setEmailError('Email is required');
      return;
    }
    if (!validateEmail(email)) {
      setEmailError('Please enter a valid email address');
      return;
    }

    // Validate password
    if (!password) {
      setPasswordError('Password is required');
      return;
    }
    const passwordValidationError = validatePassword(password);
    if (passwordValidationError) {
      setPasswordError(passwordValidationError);
      return;
    }

    setLoading(true);
    try {
      const user = await signInWithEmail(email, password);
      
      // Check if user has completed onboarding (has a plan)
      if (user) {
        const { data: userData, error: userError } = await getSupabaseClient()
          .from('users')
          .select('plan, onboard')
          .eq('uuid', user.id)
          .maybeSingle();

        if (userError) {
          console.error('Error checking user plan:', userError);
        }

        // If no user data or no plan selected, redirect to onboarding
        if (!userData || !userData.plan || userData.plan === '' || userData.plan === null) {
          Alert.alert(
            'Complete Onboarding',
            'Please complete your onboarding and select a subscription plan to continue.',
            [{ text: 'OK' }]
          );
          router.replace('/');
          return;
        }
      }

      // User has a plan, proceed to home
      router.replace('/(tabs)/home');
    } catch (error: any) {
      console.error('Email auth error:', error);
      Alert.alert(
        'Authentication Error',
        error.message || 'Failed to authenticate. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!email) {
      Alert.alert('Error', 'Please enter your email address first');
      return;
    }

    try {
      await resetPassword(email);
      Alert.alert(
        'Password Reset',
        'Check your email for password reset instructions.',
        [{ text: 'OK' }]
      );
    } catch (error: any) {
      console.error('Password reset error:', error);
      Alert.alert(
        'Error',
        error.message || 'Failed to send reset email. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const onRestore = async () => {
    if (!isIAPAvailable()) {
      return;
    }

    try {
      setBusy(true);
      setRestoreError(null);
      // Initialize IAP only when user clicks restore (user-driven action)
      // This ensures IAP is only initialized after UI is fully mounted
      await initIap();
      const purchases = await restorePurchases();
      const allExecudexProducts = ['execudex.basic', 'execudex.plus.monthly', 'execudex.plus.quarterly'];
      const matchingPurchase = purchases?.find(p =>
        allExecudexProducts.includes(p.productId)
      );

      if (matchingPurchase) {
        const productId = matchingPurchase.productId;
        const plan = productId === 'execudex.basic' ? 'basic' : 'plus';
        const cycle = productId.includes('quarterly') ? 'quarterly' : 'monthly';

        // Update user subscription using the Edge Function
        const { data: { user } } = await getSupabaseClient().auth.getUser();
        if (user) {
          // Use the update_subscription_status function instead of direct DB update
          await getSupabaseClient().functions.invoke('update_subscription_status', {
            body: {
              userId: user.id,
              plan,
              cycle,
            }
          });
        }
        const planName = plan === 'basic' ? 'Basic' : 'Plus';
        Alert.alert('Restored', `Your ${planName} plan has been restored!`);
      } else {
        Alert.alert('No purchases found', 'We couldn\'t find prior subscriptions for this Apple ID.');
      }
    } catch (e: any) {
      setRestoreError(e?.message ?? 'Please try again.');
      Alert.alert('Restore failed', e?.message ?? 'Please try again.');
    } finally {
      setBusy(false);
    }
  };


  return (
    <SafeAreaView style={styles.container}>
      {/* Back Button */}
      <Pressable
        style={styles.backButton}
        onPress={() => {
          // Always navigate to onboarding screen when back button is pressed
          // This ensures consistent behavior whether coming from sign out or regular navigation
          router.replace('/');
        }}
      >
        <Text style={styles.backButtonText}>←</Text>
      </Pressable>

      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.content}>

        {/* Title */}
        <Text style={styles.titleText}>Sign in here</Text>

        {/* Email/Password Form */}
        <View style={styles.formContainer}>
          <TextInput
            style={[
              styles.input, 
              emailError && { borderColor: '#ff4444' }
            ]}
            placeholder="Email"
            placeholderTextColor="#666"
            value={String(email ?? '')}
            onChangeText={handleEmailChange}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}
          
          <View style={styles.passwordContainer}>
            <TextInput
              style={[
                styles.passwordInput, 
                passwordError && { borderColor: '#ff4444' }
              ]}
              placeholder="Password"
              placeholderTextColor="#666"
              value={String(password ?? '')}
              onChangeText={handlePasswordChange}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Pressable
              style={styles.showPasswordButton}
              onPress={() => setShowPassword(!showPassword)}
            >
              <Text style={styles.showPasswordText}>
                {showPassword ? 'Hide' : 'Show'}
              </Text>
            </Pressable>
          </View>
          {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}

          <Pressable
            style={[
              styles.emailButton, 
              loading && styles.buttonDisabled
            ]}
            onPress={handleEmailAuth}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.emailButtonText}>
                Sign In
              </Text>
            )}
          </Pressable>

          <View style={styles.authOptions}>
            <Pressable onPress={handlePasswordReset}>
              <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
            </Pressable>
            <Pressable onPress={onRestore} disabled={busy}>
              <Text style={[styles.forgotPasswordText, busy && { opacity: 0.6 }]}>Restore Purchase</Text>
            </Pressable>
          </View>
        </View>

        {/* Social sign-in buttons hidden per user request */}

        </View>
      </TouchableWithoutFeedback>

      <ProfileLoadingIndicator
        visible={busy}
        title={restoreError ? 'Restore failed' : 'Restoring purchases...'}
        subtitle={restoreError || 'Checking your App Store subscriptions.'}
        error={restoreError}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  content: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 70,
  },
  formContainer: {
    width: '90%',
    marginBottom: 0,
  },
  input: {
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
  passwordContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  passwordInput: {
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
  showPasswordButton: {
    position: 'absolute',
    right: 16,
    top: 16,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  showPasswordText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  emailButton: {
    backgroundColor: '#090909',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  emailButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  authOptions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
  },
  forgotPasswordText: {
    color: '#666',
    fontSize: 14,
  },
  inputError: {
    // Error border color will be applied dynamically
  },
  errorText: {
    color: '#ff4444',
    fontSize: 12,
    marginTop: 4,
    marginBottom: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  backButton: {
    position: 'absolute',
    top: 60,
    left: 20,
    zIndex: 10,
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
  titleText: {
    alignSelf: 'flex-start',
    textAlign: 'left',
    color: '#fff',
    fontSize: 26,
    fontWeight: 'medium',
    marginBottom: '4%',
    paddingLeft: '5%',
    paddingTop: '0%',
  },
});
