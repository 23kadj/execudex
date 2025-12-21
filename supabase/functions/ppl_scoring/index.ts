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
    console.log('[ppl_scoring] Request body:', { 
      index_id, 
      score, 
      user_id: user_id ? user_id.substring(0, 12) + '...' : 'missing',
      user_id_type: typeof user_id,
      user_id_length: user_id ? user_id.length : 0
    });

    // Validate user_id
    if (!user_id || typeof user_id !== 'string' || user_id.trim() === '') {
      console.error('[ppl_scoring] Missing or invalid user_id in request:', { 
        user_id_present: !!user_id,
        user_id_type: typeof user_id 
      });
      return new Response(
        JSON.stringify({ 
          error: 'Authentication required: user_id missing or invalid',
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
    console.log(`[ppl_scoring] Full user_id value: "${user_id}"`);
    console.log(`[ppl_scoring] user_id type: ${typeof user_id}, length: ${user_id.length}`);

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
    console.log('[ppl_scoring] Checking for existing score with user_id:', user_id.substring(0, 12) + '...', 'index_id:', indexNum);
    
    const { data: existingScore, error: checkError } = await serviceClient
      .from('ppl_scores')
      .select('id, user_id')
      .eq('user_id', user_id)
      .eq('index_id', indexNum)
      .maybeSingle();
    
    console.log('[ppl_scoring] Existing score check result:', {
      found: !!existingScore,
      existing_user_id: existingScore?.user_id ? existingScore.user_id.substring(0, 12) + '...' : 'N/A',
      error: checkError?.message || 'none'
    });

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
      console.log('[ppl_scoring] Update params:', {
        user_id: user_id.substring(0, 12) + '...',
        user_id_full_length: user_id.length,
        score: scoreNum,
        index_id: indexNum
      });
      
      const updateData = { 
        user_id: user_id,
        score: scoreNum,
        created_at: new Date().toISOString()
      };
      
      const { data: updatedRow, error: updateError } = await serviceClient
        .from('ppl_scores')
        .update(updateData)
        .eq('user_id', user_id)
        .eq('index_id', indexNum)
        .select('id, user_id, index_id, score')
        .single();

      dbError = updateError;
      if (!updateError && updatedRow) {
        console.log('[ppl_scoring] ✅ Score updated successfully. Saved row:', {
          id: updatedRow.id,
          user_id: updatedRow.user_id ? updatedRow.user_id.substring(0, 12) + '...' : 'NULL',
          user_id_is_null: updatedRow.user_id === null,
          index_id: updatedRow.index_id,
          score: updatedRow.score
        });
      } else if (updateError) {
        console.error('[ppl_scoring] Update error details:', updateError);
      }
    } else {
      // Insert new score
      console.log('[ppl_scoring] Inserting new score');
      console.log('[ppl_scoring] Values to insert:', {
        user_id: user_id.substring(0, 12) + '...',
        user_id_full_length: user_id.length,
        index_id: indexNum,
        score: scoreNum
      });
      
      const insertData = {
        user_id: user_id,
        index_id: indexNum,
        score: scoreNum,
        created_at: new Date().toISOString()
      };
      
      const { data: insertedRow, error: insertError } = await serviceClient
        .from('ppl_scores')
        .insert(insertData)
        .select('id, user_id, index_id, score')
        .single();
      
      dbError = insertError;
      if (!insertError && insertedRow) {
        console.log('[ppl_scoring] ✅ Score inserted successfully. Saved row:', {
          id: insertedRow.id,
          user_id: insertedRow.user_id ? insertedRow.user_id.substring(0, 12) + '...' : 'NULL',
          user_id_is_null: insertedRow.user_id === null,
          index_id: insertedRow.index_id,
          score: insertedRow.score
        });
        
        // Verify the insert immediately
        const { data: verifyData } = await serviceClient
          .from('ppl_scores')
          .select('id, user_id, index_id, score')
          .eq('id', insertedRow.id)
          .single();
        
        console.log('[ppl_scoring] Verification read:', {
          user_id_in_db: verifyData?.user_id ? verifyData.user_id.substring(0, 12) + '...' : 'NULL',
          user_id_is_null_in_db: verifyData?.user_id === null
        });
      } else if (insertError) {
        console.error('[ppl_scoring] Insert error details:', JSON.stringify(insertError));
      }
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

