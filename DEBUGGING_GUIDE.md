# Profile Processing Debugging Guide

## Where to Find Edge Function JSON Responses

### In Your CMD/Terminal
When scripts run in your app, the **full JSON response** is now logged to the console. Look for these log patterns:

```
===== PROFILE_INDEX FULL RESPONSE =====
Politician ID: 116
Error: None
Data: { "ok": true, "id": 116, ... }
=======================================

===== PPL_SYNOPSIS FULL RESPONSE =====
Politician ID: 116
Error: None  
Data: { "ok": true, "synopsis": "...", ... }
======================================
```

These logs are added in `services/politicianProfileService.ts`:
- **Lines 632-637**: `profile_index` response
- **Lines 674-679**: `ppl_synopsis` response
- **Lines 774-789**: `ppl_metrics` response (in generateMetricsManually)

### In Supabase Edge Function Logs
Go to your Supabase Dashboard → Edge Functions → Select function → Logs tab

Each Edge Function now has detailed step-by-step logging with `[PROFILE_INDEX]` prefixes.

---

## What Changed - Detailed Logging

### Profile Index Script (`supabase/functions/profile_index/index.ts`)

Added comprehensive logging at each step:

1. **Line 968**: `[PROFILE_INDEX] ===== START`
2. **Line 971**: Step 0 - Weekly visits tracking
3. **Line 975**: Step 1 - Fetching ppl_index row
4. **Line 989**: Step 2 - Checking existing storage
5. **Line 1004**: Step 3 - Fetching Wikipedia content
   - **Line 1008**: Searching Wikipedia
   - **Line 1013**: SUCCESS or FAIL
   - **Line 1016**: Fallback attempt if Wikipedia fails
   - **Line 1038**: Storing content
6. **Line 1048**: Step 4 - Extracting fields with Mistral
7. **Line 1081**: Step 5 - Computing limit score/tier
8. **Line 1099**: Step 6 - Updating ppl_index table
9. **Line 1121**: `[PROFILE_INDEX] ===== COMPLETE`

---

## Potential Failure Points in Profile Index

Based on the code analysis, here's what could cause the "EarlyDrop" timeout:

### 1. **Wikipedia Fetch Timeout (Most Likely)**
**Location**: Lines 1009-1013  
**Timeout**: 15 seconds (WIKI_TIMEOUT_MS)  
**Issue**: Large Wikipedia pages or slow network  
**Fix**: Script handles this with fallback searches

### 2. **Storage Operations**
**Location**: Lines 1038-1041  
**Issue**: Writing large Wikipedia content (100k+ chars) to storage  
**Fix**: Uses chunking (110k per part)

### 3. **Mistral API Calls**
**Location**: Line 1050 (extractPersonFields)  
**Issue**: Slow AI extraction, especially for large Wikipedia pages  
**Timeout**: Varies based on text length  
**Fix**: Text is pre-processed to manageable sizes

### 4. **Fallback Search Chain**
**Location**: Lines 1016-1034  
**Issue**: When Wikipedia fails, tries findFallbackPersonUrl → webExtractOneWithRetry  
This can add 20-30 seconds  
**Fix**: Marks profile as "weak" and continues

### 5. **Concurrent Operations**
**Default**: 8 concurrent operations  
**Issue**: Can overwhelm Edge Function memory (14MB in your logs)  
**Fix**: Adjust CONCURRENCY_DEFAULT env variable

---

## Why Profile Showed "No Data Available"

### The Flow:
1. ✅ `profile_index` started (your logs show boot at 01:49:35)
2. ⏱️ Ran for 75 seconds
3. ❌ **"EarlyDrop"** - Edge Function was killed (timeout/memory)
4. ✅ `ppl_synopsis` started 2 seconds later (01:49:37)
5. ❓ Synopsis completion not in logs (likely also timed out or failed)
6. ❌ **No ppl_profiles row created** (synopsis creates this)
7. 🔄 App tried to fetch profile data with `.single()`
8. 💥 **PGRST116 error** - "0 rows returned"

