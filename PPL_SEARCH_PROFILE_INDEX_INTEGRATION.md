# PPL Search - Profile Index Integration

## Overview
Updated `ppl_search/index.ts` to incorporate the logic and patterns from `profile_index/index.ts` to ensure consistent behavior when adding politicians to the database.

## Key Changes Made

### 1. Enhanced Fallback Logic (Lines 835-956)
- **Added `tavilySearchFallback()`**: Wrapper for Tavily search with domain filtering
- **Added `fetchHTMLWithUA()`**: Direct HTML fetching with browser-like headers
- **Added `fetchViaJinaReader()`**: Jina Reader proxy for bypassing 403 errors
- **Added `stripHtml()`**: HTML to text conversion
- **Added `webExtractOneWithRetry()`**: Multi-fallback extraction (Tavily → HTML → Jina)
- **Added `findFallbackPersonUrl()`**: Smart fallback URL finder for politicians without Wikipedia

**Profile Index Parity**: These functions now match the exact implementation from `profile_index/index.ts`, ensuring the same fallback chain is used when Wikipedia is unavailable.

### 2. Comprehensive Logging Throughout (Lines 979-1210)
Added structured logging at every major step:
- **Step 1**: Tavily search with result counts
- **Step 2**: Content extraction with success ratios
- **Step 3**: Mistral validation decision logging
- **Step 4**: Politician eligibility validation
- **Step 5**: Duplicate checking with variants
- **Step 6**: Canonical name and sub_name generation
- **Step 7**: ID allocation and database insertion
- **Wikipedia Fetch**: Detailed logging of fetch attempts, fallbacks, and storage
- **Field Extraction**: Mistral extraction results and confidence scores
- **Final Update**: Fields being updated with values

**Profile Index Parity**: Follows the same `[PPL_SEARCH]` logging pattern as `[PROFILE_INDEX]` from profile_index.

### 3. Improved Wikipedia & Fallback Handling (Lines 1120-1132)
```typescript
try {
  // Try Wikipedia first
  const wiki = await fetchWikipediaText(canonical, sub_name);
  // Store if successful
} catch {
  // Mark as weak (no Wikipedia)
  await supabase.from("ppl_index").update({ weak: true }).eq("id", ins.id);
  
  // Attempt fallback URLs (.gov, .edu, .org, .us)
  const fallbackUrl = await findFallbackPersonUrl(canonical);
  if (fallbackUrl) {
    const ext = await webExtractOneWithRetry(fallbackUrl);
    // Use fallback content
  } else {
    // Store minimal stub
  }
}
```

**Profile Index Parity**: Now uses the same three-tier approach as profile_index:
1. Wikipedia (official API)
2. Fallback to official/government sites
3. Minimal stub if all else fails

### 4. Enhanced Field Extraction Logic (Lines 1134-1196)
Added politician-specific rules matching profile_index:
- **Secretary Detection**: Auto-sets `office_type = "cabinet"` if "secretary" in sub_name
- **Unknown Role Detection**: Sets `office_type = "official"` for non-standard roles
- **Former Status Handling**: Forces `tier = "base"` if "former" appears in sub_name
- **Confidence-Based Extraction**: Same Mistral + deterministic fallback approach

**Profile Index Parity**: 
```typescript
// Detect special cases from sub_name
const hasSecretary = /\bsecretary\b/i.test(subNameStr);
const isFormer = /\bformer\b/i.test(subNameStr);
const subNameIsUnknownRole = subNameStr.length > 0 && !knownRoleRx.test(subNameStr);

// Apply special office type logic
if (hasSecretary) office_type_special = "cabinet";
else if (subNameIsUnknownRole) office_type_special = "official";

// Force tier demotion for former officials
if (isFormer && tier !== "base") tier = "base";
```

### 5. Enhanced Response Data (Lines 1212-1226)
Added fields to the response:
- `wiki_url`: The Wikipedia URL or fallback URL used
- `fallback_used`: Boolean indicating if fallback was used instead of Wikipedia
- `limit_score`: The computed limit score for the politician
- `tier`: The assigned tier (base/soft/hard)

### 6. Error Handling & Retry Logic (Lines 985-1051)
- Search retry with 300ms delay on failure
- Mistral decision retry with 300ms delay on failure
- Detailed error logging at each failure point
- Graceful degradation (stub content if all extraction fails)

## Benefits

### 1. Consistency
- Both `ppl_search` and `profile_index` now use identical fallback strategies
- Same field extraction and scoring logic
- Consistent logging patterns for debugging

### 2. Robustness
- Multi-tier fallback chain prevents complete failures
- Retry logic handles transient API errors
- Graceful degradation ensures data is always stored

### 3. Maintainability
- Comprehensive logging makes debugging easier
- Clear step-by-step flow matches profile_index
- Comments indicate profile_index parity

### 4. Completeness
- Captures all relevant data fields (score, tier, etc.)
- Proper weak flag for non-Wikipedia entries
- Fallback content provides better coverage

## Testing Recommendations

1. **Test Wikipedia Success Path**: Search for well-known politicians (e.g., "Joe Biden")
2. **Test Fallback Path**: Search for lesser-known politicians without Wikipedia
3. **Test Secretary Detection**: Search for cabinet members (e.g., "Antony Blinken")
4. **Test Former Official**: Search for former officials to verify tier demotion
5. **Test Duplicate Detection**: Try adding the same politician twice
6. **Test Invalid Input**: Try non-politicians to verify rejection

## Notes

- Deno-related linter errors (lines 6-22, 959) are expected and don't affect runtime
- The code runs in Deno's edge runtime where these types are available
- All core functionality follows profile_index patterns for politician handling

