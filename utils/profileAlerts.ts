import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { getSupabaseClient } from './supabase';

// Storage keys for tracking if alerts have been shown
// These are exported so they can be preserved during sign-out
export const POLITICIAN_ALERT_KEY = 'first_time_politician_alert_shown';
export const LEGISLATION_ALERT_KEY = 'first_time_legislation_alert_shown';
export const CARD_ALERT_KEY = 'first_time_card_alert_shown';

// Array of all alert keys that should persist across sessions
export const PERSISTENT_ALERT_KEYS = [POLITICIAN_ALERT_KEY, LEGISLATION_ALERT_KEY, CARD_ALERT_KEY];

// ====================================================================
// EDIT THESE MESSAGES TO CUSTOMIZE THE ALERTS
// ====================================================================

/**
 * Alert configuration for politician profiles
 * This alert shows the FIRST time a user enters ANY politician profile
 */
const POLITICIAN_ALERT_CONFIG = {
  title: 'Politician Profile',
  message: 'Here you can explore a politician\'s agenda, who they are in and out of politics, and their political affiliations. Feel free to send feedback with bugs, errors, or suggestions. You can also bookmark this profile for later.',
  buttonText: 'Got it',
};

/**
 * Alert configuration for legislation profiles  
 * This alert shows the FIRST time a user enters ANY legislation profile
 */
const LEGISLATION_ALERT_CONFIG = {
  title: 'Legislation Profile',
  message: 'Here you can explore what this policy does, who and what the policy impacts, and what the public discourse is. Feel free to send feedback with bugs, errors, or suggestions you want us to know about. You can also bookmark this profile for later.',
  buttonText: 'Got it',
};

/**
 * Alert configuration for card/info pages
 * This alert shows the FIRST time a user enters ANY card detail page (legi5 or sub5)
 */
const CARD_ALERT_CONFIG = {
  title: 'Info Page',
  message: 'Each info page comes with breakdowns on key issues, a TLDR to keep things simple, and direct excerpts from the source that you can verify yourself. Feel free to send feedback with bugs, errors, or suggestions you want us to know about. You can also bookmark this page for later.',
  buttonText: 'Got it',
};

/**
 * Alert configuration for weak politician profiles
 * This alert shows when a user enters a weak politician profile for the FIRST TIME (per profile)
 */
const WEAK_POLITICIAN_ALERT_CONFIG = {
  title: 'Low Profile Politician',
  message: 'This politician has a limited amount of relevant and reliable information on them available; their profile is restricted to one page for the time being. Feel free to send feedback with bugs, errors, or suggestions you want us to know about. You can also bookmark this profile for later.',
  buttonText: 'Got it',
};

/**
 * Alert configuration for weak legislation profiles
 * This alert shows when a user enters a weak legislation profile for the FIRST TIME (per profile)
 */
const WEAK_LEGISLATION_ALERT_CONFIG = {
  title: 'Low Profile Legislation',
  message: 'This policy has a limited amount of information on it available; its profile is restricted to one page for the time being. Feel free to send feedback with bugs, errors, or suggestions you want us to know about. You can also bookmark this profile for later.',
  buttonText: 'Got it',
};

// ====================================================================
// END OF EDITABLE SECTION
// ====================================================================

/**
 * Check if the politician alert has been shown before
 */
export const hasPoliticianAlertBeenShown = async (): Promise<boolean> => {
  try {
    const value = await AsyncStorage.getItem(POLITICIAN_ALERT_KEY);
    return value === 'true';
  } catch (error) {
    console.error('Error checking politician alert status:', error);
    return false;
  }
};

/**
 * Check if the legislation alert has been shown before
 */
export const hasLegislationAlertBeenShown = async (): Promise<boolean> => {
  try {
    const value = await AsyncStorage.getItem(LEGISLATION_ALERT_KEY);
    return value === 'true';
  } catch (error) {
    console.error('Error checking legislation alert status:', error);
    return false;
  }
};

/**
 * Check if the card alert has been shown before
 */
export const hasCardAlertBeenShown = async (): Promise<boolean> => {
  try {
    const value = await AsyncStorage.getItem(CARD_ALERT_KEY);
    return value === 'true';
  } catch (error) {
    console.error('Error checking card alert status:', error);
    return false;
  }
};

/**
 * Mark the politician alert as shown
 */
const markPoliticianAlertAsShown = async (): Promise<void> => {
  try {
    await AsyncStorage.setItem(POLITICIAN_ALERT_KEY, 'true');
  } catch (error) {
    console.error('Error marking politician alert as shown:', error);
  }
};

/**
 * Mark the legislation alert as shown
 */
