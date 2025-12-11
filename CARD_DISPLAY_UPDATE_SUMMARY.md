# Card Display Procedure Update Summary

## Overview
Updated the card display procedure across all profile pages (Sub1–Sub4, Legi1–Legi4) to work without the `is_preview` column. The new system uses `opens_7d` sorting and tier-based limits for preview card assignment.

## Changes Made

### 1. Updated `utils/cardData.ts`
- **Removed `is_preview` dependency** from all card fetching functions
- **Updated `fetchCardData`** to fetch all cards for a given screen and sort by `opens_7d` descending
- **Updated `fetchCategoryCardData`** to filter by category and sort by `opens_7d` descending
- **Added `getCategoryFromTitle`** function to map page titles to category values
- **Added `getCategoryMapping`** function for category name mappings

### 2. Updated Profile Pages (Sub1, Sub2, Sub3)
- **Modified card fetching logic** to use the new `fetchCardData` function
- **Added comments** explaining that cards are pre-sorted by `opens_7d` descending
- **Maintained tier-based limits**:
  - `base`: max 10 preview cards
  - `soft`: max 4 preview cards  
  - `hard`: max 3 preview cards

### 3. Updated Category Page (Sub4)
- **Modified to use `fetchCategoryCardData`** with category filtering
- **Added category extraction** from `buttonText` parameter using `getCategoryFromTitle`
- **Updated tier limits** to match the new system
- **Added dependency** on `buttonText` for category-based fetching

### 4. Updated Legislation Pages (Legi1, Legi2, Legi3)
- **Modified card fetching logic** similar to profile pages
- **Added comments** explaining the new preview card assignment system
- **Maintained tier-based limits** for legislation profiles

### 5. Updated Legislation Category Page (Legi4)
- **Added complete card data fetching implementation** using `fetchCategoryCardData`
- **Added profile tier fetching** from `legi_index` table
- **Updated card rendering** to use dynamic data instead of hardcoded titles
- **Implemented category-based filtering** for legislation cards

## New Card Assignment Logic

### Preview Card Assignment (Sub1, Sub2, Sub3, Legi1, Legi2, Legi3)
1. **Collect all card_index rows** linked to the verified profile
2. **Sort by `opens_7d` descending** (highest traffic first)
3. **Assign cards in order**:
   - Highest `opens_7d` → Preview Card Slot 1
   - Second highest → Preview Card Slot 2
   - Continue until all preview slots are filled
4. **Respect tier limits** from `ppl_index` or `legi_index`:
   - `base`: max 10 preview cards
   - `soft`: max 4 preview cards
   - `hard`: max 3 preview cards

### Category Cards (Sub4, Legi4)
1. **Extract category** from page title using `getCategoryFromTitle`
2. **Filter cards by category** value matching the page title
3. **Sort by `opens_7d` descending**
4. **Apply tier limits** for maximum cards displayed
5. **Populate grid** with matching category cards

## Category Mappings
- `economy` → "Economy"
- `environment` → "Environment"  
- `social` → "Social Programs"
- `immigration` → "Immigration"
- `healthcare` → "Healthcare"
- `education` → "Education"
- `defense` → "Defense"
- `foreign` → "Foreign Policy"
- `more` → "More Selections"

## Files Modified
- ✅ `utils/cardData.ts` - Core utility functions updated
- ✅ `app/profile/sub1.tsx` - Profile preview page updated
- ✅ `app/profile/sub2.tsx` - Profile preview page updated  
- ✅ `app/profile/sub3.tsx` - Profile preview page updated
- ✅ `app/profile/sub4.tsx` - Category page updated
- ✅ `app/legislation/legi1.tsx` - Legislation preview page updated
- ✅ `app/legislation/legi2.tsx` - Legislation preview page updated
- ✅ `app/legislation/legi3.tsx` - Legislation preview page updated
- ✅ `app/legislation/legi4.tsx` - Legislation category page updated

## Key Benefits
1. **Eliminated `is_preview` column dependency** - system now works with any card_index structure
2. **Automatic traffic-based prioritization** - highest performing cards automatically get preview slots
3. **Consistent tier enforcement** - all pages respect the same tier limits
4. **Dynamic category filtering** - category pages automatically show relevant content
5. **Maintained existing UI** - no changes to card layouts or styling

## Constraints Maintained
- ✅ **No deletion of empty preview slots** - existing UI structure preserved
- ✅ **Preview slots filled first** by top `opens_7d` cards
- ✅ **Tier limits respected** across all pages
- ✅ **Category cards only in Sub4/Legi4** after category selection
- ✅ **Always sorted by `opens_7d` descending**

## Next Steps
The card display system has been successfully updated to work without the `is_preview` column. All profile and legislation pages now use the new traffic-based preview card assignment system while maintaining the existing UI structure and tier-based limitations.
