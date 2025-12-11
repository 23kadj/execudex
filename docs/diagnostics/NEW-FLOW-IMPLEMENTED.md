# ✅ New Profile Processing Flow - IMPLEMENTED

**Date:** October 7, 2025  
**Status:** Complete rewrite implemented  
**For:** Politicians only

---

## 🎯 **What Changed**

Completely rewrote `PoliticianProfileService.handleProfileOpen` to follow your exact specifications.

### **Old Flow (REMOVED):**
- ❌ Storage file checks
- ❌ Tier/name/sub_name validation
- ❌ Complex validation logic
- ❌ Unclear step order

### **New Flow (IMPLEMENTED):**
✅ Simple, linear 4-step process  
✅ `indexed` flag is the main gate  
✅ Metrics update based on 7-day window  
✅ Synopsis retry logic on "no source data"  

---

## 📋 **New Processing Steps**

### **STEP 1: Check ppl_profiles & Weak Status**
```typescript
// executeStep1_CheckProfileAndMetrics()

1. Check ppl_index.weak
   - IF weak = true → STOP, open with lock

2. Check if ppl_profiles row exists:
   
   A) Row EXISTS:
      - Check updated_at
      - IF > 7 days old → Run ppl_metrics
      - Continue to Step 2
   
   B) Row DOESN'T EXIST:
      - Run ppl_metrics
      - Run profile_index
      - SKIP to Step 3 (bypass indexed check)
```

---

### **STEP 2: Check Indexed Status**
```typescript
// executeStep2_CheckIndexed()

1. Check ppl_index.indexed

2. IF indexed = true → STOP (already processed)

3. IF indexed = false OR NULL:
   - Run profile_index
   - Continue to Step 3
```

---

### **STEP 3: Check Synopsis**
```typescript
// executeStep3_CheckSynopsis()

1. Check ppl_profiles.synopsis

2. IF synopsis is NULL or contains "No Data":
   - Run ppl_synopsis
   - Check response body for "no source data"
   
3. IF response contains "no source data available":
   - Run profile_index (retry)
   - Wait for completion
   - Run ppl_synopsis again (second attempt)

4. Continue to Step 4
```

---

### **STEP 4: Mark as Indexed**
```typescript
// executeStep4_MarkIndexed()

1. UPDATE ppl_index SET indexed = true

2. Profile opens (card count check happens in UI)
```

---

## 🔧 **Implementation Details**

### **Main Entry Point**
```typescript
// services/politicianProfileService.ts: Line 39
static async handleProfileOpen(
  politicianId: number, 
  onProgress?: ProgressCallback, 
  trace?: string
): Promise<void>
```

**Flow:**
1. Calls `executeStep1_CheckProfileAndMetrics`
2. If weak → Stop
3. If no profile row → Skip to Step 3
4. Calls `executeStep2_CheckIndexed`
5. If indexed=true → Stop
6. Calls `executeStep3_CheckSynopsis`
7. Calls `executeStep4_MarkIndexed`
8. Done

---

### **Helper Methods (New)**

| Method | Purpose | Edge Function Called |
|--------|---------|---------------------|
| `executeProfileIndex()` | Run profile_index | `profile_index` |
| `executeSynopsis()` | Run ppl_synopsis | `ppl_synopsis` |
| `executeMetrics()` | Run ppl_metrics | `ppl_metrics` |

---

### **Removed Methods**

| Method | Reason |
|--------|--------|
| `checkStorageFiles()` | No longer needed (deprecated) |
| `handleProfileChecks()` | Replaced by Step 3 |
| `executeStep1IfNeeded()` | Replaced by Step 2 |
| `executeStep1()` | Replaced by `executeProfileIndex()` |
| `executeStep2()` | Replaced by `executeSynopsis()` |
| `executeStep3()` | Replaced by `executeMetrics()` |

---

## 📊 **Expected Behavior**

### **Scenario A: Fresh Profile (indexed=false, no data)**
```
STEP 1: Check profiles
  → No ppl_profiles row found
  → Run ppl_metrics ✓
  → Run profile_index ✓
  → Skip to STEP 3

STEP 3: Check synopsis
  → No synopsis
  → Run ppl_synopsis ✓
  → Check response

STEP 4: Mark indexed
  → indexed = true ✓
  → Open profile
```

---

