// Apple App Store Server Notifications Webhook (Version 2)
// Handles subscription lifecycle events from Apple

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { Buffer } from 'node:buffer'
import { SignedDataVerifier, Environment } from 'npm:@apple/app-store-server-library@3.1.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const BUNDLE_ID = 'com.execudex.app'

// Apple Root CA - G3 (https://www.apple.com/certificateauthority/AppleRootCA-G3.cer)
// This is the root of trust for App Store Server Notification / transaction JWS chains.
// Embedded directly so verification has no runtime dependency on fetching it.
const APPLE_ROOT_CA_G3_BASE64 =
  'MIICQzCCAcmgAwIBAgIILcX8iNLFS5UwCgYIKoZIzj0EAwMwZzEbMBkGA1UEAwwSQXBwbGUgUm9vdCBDQSAtIEczMSYwJAYDVQQLDB1BcHBsZSBDZXJ0aWZpY2F0aW9uIEF1dGhvcml0eTETMBEGA1UECgwKQXBwbGUgSW5jLjELMAkGA1UEBhMCVVMwHhcNMTQwNDMwMTgxOTA2WhcNMzkwNDMwMTgxOTA2WjBnMRswGQYDVQQDDBJBcHBsZSBSb290IENBIC0gRzMxJjAkBgNVBAsMHUFwcGxlIENlcnRpZmljYXRpb24gQXV0aG9yaXR5MRMwEQYDVQQKDApBcHBsZSBJbmMuMQswCQYDVQQGEwJVUzB2MBAGByqGSM49AgEGBSuBBAAiA2IABJjpLz1AcqTtkyJygRMc3RCV8cWjTnHcFBbZDuWmBSp3ZHtfTjjTuxxEtX/1H7YyYl3J6YRbTzBPEVoA/VhYDKX1DyxNB0cTddqXl5dvMVztK517IDvYuVTZXpmkOlEKMaNCMEAwHQYDVR0OBBYEFLuw3qFYM4iapIqZ3r6966/ayySrMA8GA1UdEwEB/wQFMAMBAf8wDgYDVR0PAQH/BAQDAgEGMAoGCCqGSM49BAMDA2gAMGUCMQCD6cHEFl4aXTQY2e3v9GwOAEZLuN+yRhHFD/3meoyhpmvOwgPUnPWTxnS4at+qIxUCMG1mihDK1A3UT82NQz60imOlM27jbdoXt2QfyFMm+YhidDkLF1vLUagM6BgD56KyKA=='

const appleRootCertificates = [Buffer.from(APPLE_ROOT_CA_G3_BASE64, 'base64')]

// enableOnlineChecks=true: also checks cert revocation (OCSP) and current-time expiry against Apple.
const sandboxVerifier = new SignedDataVerifier(appleRootCertificates, true, Environment.SANDBOX, BUNDLE_ID)

// Production verification requires the app's numeric App Store Connect Apple ID
// (App Store Connect > App Information > General Information > Apple ID) — set as
// the APPLE_APP_APPLE_ID secret. Until it's configured, Production notifications are
// safely rejected rather than accepted unverified.
const appAppleIdRaw = Deno.env.get('APPLE_APP_APPLE_ID')
const appAppleId = appAppleIdRaw ? Number(appAppleIdRaw) : undefined
let productionVerifier: SignedDataVerifier | null = null
if (appAppleId !== undefined && Number.isFinite(appAppleId)) {
  productionVerifier = new SignedDataVerifier(appleRootCertificates, true, Environment.PRODUCTION, BUNDLE_ID, appAppleId)
} else {
  console.warn('⚠️ APPLE_APP_APPLE_ID secret not set — Production App Store notifications will be rejected until it is configured.')
}

function base64UrlDecode(input: string): string {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/')
  const pad = (4 - (padded.length % 4)) % 4
  return atob(padded + '='.repeat(pad))
}

// Best-effort peek at the (still unverified) environment field so we try the right
// verifier first. Not a security boundary — verifyAndDecodeNotification() below is
// what actually checks the signature, and we fall back to the other verifier if this
// guess was wrong.
function peekEnvironment(signedPayload: string): string | undefined {
  try {
    const parts = signedPayload.split('.')
    if (parts.length !== 3) return undefined
    const payload = JSON.parse(base64UrlDecode(parts[1]))
    return payload?.data?.environment || payload?.summary?.environment
  } catch {
    return undefined
  }
}

