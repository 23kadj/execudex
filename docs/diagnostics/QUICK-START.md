# ✅ Profile Pipeline Fix — Ready to Test

**Status:** Fix implemented and ready for staging validation  
**Time to Test:** 5 minutes  
**Next Step:** Turn on diagnostics and open a fresh profile

---

## 🎯 What Just Happened

✅ **Root cause diagnosed:** Processing service existed but was never called  
✅ **Fix implemented:** Added processing call to [`app/index1.tsx:161-213`](../app/index1.tsx#L161-L213)  
✅ **Safeguards added:** In-flight guard, error handling, diagnostic logging  
✅ **No linter errors:** All checks pass

**The "randomly doesn't work" bug should now be fixed.**

---

## 🚀 Test It Right Now (5 min)

### 1. Enable Diagnostics

Add to your `.env` or `.env.local`:
```bash
EXPO_PUBLIC_DEBUG_PROFILE_PIPELINE=true
```

### 2. Restart Dev Server
```bash
# Stop current server (Ctrl+C)
npm start
```

### 3. Open a Fresh Profile

Navigate to a politician profile that hasn't been processed:
```
/index1?index=<id>&title=<name>&subtitle=<position>
```

### 4. Watch the Magic ✨

**You should now see these logs** (you didn't before):
```
[diag] profile:processing:start { politicianId: 123 }
[diag] svc:handleProfileOpen:called { politicianId: 123 }  ← THIS IS NEW!
[diag] client:request:start { url: '.../profile_index' }
[diag] client:request:complete { status: 200 }
[diag] profile:processing:complete
[diag] profile:refetch:index-updated { indexed: true }
```

**Before this fix, you only saw:**
```
[diag] profile:mount
[diag] profile:fetch:*
[diag] lock:*
# ❌ NO processing calls
```

---

## ✅ What to Verify

### Test 1: Fresh Profile (Main Fix)
- [ ] Open unprocessed profile (`indexed=false`)
- [ ] See `svc:handleProfileOpen:called` in logs
- [ ] Profile populates after ~20-30s
- [ ] Synopsis, metrics, cards all appear
- [ ] No infinite loops

### Test 2: Already-Processed Profile (Skip Logic)
- [ ] Open processed profile (`indexed=true`)
- [ ] **DO NOT** see `svc:handleProfileOpen:called`
- [ ] Profile displays immediately (no processing delay)

### Test 3: Concurrent Opens (In-Flight Guard)
- [ ] Open same fresh profile in 2 tabs simultaneously
- [ ] Only **ONE** processing call in logs
- [ ] No duplicate API requests

---

## 🐛 If Something Goes Wrong

### Diagnostics Not Logging
```bash
# Verify env variable
echo $EXPO_PUBLIC_DEBUG_PROFILE_PIPELINE

# Should print: true
# If not, restart dev server
```

### Processing Fails (ppl_metrics Error) ✅ HANDLED GRACEFULLY
If you see `Error in Step 3 (ppl_metrics)`:
- ✅ **This is OK!** Your fix is working (processing WAS called)
- ✅ Profile still processes partially (synopsis populates)
- ✅ Look for `svc:partial-success` in logs
- ℹ️ This is a server-side Edge function issue
- 📖 See [ERROR-HANDLING.md](./ERROR-HANDLING.md) for details

**What you'll see:**
```
✅ svc:step2:success
❌ svc:step3:error { errorName: 'FunctionsHttpError' }
✅ svc:partial-success { failedSteps: ['ppl_metrics'] }
✅ Profile displays with synopsis (metrics missing)
```

### Infinite Loop
- **Immediately:** Comment out lines 161-213 in `app/index1.tsx`
- Redeploy
- Check in-flight guard logic

---

## 📄 Full Documentation

- **This Quick Start:** You are here
- **Implementation Details:** [`IMPLEMENTATION.md`](./IMPLEMENTATION.md)
- **Diagnostic Report:** [`profile-pipeline-report.md`](./profile-pipeline-report.md)
- **Usage Guide:** [`README.md`](./README.md)

---

## 🚢 Production Deployment

**After staging tests pass:**

1. Disable diagnostics:
   ```bash
   EXPO_PUBLIC_DEBUG_PROFILE_PIPELINE=false
   ```

2. Deploy to production

3. Monitor:
   - Profile load times (target p95 < 35s)
   - Processing success rate (target > 95%)
   - Error rates (target < 5%)

**Rollback:** Comment out lines 161-213 in `app/index1.tsx` if needed.

---

## 🎉 Expected Outcome

**Before:** 
- Profiles "randomly" didn't work
- No processing on open
- Users saw stale/missing data

**After:**
- Profiles auto-process on first open
- Fresh data displayed after processing
- Consistent behavior (no more "random")

---

## 📞 Questions?

- See diagnostic report for detailed analysis: [`profile-pipeline-report.md`](./profile-pipeline-report.md)
- See implementation guide for test cases: [`IMPLEMENTATION.md`](./IMPLEMENTATION.md)
- See usage guide for log reference: [`README.md`](./README.md)

---

**Ready to test!** Just enable diagnostics and open a profile. You should immediately see the difference in the logs.


