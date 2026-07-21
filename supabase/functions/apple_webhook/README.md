# Apple App Store Server Notifications Webhook

This Edge Function handles subscription lifecycle events from Apple's App Store.

## Setup Instructions

### 1. Deploy the Edge Function

```bash
supabase functions deploy apple_webhook
```

### 2. Get the Webhook URL

Your webhook URL will be:
```
https://[your-project-id].supabase.co/functions/v1/apple_webhook
```

### 3. Configure in App Store Connect

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Select your app
3. Go to **App Information**
4. Scroll to **App Store Server Notifications**
5. Set **Version 2 Production URL** to your webhook URL
6. Set **Version 2 Sandbox URL** to the same webhook URL (for testing)
7. Save

### 4. Set the `APPLE_APP_APPLE_ID` secret

Signature verification for the **Production** environment requires the app's numeric
App Store Connect Apple ID (App Store Connect > App Information > General Information > Apple ID —
NOT the bundle identifier). Set it as a secret:

```bash
supabase secrets set APPLE_APP_APPLE_ID=1234567890 --project-ref <ref>
```

Sandbox notifications verify without this (Apple's spec omits `appAppleId` in sandbox), so testing
via a sandbox purchase works before this is configured. Until it's set, Production notifications
are rejected (401/500) rather than accepted unverified — a fail-closed default.

### 5. Test the Webhook

Apple will send a test notification when you save the URL. Check your Supabase function logs to verify it was received.

## Handled Notification Types

| Notification Type | Action | Description |
|------------------|--------|-------------|
| `DID_RENEW` | Keep Plus | Subscription renewed successfully |
| `EXPIRED` | Downgrade to Basic | Subscription expired (cancelled or payment failed) |
| `DID_CHANGE_RENEWAL_STATUS` | Set/Clear `plus_til` | User turned auto-renew on/off |
| `REFUND` | Downgrade to Basic | User received a refund |
| `REVOKE` | Downgrade to Basic | Apple revoked the subscription |
| `DID_FAIL_TO_RENEW` | Log only | Payment failed, in retry period |

## Database Updates

All events are logged to the user's `sub_logs` column in the `users` table.

## Security

- Full JWS verification via Apple's official `@apple/app-store-server-library`: validates the
  certificate chain up to Apple's Root CA (G3, embedded in `index.ts`), checks revocation (OCSP)
  and expiry, and confirms `bundleId`/`environment`/`appAppleId` match this app before trusting
  any notification. Payloads that fail verification are rejected with 401.
- The top-level request body is Apple's real V2 shape — `{ signedPayload: "<JWS>" }` — which
  decodes to `{ notificationType, subtype, data: { signedTransactionInfo, signedRenewalInfo } }`.
  The nested `signedTransactionInfo`/`signedRenewalInfo` JWS are independently re-verified.
- `verify_jwt` is disabled for this function in `supabase/config.toml` (Apple sends no Supabase
  auth header) — trust comes entirely from the JWS signature check above.
- Service role key is used to bypass RLS policies

## Monitoring

Check function logs in Supabase Dashboard:
1. Go to **Functions** in your Supabase project
2. Select `apple_webhook`
3. View **Logs** tab

## Troubleshooting

### Webhook not receiving notifications
- Verify URL is correct in App Store Connect
- Check function is deployed: `supabase functions list`
- Test with a sandbox purchase

### User not found errors
- Ensure `last_transaction_id` is being saved during purchases
- Check that transaction IDs match between purchase and webhook

### Database not updating
- Check function logs for errors
- Verify service role key has proper permissions
- Ensure migration has been run







