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
    const { profileId } = await req.json();

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

    console.log(`Incrementing opens for profile: ${profileId}`);

    // Fetch current opens value
    const { data: currentData, error: fetchError } = await supabaseClient
      .from('ppl_index')
      .select('opens')
      .eq('id', profileId)
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
      console.error('Profile not found:', profileId);
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
      .eq('id', profileId);

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
    console.log(`✅ Successfully incremented opens to ${newValue} for profile ${profileId}`);
    return new Response(
      JSON.stringify({
        success: true,
        profileId: profileId,
        opens: newValue,
        message: 'Opens counter incremented successfully'
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

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

