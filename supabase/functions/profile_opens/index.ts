import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client with service role key for write access
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
    const { profileId, isPolitician } = await req.json();

    // Validate profileId
    if (!profileId) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: profileId' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const profileIdNum = parseInt(profileId, 10);
    if (isNaN(profileIdNum)) {
      return new Response(
        JSON.stringify({ error: 'Invalid profileId: must be a number' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Determine profile type: politician (ppl_index) or legislation (legi_index)
    const isPpl = isPolitician === true || isPolitician === 'true';
    
    if (isPpl) {
      // Handle politician profile (ppl_index)
      console.log(`Incrementing opens for politician profile: ${profileIdNum}`);

      // Fetch current opens value
      const { data: currentData, error: fetchError } = await supabaseClient
        .from('ppl_index')
        .select('opens')
        .eq('id', profileIdNum)
        .maybeSingle();

      if (fetchError) {
        console.error('Error fetching opens:', fetchError);
        return new Response(
          JSON.stringify({ 
            error: 'Failed to fetch profile data',
            details: fetchError.message 
          }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      if (!currentData) {
        console.error('Politician profile not found:', profileIdNum);
        return new Response(
          JSON.stringify({ error: 'Profile not found' }),
          {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // Calculate new value: increment by 1, or set to 1 if null
      const currentValue = currentData.opens;
      const newValue = (currentValue != null && Number.isInteger(currentValue)) 
        ? currentValue + 1 
        : 1;

      console.log(`Current value: ${currentValue}, New value: ${newValue}`);

      // Update the value
      const { error: updateError } = await supabaseClient
        .from('ppl_index')
        .update({ opens: newValue })
        .eq('id', profileIdNum);

      if (updateError) {
        console.error('Error updating opens:', updateError);
        return new Response(
          JSON.stringify({ 
            error: 'Failed to update opens',
            details: updateError.message 
          }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // Success!
      console.log(`✅ Successfully incremented opens to ${newValue} for politician profile ${profileIdNum}`);
      return new Response(
        JSON.stringify({
          success: true,
          profileId: profileIdNum,
          opens: newValue,
          message: 'Opens counter incremented successfully'
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    } else {
      // Handle legislation profile (legi_index)
      console.log(`Incrementing profile_visits for legislation profile: ${profileIdNum}`);

      // Fetch current profile_visits value
      const { data: currentData, error: fetchError } = await supabaseClient
        .from('legi_index')
        .select('profile_visits')
        .eq('id', profileIdNum)
        .maybeSingle();

      if (fetchError) {
        console.error('Error fetching profile_visits:', fetchError);
        return new Response(
          JSON.stringify({ 
            error: 'Failed to fetch profile data',
            details: fetchError.message 
          }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      if (!currentData) {
        console.error('Legislation profile not found:', profileIdNum);
        return new Response(
          JSON.stringify({ error: 'Profile not found' }),
          {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // Calculate new value: increment by 1, or set to 1 if null
      const currentValue = currentData.profile_visits;
      const newValue = (currentValue != null && Number.isInteger(currentValue)) 
        ? currentValue + 1 
        : 1;

      console.log(`Current value: ${currentValue}, New value: ${newValue}`);

      // Update the value
      const { error: updateError } = await supabaseClient
        .from('legi_index')
        .update({ profile_visits: newValue })
        .eq('id', profileIdNum);

      if (updateError) {
        console.error('Error updating profile_visits:', updateError);
        return new Response(
          JSON.stringify({ 
            error: 'Failed to update profile_visits',
            details: updateError.message 
          }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // Success!
      console.log(`✅ Successfully incremented profile_visits to ${newValue} for legislation profile ${profileIdNum}`);
      return new Response(
        JSON.stringify({
          success: true,
          profileId: profileIdNum,
          profile_visits: newValue,
          message: 'Profile visits counter incremented successfully'
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

  } catch (error) {
    console.error('Unexpected error in profile_opens function:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

