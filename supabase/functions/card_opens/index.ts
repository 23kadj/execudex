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
    const { cardId } = await req.json();

    // Validate cardId
    if (!cardId) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: cardId' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`Incrementing opens_7d for card: ${cardId}`);

    // Fetch current opens_7d value
    const { data: currentData, error: fetchError } = await supabaseClient
      .from('card_index')
      .select('opens_7d')
      .eq('id', cardId)
      .maybeSingle();

    if (fetchError) {
      console.error('Error fetching opens_7d:', fetchError);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to fetch card data',
          details: fetchError.message 
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!currentData) {
      console.error('Card not found:', cardId);
      return new Response(
        JSON.stringify({ error: 'Card not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Calculate new value: increment by 1, or set to 1 if null
    const currentValue = currentData.opens_7d;
    const newValue = (currentValue != null && Number.isInteger(currentValue)) 
      ? currentValue + 1 
      : 1;

    console.log(`Current value: ${currentValue}, New value: ${newValue}`);

    // Update the value
    const { error: updateError } = await supabaseClient
      .from('card_index')
      .update({ opens_7d: newValue })
      .eq('id', cardId);

    if (updateError) {
      console.error('Error updating opens_7d:', updateError);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to update opens_7d',
          details: updateError.message 
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Success!
    console.log(`✅ Successfully incremented opens_7d to ${newValue} for card ${cardId}`);
    return new Response(
      JSON.stringify({
        success: true,
        cardId: cardId,
        opens_7d: newValue,
        message: 'Opens counter incremented successfully'
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Unexpected error in card_opens function:', error);
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

