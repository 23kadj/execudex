import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReceiptValidationResponse {
  status: number;
  environment: string;
  receipt: {
    in_app: Array<{
      product_id: string;
      transaction_id: string;
      original_transaction_id: string;
      purchase_date_ms: string;
      expires_date_ms?: string;
    }>;
  };
}

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
    const { receiptData, userId } = await req.json();

    // Validate inputs
    if (!receiptData || !userId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: receiptData and userId' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`Verifying receipt for user: ${userId}`);

    // Verify receipt with Apple
    const appleResponse = await verifyReceiptWithApple(receiptData);
    
    if (appleResponse.status !== 0) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid receipt', 
          appleStatus: appleResponse.status 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Check for valid Execudex subscriptions
    const validSubscriptions = findValidExecudexSubscriptions(appleResponse.receipt.in_app);
    
    if (validSubscriptions.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No valid Execudex subscriptions found' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Update user subscription status
    const subscription = validSubscriptions[0]; // Use most recent valid subscription
    const productId = subscription.product_id;
    // Determine plan from product ID
    const plan = productId === 'execudex.basic' ? 'basic' : 'plus';
    // Determine cycle from product ID (Basic is monthly only)
    const cycle = productId === 'execudex.plus.quarterly' ? 'quarterly' : 'monthly';

    // CRITICAL: Use original_transaction_id for ownership tracking
    // original_transaction_id stays constant across renewals, transaction_id changes each renewal
    const transactionId = subscription.original_transaction_id || subscription.transaction_id;
    
    console.log(`💾 Saving transaction ID for user ${userId}:`, {
      transactionId,
      original_transaction_id: subscription.original_transaction_id,
      transaction_id: subscription.transaction_id,
      productId,
      plan,
      cycle
    });

    const { error: updateError } = await supabaseClient
      .from('users')
      .update({ 
        plan, 
        cycle,
        last_transaction_id: transactionId,
        last_purchase_date: new Date(parseInt(subscription.purchase_date_ms)).toISOString(),
        receipt_validated: true
      })
      .eq('uuid', userId);

    if (updateError) {
      console.error('Error updating user subscription:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update subscription status' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('✅ Receipt validated and subscription updated successfully');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Receipt validated successfully',
        subscription: {
          plan,
          cycle,
          transactionId: transactionId,
          purchaseDate: new Date(parseInt(subscription.purchase_date_ms)).toISOString(),
          expiresDate: subscription.expires_date_ms ? new Date(parseInt(subscription.expires_date_ms)).toISOString() : null
        }
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Unexpected error in verify_receipt function:', error);
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

/**
 * Verify receipt with Apple's servers
 */
async function verifyReceiptWithApple(receiptData: string): Promise<ReceiptValidationResponse> {
  // For sandbox testing
  const sandboxUrl = 'https://sandbox.itunes.apple.com/verifyReceipt';
  // For production
  const productionUrl = 'https://buy.itunes.apple.com/verifyReceipt';

  const payload = {
    'receipt-data': receiptData,
    'password': Deno.env.get('APP_STORE_SHARED_SECRET') || '', // Optional shared secret
    'exclude-old-transactions': true
  };

  try {
    // Try production first
    let response = await fetch(productionUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    let result = await response.json() as ReceiptValidationResponse;

    // If production returns 21007 (sandbox receipt), try sandbox
    if (result.status === 21007) {
      response = await fetch(sandboxUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      result = await response.json() as ReceiptValidationResponse;
    }

    return result;
  } catch (error) {
    console.error('Error verifying receipt with Apple:', error);
    throw new Error('Failed to verify receipt with Apple');
  }
}

/**
 * Find valid Execudex subscriptions from receipt data
 */
function findValidExecudexSubscriptions(inAppPurchases: any[]): any[] {
  const execudexProducts = ['execudex.basic', 'execudex.plus.monthly', 'execudex.plus.quarterly'];
  const now = Date.now();

  return inAppPurchases
    .filter(purchase => execudexProducts.includes(purchase.product_id))
    .filter(purchase => {
      // Check if subscription is still active (not expired)
      if (purchase.expires_date_ms) {
        const expiresDate = parseInt(purchase.expires_date_ms);
        return expiresDate > now;
      }
      // If no expiry date, assume it's valid (non-consumable or lifetime)
      return true;
    })
    .sort((a, b) => {
      // Sort by purchase date (most recent first)
      return parseInt(b.purchase_date_ms) - parseInt(a.purchase_date_ms);
    });
}


