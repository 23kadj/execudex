import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BASIC_WEEKLY_LIMIT = 5;
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

    // Helper function to get the most recent Sunday at 00:00:00 EST
    function getMostRecentSunday(date: Date): Date {
      const d = new Date(date);
      // Convert to EST (UTC-5)
      d.setHours(d.getHours() - 5);
      const day = d.getDay();
      const diff = day; // Days since Sunday
      d.setDate(d.getDate() - diff);
      d.setHours(0, 0, 0, 0);
      return d;
    }

    // Helper function to get next Sunday date for display
    function getNextSunday(date: Date): string {
      const d = new Date(date);
      d.setHours(d.getHours() - 5); // EST adjustment
      const day = d.getDay();
      const daysUntilSunday = day === 0 ? 7 : 7 - day;
      d.setDate(d.getDate() + daysUntilSunday);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    // Check if weekly reset is needed (check on any day, not just Sunday)
    const mostRecentSunday = getMostRecentSunday(currentDate);
    
    // Check if last_reset happened since the most recent Sunday
    const needsReset = !lastReset || lastReset < mostRecentSunday;
    
    if (needsReset) {
      console.log('Weekly reset triggered (most recent Sunday was before last_reset or no reset exists)');
      
      // Reset the week_profiles array and add current profile
      weekProfiles = [profile_id];
      
      // Create simple comma-separated format for reset
      const resetString = profile_id;
      console.log('Creating reset string:', resetString);
      
      // Update database with reset
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

    // Profile is not in array - check if there's room (only for basic plan)
    if (isBasicPlan) {
      console.log(`Checking quota: ${weekProfiles.length} profiles used, limit is ${BASIC_WEEKLY_LIMIT}`);
      if (weekProfiles.length >= BASIC_WEEKLY_LIMIT) {
        console.log(`Weekly profile limit reached: ${weekProfiles.length} >= ${BASIC_WEEKLY_LIMIT}`);
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
    } else {
      console.log(`Plus plan user - unlimited access (tracking ${weekProfiles.length} profiles)`);
    }

    // There's room (or unlimited for plus) - add the profile to the array
    weekProfiles.push(profile_id);
    const newLength = weekProfiles.length;
    console.log(`Adding profile ${profile_id}. New count will be: ${newLength}${isBasicPlan ? ` (limit: ${BASIC_WEEKLY_LIMIT})` : ' (unlimited)'}`);
    
    // Double-check we're not exceeding the limit before updating database (only for basic plan)
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
      
      if (verifyProfiles.length > BASIC_WEEKLY_LIMIT) {
        console.error(`CRITICAL: week_profiles exceeded limit after update! Count: ${verifyProfiles.length}, Limit: ${BASIC_WEEKLY_LIMIT}`);
        console.error('Stored profiles:', verifyProfiles);
        // This shouldn't happen, but log it for debugging
      } else {
        console.log(`Verified: Database has ${verifyProfiles.length} profiles stored (limit: ${BASIC_WEEKLY_LIMIT})`);
      }
    }

    console.log(`Profile added successfully. Total profiles: ${newLength}`);

    // Calculate remaining profiles for warning system (only for basic plan)
    let showWarning = false;
    let remaining = 0;
    
    if (isBasicPlan) {
      remaining = BASIC_WEEKLY_LIMIT - newLength;
      // Show warning when user is at or below warning thresholds (2 or 1 remaining)
      // This means warnings show at profiles 3 and 4 (out of 5)
      if (WARNING_THRESHOLDS.includes(remaining)) {
        showWarning = true;
        console.log(`Warning triggered: ${remaining} profile(s) remaining`);
      }
    }

    return new Response(
      JSON.stringify({ 
        allowed: true,
        profilesUsed: newLength,
        reason: isBasicPlan ? 'profile_added' : 'unlimited_plan',
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

