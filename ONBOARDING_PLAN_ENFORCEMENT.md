# Onboarding Plan Enforcement Implementation

## Overview
This document describes the implementation of plan/subscription enforcement in the authentication and onboarding flow. Users must now complete onboarding and select a plan before accessing the main application.

## Changes Made

### 1. Sign-In Screen (`components/SignInScreen.tsx`)
**Changes:**
- Modified `handleEmailAuth` to check if user has a plan after successful authentication
- Queries the `users` table to check for `plan` field
- If user has no plan (null, empty, or missing), redirects to onboarding page (`/`) with an alert
- Only allows access to home screen (`/(tabs)/home`) if user has completed plan selection

**Lines Modified:** [49:116](components/SignInScreen.tsx#L49-L116)

### 2. Auth Provider (`components/AuthProvider.tsx`)
**Changes:**
- Updated `signInWithEmail` return type from `Promise<void>` to `Promise<User | null>`
- Updated `signUpWithEmail` return type from `Promise<void>` to `Promise<User | null>`
- Both functions now return the authenticated user object for downstream plan checking

**Lines Modified:**
- [5:14](components/AuthProvider.tsx#L5-L14) - Type definitions
- [58:70](components/AuthProvider.tsx#L58-L70) - signInWithEmail implementation
- [72:84](components/AuthProvider.tsx#L72-L84) - signUpWithEmail implementation

### 3. Auth Callback Handler (`app/auth/callback.tsx`)
**Changes:**
- Updated OAuth callback handler to check user plan status after authentication
- Extracts user ID from authentication response
- Queries `users` table to verify plan selection
- Redirects to onboarding (`/`) if no plan found
- Only navigates to home if user has completed plan selection

**Lines Modified:** [10:64](app/auth/callback.tsx#L10-L64)

### 4. Save Onboard Data Edge Function (`supabase/functions/save_onboard_data/index.ts`)
**Changes:**
- **Required Fields:** Now requires `plan` parameter in addition to `uuid` and `onboardData`
- **User Creation:** Creates user row with plan data if it doesn't exist (handles case where trigger hasn't created it yet)
- **User Update:** Updates existing user row with plan data if row exists
- **Plan Enforcement:** User data is only saved when a plan is selected during onboarding
- **Race Condition Handling:** Handles scenario where database trigger creates row simultaneously with insert attempt

**Lines Modified:**
- [28:40](supabase/functions/save_onboard_data/index.ts#L28-L40) - Validation
- [64:175](supabase/functions/save_onboard_data/index.ts#L64-L175) - Insert/Update logic

## Flow Diagram

```
User Sign-Up
    ↓
Auth Account Created (Supabase Auth)
    ↓
User Goes Through Onboarding Steps
    ↓
User Selects Plan
    ↓
save_onboard_data creates/updates users table row WITH plan
    ↓
User can access main app

──────────────────────────────────

Existing User Sign-In
    ↓
Check if user has plan in users table
    ↓
    ├─ Has Plan → Allow access to home
    └─ No Plan → Redirect to onboarding with prompt
```

## Database Schema Requirements

The `users` table must have these columns:
- `uuid` (UUID) - References auth.users(id)
- `onboard` (TEXT) - Onboarding answers
- `plan` (TEXT) - Subscription plan ('basic', 'plus', etc.)
- `cycle` (TEXT) - Billing cycle ('monthly', 'quarterly')

## User Experience

### New Users
1. Create account with email/password
2. Complete onboarding questionnaire
3. **Must select a subscription plan**
4. Only then gain access to main application

### Existing Users Without Plan
1. Attempt to sign in
2. Receive alert: "Please complete your onboarding and select a subscription plan to continue"
3. Redirected to onboarding page to complete plan selection
4. After selecting plan, can access main application

### Existing Users With Plan
1. Sign in normally
2. Immediate access to main application

## Security Considerations

- Plan checking happens on both client-side (React Native) and server-side (Edge Functions)
- User authentication still works through Supabase Auth (unchanged)
- User profile data only created/updated when plan is selected
- No unauthorized access to main app without plan selection

## Testing Checklist

- [ ] New user signs up and completes onboarding with plan selection
- [ ] New user signs up but tries to skip plan selection (should not be possible)
- [ ] Existing user with plan signs in (should work normally)
- [ ] Existing user without plan signs in (should be redirected to onboarding)
- [ ] OAuth callback checks plan status correctly
- [ ] Edge function validates plan parameter is present
- [ ] Edge function creates user row with plan when needed
- [ ] Edge function updates existing user row with plan

## Migration Notes

**For Existing Users Without Plans:**
If you have existing users in your `users` table without a `plan` value, they will be prompted to complete onboarding on their next sign-in. Consider:
1. Running a migration to assign default plans to existing users, OR
2. Forcing all existing users through onboarding on next login (current behavior)

**SQL to assign default plan to existing users:**
```sql
UPDATE users 
SET plan = 'basic', cycle = 'monthly' 
WHERE plan IS NULL OR plan = '';
```

## Maintenance

When modifying the onboarding flow:
1. Ensure plan selection step remains mandatory
2. Keep plan parameter required in `save_onboard_data` function
3. Maintain plan checks in sign-in and callback flows
4. Update validation logic if new subscription tiers are added

