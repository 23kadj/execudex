# Authentication Setup for Execudex

This document explains how authentication is set up in the Execudex app using Supabase with Google OAuth.

## Current Setup

The app is configured with:
- **Supabase Project URL**: `https://tvvmkzoiicjrfjbmqzwc.supabase.co`
- **Authentication Provider**: Google OAuth (Apple will be added later)
- **Deep Link Scheme**: `execudex://`

## Components

### 1. Supabase Configuration (`lib/supabase.ts`)
- Configured with the provided project URL and anon key
- Uses AsyncStorage for session persistence
- Configured for React Native with URL polyfill

### 2. Authentication Provider (`components/AuthProvider.tsx`)
- Manages authentication state using React Context
- Provides `signInWithGoogle()` and `signOut()` functions
- Listens for auth state changes

### 3. Sign-In Screen (`components/SignInScreen.tsx`)
- Clean, modern UI matching the app's design
- Google sign-in button with loading states
- Error handling for failed sign-ins

### 4. Auth Callback Handler (`app/auth/callback.tsx`)
- Handles OAuth redirect from Google
- Processes authentication callback
- Redirects to main app on success

## Supabase Configuration Required

To complete the setup, you need to configure Google OAuth in your Supabase project:

### 1. Enable Google Provider
1. Go to your Supabase dashboard
2. Navigate to Authentication > Providers
3. Enable Google provider
4. Add your Google OAuth credentials

### 2. Configure OAuth Redirect URLs
Add these redirect URLs in your Google OAuth console:
- `https://tvvmkzoiicjrfjbmqzwc.supabase.co/auth/v1/callback`
- `execudex://auth/callback`

### 3. Update Supabase Settings
In your Supabase project settings, add:
- **Site URL**: `https://tvvmkzoiicjrfjbmqzwc.supabase.co`
- **Redirect URLs**: 
  - `execudex://auth/callback`
  - `https://tvvmkzoiicjrfjbmqzwc.supabase.co/auth/v1/callback`

## App Flow

1. **App Launch**: Shows splash screen
2. **Auth Check**: Checks for existing session
3. **Sign-In**: If no session, shows sign-in screen
4. **OAuth Flow**: User taps Google sign-in → redirects to Google → callback to app
5. **Main App**: After successful auth, shows main app with tabs
6. **Sign-Out**: Available in profile tab with confirmation dialog

## Features

- ✅ Google OAuth authentication
- ✅ Session persistence
- ✅ Loading states and error handling
- ✅ Sign-out functionality
- ✅ Deep linking support
- ✅ Clean, modern UI
- 🔄 Apple Sign-In (planned for future)

## Testing

To test the authentication flow:
1. Run the app: `npm start`
2. Tap "Continue with Google" on the sign-in screen
3. Complete Google OAuth flow
4. Should redirect back to main app
5. Check profile tab to see user email and sign-out option

## Troubleshooting

### Common Issues:
1. **OAuth redirect not working**: Check redirect URLs in Google console and Supabase
2. **Session not persisting**: Verify AsyncStorage is working
3. **Callback not handling**: Check deep link configuration in app.json

### Debug Steps:
1. Check console logs for auth errors
2. Verify Supabase project settings
3. Test deep linking manually
4. Check network requests in dev tools
