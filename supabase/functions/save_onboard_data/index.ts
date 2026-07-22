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

    // Identify the caller from their JWT. This function runs with the service role,
    // which bypasses both RLS and the users_enforce_server_managed_subscription_fields
    // trigger, so a uuid taken from the request body would let any caller write any
    // other user's row. The body's uuid is ignored entirely.
    const authHeader = req.headers.get('Authorization') ?? '';
    const accessToken = authHeader.replace(/^Bearer\s+/i, '').trim();

    const {
      data: { user: caller },
      error: authError,
    } = await supabaseClient.auth.getUser(accessToken);

    if (authError || !caller) {
      console.error('Rejecting request with no valid user token:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Parse request body
    const { uuid: bodyUuid, onboardData, plan, cycle } = await req.json();

    const uuid = caller.id;
    if (bodyUuid && bodyUuid !== uuid) {
      console.warn(`Ignoring body uuid ${bodyUuid}; writing caller's own row ${uuid}`);
    }

    // Validate inputs - now require plan to be provided
    if (!onboardData || !plan) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: onboardData and plan' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Only the free plan may be set from here. Selecting free grants no entitlement
    // and has no purchase behind it, so there is no other server-side writer for it.
    // Paid plans are written by verify_receipt after Apple has validated the receipt
    // -- both onboarding call sites (app/index.tsx:329 after purchase, :442 after
    // restore) run that first, so the plan write here was only ever a redundant
    // second write. Honouring it would make this function a way to self-grant Plus.
    const isFreePlan = plan === 'free';
    if (!isFreePlan) {
      console.log(`Plan "${plan}" is server-managed; writing onboard data only.`);
    }

    console.log(`Attempting to save onboard data for user: ${uuid}`);
    console.log(`Onboard data: ${onboardData}`);
    console.log(`Plan: ${plan} (written: ${isFreePlan})`);
    console.log(`Cycle: ${cycle}`);

    // Retry logic: Wait for the user row to exist (SQL trigger might still be running)
    const maxRetries = 5;
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Check if the user row exists (using lowercase uuid only)
        const { data: existingUser, error: checkError } = await supabaseClient
          .from('users')
          .select('id')
          .eq('uuid', uuid)
          .maybeSingle();

        if (checkError || !existingUser) {
          // User row doesn't exist yet, create it with plan data
          console.log(`Attempt ${attempt}: User row not found, creating new row with plan...`);
          
          // Build insert object. plan/cycle are set only for the free plan; for a
          // paid plan verify_receipt has already recorded them.
          const insertData: any = {
            uuid: uuid,
            onboard: onboardData,
          };

          if (isFreePlan) {
            insertData.plan = plan;
            insertData.cycle = cycle || 'monthly'; // Default to monthly if not provided
          }

          console.log(`About to insert with data:`, insertData);
          
          // Insert the user row with plan data
          const insertResult = await supabaseClient
            .from('users')
            .insert(insertData);

          if (insertResult.error) {
            console.error(`Insert error on attempt ${attempt}:`, insertResult.error);
            lastError = insertResult.error;
            
            // If row already exists (race condition with trigger), try updating instead
            if (insertResult.error.code === '23505') { // Unique violation
              console.log('Row exists from trigger, will update on next attempt');
            }
            
            if (attempt < maxRetries) {
              await new Promise(resolve => setTimeout(resolve, 500 * Math.pow(2, attempt - 1)));
              continue;
            }
          } else {
            // Success!
            console.log(`✅ User row created with plan successfully for user ${uuid}`);
            console.log(`✅ Plan: ${plan}, Cycle: ${cycle}`);
            return new Response(
              JSON.stringify({
                success: true,
                message: 'User data saved successfully',
                data: { uuid, onboardData, plan, cycle, planWritten: isFreePlan },
              }),
              {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              }
            );
          }
        } else {
          // Row exists! Now update the onboard, plan, and cycle columns
          console.log(`User row found! ID: ${existingUser.id}`);
          
          // Build update object. plan/cycle are set only for the free plan; for a
          // paid plan verify_receipt has already recorded them.
          const updateData: any = {
            onboard: onboardData,
          };

          if (isFreePlan) {
            updateData.plan = plan;
            updateData.cycle = cycle || 'monthly'; // Default to monthly if not provided
          }

          console.log(`About to update with data:`, updateData);

          // Update the user row (using lowercase uuid only)
          const updateResult = await supabaseClient
            .from('users')
            .update(updateData)
            .eq('uuid', uuid);

          if (updateResult.error) {
            console.error(`Update error on attempt ${attempt}:`, updateResult.error);
            lastError = updateResult.error;
            
            if (attempt < maxRetries) {
              await new Promise(resolve => setTimeout(resolve, 500 * Math.pow(2, attempt - 1)));
              continue;
            }
          } else {
            // Success!
            console.log(`✅ Onboard data saved successfully for user ${uuid}`);
            console.log(`✅ Plan: ${plan}, Cycle: ${cycle}`);
            return new Response(
              JSON.stringify({
                success: true,
                message: 'Onboard data saved successfully',
                data: { uuid, onboardData, plan, cycle, planWritten: isFreePlan },
              }),
              {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              }
            );
          }
        }
      } catch (error) {
        console.error(`Attempt ${attempt} failed:`, error);
        lastError = error;
        
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 500 * Math.pow(2, attempt - 1)));
        }
      }
    }

    // If we got here, all retries failed
    console.error('All retry attempts failed. Last error:', lastError);
    return new Response(
      JSON.stringify({
        error: 'Failed to save onboard data after multiple attempts',
        details: lastError,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Unexpected error in save_onboard_data function:', error);
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

