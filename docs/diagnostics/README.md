# Profile Pipeline Diagnostics — Usage Guide

## 🎯 Purpose

This diagnostic system helps identify why profile processing "randomly doesn't work" by adding comprehensive tracing throughout the profile open and processing flow.

**Key Finding:** See [`profile-pipeline-report.md`](./profile-pipeline-report.md) for the root cause analysis.

---

## 🚀 Quick Start

### 1. Enable Diagnostics

Create or update your `.env` or `.env.local` file:

```bash
EXPO_PUBLIC_DEBUG_PROFILE_PIPELINE=true
```

**Important:** Use the `EXPO_PUBLIC_` prefix for Expo environment variables.

### 2. Restart Development Server

```bash
# Stop current server (Ctrl+C)
npm start
# Or
expo start
```

### 3. Open a Profile

Navigate to any politician profile:
```
/index1?index=123&title=John+Doe&subtitle=Senator
```

### 4. View Diagnostic Logs

Check your browser console or terminal for logs prefixed with `[diag]`:

```
[diag 2025-10-07T10:30:45.123Z] profile:mount [ppl-open-1696673445123-abc123] { id: 123, route: '/index1' }
[diag 2025-10-07T10:30:45.234Z] profile:fetch:start [ppl-open-1696673445123-abc123] { politicianId: 123 }
[diag 2025-10-07T10:30:45.456Z] profile:fetch:index-success [ppl-open-1696673445123-abc123] { tier: 'hard', indexed: false }
```

---

## 📊 Log Tags Reference

### Profile Page Logs (`app/index1.tsx`)

| Tag | Description | When |
|-----|-------------|------|
| `profile:mount` | Component mounted | On route navigation |
| `profile:fetch:start` | Starting data fetch | After mount, when ID available |
| `profile:fetch:index-success` | `ppl_index` data fetched | After Supabase query |
| `profile:fetch:index-error` | Failed to fetch index | On DB error |
| `profile:fetch:profile-success` | `ppl_profiles` data fetched | After profile query |
| `profile:fetch:profile-error` | Failed to fetch profile | On DB error (PGRST116 = not found) |
| `profile:fetch:complete` | Fetch completed | End of fetch effect |

### Probe Logs (Diagnostic Only)

| Tag | Description | When |
|-----|-------------|------|
| `probe:processing:invoke` | Starting processing test | Only when `DEBUG_PROFILE_PIPELINE=true` |
| `probe:processing:response` | Processing response received | After Edge function call |
| `probe:invalid-id` | Profile ID is invalid | ID parsing failed |
| `probe:missing-url` | Environment URL not set | Missing `EXPO_PUBLIC_SUPABASE_URL` |

### Service Layer Logs (`services/politicianProfileService.ts`)

| Tag | Description | When |
|-----|-------------|------|
| `svc:handleProfileOpen:called` | **Main entry point invoked** | **If you DON'T see this, service isn't called** |
| `svc:validation:start` | Starting validation check | Beginning of validation |
| `svc:validation:no-storage-files` | No storage files found | Profile needs indexing |
| `svc:storage:check` | Checking storage bucket | Looking for profile files |
| `svc:storage:result` | Storage check complete | Files found/not found |

### Lock Service Logs (`services/profileLockService.ts`)

| Tag | Description | When |
|-----|-------------|------|
| `lock:check:start` | Starting lock check | Called by `useProfileLock` |
| `lock:check:result` | Lock check complete | Returns lock status |
| `lock:ppl:check` | Checking politician lock | Politician-specific flow |
| `lock:ppl:card-count` | Card count retrieved | After DB query |
| `lock:ppl:locked-no-cards` | Profile locked (0 cards) | Lock applied |
| `lock:ppl:unlocked` | Profile unlocked | Has cards |
| `lock:card-count:result` | Card count query result | DB response |

### HTTP Client Logs (`lib/diag/profileClient.ts`)

