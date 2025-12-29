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

    console.log('[checkProfileAccess] Starting access check:', { userId, profileId, currentDate });

    const { data, error } = await getSupabaseClient().functions.invoke('check_profile_access', {
      body: {
        user_uuid: userId,
        profile_id: profileId,
        date: currentDate,
      },
    });

    if (error) {
      console.error('[checkProfileAccess] ❌ Error calling check_profile_access edge function:', error);
      console.error('[checkProfileAccess] Full error object:', JSON.stringify(error, null, 2));
      console.error('[checkProfileAccess] Error context:', error.context);
      console.error('[checkProfileAccess] ⚠️ Edge function failed - defaulting to ALLOW access (profile tracking may not work)');
      // Default to allowing access if edge function fails (graceful degradation)
      // NOTE: This means week_profiles won't be updated if the edge function fails!
      return {
        allowed: true,
        error: error.message || 'Failed to check profile access',
      };
    }

    // Log the raw response
    console.log('[checkProfileAccess] ✅ Edge function response received:', JSON.stringify(data, null, 2));
    console.log('[checkProfileAccess] Access check result:', {
      allowed: data?.allowed,
      profilesUsed: data?.profilesUsed,
      reason: data?.reason,
      showWarning: data?.showWarning,
      remainingProfiles: data?.remainingProfiles
    });

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
  cycle?: string;
}> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('users')
      .select('plan, cycle, week_profiles')
      .eq('uuid', userId)
      .maybeSingle();

    if (error || !data) {
      console.error('Error fetching weekly profile usage:', error);
      return {
        profilesUsed: 0,
        profileIds: [],
        plan: 'basic',
        cycle: 'monthly',
      };
    }

    // Type assertion for data
    const userData = data as {
      plan?: string;
      cycle?: string;
      week_profiles?: string | string[] | null;
    };
    
    console.log('Weekly profile usage data:', userData);
    console.log('Array type:', typeof userData.week_profiles);
    console.log('Array is array?:', Array.isArray(userData.week_profiles));
    console.log('Array length:', userData.week_profiles?.length);
    console.log('Array contents:', userData.week_profiles);

    // Handle different data types: null, empty string, string, or array
    let weekProfiles: string[] = [];
    const weekProfilesRaw = userData.week_profiles;
    
    // Handle null or undefined first
    if (weekProfilesRaw == null) {
      console.log('week_profiles is null/undefined, defaulting to empty array');
      weekProfiles = [];
    }
    // Handle empty string
    else if (typeof weekProfilesRaw === 'string' && weekProfilesRaw.trim() === '') {
      console.log('week_profiles is empty string, defaulting to empty array');
      weekProfiles = [];
    }
    // Handle comma-separated string format
    else if (typeof weekProfilesRaw === 'string') {
      console.log('week_profiles is a string, parsing comma-separated format...');
      try {
        // Simple comma-separated format: "123ppl,329ppl,11legi"
        weekProfiles = weekProfilesRaw.split(',').filter(id => id.trim() !== '');
        console.log('Extracted profile IDs:', weekProfiles);
      } catch (e) {
        console.error('Failed to parse week_profiles comma format:', e);
        weekProfiles = [];
      }
    }
    // Handle array format (if database column is text[] instead of text)
    else if (Array.isArray(weekProfilesRaw)) {
      console.log('week_profiles is already an array');
      weekProfiles = weekProfilesRaw.filter(id => id != null && String(id).trim() !== '');
    }
    // Fallback for any other type
    else {
      console.warn('week_profiles is unexpected type, defaulting to []', typeof weekProfilesRaw);
      weekProfiles = [];
    }

    // If plan is null/empty, treat as new user with basic access
    if (!userData.plan || userData.plan === '') {
      return {
        profilesUsed: 0,
        profileIds: [],
        plan: '',  // Empty string indicates no subscription
        cycle: undefined,
      };
    }

    return {
      profilesUsed: weekProfiles.length,
      profileIds: weekProfiles,
      plan: userData.plan,
      cycle: userData.cycle,
    };
  } catch (error) {
    console.error('Exception in getWeeklyProfileUsage:', error);
    return {
      profilesUsed: 0,
      profileIds: [],
      plan: 'basic',
      cycle: 'monthly',
    };
  }
}

