import { getSupabaseClient } from '../utils/supabase';

export interface ProfileAccessResponse {
  allowed: boolean;
  profilesUsed?: number;
  reason?: string;
  resetDate?: string;
  showWarning?: boolean;
  remainingProfiles?: number;
  error?: string;
}

/**
 * Check if user can access a profile based on their subscription plan
 * @param userId - User's UUID
 * @param profileId - Profile ID in format "123ppl" or "456legi"
 * @returns ProfileAccessResponse with access decision and metadata
 */
export async function checkProfileAccess(
  userId: string,
  profileId: string
): Promise<ProfileAccessResponse> {
  try {
    const currentDate = new Date().toISOString();

    console.log('Checking profile access:', { userId, profileId, currentDate });

    const { data, error } = await getSupabaseClient().functions.invoke('check_profile_access', {
      body: {
        user_uuid: userId,
        profile_id: profileId,
        date: currentDate,
      },
    });

    if (error) {
      console.error('Error calling check_profile_access:', error);
      console.error('Full error object:', JSON.stringify(error, null, 2));
      console.error('Error context:', error.context);
      console.error('Edge function failed - defaulting to ALLOW access');
      // Default to allowing access if edge function fails (graceful degradation)
      return {
        allowed: true,
        error: error.message || 'Failed to check profile access',
      };
    }

    // Log the raw response
    console.log('Raw edge function response:', JSON.stringify(data, null, 2));

    console.log('Profile access response:', data);
    return data as ProfileAccessResponse;
  } catch (error) {
    console.error('Exception in checkProfileAccess:', error);
    console.error('Exception occurred - defaulting to ALLOW access');
    // Default to allowing access on exception (graceful degradation)
    return {
      allowed: true,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get current week's profile usage for the user
 * @param userId - User's UUID
 * @returns Object with profilesUsed count and list of profile IDs
 */
export async function getWeeklyProfileUsage(userId: string): Promise<{
  profilesUsed: number;
  profileIds: string[];
  plan: string;
}> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('plan, week_profiles')
      .eq('uuid', userId)
      .single();

    if (error || !data) {
      console.error('Error fetching weekly profile usage:', error);
      return {
        profilesUsed: 0,
        profileIds: [],
        plan: 'basic',
      };
    }

    console.log('Weekly profile usage data:', data);
    console.log('Array type:', typeof data.week_profiles);
    console.log('Array is array?:', Array.isArray(data.week_profiles));
    console.log('Array length:', data.week_profiles?.length);
    console.log('Array contents:', data.week_profiles);

    // Handle comma-separated string format
    let weekProfiles = data.week_profiles;
    if (typeof weekProfiles === 'string') {
      console.log('week_profiles is a string, parsing comma-separated format...');
      try {
        // Simple comma-separated format: "123ppl,329ppl,11legi"
        weekProfiles = weekProfiles.split(',').filter(id => id.trim() !== '');
        console.log('Extracted profile IDs:', weekProfiles);
      } catch (e) {
        console.error('Failed to parse week_profiles comma format:', e);
        weekProfiles = [];
      }
    }
    
    // If it's not an array at all, default to empty array
    if (!Array.isArray(weekProfiles)) {
      console.warn('week_profiles is not an array, defaulting to []');
      weekProfiles = [];
    }

    return {
      profilesUsed: weekProfiles.length,
      profileIds: weekProfiles,
      plan: data.plan || 'basic',
    };
  } catch (error) {
    console.error('Exception in getWeeklyProfileUsage:', error);
    return {
      profilesUsed: 0,
      profileIds: [],
      plan: 'basic',
    };
  }
}