| Tag | Description | When |
|-----|-------------|------|
| `client:request:start` | HTTP request starting | Before fetch |
| `client:request:complete` | HTTP response received | After fetch |
| `client:request:timeout` | Request timed out | After 30s (default) |
| `client:request:fetch-error` | Network error | Fetch failed |
| `client:operation:complete` | Full operation done | Including mutex wait |

### Hook Logs (`hooks/useProfileLock.ts`)

| Tag | Description | When |
|-----|-------------|------|
| `hook:useProfileLock:init` | Hook initialized | On first render |
| `hook:loadLockStatus:start` | Loading lock status | Effect triggered |
| `hook:loadLockStatus:success` | Lock status loaded | Data available |
| `hook:loadLockStatus:error` | Failed to load lock | DB/network error |
| `hook:loadLockStatus:skip` | Skipped (no ID) | Missing params |

---

## 🔍 Diagnostic Scenarios

### Scenario 1: Verify Processing Is Never Called

**Goal:** Confirm the root cause — processing service isn't invoked on profile open.

**Steps:**
1. Enable diagnostics
2. Open any profile
3. Search logs for `svc:handleProfileOpen:called`

**Expected Result:**
- ❌ **NO** `svc:handleProfileOpen:called` log
- ✅ You will see `profile:mount`, `profile:fetch:*`, `lock:*`
- ✅ This confirms the gap

**Example Log Sequence:**
```
[diag] profile:mount [trace-123] { id: 456 }
[diag] profile:fetch:start [trace-123] { politicianId: 456 }
[diag] profile:fetch:index-success [trace-123] { tier: 'hard', indexed: false }
[diag] lock:check:start [trace-456] { profileId: 456 }
[diag] lock:ppl:card-count [trace-456] { cardCount: 0 }
[diag] lock:ppl:locked-no-cards [trace-456] { profileId: 456 }

# ❌ NO svc:handleProfileOpen:called — Confirms the gap!
```

---

### Scenario 2: Test Processing with Probe

**Goal:** Prove that calling the processing endpoint works.

**Steps:**
1. Enable diagnostics (already enabled from Scenario 1)
2. Open a fresh profile (never processed, `indexed=false`)
3. Look for `probe:processing:*` logs

**Expected Result:**
- ✅ `probe:processing:invoke` — Probe started
- ✅ `client:request:start` — HTTP request made
- ✅ `client:request:complete { status: 200 }` — Success
- ✅ `probe:processing:response` — Response logged

**Example Log Sequence:**
```
[diag] probe:processing:invoke [trace-123] {
  politicianId: 456,
  url: 'https://.../functions/v1/profile_index',
  note: 'This call is NOT in production code'
}
[diag] client:request:start [trace-123] { key: 'p:456', url: '...' }
[diag] client:request:complete [trace-123] { status: 200, ok: true, durationMs: 25432 }
[diag] probe:processing:response [trace-123] {
  status: 200,
  bodyPreview: '{"success":true,"message":"Profile indexed",...}'
}
```

**Interpretation:**
- The endpoint **works** when called
- The UI just **doesn't call it**

---

### Scenario 3: Profile Lock Behavior

**Goal:** Understand when profiles get locked and why.

**Steps:**
1. Enable diagnostics
2. Open profiles with varying card counts (0, 1-9, 10+)
3. Compare lock status logs

**Expected Results:**

**0 Cards:**
```
[diag] lock:ppl:card-count [trace] { cardCount: 0 }
[diag] lock:ppl:locked-no-cards [trace] { profileId: 456 }
[diag] lock:check:result [trace] {
  isLocked: true,
  lockReason: 'no_cards',
  lockedPage: 'synopsis'
}
```

**1-9 Cards:**
```
[diag] lock:ppl:card-count [trace] { cardCount: 5 }
[diag] lock:ppl:unlocked [trace] { profileId: 456, cardCount: 5 }
[diag] lock:check:result [trace] {
  isLocked: false,
  lockReason: 'none'
}
```

