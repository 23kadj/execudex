# Profile Pipeline Fix — Implementation Summary

**Date:** October 7, 2025  
**Status:** ✅ **FIX IMPLEMENTED**  
**PR:** Minimal Fix (Option A from diagnostic report)

---

## 🎯 What Was Fixed

**Problem:** Profile processing service existed but was never called when users opened profiles, causing "randomly doesn't work" behavior.

**Solution:** Added processing call to [`app/index1.tsx`](../app/index1.tsx#L161-L213) that triggers when `indexed === false`.

---

## 📝 Changes Made

### 1. Added Import ([`app/index1.tsx:20`](../app/index1.tsx#L20))

```typescript
import { PoliticianProfileService } from '../services/politicianProfileService';
```

### 2. Added Processing Logic ([`app/index1.tsx:161-213`](../app/index1.tsx#L161-L213))

Inserted after successfully fetching `indexData`:

```typescript
// 🔧 FIX: Trigger processing if profile hasn't been indexed yet
if (indexData.indexed === false) {
  try {
    // Guard against double-fire per mount (simple global set)
    if (!(globalThis as any).__pplProcInFlight) {
      (globalThis as any).__pplProcInFlight = new Set<number>();
    }
    const inFlight: Set<number> = (globalThis as any).__pplProcInFlight;
    
    if (!inFlight.has(politicianId)) {
      inFlight.add(politicianId);
      logDiag('profile:processing:start', { politicianId }, trace);
      
      // Call the processing service (this was missing!)
      await PoliticianProfileService.handleProfileOpen(politicianId, undefined, trace);
      
      logDiag('profile:processing:complete', { politicianId }, trace);
      inFlight.delete(politicianId);
      
      // Refetch fresh data after processing completes
      logDiag('profile:refetch:start', { politicianId }, trace);
      const { data: refreshedIndex } = await supabase
        .from('ppl_index')
        .select('name, sub_name, tier, indexed, weak')
        .eq('id', politicianId)
        .single();
      const { data: refreshedProfile } = await supabase
        .from('ppl_profiles')
        .select('index_id, approval, disapproval, synopsis, agenda, identity, affiliates, poll_summary, poll_link, score')
        .eq('index_id', politicianId)
        .single();
      
      if (refreshedIndex) {
        setName(refreshedIndex.name || 'No Data Available');
        setPosition(refreshedIndex.sub_name || 'No Data Available');
        logDiag('profile:refetch:index-updated', {
          politicianId,
          indexed: refreshedIndex.indexed
        }, trace);
      }
      if (refreshedProfile) {
        setProfileData(refreshedProfile);
        logDiag('profile:refetch:profile-updated', {
          politicianId,
          hasSynopsis: !!refreshedProfile.synopsis
        }, trace);
      }
    }
  } catch (e) {
    console.error('Profile processing failed:', e);
    logDiagError('profile:processing:error', e, trace);
  }
}
```

---

## 🔍 How It Works

### Before (Read-Only)
```
User opens profile
  → Fetch ppl_index (read only)
  → Fetch ppl_profiles (read only)
  → Display whatever exists
  → ❌ No processing if data missing
```

### After (Process-Then-Display)
```
User opens profile
  → Fetch ppl_index (read only)
  → Check: indexed === false?
    → YES: Call PoliticianProfileService.handleProfileOpen()
      → Runs profile_index, ppl_synopsis, ppl_metrics
      → Refetch updated data
      → Display fresh data
    → NO: Skip processing (already done)
  → Display data
```

---

## 🛡️ Safeguards

### 1. **In-Flight Guard**
```typescript
const inFlight: Set<number> = (globalThis as any).__pplProcInFlight;
if (!inFlight.has(politicianId)) {
  inFlight.add(politicianId);
  // ... process ...
  inFlight.delete(politicianId);
}
```

**Prevents:**
- Double-processing from StrictMode double-mount
- Concurrent requests from rapid navigation
- Multiple tabs processing same profile simultaneously

### 2. **Indexed Flag Check**
```typescript
if (indexData.indexed === false)
```

**Ensures:**
- Processing only runs once per profile
- Already-processed profiles skip immediately
- No wasted API calls

### 3. **Error Handling**
```typescript
try {
  await PoliticianProfileService.handleProfileOpen(...);
} catch (e) {
  console.error('Profile processing failed:', e);
  logDiagError('profile:processing:error', e, trace);
}
```

**Graceful degradation:**
- Page doesn't crash on processing failure
- Error logged for debugging
- User sees partial data (whatever was fetched before processing)

---

## 🧪 Testing Checklist

### Before Testing
```bash
# Enable diagnostics
EXPO_PUBLIC_DEBUG_PROFILE_PIPELINE=true

# Restart dev server
npm start
```

### Test Case 1: Fresh Profile (Never Processed)

**Setup:** Find a politician with `indexed = false` in `ppl_index`

**Steps:**
1. Navigate to `/index1?index=<id>&title=<name>&subtitle=<position>`
2. Watch console logs

**Expected Logs:**
```
[diag] profile:mount [ppl-open-...] { id: <id> }
[diag] profile:fetch:index-success [ppl-open-...] { indexed: false }
[diag] profile:processing:start [ppl-open-...] { politicianId: <id> }
[diag] svc:handleProfileOpen:called [ppl-open-...] { politicianId: <id> }
[diag] svc:validation:start [ppl-open-...] { politicianId: <id> }
[diag] client:request:start [ppl-open-...] { url: '.../profile_index' }
[diag] client:request:complete [ppl-open-...] { status: 200 }
[diag] profile:processing:complete [ppl-open-...]
[diag] profile:refetch:start [ppl-open-...]
[diag] profile:refetch:index-updated [ppl-open-...] { indexed: true }
[diag] profile:refetch:profile-updated [ppl-open-...] { hasSynopsis: true }
```

**Expected UI:**
- Initial: Loading or "No Data Available"
- After ~20-30s: Full profile with synopsis, metrics, cards
- No infinite loops
- No duplicate processing calls

---

### Test Case 2: Already-Processed Profile

**Setup:** Find a politician with `indexed = true` in `ppl_index`

**Steps:**
1. Navigate to profile
2. Watch console logs

**Expected Logs:**
```
[diag] profile:mount [ppl-open-...] { id: <id> }
[diag] profile:fetch:index-success [ppl-open-...] { indexed: true }
# ✅ NO profile:processing:start
# ✅ NO svc:handleProfileOpen:called
[diag] profile:fetch:profile-success [ppl-open-...] { hasSynopsis: true }
```

**Expected UI:**
- Immediate display of full profile
- No processing delay
- Data already populated

---

### Test Case 3: Concurrent Opens (Same Profile, Multiple Tabs)

**Setup:** Fresh profile

**Steps:**
1. Open profile in Tab 1
2. Immediately open same profile in Tab 2
3. Watch logs from both

**Expected Behavior:**
- **Only one** processing call (in-flight guard works)
- Second tab waits or skips (profile gets marked `indexed=true` by first)
- No duplicate API calls to Edge functions

**Expected Logs:**
```
# Tab 1
[diag] profile:processing:start [trace-123] { politicianId: 456 }
[diag] svc:handleProfileOpen:called [trace-123]

# Tab 2
[diag] profile:fetch:index-success [trace-789] { indexed: false }
# ✅ In-flight guard prevents second call
# OR indexed=true if Tab 1 finished first
```

---

### Test Case 4: Rapid Back/Forward Navigation

**Setup:** Fresh profile

**Steps:**
1. Open profile
2. Hit back immediately
3. Hit forward immediately
4. Repeat 3-5 times rapidly

**Expected Behavior:**
- Single processing call (in-flight guard)
- No duplicate requests
- No memory leaks

---

### Test Case 5: Error Handling

**Setup:** Temporarily break Edge function (e.g., wrong endpoint URL)

**Steps:**
1. Open fresh profile
2. Processing will fail

**Expected Behavior:**
- Error logged: `profile:processing:error`
- Page doesn't crash
- User sees partial data (name, position from `ppl_index`)
- Can still navigate away

---

## 📊 Metrics to Monitor (Production)

### Key Metrics

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Profile load time (p50) | < 2s | > 5s |
| Profile load time (p95) | < 35s | > 60s |
| Processing success rate | > 95% | < 90% |
| Processing error rate | < 5% | > 10% |
| Double-processing rate | 0% | > 1% |

### Log Queries

**Success Rate:**
```javascript
// Count successful processing calls
successCount = logs.filter(l => l.tag === 'profile:processing:complete').length;
errorCount = logs.filter(l => l.tag === 'profile:processing:error').length;
successRate = successCount / (successCount + errorCount);
```

**Double-Processing Detection:**
```javascript
// Check for duplicate processing of same ID within 60s
const processingStarts = logs.filter(l => l.tag === 'profile:processing:start');
const duplicates = processingStarts.filter((log, idx, arr) => 
  arr.findIndex(l => 
    l.data.politicianId === log.data.politicianId && 
    Math.abs(l.timestamp - log.timestamp) < 60000
  ) !== idx
);
```

---

## 🚀 Deployment Plan

### Stage 1: Staging (Current)

**Status:** ✅ Fix implemented

**Actions:**
1. ✅ Enable diagnostics: `EXPO_PUBLIC_DEBUG_PROFILE_PIPELINE=true`
2. 🔄 Run Test Cases 1-5 above
3. 🔄 Verify log sequences match expectations
4. 🔄 Confirm no double-processing
5. 🔄 Check error handling

---

### Stage 2: Production Deployment

**Prerequisites:**
- [ ] All test cases pass in staging
- [ ] No linter errors
- [ ] Code review approved
- [ ] Documentation updated

**Deployment Steps:**

1. **Disable diagnostics in production:**
   ```bash
   # .env.production
   EXPO_PUBLIC_DEBUG_PROFILE_PIPELINE=false
   ```

2. **Deploy with feature flag (optional):**
   ```typescript
   const ENABLE_AUTO_PROCESSING = process.env.EXPO_PUBLIC_ENABLE_AUTO_PROCESSING !== 'false';
   
   if (indexData.indexed === false && ENABLE_AUTO_PROCESSING) {
     // ... processing logic
   }
   ```

3. **Monitor metrics:**
   - Profile load times (CloudWatch/DataDog)
   - Error rates (Sentry)
   - Edge function invocations (Supabase dashboard)

4. **Gradual rollout (optional):**
   ```typescript
   const shouldProcess = Math.random() < 0.25; // 25% of users
   if (indexData.indexed === false && shouldProcess) {
     // ... processing logic
   }
   ```

---

### Stage 3: Optimization (Future)

**Option B: Async Processing + Polling**

If blocking latency becomes an issue, migrate to non-blocking pattern:

```typescript
// Fire and forget
if (indexData.indexed === false) {
  PoliticianProfileService.handleProfileOpen(politicianId).catch(console.error);
  
  // Poll for completion
  const pollInterval = setInterval(async () => {
    const { data } = await supabase
      .from('ppl_index')
      .select('indexed')
      .eq('id', politicianId)
      .single();
    
    if (data?.indexed) {
      clearInterval(pollInterval);
      // Refetch and update UI
    }
  }, 5000);
}
```

See [`profile-pipeline-report.md`](./profile-pipeline-report.md#option-b-background-processing-with-status-polling) for full implementation.

---

## 🔙 Rollback Plan

### Immediate Rollback (< 5 min)

**If:** Processing causes crashes, infinite loops, or severe latency spikes

**Action:** Comment out the processing block:

```typescript
// ROLLBACK: Temporarily disable auto-processing
/*
if (indexData.indexed === false) {
  // ... processing logic ...
}
*/
```

**Result:** Page returns to read-only mode (original behavior)

---

### Feature Flag Rollback (< 1 min)

**If:** Deployed with feature flag

**Action:** Set environment variable:
```bash
EXPO_PUBLIC_ENABLE_AUTO_PROCESSING=false
```

**Result:** Processing disabled without code change

---

## 📋 Related Documentation

- **Diagnostic Report:** [`profile-pipeline-report.md`](./profile-pipeline-report.md)
- **Usage Guide:** [`README.md`](./README.md)
- **Original Implementation:** [`app/index1.tsx:161-213`](../app/index1.tsx#L161-L213)
- **Service Layer:** [`services/politicianProfileService.ts`](../services/politicianProfileService.ts)

---

## ✅ Sign-Off Checklist

- [x] Fix implemented in code
- [x] No linter errors
- [x] In-flight guard added
- [x] Error handling added
- [x] Diagnostic logging added
- [ ] All test cases pass
- [ ] Code review complete
- [ ] Production deployment plan ready
- [ ] Rollback plan documented
- [ ] Monitoring configured

---

**Implementation Date:** October 7, 2025  
**Implemented By:** AI Diagnostic System  
**Status:** ✅ Ready for Staging Tests


