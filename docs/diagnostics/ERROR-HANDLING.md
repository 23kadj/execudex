# Profile Processing — Error Handling & Resilience

**Date:** October 7, 2025  
**Status:** Improved error handling for partial failures

---

## 🎯 Issue Encountered

**Error:** `ppl_metrics` Edge Function returning non-2xx status code

**Impact:** Entire profile processing failed if Step 3 (metrics) failed, even though Steps 1-2 succeeded.

---

## ✅ Resolution: Graceful Degradation

### What Changed

**Before (Fragile):**
```typescript
// Used Promise.all - any step failure = total failure
await Promise.all([
  executeStep2(...),
  executeStep3(...)
]);
// ❌ If ppl_metrics fails, entire processing fails
```

**After (Resilient):**
```typescript
// Uses Promise.allSettled - allows partial success
const results = await Promise.allSettled([...]);

// Check which steps succeeded/failed
results.forEach((result, idx) => {
  if (result.status === 'rejected') {
    console.warn(`Step ${stepName} failed:`, result.reason);
    // Continue processing (partial success)
  }
});

// Only throw if ALL steps failed
if (failures.length === stepPromises.length) {
  throw new Error(`All processing steps failed`);
}
```

---

## 🛡️ Resilience Strategy

### Partial Success Matrix

| Step 1 | Step 2 | Step 3 | Result | Profile State |
|--------|--------|--------|--------|---------------|
| ✅ | ✅ | ✅ | **Full Success** | Complete profile |
| ✅ | ✅ | ❌ | **Partial Success** | Profile with synopsis, no metrics |
| ✅ | ❌ | ✅ | **Partial Success** | Profile with metrics, no synopsis |
| ✅ | ❌ | ❌ | **Minimal Success** | Basic index only |
| ❌ | - | - | **Failure** | Processing failed |

**Key Principle:** Some data is better than no data.

---

## 📊 Improved Logging

### New Diagnostic Tags

| Tag | When | Meaning |
|-----|------|---------|
| `svc:step2:start` | Step 2 starts | `ppl_synopsis` invoked |
| `svc:step2:success` | Step 2 completes | Synopsis generated |
| `svc:step2:error` | Step 2 fails | Edge function error (with details) |
| `svc:step3:start` | Step 3 starts | `ppl_metrics` invoked |
| `svc:step3:success` | Step 3 completes | Metrics collected |
| `svc:step3:error` | Step 3 fails | Edge function error (with details) |
| `svc:partial-success` | Some steps fail | Lists failed steps |
| `svc:step-failed:ppl_metrics` | Specific step fails | Individual step failure |
| `svc:step-success:ppl_synopsis` | Specific step succeeds | Individual step success |

### Example Log Sequence (Partial Success)

```
[diag] svc:handleProfileOpen:called { politicianId: 123 }
[diag] svc:step2:start { politicianId: 123 }
[diag] svc:step3:start { politicianId: 123 }
[diag] svc:step2:success { politicianId: 123 }
[diag] svc:step3:error {
  politicianId: 123,
  errorName: 'FunctionsHttpError',
  errorMessage: 'Edge Function returned a non-2xx status code',
  errorContext: { ... }
}
[diag] svc:step-failed:ppl_metrics [FunctionsHttpError: ...]
[diag] svc:step-success:ppl_synopsis { politicianId: 123 }
[diag] svc:partial-success {
  politicianId: 123,
  failedSteps: ['ppl_metrics'],
  successCount: 1,
  totalSteps: 2
}
```

**Result:** Profile gets indexed, synopsis populates, but metrics are missing. User sees most content.

---

## 🔍 Understanding the ppl_metrics Error

### What Causes FunctionsHttpError?

**Possible Causes:**

1. **Edge Function Timeout** (most common)
   - Default timeout: 60s
   - Polling/scraping external APIs
   - Rate limiting from external sources

2. **Missing External API Keys**
   - Metrics step may call polling aggregators
   - Check `.env` for required keys

3. **Invalid Politician Data**
   - Profile doesn't exist in external databases
   - Name mismatch preventing lookups

4. **Edge Function Bug**
   - Check Supabase Edge Function logs
   - Look for stack traces

### How to Diagnose

**1. Check Supabase Edge Function Logs:**
```bash
# In Supabase dashboard:
Functions → ppl_metrics → Logs

# Look for:
- Request payload (was correct ID sent?)
- Error stack trace
- External API failures
```

**2. Check Diagnostic Logs (Client):**
```
[diag] svc:step3:error {
  errorName: 'FunctionsHttpError',
  errorMessage: '...',
  errorContext: { ... }  ← Check this for status code
}
```

**3. Test Edge Function Directly:**
```bash
curl -X POST https://your-project.supabase.co/functions/v1/ppl_metrics \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{"id": 123}'
```

---

## ✅ What to Expect Now

### Scenario 1: ppl_metrics Fails (Partial Success)

**User Experience:**
- Profile opens in ~20-25s (Steps 1-2 complete)
- Synopsis displays ✅
- Metrics missing ❌ (approval/disapproval not updated)
- Cards may generate (depends on synopsis success)