**10+ Cards:**
```
[diag] lock:ppl:card-count [trace] { cardCount: 15 }
[diag] lock:ppl:unlocked [trace] { profileId: 456, cardCount: 15 }
```

---

### Scenario 4: Concurrent Opens (Mutex Test)

**Goal:** Verify mutex prevents duplicate processing (when fix is applied).

**Steps:**
1. Enable diagnostics
2. Open same profile in two tabs simultaneously
3. Compare trace IDs and request timing

**Expected Result (With Fix):**
```
# Tab 1
[diag] client:request:start [trace-123] { key: 'p:456', queueWaitMs: 0 }
[diag] client:request:complete [trace-123] { status: 200, durationMs: 25000 }

# Tab 2 (waits for Tab 1)
[diag] client:request:start [trace-789] { key: 'p:456', queueWaitMs: 25123 }
[diag] client:request:complete [trace-789] { status: 200, durationMs: 120 }
```

**Note:** `queueWaitMs` in Tab 2 shows it waited for Tab 1 to complete.

---

## 🧹 Disable Diagnostics

To turn off logging:

```bash
# Remove or set to false
EXPO_PUBLIC_DEBUG_PROFILE_PIPELINE=false
```

Then restart your dev server.

**Performance Impact:** Diagnostics are extremely lightweight when disabled (single boolean check per call site). No runtime overhead.

---

## 📁 File Structure

```
lib/diag/
├── logger.ts          # Core logging utilities
└── profileClient.ts   # HTTP client with mutex

docs/diagnostics/
├── README.md                      # This file
└── profile-pipeline-report.md    # Full diagnostic report
```

---

## 🐛 Troubleshooting

### No Logs Appearing

**Check:**
1. Environment variable set correctly: `EXPO_PUBLIC_DEBUG_PROFILE_PIPELINE=true`
2. Dev server restarted after env change
3. Browser console visible (if web) or terminal (if native)
4. No console filters hiding `[diag]` logs

**Verify:**
```javascript
// In browser console or REPL
console.log(process.env.EXPO_PUBLIC_DEBUG_PROFILE_PIPELINE);
// Should print: "true"
```

---

### Probe Not Running

**Check:**
1. Diagnostics enabled (see above)
2. Profile ID is valid (not NaN)
3. `EXPO_PUBLIC_SUPABASE_URL` environment variable set

**Expected Error Log:**
```
[diag] probe:missing-url [trace] { env: undefined }
```

**Fix:** Add to `.env`:
```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
```

---

### Trace IDs Not Correlating

**Issue:** Logs from different sources (page, hook, service) have different trace IDs.

**Explanation:** This is **expected**. Each component generates its own trace ID:
- `app/index1.tsx` → `ppl-open-{timestamp}-{random}`
- `hooks/useProfileLock` → `use-profile-lock-{timestamp}-{random}`
- Service calls → Inherit trace from caller (if passed)

**To correlate:**
1. Use timestamp to identify concurrent logs
2. Use profile ID to group related operations
3. Future enhancement: Pass trace ID through full call chain

---

## 🚀 Next Steps

After reviewing diagnostic logs:

1. **Confirm Root Cause:** No `svc:handleProfileOpen:called` logs → Processing never invoked
2. **Review Report:** See [`profile-pipeline-report.md`](./profile-pipeline-report.md)
3. **Implement Fix:** Add processing call to `app/index1.tsx` (see report for options)
4. **Re-test:** Enable diagnostics on fixed version to verify processing runs
5. **Monitor:** Track processing success rate and latency

---

## 📞 Support

For questions about this diagnostic system:
- See full report: [`profile-pipeline-report.md`](./profile-pipeline-report.md)
- Review audit checklist in report
- Check example log sequences above

---

**Last Updated:** October 7, 2025  
**Diagnostic Version:** 1.0.0