### Why No Crash Now:
- Changed `.single()` to `.maybeSingle()` in:
  - `app/index1.tsx` (lines 88, 136)
  - `app/profile/synop.tsx` (lines 82, 149, 375)
- App now gracefully handles missing data

---

## Specific Case: Politician ID 116

Based on your logs, here's what likely happened:

```
[PROFILE_INDEX] Step 1: Found politician
[PROFILE_INDEX] Step 2: No existing storage
[PROFILE_INDEX] Step 3: Searching Wikipedia...
[PROFILE_INDEX] Step 3: Fetching Wikipedia content...
  ⏱️ (This likely took 30-50 seconds for a large Wikipedia page)
[PROFILE_INDEX] Step 3b: Storing content...
  ⏱️ (Large content = slow storage write)
[PROFILE_INDEX] Step 4: Extracting with Mistral...
  ⏱️ (Processing large text = slow)
⚠️  Total time exceeded 75 seconds → KILLED by Edge runtime
```

**Result**: profile_index never completed, so ppl_index was only partially updated (no tier, no limit_score saved).

---

## How to Debug Next Time

### 1. Check CMD Console
Look for the boxed response logs:
```
===== PROFILE_INDEX FULL RESPONSE =====
```

### 2. Check Supabase Logs
Go to Dashboard → Edge Functions → profile_index → Logs

Look for:
- Which step it got to
- Any `[PROFILE_INDEX] FAIL:` messages
- Memory usage in shutdown event

### 3. Check Database Directly
```sql
-- Check if row exists in ppl_profiles
SELECT * FROM ppl_profiles WHERE index_id = 116;

-- Check ppl_index for partial updates
SELECT id, name, tier, limit_score, weak, indexed 
FROM ppl_index WHERE id = 116;
```

### 4. Common Patterns

**Pattern A: Wikipedia Timeout**
```
[PROFILE_INDEX] Searching Wikipedia for "Name"
[No further logs]
→ Stuck fetching Wikipedia
```

**Pattern B: Large Page Processing**
```
[PROFILE_INDEX] SUCCESS: Fetched 250000 characters
[PROFILE_INDEX] Step 3b: Storing content...
[No further logs]
→ Stuck writing to storage
```

**Pattern C: Mistral Extraction Timeout**
```
[PROFILE_INDEX] Step 4: Extracting person fields
[No further logs]
→ Stuck in AI extraction
```

---

## Solutions

### Short Term:
1. **Retry the profile** - Often works on second attempt (storage cached)
2. **Check politician name** - Obscure politicians may lack Wikipedia pages
3. **Wait for manual metrics** - Use "Generate Metrics" button when needed

### Long Term:
1. **Increase Edge Function timeout** (Supabase settings)
2. **Add progress checkpoints** - Resume from last successful step
3. **Implement queue system** - Process in background, notify when ready
4. **Add cache layer** - Store partial results to avoid reprocessing

---

## Testing the New Logging

### To test, open a profile and watch your CMD:

**Expected Output:**
```
Executing profile_index for ID 116
===== PROFILE_INDEX FULL RESPONSE =====
Politician ID: 116
Error: None
Data: {
  "ok": true,
  "id": 116,
  "updated": { "tier": "soft", "limit_score": 0.65 },
  "url": "https://en.wikipedia.org/wiki/..."
}
=======================================
profile_index completed successfully

Executing ppl_synopsis for ID 116
===== PPL_SYNOPSIS FULL RESPONSE =====
Politician ID: 116
Error: None
Data: {
  "ok": true,
  "synopsis": "...",
  ...
}
======================================
ppl_synopsis completed successfully
```

**If Something Fails:**
```
===== PROFILE_INDEX FULL RESPONSE =====
Politician ID: 116
Error: {
  "message": "Failed to fetch Wikipedia",
  "details": "..."
}
Data: None
=======================================
```

---

## Summary

- ✅ **Added detailed logging** to profile_index Edge Function
- ✅ **Added response logging** to app service calls
- ✅ **Fixed crash** on missing data (maybeSingle)
- ✅ **Removed metrics** from initial processing
- ✅ **Added manual metrics** generation button

**Next profile you open will show you exactly where it fails!**

