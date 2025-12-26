// Apple App Store Server Notifications Webhook
// Handles subscription lifecycle events from Apple

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AppleNotification {
  notificationType: string
  subtype?: string
  data: {
    signedTransactionInfo?: string
    signedRenewalInfo?: string
  }
}

// Decode JWT payload without verification (verification happens separately)
function decodeJWT(token: string): any {
  const parts = token.split('.')
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format')
  }
  
  const payload = parts[1]
  const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
  return JSON.parse(decoded)
}

// Verify Apple's JWT signature using Apple's public keys
async function verifyAppleJWT(token: string): Promise<boolean> {
  try {
    // In production, you should:
    // 1. Fetch Apple's public keys from https://appleid.apple.com/auth/keys
    // 2. Verify the JWT signature using the appropriate key
    // 3. Verify the token hasn't expired
    // 4. Verify the token issuer is Apple
    
    // For now, we'll decode and log but skip verification
    // TODO: Implement full JWT verification for production
    const decoded = decodeJWT(token)
    console.log('🔐 JWT decoded (verification skipped for now):', decoded)
    return true
  } catch (error) {
    console.error('❌ JWT verification failed:', error)
    return false
  }
}

// Log event to user's sub_logs
async function logToSubLogs(
  supabase: any,
  userId: string,
  notificationType: string,
  details: string
) {
  try {
    const { data: userData } = await supabase
      .from('users')
      .select('sub_logs')
      .eq('id', userId)
      .single()

    const currentLogs = userData?.sub_logs || ''
    const newLog = `${new Date().toISOString()} | ${notificationType} | ${details}`
    const updatedLogs = currentLogs ? `${currentLogs}\n${newLog}` : newLog

    await supabase
      .from('users')
      .update({ sub_logs: updatedLogs })
      .eq('id', userId)

    console.log('📝 Logged to sub_logs:', newLog)
  } catch (error) {
    console.error('❌ Failed to log to sub_logs:', error)
  }
}

// Find user by transaction ID
async function findUserByTransactionId(
  supabase: any,
  transactionId: string
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .eq('last_transaction_id', transactionId)
      .single()

    if (error || !data) {
      console.warn('⚠️ User not found for transaction ID:', transactionId)
      return null
    }

    return data.id
  } catch (error) {
    console.error('❌ Error finding user:', error)
    return null
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('📩 Received Apple webhook notification')

    // Parse the notification
    const notification: AppleNotification = await req.json()
    console.log('📦 Notification type:', notification.notificationType)
    console.log('📦 Subtype:', notification.subtype)

    // Verify JWT signature (if present)
    if (notification.data?.signedTransactionInfo) {
      const isValid = await verifyAppleJWT(notification.data.signedTransactionInfo)
      if (!isValid) {
        console.error('❌ Invalid JWT signature')
        return new Response(
          JSON.stringify({ error: 'Invalid signature' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Decode transaction info
    let transactionInfo: any = {}
    if (notification.data?.signedTransactionInfo) {
      transactionInfo = decodeJWT(notification.data.signedTransactionInfo)
      console.log('💳 Transaction info:', transactionInfo)
    }

    // Decode renewal info
    let renewalInfo: any = {}
    if (notification.data?.signedRenewalInfo) {
      renewalInfo = decodeJWT(notification.data.signedRenewalInfo)
      console.log('🔄 Renewal info:', renewalInfo)
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Find user by originalTransactionId
    const originalTransactionId = transactionInfo.originalTransactionId || transactionInfo.transactionId
    if (!originalTransactionId) {
      console.error('❌ No transaction ID found in notification')
      return new Response(
        JSON.stringify({ error: 'No transaction ID' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userId = await findUserByTransactionId(supabase, originalTransactionId)
    if (!userId) {
      console.warn('⚠️ User not found, ignoring notification')
      // Return 200 to acknowledge receipt even if user not found
      return new Response(
        JSON.stringify({ message: 'User not found, notification ignored' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('👤 Found user:', userId)

    // Handle different notification types
    const notificationType = notification.notificationType
    const expiresDate = transactionInfo.expiresDate ? new Date(parseInt(transactionInfo.expiresDate)) : null

    switch (notificationType) {
      case 'DID_RENEW':
        // Subscription renewed successfully
        console.log('✅ Subscription renewed')
        await supabase
          .from('users')
          .update({
            plan: 'plus',
            plus_til: null // Clear any scheduled downgrade
          })
          .eq('id', userId)
        
        await logToSubLogs(
          supabase,
          userId,
          'DID_RENEW',
          `Subscription renewed until ${expiresDate?.toISOString() || 'unknown'}`
        )
        break

      case 'EXPIRED':
        // Subscription expired
        console.log('⏰ Subscription expired')
        await supabase
          .from('users')
          .update({
            plan: 'basic',
            cycle: null,
            plus_til: null
          })
          .eq('id', userId)
        
        await logToSubLogs(
          supabase,
          userId,
          'EXPIRED',
          'Subscription expired, downgraded to Basic'
        )
        break

      case 'DID_CHANGE_RENEWAL_STATUS':
        // User turned auto-renew on or off
        const autoRenewStatus = renewalInfo.autoRenewStatus
        console.log('🔄 Auto-renew status changed:', autoRenewStatus)
        
        if (autoRenewStatus === 0) {
          // Auto-renew turned OFF - schedule downgrade
          if (expiresDate) {
            await supabase
              .from('users')
              .update({
                plus_til: expiresDate.toISOString()
              })
              .eq('id', userId)
            
            await logToSubLogs(
              supabase,
              userId,
              'AUTO_RENEW_OFF',
              `Auto-renew disabled, downgrade scheduled for ${expiresDate.toISOString()}`
            )
          }
        } else {
          // Auto-renew turned ON - clear scheduled downgrade
          await supabase
            .from('users')
            .update({
              plus_til: null
            })
            .eq('id', userId)
          
          await logToSubLogs(
            supabase,
            userId,
            'AUTO_RENEW_ON',
            'Auto-renew enabled, scheduled downgrade cancelled'
          )
        }
        break

      case 'REFUND':
        // User received refund
        console.log('💸 Subscription refunded')
        await supabase
          .from('users')
          .update({
            plan: 'basic',
            cycle: null,
            plus_til: null
          })
          .eq('id', userId)
        
        await logToSubLogs(
          supabase,
          userId,
          'REFUND',
          'Subscription refunded, downgraded to Basic'
        )
        break

      case 'REVOKE':
        // Subscription revoked by Apple
        console.log('🚫 Subscription revoked')
        await supabase
          .from('users')
          .update({
            plan: 'basic',
            cycle: null,
            plus_til: null
          })
          .eq('id', userId)
        
        await logToSubLogs(
          supabase,
          userId,
          'REVOKE',
          'Subscription revoked by Apple, downgraded to Basic'
        )
        break

      case 'DID_FAIL_TO_RENEW':
        // Payment failed, but subscription is in grace/retry period
        console.log('⚠️ Renewal failed, waiting for retry')
        await logToSubLogs(
          supabase,
          userId,
          'RENEWAL_FAILED',
          'Payment failed, in retry period'
        )
        // Don't downgrade yet, wait for EXPIRED
        break

      default:
        console.log('ℹ️ Unhandled notification type:', notificationType)
        await logToSubLogs(
          supabase,
          userId,
          notificationType,
          `Unhandled notification: ${JSON.stringify(notification)}`
        )
    }

    console.log('✅ Webhook processed successfully')

    return new Response(
      JSON.stringify({ message: 'Webhook processed successfully' }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('❌ Webhook processing error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})



