# 🍎 Apple Demo Account Setup Guide

## Overview
Apple requires a demo account with an **expired subscription** so they can test the subscription renewal flow during App Review.

## Step-by-Step Setup

### 1. Create a Test Account

1. **Create a new user account** in your app (sign up normally)
2. **Complete onboarding** and select a subscription plan (Basic or Plus)
3. **Note the user's email and UUID** for later reference

### 2. Set Up Expired Subscription State

You need to manually set the user's subscription to "expired" state in your database. Here are two methods:

#### Method A: Using Supabase Dashboard (Easiest)

1. Go to your Supabase Dashboard → Table Editor → `users` table
2. Find the user by their email or UUID
3. Update the following fields:
   - `plan`: Set to `NULL` (or empty string `''`)
   - `cycle`: Set to `NULL`
   - `plus_til`: Set to `NULL`
   - `last_transaction_id`: Keep existing value (shows they had a subscription)
   - `last_purchase_date`: Set to a date in the past (e.g., 30 days ago)

#### Method B: Using SQL Query

```sql
-- Replace 'USER_EMAIL_HERE' with the demo account email
UPDATE users
SET 
  plan = NULL,
  cycle = NULL,
  plus_til = NULL,
  last_purchase_date = NOW() - INTERVAL '30 days'
WHERE uuid = (
  SELECT id FROM auth.users WHERE email = 'USER_EMAIL_HERE'
);
```

### 3. Verify Expired State

After updating, verify the account:
- User should be able to log in
- User should see the subscription page (not stuck in onboarding)
- User should see prompts to resubscribe
- User should NOT have access to premium features

### 4. Provide to Apple

In your App Review notes, provide:
- **Email:** `demo@execudex.dev` (or whatever email you used)
- **Password:** `DemoAccount123!` (or a secure password you set)
- **Note:** "This account has an expired subscription. Please use this account to test the subscription renewal flow."

## Important Notes

### Current Behavior with Expired Subscriptions

- ✅ **User can log in** (authentication works)
- ✅ **User can access subscription page** (to resubscribe)
- ⚠️ **User may be redirected to onboarding** if `plan` is NULL (this is expected behavior)
- ✅ **User can complete onboarding again** to purchase a new subscription

### What Apple Will Test

1. **Login** with the expired account
2. **View subscription page** (should show expired/prompt to resubscribe)
3. **Purchase a new subscription** (should work normally)
4. **Verify subscription activates** correctly

## Troubleshooting

### Issue: User Stuck in Onboarding

**Problem:** If `plan` is NULL, the app redirects to onboarding.

**Solution:** This is actually fine! Apple can:
1. Complete onboarding again
2. Select a subscription plan
3. Complete purchase
4. Verify subscription activates

### Issue: User Can't Access Subscription Page

**Problem:** User is redirected away from subscription page.

**Solution:** Make sure the user has completed onboarding at least once. The subscription page should be accessible from the profile tab.

## Alternative: Use Sandbox Account with Expired Subscription

If you have access to App Store Connect sandbox testing:

1. Create a sandbox test account
2. Purchase a subscription with that account
3. Wait for it to expire (or manually expire it in App Store Connect)
4. Use that account as the demo account

This is more realistic but requires waiting for expiration.

## Quick SQL Script

Here's a complete SQL script to set up a demo account:

```sql
-- Step 1: Create/Find user (if needed)
-- (User should already exist from signup)

-- Step 2: Set expired subscription state
UPDATE users
SET 
  plan = NULL,
  cycle = NULL,
  plus_til = NULL,
  last_purchase_date = NOW() - INTERVAL '30 days',
  sub_logs = COALESCE(sub_logs, '') || E'\n' || NOW()::text || ' | DEMO_SETUP | Subscription expired for Apple review testing'
WHERE uuid = (
  SELECT id FROM auth.users WHERE email = 'demo@execudex.dev'
);

-- Step 3: Verify
SELECT uuid, email, plan, cycle, last_purchase_date 
FROM users 
WHERE uuid = (SELECT id FROM auth.users WHERE email = 'demo@execudex.dev');
```

## What to Include in App Review Notes

```
Demo Account for Subscription Testing:
- Email: demo@execudex.dev
- Password: [your secure password]
- Status: This account has an expired subscription. 
  Please use this account to test the subscription renewal flow.
  The account will redirect to onboarding where you can select 
  and purchase a new subscription plan.
```