async function verifyNotification(signedPayload: string) {
  const guessedEnv = peekEnvironment(signedPayload)
  const primary = guessedEnv === Environment.PRODUCTION ? productionVerifier : sandboxVerifier
  const fallback = primary === productionVerifier ? sandboxVerifier : productionVerifier
  const candidates = [primary, fallback].filter((v): v is SignedDataVerifier => v !== null)

  if (candidates.length === 0) {
    throw new Error('No verifier available for this environment (APPLE_APP_APPLE_ID not configured)')
  }

  let lastError: unknown
  for (const verifier of candidates) {
    try {
      const decoded = await verifier.verifyAndDecodeNotification(signedPayload)
      return { decoded, verifier }
    } catch (e) {
      lastError = e
    }
  }
  throw lastError
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
    // Check both permanent and pending transaction ID fields
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .or(`last_transaction_id.eq.${transactionId},pending_transaction_id.eq.${transactionId}`)
      .maybeSingle()

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

    // Apple's actual wire format is a single signed JWS: { signedPayload: "ey..." }
    // which decodes to { notificationType, subtype, data: { signedTransactionInfo, signedRenewalInfo } }.
    const body = await req.json()
    const signedPayload: string | undefined = body?.signedPayload

    if (!signedPayload || typeof signedPayload !== 'string') {
      console.error('❌ Missing signedPayload in webhook body')
      return new Response(
        JSON.stringify({ error: 'Missing signedPayload' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let decoded: any
    let verifier: SignedDataVerifier
    try {
      const result = await verifyNotification(signedPayload)
      decoded = result.decoded
      verifier = result.verifier
    } catch (verifyError) {
      console.error('❌ Notification signature verification failed:', verifyError)
      return new Response(
        JSON.stringify({ error: 'Invalid signature' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const notificationType: string | undefined = decoded.notificationType
    const subtype: string | undefined = decoded.subtype
    console.log('📦 Notification type:', notificationType, '| Subtype:', subtype)

    // Apple's "Send Test Notification" (App Store Connect / the requestATestNotification
    // endpoint) delivers notificationType TEST with no data.signedTransactionInfo. It has
    // already passed signature verification above, so a forged TEST payload never reaches
    // here — but there's no transaction to parse, so acknowledge and stop before the
    // transaction branch would 400 on a missing transaction ID.
    if (notificationType === 'TEST') {
      console.log('🧪 Test notification received and verified')
      return new Response(
        JSON.stringify({ message: 'Test notification received' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Each nested JWS is independently signed and must be independently verified.
    let transactionInfo: any = {}
    if (decoded.data?.signedTransactionInfo) {
      try {
        transactionInfo = await verifier.verifyAndDecodeTransaction(decoded.data.signedTransactionInfo)
        console.log('💳 Transaction info verified:', transactionInfo)
      } catch (e) {
        console.error('❌ Transaction info verification failed:', e)
      }
    }

    let renewalInfo: any = {}
    if (decoded.data?.signedRenewalInfo) {
      try {
        renewalInfo = await verifier.verifyAndDecodeRenewalInfo(decoded.data.signedRenewalInfo)
        console.log('🔄 Renewal info verified:', renewalInfo)
      } catch (e) {
        console.error('❌ Renewal info verification failed:', e)
      }
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

    const expiresDate = transactionInfo.expiresDate ? new Date(transactionInfo.expiresDate) : null

    switch (notificationType) {
      case 'SUBSCRIBED': {
        // subtype INITIAL_BUY: first purchase. RESUBSCRIBE: reactivated after lapsing.
        console.log(`✅ Subscribed (${subtype})`)

        const subscribedResult = await supabase
          .from('users')
          .update({
            last_transaction_id: originalTransactionId, // Promote from pending to permanent
            pending_transaction_id: null, // Clear pending
            plan: 'plus',
            plus_til: expiresDate?.toISOString() || null
          })
          .eq('pending_transaction_id', originalTransactionId)
          .select();

        if (subscribedResult.data && subscribedResult.data.length === 0) {
          // No pending transaction matched (e.g. resubscribe on an already-linked account) - update directly.
          await supabase
            .from('users')
            .update({
              plan: 'plus',
              plus_til: expiresDate?.toISOString() || null
            })
            .eq('id', userId);
        }

        await logToSubLogs(
          supabase,
          userId,
          'SUBSCRIBED',
          `${subtype || ''} subscription activated until ${expiresDate?.toISOString() || 'unknown'}`
        )
        break;
      }

      case 'DID_RENEW':
        // Subscription renewed successfully
        console.log('✅ Subscription renewed')

        // Try to promote pending transaction ID first (in case this is actually initial activation)
        const renewPromotionResult = await supabase
          .from('users')
          .update({
            last_transaction_id: originalTransactionId,
            pending_transaction_id: null,
            plan: 'plus',
            plus_til: expiresDate?.toISOString() || null
          })
          .eq('pending_transaction_id', originalTransactionId)
          .select();

        // If no pending transaction was promoted, this is a normal renewal
        if (renewPromotionResult.data && renewPromotionResult.data.length === 0) {
          await supabase
            .from('users')
            .update({
              plan: 'plus',
              plus_til: expiresDate?.toISOString() || null
            })
            .eq('id', userId);
        }

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
          notificationType || 'UNKNOWN',
          `Unhandled notification: ${JSON.stringify({ notificationType, subtype })}`
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
