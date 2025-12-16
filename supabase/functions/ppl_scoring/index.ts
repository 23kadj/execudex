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
    console.log('[ppl_scoring] Function invoked');
    
    // Check environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    console.log('[ppl_scoring] Env check:', {
      hasUrl: !!supabaseUrl,
      hasServiceKey: !!serviceKey,
    });
    
    if (!supabaseUrl || !serviceKey) {
      console.error('[ppl_scoring] Missing environment variables');
      return new Response(
        JSON.stringify({ 
          error: 'Server configuration error: missing environment variables',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Parse request body
    const { index_id, score, user_id } = await req.json();
    console.log('[ppl_scoring] Request body:', { index_id, score, user_id: user_id ? 'present' : 'missing' });

    // Validate user_id
    if (!user_id) {
      console.error('[ppl_scoring] Missing user_id in request');
      return new Response(
        JSON.stringify({ 
          error: 'Authentication required: user_id missing',
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate inputs
    if (!index_id || score == null) {
      console.error('[ppl_scoring] Missing required fields');
      return new Response(
        JSON.stringify({ 
          error: 'Missing required fields: index_id and score are required' 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate score range (0-5)
    const scoreNum = Number(score);
    if (isNaN(scoreNum) || scoreNum < 0 || scoreNum > 5) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid score: must be a number between 0 and 5' 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate index_id is a positive integer
    const indexNum = Number(index_id);
    if (isNaN(indexNum) || indexNum <= 0 || !Number.isInteger(indexNum)) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid index_id: must be a positive integer' 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`[ppl_scoring] Processing: user=${user_id.substring(0, 8)}..., politician=${indexNum}, score=${scoreNum}`);

    // Use service role client for all DB operations
    const serviceClient = createClient(
      supabaseUrl,
      serviceKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );
    
    // Verify user exists (simple security check)
    const { data: userCheck, error: userCheckError } = await serviceClient
      .from('users')
      .select('uuid')
      .eq('uuid', user_id)
      .maybeSingle();
    
    if (userCheckError || !userCheck) {
      console.error('[ppl_scoring] Invalid user_id:', user_id.substring(0, 8));
      return new Response(
        JSON.stringify({ 
          error: 'Invalid user',
        }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // STEP 1: Insert or update the user's score in ppl_scores
    const { data: existingScore, error: checkError } = await serviceClient
      .from('ppl_scores')
      .select('id')
      .eq('user_id', user_id)
      .eq('index_id', indexNum)
      .maybeSingle();

    if (checkError) {
      console.error('[ppl_scoring] Error checking existing score:', checkError);
      return new Response(
        JSON.stringify({ 
          error: 'Database error while checking existing score',
          details: checkError.message 
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    let dbError = null;

    if (existingScore) {
      // Update existing score
      console.log(`[ppl_scoring] Updating existing score (id: ${existingScore.id})`);
      const { error: updateError } = await serviceClient
        .from('ppl_scores')
        .update({ 
          score: scoreNum,
          created_at: new Date().toISOString()
        })
        .eq('user_id', user_id)
        .eq('index_id', indexNum);

      dbError = updateError;
    } else {
      // Insert new score
      console.log('[ppl_scoring] Inserting new score');
      const { error: insertError } = await serviceClient
        .from('ppl_scores')
        .insert({
          user_id: user_id,
          index_id: indexNum,
          score: scoreNum,
          created_at: new Date().toISOString()
        });

      dbError = insertError;
    }

    if (dbError) {
      console.error('[ppl_scoring] Error saving score:', dbError);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to save score',
          details: dbError.message 
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('[ppl_scoring] ✅ Score saved to ppl_scores');

    // STEP 2: Query all scores for this politician and calculate average
    const { data: allScores, error: scoresError } = await serviceClient
      .from('ppl_scores')
      .select('score')
      .eq('index_id', indexNum);

    if (scoresError) {
      console.error('[ppl_scoring] Error fetching all scores:', scoresError);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to calculate average',
          details: scoresError.message 
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Calculate average
    let averageScore = null;
    if (allScores && allScores.length > 0) {
      const validScores = allScores
        .map(item => Number(item.score))
        .filter(s => !isNaN(s) && s >= 0 && s <= 5);
      
      if (validScores.length > 0) {
        const sum = validScores.reduce((acc, s) => acc + s, 0);
        const avg = sum / validScores.length;
        averageScore = Math.round(avg * 10) / 10; // Round to 1 decimal place
        console.log(`[ppl_scoring] Calculated average: ${averageScore} from ${validScores.length} scores`);
      }
    }

    // STEP 3: Update ppl_profiles.score with the new average
    if (averageScore !== null) {
      const { error: profileError } = await serviceClient
        .from('ppl_profiles')
        .update({ score: averageScore })
        .eq('index_id', indexNum);

      if (profileError) {
        console.error('[ppl_scoring] Error updating ppl_profiles:', profileError);
        // Don't fail the request, just log the error
      } else {
        console.log(`[ppl_scoring] ✅ Updated ppl_profiles.score to ${averageScore}`);
      }
    }

    console.log(`[ppl_scoring] ✅ Complete! Average: ${averageScore ?? 'N/A'}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Score submitted successfully',
        data: {
          user_score: scoreNum,
          average_score: averageScore,
          total_scores: allScores?.length ?? 0,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('[ppl_scoring] Unexpected error:', error);
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

