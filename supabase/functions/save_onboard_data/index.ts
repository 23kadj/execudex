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
    const { uuid, onboardData, plan, cycle } = await req.json();

    // Validate inputs - now require plan to be provided
    if (!uuid || !onboardData || !plan) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: uuid, onboardData, and plan' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`Attempting to save onboard data for user: ${uuid}`);
    console.log(`Onboard data: ${onboardData}`);
    console.log(`Plan: ${plan}`);
    console.log(`Cycle: ${cycle}`);
    console.log(`Full request body:`, { uuid, onboardData, plan, cycle });

    // First, let's check the table structure
    const { data: tableCheck, error: tableError } = await supabaseClient
      .from('users')
      .select('*')
      .limit(1);
    
    if (tableError) {
      console.error('Error checking users table:', tableError);
    } else {
      console.log('Users table structure (sample):', tableCheck);
    }

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
          
          // Build insert object with plan and cycle (both required)
          const insertData: any = { 
            uuid: uuid,
            onboard: onboardData,
            plan: plan,
            cycle: cycle || 'monthly' // Default to monthly if not provided
          };
          
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
                data: { uuid, onboardData, plan, cycle },
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
          
          // Build update object with plan and cycle (both required)
          const updateData: any = { 
            onboard: onboardData,
            plan: plan,
            cycle: cycle || 'monthly' // Default to monthly if not provided
          };
          
          console.log(`About to update with data:`, updateData);
          console.log(`Plan value: "${plan}" (type: ${typeof plan})`);
          console.log(`Cycle value: "${cycle}" (type: ${typeof cycle})`);
          
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
                data: { uuid, onboardData, plan, cycle },
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

