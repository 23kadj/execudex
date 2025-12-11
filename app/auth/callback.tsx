import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { supabase } from '../../utils/supabase';

export default function AuthCallback() {
  const router = useRouter();
  const params = useLocalSearchParams();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Extract token from URL if present
        const { access_token, refresh_token } = params;
        let userId: string | undefined;
        
        if (access_token && refresh_token) {
          // Set the session with the tokens from the callback
          const { data, error } = await supabase.auth.setSession({
            access_token: access_token as string,
            refresh_token: refresh_token as string,
          });
          
          if (error) {
            console.error('Auth callback error:', error);
            router.replace('/signin');
            return;
          }
          
          userId = data.user?.id;
        } else {
          // Fallback: try to get existing session
          const { data, error } = await supabase.auth.getSession();
          if (error) {
            console.error('Auth callback error:', error);
            router.replace('/signin');
            return;
          }
          
          userId = data.session?.user?.id;
        }

        // Check if user has completed onboarding (has a plan)
        if (userId) {
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('plan, onboard')
            .eq('uuid', userId)
            .maybeSingle();

          if (userError) {
            console.error('Error checking user plan:', userError);
          }

          // If no user data or no plan selected, redirect to onboarding
          if (!userData || !userData.plan || userData.plan === '' || userData.plan === null) {
            console.log('User has no plan, redirecting to onboarding');
            router.replace('/');
            return;
          }
        }

        // Successfully authenticated with plan, redirect to main app
        router.replace('/(tabs)/home');
      } catch (error) {
        console.error('Auth callback error:', error);
        router.replace('/signin');
      }
    };

    handleAuthCallback();
  }, [router, params]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#fff" />
      <Text style={styles.text}>Completing sign in...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    color: '#fff',
    fontSize: 16,
    marginTop: 16,
  },
});
