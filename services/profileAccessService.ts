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

const PROFILE_ACCESS_MAX_RETRIES = 2;
const PROFILE_ACCESS_RETRY_DELAY_MS = 800;

function isRetryableStatus(err: unknown): boolean {
  const status = (err as { context?: { status?: number } })?.context?.status;
  return status === 502 || status === 503 || status === 504;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  const currentDate = new Date().toISOString();
  const body = {
    user_uuid: userId,
    profile_id: profileId,
    date: currentDate,
  };

  let lastError: unknown = null;

  for (let attempt = 0; attempt <= PROFILE_ACCESS_MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        await sleep(PROFILE_ACCESS_RETRY_DELAY_MS);
      }

      const { data, error } = await getSupabaseClient().functions.invoke('check_profile_access', {
        body,
      });

      if (!error) {
        return data as ProfileAccessResponse;
      }

      lastError = error;

      if (attempt < PROFILE_ACCESS_MAX_RETRIES && isRetryableStatus(error)) {
        continue;
      }

      // Final attempt failed or non-retryable: degrade gracefully
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.warn(
          `[checkProfileAccess] Edge function failed after ${attempt + 1} attempt(s), defaulting to ALLOW. Status: ${(error as { context?: { status?: number } })?.context?.status ?? 'unknown'}`
        );
      }
      return {
        allowed: true,
        error: (error as Error).message || 'Failed to check profile access',
      };
    } catch (error) {
      lastError = error;
      if (attempt < PROFILE_ACCESS_MAX_RETRIES) {
        continue;
      }
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.warn('[checkProfileAccess] Exception after retries, defaulting to ALLOW:', error);
      }
      return {
        allowed: true,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  return {
    allowed: true,
    error: lastError instanceof Error ? lastError.message : 'Failed to check profile access',
  };
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

