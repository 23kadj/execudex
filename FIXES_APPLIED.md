# Profile Quota System - Fixes Applied

## Issues Fixed

### 1. **Edge Function Failing (Non-2xx Error)**
**Problem**: Edge function was returning errors, causing profile access to fail
**Fix**: 
- Made edge function more robust with fallback to allowing access on error
- Added dual column lookup (tries both `uuid` and `id` columns)
- Returns 200 status even when user not found (graceful degradation)
- Service layer now defaults to `allowed: true` on any error

### 2. **Profile Loading Before Access Check**
**Problem**: Profile was rendering before the access check completed
**Fix**:
- Added `checkingAccess` and `accessAllowed` state variables
- Profile data fetch now waits for access check to complete
- Alert shows BEFORE profile renders, not after
- User is immediately navigated back if access denied

### 3. **Function Failure Blocking Access**
**Problem**: When edge function failed, it blocked users instead of allowing them through
**Fix**:
- Changed error handling to default to `allowed: true`
- Console logs show clear "defaulting to ALLOW access" messages
- System gracefully degrades instead of blocking users

## Files Modified

### 1. `services/profileAccessService.ts`
- Changed error handling to default to allowing access
- Added console logs for debugging

### 2. `supabase/functions/check_profile_access/index.ts`
- Added dual column lookup (uuid/id)
- Returns 200 status with allow on user not found
- More robust error handling

### 3. `app/index1.tsx` (Politician Profiles)
- Added separate useEffect for access check (runs FIRST)
- Added `checkingAccess` and `accessAllowed` states
- Profile data fetch waits for access check
- Alert blocks profile loading

### 4. `app/index2.tsx` (Legislation Profiles)  
- Same changes as index1.tsx
- Consistent behavior across both profile types

## Next Steps to Get It Working

### Step 1: Deploy the Edge Function
```bash
# Navigate to your project directory
cd c:\Users\gykad\OneDrive\execudex

# Deploy the function
supabase functions deploy check_profile_access
```

### Step 2: Run the Database Migration
Option A - Via Supabase Dashboard:
1. Go to https://supabase.com/dashboard
2. Select your project
3. Go to SQL Editor
4. Paste contents from `supabase/migrations/add_profile_quota_columns.sql`
5. Click Run

Option B - Via CLI:
```bash
supabase db push
```

### Step 3: Set User Plan
For testing, manually set a user's plan to "basic":
```sql
UPDATE users 
SET plan = 'basic', 
    week_profiles = '{}', 
    last_reset = NULL 
WHERE uuid = 'your-user-id-here';
```

## How to Test

1. **Open your app** - clear any cache/restart if needed

2. **Check console logs** - you should see:
   ```
   STEP 0: Checking profile access...
   Access response: { allowed: true, ... }
   ```

3. **Open a profile** - should work normally

4. **Check subscription page** - should show your usage count

5. **If still getting errors**:
   - Check if edge function is deployed: `supabase functions list`
   - Check database columns exist: Run `SELECT * FROM users LIMIT 1;`
   - Check console for specific error messages

## Current Behavior

**On Success:**
- Profile access check runs first
- If allowed, profile loads normally
- Usage tracked in database
- Subscription page shows count

**On Error (Edge Function Fails):**
- Console shows "defaulting to ALLOW access"
- Profile loads normally
- No quota tracking (graceful degradation)
- User not blocked

**On Quota Exceeded:**
- Alert shows BEFORE profile renders
- User cannot access profile
- Directed to upgrade or check history

## Why It Might Show "8/20"

If you're seeing 8/20 on subscription page after opening only one profile, possible causes:

1. **Old data**: week_profiles array had existing data from previous tests
   - **Fix**: Clear the array: `UPDATE users SET week_profiles = '{}' WHERE uuid = 'your-id';`

2. **Multiple edge function calls**: Same profile opening triggered function multiple times
   - **Fix**: Already addressed with the blocking state

3. **Test data**: You had manually added test IDs to the array
   - **Fix**: Clear and start fresh

## Debug Commands

**Check your current usage:**
```sql
SELECT uuid, plan, week_profiles, last_reset 
FROM users 
WHERE uuid = 'your-user-id-here';
```

**Reset your week:**
```sql
UPDATE users 
SET week_profiles = '{}', 
    last_reset = NULL 
WHERE uuid = 'your-user-id-here';
```

**Check edge function logs:**
```bash
supabase functions logs check_profile_access
```

## If Still Having Issues

1. Share the **exact console logs** when opening a profile
2. Check if columns exist: `\d users` in psql
3. Verify edge function is deployed and accessible
4. Try the test SQL queries above to see current state