### **Scenario B: Existing Profile (indexed=false, has data)**
```
STEP 1: Check profiles
  → ppl_profiles row exists
  → updated_at is recent (<7 days)
  → Skip metrics
  → Continue to STEP 2

STEP 2: Check indexed
  → indexed = false
  → Run profile_index ✓
  → Continue to STEP 3

STEP 3: Check synopsis
  → Synopsis exists
  → Skip
  → Continue to STEP 4

STEP 4: Mark indexed
  → indexed = true ✓
  → Open profile
```

---

### **Scenario C: Already Processed (indexed=true)**
```
STEP 1: Check profiles
  → ppl_profiles row exists
  → Check metrics age
  → Continue to STEP 2

STEP 2: Check indexed
  → indexed = true ✓
  → STOP - Open profile immediately
```

---

### **Scenario D: Weak Profile**
```
STEP 1: Check profiles
  → ppl_index.weak = true
  → STOP - Open with lock
```

---

### **Scenario E: Synopsis "No Source Data"**
```
STEP 3: Check synopsis
  → No synopsis
  → Run ppl_synopsis ✓
  → Response: "no source data available"
  → Run profile_index (retry) ✓
  → Run ppl_synopsis again (second attempt) ✓
  → Continue to STEP 4
```

---

## 🧪 **Testing**

### **Enable Diagnostics**
```bash
EXPO_PUBLIC_DEBUG_PROFILE_PIPELINE=true
```

### **Expected Logs (Fresh Profile)**
```
[diag] svc:handleProfileOpen:start { politicianId: 123 }
[diag] svc:step1:start { politicianId: 123 }
[diag] svc:step1:no-profile-row { politicianId: 123 }
[diag] svc:metrics:start { politicianId: 123 }
[diag] svc:metrics:success { politicianId: 123 }
[diag] svc:profile-index:start { politicianId: 123 }
[diag] svc:profile-index:success { politicianId: 123 }
[diag] svc:step3:start { politicianId: 123 }
[diag] svc:step3:running-synopsis { politicianId: 123 }
[diag] svc:synopsis:start { politicianId: 123 }
[diag] svc:synopsis:success { politicianId: 123 }
[diag] svc:step4:start { politicianId: 123 }
[diag] svc:step4:success { politicianId: 123 }
[diag] svc:handleProfileOpen:complete { politicianId: 123 }
```

---

### **Expected Logs (Weak Profile)**
```
[diag] svc:handleProfileOpen:start { politicianId: 456 }
[diag] svc:step1:start { politicianId: 456 }
[diag] svc:step1:weak-profile { politicianId: 456 }
[diag] svc:weak-profile:stop { politicianId: 456 }
```

---

### **Expected Logs (Already Indexed)**
```
[diag] svc:handleProfileOpen:start { politicianId: 789 }
[diag] svc:step1:start { politicianId: 789 }
[diag] svc:step1:profile-exists { updated_at: '2025-10-05' }
[diag] svc:step2:start { politicianId: 789 }
[diag] svc:step2:already-indexed { politicianId: 789 }
[diag] svc:already-indexed:stop { politicianId: 789 }
```

---

## ⚠️ **Important Notes**

1. **Metrics Failure is Non-Blocking**
   - If `ppl_metrics` fails, processing continues
   - Error logged but doesn't stop flow

2. **Synopsis Retry Logic**
   - Checks response body for "no source data"
   - Automatically retries with profile_index + synopsis
   - Only retries once

3. **Weak Profiles**
   - Checked at Step 1
   - Immediately stops processing
   - Profile opens with lock (handled in UI)

4. **Card Count Check**
   - Happens at Step 4
   - Determines lock/generate button visibility
   - 0 cards → Show lock + generate button
   - >0 cards → Normal access

5. **Deprecated Code Kept**
   - Old methods marked as deprecated
   - Kept for backward compatibility
   - Not called by new flow

---

## 📁 **Files Modified**

- ✅ `services/politicianProfileService.ts` - Complete rewrite
- ✅ `lib/diag/logger.ts` - Already existed (no changes)
- ✅ `app/index1.tsx` - Already calls handleProfileOpen (no changes needed)

---

## 🚀 **Ready to Test**

The implementation is complete. Test with:

1. Fresh profile (`indexed=false`, no data)
2. Existing profile (`indexed=false`, has data)
3. Already processed (`indexed=true`)
4. Weak profile (`weak=true`)
5. Synopsis "no source data" scenario

All scenarios should now work as specified!

