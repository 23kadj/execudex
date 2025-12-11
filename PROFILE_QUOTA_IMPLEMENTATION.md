# Profile Quota System Implementation

## Overview
This document describes the implementation of a weekly profile access quota system for subscription management.

## Features
- **Basic Plan**: Users can access up to 20 unique profiles per week (mix of politicians and legislation)
- **Plus Plan**: Users have unlimited profile access
- **Weekly Reset**: Profile limits reset every Sunday at midnight (EST)
- **Smart Tracking**: Profiles are tracked by ID (format: "123ppl" or "456legi")
- **User Warnings**: Users get a warning when they reach 15 profiles
- **Visual Feedback**: Progress bar and counter shown on subscription page

## Implementation Details

### 1. Database Changes
**File**: `supabase/migrations/add_profile_quota_columns.sql`

Added three new columns to the `users` table:
- `week_profiles` (text[]): Array of profile IDs accessed this week
- `last_reset` (timestamptz): Timestamp of last weekly reset
- `plan` (text): User's subscription plan ("basic" or other)

**To apply migration:**
```bash
# Run this in your Supabase project
psql -d your_database < supabase/migrations/add_profile_quota_columns.sql
```

### 2. Edge Function
**File**: `supabase/functions/check_profile_access/index.ts`

New edge function that handles:
- Profile access verification (Step 0 before profile loading)
- Sunday reset logic (automatic on first access of new week)
- Quota tracking (add profile to array if under 20)
- Access blocking (return failure if at 20)

**Inputs:**
- `user_uuid`: User's ID
- `profile_id`: Profile ID (e.g., "219ppl" or "542legi")
- `date`: Current date/time

**Outputs:**
```typescript
{
  allowed: boolean,
  profilesUsed?: number,
  reason?: string,
  resetDate?: string,
  showWarning?: boolean
}
```

**To deploy:**
```bash
# Deploy the edge function to Supabase
supabase functions deploy check_profile_access
```

### 3. Frontend Service
**File**: `services/profileAccessService.ts`

Service layer providing:
- `checkProfileAccess()`: Main function to verify profile access
- `getWeeklyProfileUsage()`: Fetch current usage stats

### 4. Profile Pages Integration
**Files Modified:**
- `app/index1.tsx` (Politician profiles)
- `app/index2.tsx` (Legislation profiles)

**Integration Points:**
Added Step 0 check at the beginning of profile data fetching:
1. Call `checkProfileAccess()` with user ID and profile ID
2. If blocked: Show alert and navigate back
3. If warning threshold (15+): Show gentle warning
4. If allowed: Continue loading profile

**User Experience:**
- **Blocked Access**: Modal with upgrade CTA, history link, and reset date
- **Warning**: Alert when 5 or fewer profiles remain

### 5. Subscription Page
**File**: `app/subscription.tsx`

Added visual profile usage display for Basic plan users:
- Large counter showing "X / 20 profiles accessed"
- Progress bar (green when under 15, red when 15-20)
- Contextual message about remaining profiles or limit reached
- Automatically hidden for non-basic plan users

## User Flow Example

### Scenario 1: Basic User, 5th Profile
1. User clicks on politician profile
2. `checkProfileAccess()` called
3. User has accessed 4 profiles so far
4. Profile ID added to `week_profiles` array → now 5
5. Profile loads normally
6. Response: `{ allowed: true, profilesUsed: 5 }`

### Scenario 2: Basic User, 15th Profile
1. User clicks on legislation profile
2. `checkProfileAccess()` called
3. User has accessed 14 profiles so far
4. Profile ID added to array → now 15
5. **Warning Alert**: "You have 5 profiles remaining this week"
6. User clicks OK
7. Profile loads normally

### Scenario 3: Basic User, 21st Profile (Blocked)
1. User tries to access new profile
2. `checkProfileAccess()` called
3. User has accessed 20 profiles (different from current one)
4. **Blocking Alert**: "Weekly Profile Limit Reached"
5. Options: "Upgrade Now" or "OK"
6. Profile does NOT load, user navigated back

### Scenario 4: Sunday Reset
1. User accesses profile on Sunday
2. `checkProfileAccess()` checks `last_reset`
3. Sees last reset was before current Sunday
4. Wipes `week_profiles` array
5. Adds current profile as first entry
6. Updates `last_reset` to now
7. Profile loads, user has used 1/20

### Scenario 5: Plus Plan User
1. User clicks any profile
2. `checkProfileAccess()` checks plan
3. Plan is not "basic"
4. Returns `{ allowed: true, reason: 'unlimited_plan' }`
5. All quota checks bypassed, profile loads

## Testing Checklist

- [ ] Deploy edge function to Supabase
- [ ] Run database migration
- [ ] Set a test user's `plan` to "basic"
- [ ] Access 5 different profiles → should work
- [ ] Access same profile twice → should not count twice
- [ ] Access 15th profile → should show warning
- [ ] Access 20th profile → should still work
- [ ] Try accessing 21st different profile → should block
- [ ] Manually change `last_reset` to last week → next access should reset
- [ ] Set user's plan to "plus" → should bypass all checks
- [ ] Check subscription page shows usage counter

## Configuration

### Timezone
Currently set to EST (UTC-5). To change:
- Edit `supabase/functions/check_profile_access/index.ts`
- Find `getMostRecentSunday()` function
- Adjust offset: `d.setHours(d.getHours() - 5)` (change `-5` to desired offset)

### Weekly Limit
Currently 20 profiles. To change:
- Edit edge function: Search for `>= 20` and `/ 20`
- Edit subscription page: Update text and calculations
- Update database constraint in migration file

### Warning Threshold
Currently triggers at 15 profiles. To change:
- Edit edge function: `if (accessResponse.showWarning && accessResponse.profilesUsed >= 15)`
- Edit subscription page progress bar color threshold

## Important Notes

1. **Profile ID Format**: Always use format `{id}ppl` or `{id}legi`
2. **Race Conditions**: Database constraint limits array to 20 entries max
3. **History Feature**: Existing history feature works automatically (users can revisit authorized profiles)
4. **Upgrade Flow**: Alert includes direct link to `/subscription` page
5. **Sunday Reset**: Happens lazily on first access, not via cron (simpler, no scheduled jobs needed)

## Future Enhancements (Optional)

1. **Analytics Dashboard**: Track which profiles are most accessed
2. **Swap Profiles**: Allow users to "swap out" one of their 20
3. **Preview Mode**: Let users see profile summary without using a slot
4. **Custom Limits**: Allow different limits per user/tier
5. **Historical Tracking**: Keep archive of past weeks for analytics

## Support

If issues arise:
1. Check edge function logs in Supabase dashboard
2. Verify database columns exist with correct types
3. Ensure user has correct `plan` value
4. Check console logs for API errors
5. Verify profile IDs are in correct format