const markLegislationAlertAsShown = async (): Promise<void> => {
  try {
    await AsyncStorage.setItem(LEGISLATION_ALERT_KEY, 'true');
  } catch (error) {
    console.error('Error marking legislation alert as shown:', error);
  }
};

/**
 * Mark the card alert as shown
 */
const markCardAlertAsShown = async (): Promise<void> => {
  try {
    await AsyncStorage.setItem(CARD_ALERT_KEY, 'true');
  } catch (error) {
    console.error('Error marking card alert as shown:', error);
  }
};

/**
 * Show the politician profile alert if it hasn't been shown before
 * Returns true if the alert was shown, false if it was already shown before
 */
export const showPoliticianAlertIfNeeded = async (): Promise<boolean> => {
  const hasBeenShown = await hasPoliticianAlertBeenShown();
  
  if (!hasBeenShown) {
    Alert.alert(
      POLITICIAN_ALERT_CONFIG.title,
      POLITICIAN_ALERT_CONFIG.message,
      [
        {
          text: POLITICIAN_ALERT_CONFIG.buttonText,
          onPress: () => markPoliticianAlertAsShown(),
        },
      ],
      { cancelable: false }
    );
    return true;
  }
  
  return false;
};

/**
 * Show the legislation profile alert if it hasn't been shown before
 * Returns true if the alert was shown, false if it was already shown before
 */
export const showLegislationAlertIfNeeded = async (): Promise<boolean> => {
  const hasBeenShown = await hasLegislationAlertBeenShown();
  
  if (!hasBeenShown) {
    Alert.alert(
      LEGISLATION_ALERT_CONFIG.title,
      LEGISLATION_ALERT_CONFIG.message,
      [
        {
          text: LEGISLATION_ALERT_CONFIG.buttonText,
          onPress: () => markLegislationAlertAsShown(),
        },
      ],
      { cancelable: false }
    );
    return true;
  }
  
  return false;
};

/**
 * Show the card/info page alert if it hasn't been shown before
 * Returns true if the alert was shown, false if it was already shown before
 */
export const showCardAlertIfNeeded = async (): Promise<boolean> => {
  const hasBeenShown = await hasCardAlertBeenShown();
  
  if (!hasBeenShown) {
    Alert.alert(
      CARD_ALERT_CONFIG.title,
      CARD_ALERT_CONFIG.message,
      [
        {
          text: CARD_ALERT_CONFIG.buttonText,
          onPress: () => markCardAlertAsShown(),
        },
      ],
      { cancelable: false }
    );
    return true;
  }
  
  return false;
};

/**
 * Show the politician alert immediately (for testing/debugging)
 * This bypasses the "has been shown" check
 */
export const showPoliticianAlertForTesting = (): void => {
  Alert.alert(
    POLITICIAN_ALERT_CONFIG.title,
    POLITICIAN_ALERT_CONFIG.message,
    [{ text: POLITICIAN_ALERT_CONFIG.buttonText }],
    { cancelable: false }
  );
};

/**
 * Show the legislation alert immediately (for testing/debugging)
 * This bypasses the "has been shown" check
 */
export const showLegislationAlertForTesting = (): void => {
  Alert.alert(
    LEGISLATION_ALERT_CONFIG.title,
    LEGISLATION_ALERT_CONFIG.message,
    [{ text: LEGISLATION_ALERT_CONFIG.buttonText }],
    { cancelable: false }
  );
};

/**
 * Show the card alert immediately (for testing/debugging)
 * This bypasses the "has been shown" check
 */
export const showCardAlertForTesting = (): void => {
  Alert.alert(
    CARD_ALERT_CONFIG.title,
    CARD_ALERT_CONFIG.message,
    [{ text: CARD_ALERT_CONFIG.buttonText }],
    { cancelable: false }
  );
};

// ====================================================================
// WEAK PROFILE ALERTS (Database-backed, per-user, per-profile)
// ====================================================================

/**
 * Check if user has seen a specific weak profile
 * @param userId - User's UUID
 * @param profileId - Profile ID (e.g., "123" for politician with id 123)
 * @param profileType - Either 'ppl' or 'legi'
 */
export const hasSeenWeakProfile = async (
  userId: string | undefined,
  profileId: string,
  profileType: 'ppl' | 'legi'
): Promise<boolean> => {
  if (!userId || !profileId) return false;

  try {
    const supabase = getSupabaseClient();
    const { data: userData, error } = await supabase
      .from('users')
      .select('weak_profiles')
      .eq('uuid', userId)
      .maybeSingle();

    if (error || !userData) return false;

    const weakProfiles = userData.weak_profiles || '';
    const profileKey = `${profileType}${profileId}`;
    
    // Check if this specific profile is in the comma-separated list
    const seenProfiles = weakProfiles.split(',').filter((p: string) => p.trim());
    return seenProfiles.includes(profileKey);
  } catch (error) {
    console.error('Error checking weak profile status:', error);
    return false;
  }
};