**Logs:**
```
✅ svc:step2:success
❌ svc:step3:error
✅ svc:partial-success { failedSteps: ['ppl_metrics'] }
✅ Profile marked as indexed
```

**Action:** Manual retry or investigate Edge function.

---

### Scenario 2: ppl_synopsis Fails (Less Likely)

**User Experience:**
- Profile opens in ~10s (Step 1 complete)
- Basic info displays (name, position)
- Synopsis missing ❌
- Metrics may populate ✅

**Logs:**
```
❌ svc:step2:error
✅ svc:step3:success
✅ svc:partial-success { failedSteps: ['ppl_synopsis'] }
```

---

### Scenario 3: All Steps Fail (Worst Case)

**User Experience:**
- Error thrown, caught by client
- Profile shows basic data from `ppl_index`
- User sees error message

**Logs:**
```
❌ svc:step2:error
❌ svc:step3:error
❌ Error: All processing steps failed: ppl_synopsis, ppl_metrics
❌ profile:processing:error
```

**Action:** Check Edge function health in Supabase dashboard.

---

## 🔧 Quick Fixes

### Fix 1: Increase Edge Function Timeout

If timeouts are common:

```typescript
// In Edge function code (supabase/functions/ppl_metrics/index.ts)
Deno.serve({
  handler: async (req) => {
    // ... existing code ...
  },
  // Increase timeout
  timeout: 120  // 2 minutes instead of 60s
});
```

### Fix 2: Skip Metrics Temporarily

If metrics consistently fail, disable Step 3:

```typescript
// In services/politicianProfileService.ts
const needsStep3 = false;  // Temporarily disable
// const needsStep3 = this.needsMetricsUpdate(profileData);
```

**Effect:** Profiles process faster, skip problematic step.

### Fix 3: Retry Failed Steps

Add retry logic (future enhancement):

```typescript
const maxRetries = 2;
let attempt = 0;
while (attempt < maxRetries) {
  try {
    await this.executeStep3(politicianId);
    break;
  } catch (error) {
    attempt++;
    if (attempt === maxRetries) throw error;
    await new Promise(r => setTimeout(r, 5000)); // Wait 5s
  }
}
```

---

## 📋 Monitoring Checklist

### Metrics to Track

- [ ] **Step 2 Success Rate** → Target: > 95%
- [ ] **Step 3 Success Rate** → Target: > 90% (may be lower due to external APIs)
- [ ] **Partial Success Rate** → Monitor trend
- [ ] **Full Failure Rate** → Target: < 5%

### Alert Thresholds

| Condition | Threshold | Action |
|-----------|-----------|--------|
| Step 2 failures | > 10% | Investigate `ppl_synopsis` Edge function |
| Step 3 failures | > 20% | Check external API quotas/keys |
| Full failures | > 5% | Check Supabase health, DB access |
| Partial success | > 30% | Acceptable if Step 3 is problematic |

---

## 🚀 What This Means for Your Test

**You saw:** `Error in Step 3 (ppl_metrics)` with stack trace

**What actually happened:**
1. ✅ Fix is working (processing WAS called!)
2. ✅ Step 1 (profile_index) likely completed
3. ✅ Step 2 (ppl_synopsis) likely completed
4. ❌ Step 3 (ppl_metrics) failed at Edge function
5. ✅ **NEW:** Profile still gets marked as indexed (partial success)
6. ✅ **NEW:** User sees synopsis even though metrics failed

**Before this improvement:**
- Entire processing would fail
- Profile stays `indexed = false`
- User sees nothing

**After this improvement:**
- Processing succeeds partially
- Profile marked `indexed = true`
- User sees synopsis, basic info, possibly cards
- Only metrics missing

---

## 🧪 Test Again

**Re-run the same test:**

1. Enable diagnostics (already on)
2. Open a fresh profile
3. Look for **new logs:**

```
✅ [diag] svc:step-failed:ppl_metrics
✅ [diag] svc:partial-success {
     failedSteps: ['ppl_metrics'],
     successCount: 1,
     totalSteps: 2
   }
✅ [diag] profile:processing:complete  ← Still completes!
```

4. Check UI: Profile should display synopsis even if metrics failed

---

## 📞 Next Steps

### Immediate (You)
1. Re-test with improved error handling
2. Check if synopsis populates despite metrics failure
3. Review Supabase Edge function logs for `ppl_metrics`

### Short-term (If ppl_metrics keeps failing)
1. Investigate Edge function directly
2. Check external API keys/quotas
3. Consider increasing timeout
4. Or: Disable Step 3 temporarily

### Long-term (Production)
1. Add retry logic with exponential backoff
2. Make metrics optional (non-blocking)
3. Add background job to retry failed steps
4. Monitor partial success rates

---

**The key insight:** Your fix is working! The processing IS being called. The `ppl_metrics` failure is a **server-side issue**, not a problem with the client-side fix. And now the client handles it gracefully. 🎉

