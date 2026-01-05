# Push Notifications - Steps You Need to Complete

I've completed the code implementation. Here are the steps you need to do:

## ✅ Already Completed (by me):
1. ✅ Created `services/pushTokenService.ts` - handles push token registration
2. ✅ Created database migration `supabase/migrations/20250117_create_user_push_tokens.sql`
3. ✅ Updated `app.json` to include expo-notifications plugin
4. ✅ Updated `NotificationService` to send via Expo Push API (with local notification fallback)
5. ✅ Updated `app/index1.tsx` and `app/index2.tsx` to register push tokens on subscribe
6. ✅ Updated edge functions (`ppl_card_gen` and `bill_cards`) to send push notifications

## 📋 Steps You Must Complete:

### 1. Apply Database Migration

**Location:** `supabase/migrations/20250117_create_user_push_tokens.sql`

Apply this migration to your Supabase database using one of these methods:

**Option A: Supabase Dashboard**
1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy the contents of `supabase/migrations/20250117_create_user_push_tokens.sql`
4. Paste and run the SQL

**Option B: Supabase CLI**
```bash
supabase db push
```

### 2. Create APNs Authentication Key (.p8 file)

1. Go to [Apple Developer Portal](https://developer.apple.com/account)
2. Navigate to **Certificates, Identifiers & Profiles**
3. Select **Keys** → Click **+** (Create a new key)
4. Enter a name for the key (e.g., "Execudex Push Notifications")
5. Enable **Apple Push Notifications service (APNs)**
6. Click **Continue** → **Register**
7. **Download the .p8 file** (you can only download it once - save it securely!)
8. **Note the Key ID** (shown on the key detail page, e.g., "ABC123XYZ")
9. **Note your Team ID** (found in your Apple Developer account membership page, or in the top-right corner of the Developer Portal)

**Important:** Keep the .p8 file, Key ID, and Team ID safe - you'll need them in the next step.

### 3. Upload APNs Key to Expo/EAS

You need to upload your .p8 key to Expo so it can send push notifications on your behalf.

**Option A: Using EAS CLI (Recommended)**
```bash
eas credentials
```
- Select your iOS platform
- Choose "Push Notifications" → "Set up APNs Authentication Key"
- Provide:
  - Path to your .p8 file (or paste the contents)
  - Key ID (from step 2)
  - Team ID (from step 2)

**Option B: Using Expo Dashboard**
1. Go to [Expo Dashboard](https://expo.dev)
2. Select your project
3. Go to **Credentials** → **iOS**
4. Find **Push Notifications**
5. Upload your .p8 file and enter Key ID and Team ID

### 4. Enable Push Notifications in Apple Developer Account

1. Go to [Apple Developer Portal](https://developer.apple.com/account)
2. Navigate to **Certificates, Identifiers & Profiles**
3. Select **Identifiers** → Your App ID (`com.execudex.app`)
4. Enable **Push Notifications** capability (if not already enabled)
5. Click **Save**

### 5. Build with EAS Build (Required for Push Notifications)

Push notifications require a native build. You cannot test push notifications in Expo Go.

**Prerequisites:**
- Install EAS CLI: `npm install -g eas-cli`
- Login: `eas login`
- Configure project: `eas build:configure` (if not already done)

**Build for iOS:**
```bash
eas build --platform ios --profile production
```

This will:
- Create a native iOS build with push notification capabilities
- Generate necessary certificates automatically
- Upload to App Store Connect or provide download link

**Important Notes:**
- Push notifications only work on physical devices (not simulators)
- You must build with EAS; local builds won't have push notification support
- The build process takes 15-30 minutes

### 6. Test Push Notifications

After building and installing the app on a physical iOS device:

1. **Subscribe to a profile** in the app (this will register the push token)
2. **Generate cards** for that profile (from another account or wait for scheduled generation)
3. **Verify you receive a push notification** on your device (even when app is closed)
4. **Tap the notification** - it should navigate to the notifications page

**Testing Checklist:**
- [ ] App is installed on physical iOS device
- [ ] User subscribes to a profile
- [ ] Push token is registered (check `user_push_tokens` table in Supabase)
- [ ] Cards are generated for that profile
- [ ] Push notification appears on device
- [ ] Tapping notification navigates to `/notifications` page

### 7. Deploy Edge Functions (if you modified them)

If you've made changes to edge functions, deploy them:

```bash
supabase functions deploy ppl_card_gen
supabase functions deploy bill_cards
```

## Troubleshooting

### Push notifications not working?
1. **Check if token is registered:** Query `user_push_tokens` table in Supabase
2. **Check edge function logs:** Look for errors in Supabase Dashboard → Functions → Logs
3. **Verify Expo Push API responses:** Check network requests in edge function logs
4. **Ensure app was built with EAS:** Push notifications don't work in Expo Go
5. **Check device settings:** Ensure notifications are enabled for the app in iOS Settings

### "Push token not found" errors?
- The user must subscribe to at least one profile to register their push token
- Push tokens are registered when `registerPushToken()` is called in `subscribeToProfile`
- Check that the migration was applied successfully

### Notifications not appearing?
- Verify the `notifications` table has entries (check Supabase)
- Check edge function logs for errors
- Ensure the app has notification permissions enabled
- Verify the Expo Push API call succeeded (check edge function logs)

## Summary

The code is ready! You just need to:
1. ✅ Apply the database migration
2. ✅ Create APNs Authentication Key (.p8 file) in Apple Developer
3. ✅ Upload .p8 key to Expo/EAS using `eas credentials`
4. ✅ Enable Push Notifications capability for your App ID
5. ✅ Build with EAS Build
6. ✅ Test on a physical device

The system will automatically:
- Register push tokens when users subscribe
- Send push notifications when cards are generated
- Fall back to local notifications if push tokens aren't available