/**
 * Mark a specific weak profile as seen for this user
 * @param userId - User's UUID
 * @param profileId - Profile ID
 * @param profileType - Either 'ppl' or 'legi'
 */
export const markWeakProfileAsSeen = async (
  userId: string | undefined,
  profileId: string,
  profileType: 'ppl' | 'legi'
): Promise<void> => {
  if (!userId || !profileId) return;

  try {
    const supabase = getSupabaseClient();
    
    // Get current weak_profiles list
    const { data: userData, error: fetchError } = await supabase
      .from('users')
      .select('weak_profiles')
      .eq('uuid', userId)
      .maybeSingle();

    if (fetchError) {
      console.error('Error fetching weak profiles:', fetchError);
      return;
    }

    const currentWeakProfiles = userData?.weak_profiles || '';
    const profileKey = `${profileType}${profileId}`;
    
    // Add to list if not already present
    const seenProfiles = currentWeakProfiles.split(',').filter((p: string) => p.trim());
    if (!seenProfiles.includes(profileKey)) {
      seenProfiles.push(profileKey);
      const updatedList = seenProfiles.join(',');
      
      const { error: updateError } = await supabase
        .from('users')
        .update({ weak_profiles: updatedList })
        .eq('uuid', userId);

      if (updateError) {
        console.error('Error updating weak profiles:', updateError);
      }
    }
  } catch (error) {
    console.error('Error marking weak profile as seen:', error);
  }
};

/**
 * Show weak politician alert if user hasn't seen this specific profile before
 * @param userId - User's UUID
 * @param profileId - Profile ID
 * @returns true if alert was shown, false if already seen
 */
export const showWeakPoliticianAlertIfNeeded = async (
  userId: string | undefined,
  profileId: string
): Promise<boolean> => {
  const hasSeenIt = await hasSeenWeakProfile(userId, profileId, 'ppl');
  
  if (!hasSeenIt) {
    Alert.alert(
      WEAK_POLITICIAN_ALERT_CONFIG.title,
      WEAK_POLITICIAN_ALERT_CONFIG.message,
      [
        {
          text: WEAK_POLITICIAN_ALERT_CONFIG.buttonText,
          onPress: () => markWeakProfileAsSeen(userId, profileId, 'ppl'),
        },
      ],
      { cancelable: false }
    );
    return true;
  }
  
  return false;
};

/**
 * Show weak legislation alert if user hasn't seen this specific profile before
 * @param userId - User's UUID
 * @param profileId - Profile ID
 * @returns true if alert was shown, false if already seen
 */
export const showWeakLegislationAlertIfNeeded = async (
  userId: string | undefined,
  profileId: string
): Promise<boolean> => {
  const hasSeenIt = await hasSeenWeakProfile(userId, profileId, 'legi');
  
  if (!hasSeenIt) {
    Alert.alert(
      WEAK_LEGISLATION_ALERT_CONFIG.title,
      WEAK_LEGISLATION_ALERT_CONFIG.message,
      [
        {
          text: WEAK_LEGISLATION_ALERT_CONFIG.buttonText,
          onPress: () => markWeakProfileAsSeen(userId, profileId, 'legi'),
        },
      ],
      { cancelable: false }
    );
    return true;
  }
  
  return false;
};

/**
 * Show weak politician alert immediately (for info button on weak profiles)
 */
export const showWeakPoliticianAlertForInfoButton = (): void => {
  Alert.alert(
    WEAK_POLITICIAN_ALERT_CONFIG.title,
    WEAK_POLITICIAN_ALERT_CONFIG.message,
    [{ text: WEAK_POLITICIAN_ALERT_CONFIG.buttonText }],
    { cancelable: false }
  );
};

/**
 * Show weak legislation alert immediately (for info button on weak profiles)
 */
export const showWeakLegislationAlertForInfoButton = (): void => {
  Alert.alert(
    WEAK_LEGISLATION_ALERT_CONFIG.title,
    WEAK_LEGISLATION_ALERT_CONFIG.message,
    [{ text: WEAK_LEGISLATION_ALERT_CONFIG.buttonText }],
    { cancelable: false }
  );
};

/**
 * Reset all alerts (useful for testing or debugging)
 * This will cause the alerts to show again on next visit
 */
export const resetAllProfileAlerts = async (): Promise<void> => {
  try {
    await AsyncStorage.multiRemove([POLITICIAN_ALERT_KEY, LEGISLATION_ALERT_KEY, CARD_ALERT_KEY]);
    console.log('All profile alerts have been reset');
  } catch (error) {
    console.error('Error resetting profile alerts:', error);
  }
};

