import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BASIC_WEEKLY_LIMIT = 10;
const WARNING_THRESHOLDS = [2, 1];

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Parse request body
    const { user_uuid, profile_id, date } = await req.json();

    // Validate inputs
    if (!user_uuid || !profile_id || !date) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: user_uuid, profile_id, and date' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`Checking profile access for user: ${user_uuid}, profile: ${profile_id}`);

    // Fetch user's subscription plan and profile access data
    const { data: userData, error: userError } = await supabaseClient
      .from('users')
      .select('plan, week_profiles, last_reset')
      .eq('uuid', user_uuid)
      .single();

    if (userError || !userData) {
      console.error('Error fetching user data:', userError);
      // Default to allowing access if user not found (graceful degradation)
      return new Response(
        JSON.stringify({ 
          allowed: true,
          reason: 'user_not_found_default_allow',
          error: userError?.message
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Check if user is on basic plan
    const isBasicPlan = userData.plan === 'basic';
    
    // User is on basic plan - check quota system
    const currentDate = new Date(date);
    const currentDayOfWeek = currentDate.getDay(); // 0 = Sunday

    // Get week_profiles - handle comma-separated string format
    // Track usage for both basic and plus users (plus users have unlimited but we still track)
    let weekProfiles: string[] = [];
    if (userData.week_profiles) {
      if (typeof userData.week_profiles === 'string') {
        // Simple comma-separated format: "123ppl,329ppl,11legi"
        console.log('Parsing comma-separated week_profiles string...');
        try {
          weekProfiles = userData.week_profiles.split(',').filter(id => id.trim() !== '');
          console.log('Extracted profile IDs:', weekProfiles);
        } catch (e) {
          console.error('Failed to parse week_profiles string:', e);
          weekProfiles = [];
        }
      } else if (Array.isArray(userData.week_profiles)) {
        weekProfiles = userData.week_profiles;
      }
    }
    
    // Remove any duplicates (defensive measure)
    weekProfiles = [...new Set(weekProfiles)];
    console.log(`Final weekProfiles (after deduplication): ${weekProfiles.length} unique profiles:`, weekProfiles);
    
    let lastReset = userData.last_reset ? new Date(userData.last_reset) : null;

    // Helper function to get Eastern Time components and day of week from a UTC date
    function getEasternTimeInfo(date: Date): { year: number; month: number; day: number; dayOfWeek: number } {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        weekday: 'short'
      });
      
      const parts = formatter.formatToParts(date);
      const year = parseInt(parts.find(p => p.type === 'year')!.value);
      const month = parseInt(parts.find(p => p.type === 'month')!.value) - 1; // 0-indexed
      const day = parseInt(parts.find(p => p.type === 'day')!.value);
      
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const weekdayPart = parts.find(p => p.type === 'weekday')!.value;
      const dayOfWeek = dayNames.indexOf(weekdayPart);
      
      return { year, month, day, dayOfWeek };
    }

    // Helper function to create a Date object for a specific date/time in Eastern Time
    // Tests both EST (UTC-5) and EDT (UTC-4) to find the correct one
    function createDateInEasternTime(year: number, month: number, day: number, hour: number, minute: number, second: number): Date {
      // Try EST first (UTC-5)
      const estCandidate = new Date(Date.UTC(year, month, day, hour + 5, minute, second));
      // Try EDT (UTC-4)
      const edtCandidate = new Date(Date.UTC(year, month, day, hour + 4, minute, second));
      
      // Format both in Eastern Time and extract components to see which matches our target
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
      
      const estParts = formatter.formatToParts(estCandidate);
      const edtParts = formatter.formatToParts(edtCandidate);
      
      const estYear = parseInt(estParts.find(p => p.type === 'year')!.value);
      const estMonth = parseInt(estParts.find(p => p.type === 'month')!.value) - 1;
      const estDay = parseInt(estParts.find(p => p.type === 'day')!.value);
      const estHour = parseInt(estParts.find(p => p.type === 'hour')!.value);
      const estMinute = parseInt(estParts.find(p => p.type === 'minute')!.value);
      const estSecond = parseInt(estParts.find(p => p.type === 'second')!.value);
      
      const edtYear = parseInt(edtParts.find(p => p.type === 'year')!.value);
      const edtMonth = parseInt(edtParts.find(p => p.type === 'month')!.value) - 1;
      const edtDay = parseInt(edtParts.find(p => p.type === 'day')!.value);
      const edtHour = parseInt(edtParts.find(p => p.type === 'hour')!.value);
      const edtMinute = parseInt(edtParts.find(p => p.type === 'minute')!.value);
      const edtSecond = parseInt(edtParts.find(p => p.type === 'second')!.value);
      
      // Compare components to target
      const matchesEST = estYear === year && estMonth === month && estDay === day && 
                        estHour === hour && estMinute === minute && estSecond === second;
      const matchesEDT = edtYear === year && edtMonth === month && edtDay === day && 
                        edtHour === hour && edtMinute === minute && edtSecond === second;
      
      // Return the one that matches
      if (matchesEST) return estCandidate;
      if (matchesEDT) return edtCandidate;
      
      // Fallback: return EST (shouldn't happen, but safe fallback)
      return estCandidate;
    }

    // Helper function to get the most recent Sunday at 00:00:00 Eastern Time
    function getMostRecentSunday(date: Date): Date {
      const eastern = getEasternTimeInfo(date);
      const daysSinceSunday = eastern.dayOfWeek; // 0 = Sunday
      
      // Create a date representing the current Eastern Time date
      const currentEasternDate = createDateInEasternTime(eastern.year, eastern.month, eastern.day, 0, 0, 0);
      
      // Subtract days in milliseconds
      const sundayDate = new Date(currentEasternDate.getTime() - (daysSinceSunday * 24 * 60 * 60 * 1000));
      
      // Extract Eastern Time components from the result
      const sundayEastern = getEasternTimeInfo(sundayDate);
      
      // Create date for Sunday at midnight Eastern Time
      return createDateInEasternTime(sundayEastern.year, sundayEastern.month, sundayEastern.day, 0, 0, 0);
    }

    // Helper function to get next Sunday date for display (in Eastern Time)
    function getNextSunday(date: Date): string {
      const eastern = getEasternTimeInfo(date);
      const daysUntilSunday = eastern.dayOfWeek === 0 ? 7 : 7 - eastern.dayOfWeek;
      
      // Create a date representing the current Eastern Time date
      const currentEasternDate = createDateInEasternTime(eastern.year, eastern.month, eastern.day, 0, 0, 0);
      
      // Add days in milliseconds
      const nextSundayDateObj = new Date(currentEasternDate.getTime() + (daysUntilSunday * 24 * 60 * 60 * 1000));
      
      // Extract Eastern Time components from the result
      const nextSundayEastern = getEasternTimeInfo(nextSundayDateObj);
      
      // Create date for next Sunday at midnight Eastern Time and format for display
      const nextSundayDate = createDateInEasternTime(nextSundayEastern.year, nextSundayEastern.month, nextSundayEastern.day, 0, 0, 0);
      return nextSundayDate.toLocaleDateString('en-US', { 
        timeZone: 'America/New_York',
        month: 'short', 
        day: 'numeric' 
      });
    }

    // Check if weekly reset is needed (check on any day, not just Sunday)
    const mostRecentSunday = getMostRecentSunday(currentDate);
    
    // Check if last_reset happened since the most recent Sunday
    const needsReset = !lastReset || lastReset < mostRecentSunday;
    
    if (needsReset) {
      console.log('Weekly reset triggered (most recent Sunday was before last_reset or no reset exists)');
      
      // Reset the week_profiles array and add current profile
      // This tracks the profile for ALL users (both basic and plus) - tracking is universal
      weekProfiles = [profile_id];
      
      // Create simple comma-separated format for reset
      const resetString = profile_id;
      console.log(`Creating reset string for ${isBasicPlan ? 'basic' : 'plus'} plan user:`, resetString);
      
      // Update database with reset (tracks for all users)
      const { error: updateError } = await supabaseClient
        .from('users')
        .update({
          week_profiles: resetString,
          last_reset: currentDate.toISOString()
        })
        .eq('uuid', user_uuid);

      if (updateError) {
        console.error('Error updating user data during reset:', updateError);
        return new Response(
          JSON.stringify({ error: 'Failed to reset weekly profiles', details: updateError.message }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // Verify array length is 1 and return
      console.log('Reset completed, returning with profilesUsed: 1');
      return new Response(
        JSON.stringify({ 
          allowed: true,
          profilesUsed: 1,
          reason: 'weekly_reset_completed'
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Profile Verification Step
    // Check if profile_id is already in the array
    if (weekProfiles.includes(profile_id)) {
      console.log(`Profile ${profile_id} already accessed this week. Current count: ${weekProfiles.length}`);
      const planType = isBasicPlan ? 'basic' : 'plus';
      console.log(`${planType} plan user - profile already tracked`);
      return new Response(
        JSON.stringify({ 
          allowed: true,
          profilesUsed: weekProfiles.length,
          reason: 'already_accessed'
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Profile is not in array - need to add it for tracking
    // IMPORTANT: We track profiles for ALL users (both basic and plus)
    // - Basic users: Tracking is used for quota enforcement (limit of 5 per week)
    // - Plus users: Tracking is for record-keeping (no limits, unlimited access)
    
    // For basic plan users: Check quota BEFORE adding
    if (isBasicPlan) {
      console.log(`Basic plan: Checking quota: ${weekProfiles.length} profiles used, limit is ${BASIC_WEEKLY_LIMIT}`);
      if (weekProfiles.length >= BASIC_WEEKLY_LIMIT) {
        console.log(`Weekly profile limit reached: ${weekProfiles.length} >= ${BASIC_WEEKLY_LIMIT}`);
        const nextSundayDate = getNextSunday(currentDate);
        
        // Basic plan user exceeded quota - deny access (don't track this profile)
        return new Response(
          JSON.stringify({ 
            allowed: false,
            reason: 'quota_exceeded',
            profilesUsed: weekProfiles.length,
            resetDate: nextSundayDate
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // Add the profile to the array for tracking
    // This happens for ALL users (both basic and plus):
    // - Basic: Only reaches here if quota check passed (under limit)
    // - Plus: Always reaches here (unlimited, tracking for records)
    weekProfiles.push(profile_id);
    const newLength = weekProfiles.length;
    console.log(`Adding profile ${profile_id} to tracking. New count: ${newLength}${isBasicPlan ? ` (basic plan, limit: ${BASIC_WEEKLY_LIMIT})` : ' (plus plan - unlimited, tracking for records)'}`);
    
    // Double-check we're not exceeding the limit before updating database (only for basic plan)
    // This is a defensive check - should never happen if logic above is correct
    // Plus users can have unlimited profiles tracked, so skip this check for them
    if (isBasicPlan && newLength > BASIC_WEEKLY_LIMIT) {
      console.error(`ERROR: Attempted to add profile would exceed limit! Current: ${newLength}, Limit: ${BASIC_WEEKLY_LIMIT}`);
      // Remove the profile we just added
      weekProfiles.pop();
      const nextSundayDate = getNextSunday(currentDate);
      return new Response(
        JSON.stringify({ 
          allowed: false,
          reason: 'quota_exceeded',
          profilesUsed: weekProfiles.length,
          resetDate: nextSundayDate
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
    
    // Convert back to simple comma-separated format: "123ppl,329ppl,11legi"
    const commaString = weekProfiles.join(',');
    console.log('Creating comma-separated string:', commaString);
    
    // Update database with comma-separated format
    const { error: updateError } = await supabaseClient
      .from('users')
      .update({
        week_profiles: commaString
      })
      .eq('uuid', user_uuid);

    if (updateError) {
      console.error('Error updating week_profiles:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update profile access', details: updateError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Verify array length after update (defensive check)
    const { data: verifyData, error: verifyError } = await supabaseClient
      .from('users')
      .select('week_profiles')
      .eq('uuid', user_uuid)
      .single();

    if (verifyError || !verifyData) {
      console.error('Error verifying update:', verifyError);
    } else {
      // Parse the stored value to verify count
      let verifyProfiles: string[] = [];
      if (typeof verifyData.week_profiles === 'string') {
        verifyProfiles = verifyData.week_profiles.split(',').filter(id => id.trim() !== '');
      } else if (Array.isArray(verifyData.week_profiles)) {
        verifyProfiles = verifyData.week_profiles;
      }
      
      // Only check limit for basic plan users (plus users can have unlimited)
      if (isBasicPlan && verifyProfiles.length > BASIC_WEEKLY_LIMIT) {
        console.error(`CRITICAL: Basic plan user exceeded limit after update! Count: ${verifyProfiles.length}, Limit: ${BASIC_WEEKLY_LIMIT}`);
        console.error('Stored profiles:', verifyProfiles);
        // This shouldn't happen, but log it for debugging
      } else {
        const planType = isBasicPlan ? 'basic' : 'plus';
        console.log(`Verified: Database has ${verifyProfiles.length} profiles stored for ${planType} plan user${isBasicPlan ? ` (limit: ${BASIC_WEEKLY_LIMIT})` : ' (unlimited tracking)'}`);
      }
    }

    console.log(`Profile added successfully. Total profiles tracked: ${newLength}${isBasicPlan ? ` (basic plan)` : ' (plus plan - unlimited)'}`);

    // Calculate remaining profiles for warning system (only for basic plan)
    // Plus users don't need warnings since they have unlimited access
    let showWarning = false;
    let remaining = 0;
    
    if (isBasicPlan) {
      remaining = BASIC_WEEKLY_LIMIT - newLength;
      // Show warning when user is at or below warning thresholds (2 or 1 remaining)
      // This means warnings show at profiles 8 and 9 (out of 10)
      if (WARNING_THRESHOLDS.includes(remaining)) {
        showWarning = true;
        console.log(`Warning triggered for basic plan: ${remaining} profile(s) remaining`);
      }
    } else {
      // Plus plan: No warnings needed, but log tracking info
      console.log(`Plus plan user: Profile tracked (${newLength} total this week) - no limits, tracking for records only`);
    }

    return new Response(
      JSON.stringify({ 
        allowed: true,
        profilesUsed: newLength,
        reason: isBasicPlan ? 'profile_added' : 'unlimited_plan_tracked',
        showWarning: showWarning,
        remainingProfiles: isBasicPlan ? remaining : undefined
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Unexpected error in check_profile_access:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

