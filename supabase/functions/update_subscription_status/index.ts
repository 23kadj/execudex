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
    const { userId, plan, cycle, transactionId, purchaseDate } = await req.json();

    // Validate inputs
    if (!userId || !plan) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: userId and plan' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate plan values
    if (!['basic', 'plus'].includes(plan)) {
      return new Response(
        JSON.stringify({ error: 'Invalid plan. Must be "basic" or "plus"' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate cycle values
    if (cycle && !['monthly', 'quarterly'].includes(cycle)) {
      return new Response(
        JSON.stringify({ error: 'Invalid cycle. Must be "monthly" or "quarterly"' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`Updating subscription status for user: ${userId}`);
    console.log(`Plan: ${plan}, Cycle: ${cycle}`);
    console.log(`Transaction ID: ${transactionId}, Purchase Date: ${purchaseDate}`);

    // Check if user exists
    const { data: existingUser, error: checkError } = await supabaseClient
      .from('users')
      .select('id, uuid, plan, cycle')
      .eq('uuid', userId)
      .maybeSingle();

    if (checkError) {
      console.error('Error checking user existence:', checkError);
      return new Response(
        JSON.stringify({ error: 'Failed to check user existence' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!existingUser) {
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Prepare update data
    const updateData: any = {
      plan: plan,
      updated_at: new Date().toISOString()
    };

    // Add cycle if provided
    if (cycle) {
      updateData.cycle = cycle;
    }

    // Add transaction info if provided (for future receipt validation)
    if (transactionId) {
      updateData.last_transaction_id = transactionId;
    }

    if (purchaseDate) {
      updateData.last_purchase_date = purchaseDate;
    }

    console.log(`Updating user ${userId} with data:`, updateData);

    // Update the user's subscription status
    const { data: updateResult, error: updateError } = await supabaseClient
      .from('users')
      .update(updateData)
      .eq('uuid', userId)
      .select();

    if (updateError) {
      console.error('Error updating user subscription:', updateError);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to update subscription status',
          details: updateError.message 
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('✅ Subscription status updated successfully:', updateResult);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Subscription status updated successfully',
        data: {
          userId,
          plan,
          cycle,
          transactionId,
          purchaseDate,
          updatedAt: new Date().toISOString()
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Unexpected error in update_subscription_status function:', error);
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


