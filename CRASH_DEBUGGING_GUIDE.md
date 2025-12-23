# Crash Debugging Guide - Concepts & Questions

## 1. Module-Scope Logger Explained

### What is "Module Scope"?
**Module scope** = Code that runs when the file is first loaded/imported, BEFORE React renders anything.

### Example (BAD - Module Scope):
```typescript
// app/profile/see-more.tsx
import { persistentLogger } from '../../utils/persistentLogger';

// ❌ THIS RUNS IMMEDIATELY WHEN FILE IS IMPORTED
// Runs even before the component function is called
persistentLogger.log('see-more:module_loaded').catch(() => {});

export default function SeeMore() {
  // Component code here
}
```

**Problem**: When Expo Router resolves the route `/profile/see-more`, it imports the file. The module-scope code runs immediately, which might:
- Access native modules (AsyncStorage, FileSystem) before they're ready
- Cause crashes in Preview builds where native modules load differently
- Execute before error boundaries are set up

### Example (GOOD - Inside Component):
```typescript
// app/profile/see-more.tsx
import { persistentLogger } from '../../utils/persistentLogger';

export default function SeeMore() {
  // ✅ THIS RUNS INSIDE THE COMPONENT
  // Only executes when React actually renders the component
  useEffect(() => {
    persistentLogger.log('see-more:mounted').catch(() => {});
  }, []);
  
  // Component code here
}
```

**Why it matters for see-more.tsx**: The crash happens BEFORE the component renders. If module-scope code tries to access native modules during route resolution, it can crash instantly.

---

## 2. Lazy Loading for Supabase Explained

### What is Lazy Loading?
**Lazy loading** = Only loading/initializing something when you actually need it, not when the file is imported.

### Example (BAD - Eager Loading):
```typescript
// utils/supabase.ts
import AsyncStorage from '@react-native-async-storage/async-storage'; // ❌ Loads immediately

// ❌ Client created immediately when file is imported
export const supabase = createClient(URL, KEY, {
  auth: { storage: AsyncStorage }
});
```

**Problem**: 
- When ANY file imports from `utils/supabase.ts`, AsyncStorage loads immediately
- AsyncStorage is a native module - requires native bridge
- In Preview builds, native modules might not be ready when file is imported
- Can cause crashes during app startup

### Example (GOOD - Lazy Loading):
```typescript
// utils/supabase.ts
// ✅ No imports at top level

let supabaseClient = null; // ✅ Not created yet

export function getSupabaseClient() {
  if (supabaseClient) {
    return supabaseClient; // ✅ Return existing if already created
  }
  
  // ✅ Only load AsyncStorage when this function is called
  const AsyncStorage = require('@react-native-async-storage/async-storage').default;
  
  // ✅ Only create client when actually needed
  supabaseClient = createClient(URL, KEY, {
    auth: { storage: AsyncStorage }
  });
  
  return supabaseClient;
}
```

**Benefits**:
- AsyncStorage only loads when `getSupabaseClient()` is called
- Client only created when actually needed
- Native modules load at runtime, not at import time
- Safer for Preview builds

---

## 3. New Architecture + Other Solutions

### Can New Architecture Need Combined Solutions?
**YES!** New Architecture (Fabric/TurboModules) changes how native modules communicate with JS. It might need:

1. **Version Alignment**: React 19.1.0 + React Native 0.81.5 + Expo SDK 54 must all be compatible
2. **Native Module Updates**: Some libraries might need updates for New Architecture
3. **Build Configuration**: EAS build might need specific settings
4. **Code Patterns**: Some code patterns that work in old architecture fail in new

### How to Test New Architecture:
1. **Disable it** (`"newArchEnabled": false`) → Build → Test
2. **Enable it** (`"newArchEnabled": true`) → Build → Test
3. **Compare**: If disabling fixes crashes, New Architecture is the issue
4. **Check compatibility**: Verify all dependencies support New Architecture

### Testing Strategy:
```bash
# Test 1: Disable New Architecture
# Edit app.json: "newArchEnabled": false
eas build --platform ios --profile preview

# Test 2: Enable New Architecture  
# Edit app.json: "newArchEnabled": true
eas build --platform ios --profile preview

# Compare results
```

---

## 4. EAS Build Commands

### For TestFlight (Production Build):
```bash
# Build for TestFlight (requires App Store Connect setup)
eas build --platform ios --profile production

# Or if you have a specific profile:
eas build --platform ios --profile production --non-interactive
```

### For Preview Build (Internal Testing):
```bash
# Preview build (what you've been using)
eas build --platform ios --profile preview
```

### Check Your EAS Config:
Look in `eas.json` to see available profiles:
```json
{
  "build": {
    "preview": {
      "distribution": "internal",
      "ios": {
        "simulator": false
      }
    },
    "production": {
      "distribution": "store",
      "ios": {
        "simulator": false
      }
    }
  }
}
```

---

## 5. Clarifying Questions About Crashes

Please answer these to help diagnose:

### Crash Timing:
1. **When exactly does it crash?**
   - [ ] Immediately when tapping "See Metrics" button
   - [ ] During navigation transition (you see animation start)
   - [ ] After navigation completes but before screen renders
   - [ ] Screen renders but then crashes

2. **What do you see before crash?**
   - [ ] Nothing (instant crash)
   - [ ] Brief flash of previous screen
   - [ ] Navigation animation starts
   - [ ] Loading indicator appears

### Crash Pattern:
3. **Does it crash 100% of the time or sometimes?**
   - [ ] Always crashes
   - [ ] Sometimes works, sometimes crashes
   - [ ] Works first time, crashes on subsequent attempts

4. **Does it crash on other screens too?**
   - [ ] Only "See More" screen
   - [ ] Other profile screens crash too
   - [ ] Other navigation crashes
   - [ ] Only Preview builds, dev mode works fine

### Device/Environment:
5. **What device are you testing on?**
   - [ ] Physical iPhone (which model?)
   - [ ] iOS Simulator
   - [ ] Both

6. **iOS version?**
   - [ ] iOS 17.x
   - [ ] iOS 18.x
   - [ ] Other: _____

### Error Messages:
7. **Do you see any error messages?**
   - [ ] No error, just instant crash
   - [ ] "App crashed" message
   - [ ] Error in Xcode console (if available)
   - [ ] Error in Expo logs

8. **In Preview build, can you access debug screens?**
   - [ ] Yes, `/debug-logs` works
   - [ ] Yes, `/debug-flags` works
   - [ ] No, app crashes before I can navigate
   - [ ] Haven't tried

### Search Functionality:
9. **Search crashes too, or just "See More"?**
   - [ ] Search also crashes
   - [ ] Search shows "failed to load results" but doesn't crash
   - [ ] Search works fine

10. **When does search fail?**
    - [ ] When typing in search box
    - [ ] When submitting search
    - [ ] When viewing results
    - [ ] When clicking a result

### Previous Attempts:
11. **When you disabled New Architecture, did you:**
    - [ ] Rebuild the Preview build after changing app.json?
    - [ ] Test on the same device?
    - [ ] See any difference at all?

12. **When you changed React versions, did you:**
    - [ ] Run `npx expo install --fix`?
    - [ ] Clear node_modules and reinstall?
    - [ ] Rebuild after version changes?

---

## Next Steps

After you answer these questions, I'll:
1. Restore `app/index.tsx` with proper onboarding
2. Fix Supabase query syntax
3. Provide targeted solutions based on your answers










