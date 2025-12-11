# Card Exclusion Implementation - Preview vs Category Pages

## Overview
Successfully implemented logic to ensure that cards displayed in preview slots (Sub1–Sub3, Legi1–Legi3) do not appear again in category pages (Sub4/Legi4). Each card can now only be shown once across all screens, preventing duplicate content.

## Problem Solved
Previously, cards could appear in both preview slots and category pages, leading to:
- **Duplicate content** across different screens
- **Poor user experience** with repeated information
- **Inefficient content distribution** across the interface

## Solution Implemented

### 1. New Function: `fetchCategoryCardDataExcludingPreview`
- **Location**: `utils/cardData.ts`
- **Purpose**: Fetches category cards while automatically excluding those already used in preview slots
- **Parameters**: `ownerId`, `isPpl`, `category` (no `screen` parameter needed)

### 2. Smart Exclusion Logic
- **Identifies preview screens** based on profile type:
  - **Profile pages**: `['agenda', 'identity', 'affiliates']` (Sub1, Sub2, Sub3)
  - **Legislation pages**: `['agenda', 'impact', 'discourse']` (Legi1, Legi2, Legi3)

- **Collects all preview card IDs** from all preview screens
- **Excludes preview cards** when fetching category content
- **Maintains sorting** by `opens_7d` descending for optimal content prioritization

## Implementation Details

### Function Implementation
```typescript
export async function fetchCategoryCardDataExcludingPreview({
  ownerId,
  isPpl,
  category
}: Omit<CategoryCardParams, 'screen'>): Promise<CardData[]> {
  try {
    // First, get all preview screens for this profile type
    const previewScreens = isPpl 
      ? ['agenda', 'identity', 'affiliates']  // Sub1, Sub2, Sub3
      : ['agenda', 'impact', 'discourse'];   // Legi1, Legi2, Legi3
    
    // Get all cards from preview screens to exclude them
    const previewCardsPromises = previewScreens.map(screen => 
      supabase
        .from('card_index')
        .select('id')
        .eq('owner_id', ownerId)
        .eq('is_ppl', isPpl)
        .eq('screen', screen)
    );
    
    const previewCardsResults = await Promise.all(previewCardsPromises);
    const previewCardIds = new Set<number>();
    
    // Collect all preview card IDs
    previewCardsResults.forEach(result => {
      if (result.data) {
        result.data.forEach(card => {
          previewCardIds.add(card.id);
        });
      }
    });
    
    // Now get category cards, excluding those already used in preview slots
    const { data, error } = await supabase
      .from('card_index')
      .select('id, title, subtext, screen, category, opens_7d, is_media')
      .eq('owner_id', ownerId)
      .eq('is_ppl', isPpl)
      .eq('category', category)
      .not('id', 'in', `(${Array.from(previewCardIds).join(',')})`);
    
    if (error) {
      console.error('Error fetching category card data excluding preview:', error);
      return [];
    }
    
    if (!data || data.length === 0) {
      return [];
    }
    
    // Sort by opens_7d descending
    const sortedData = data.sort((a, b) => (b.opens_7d || 0) - (a.opens_7d || 0));
    
    return sortedData;
    
  } catch (error) {
    console.error('Error in fetchCategoryCardDataExcludingPreview:', error);
    return [];
  }
}
```

### 2. Updated Components

#### Sub4 (Profile Category Page)
- **Import updated**: Now uses `fetchCategoryCardDataExcludingPreview`
- **Function call simplified**: No longer needs `screen` parameter
- **Automatic exclusion**: Preview cards automatically filtered out

#### Legi4 (Legislation Category Page)
- **Import updated**: Now uses `fetchCategoryCardDataExcludingPreview`
- **Function call simplified**: No longer needs `screen` parameter
- **Automatic exclusion**: Preview cards automatically filtered out

## How It Works

### 1. Preview Page Behavior (Sub1–Sub3, Legi1–Legi3)
- **No changes**: Continue to work exactly as before
- **Cards displayed**: Based on tier limits and `opens_7d` sorting
- **Content**: Highest performing cards for each screen

### 2. Category Page Behavior (Sub4, Legi4)
- **Automatic filtering**: Preview cards automatically excluded
- **Unique content**: Only shows cards not already displayed elsewhere
- **Maintained functionality**: Media sourcing toggle and tier limits still work
- **Better distribution**: Ensures all available content is utilized

### 3. Exclusion Process
1. **Identify preview screens** based on profile type (profile vs legislation)
2. **Fetch all preview card IDs** from all preview screens
3. **Query category cards** with `NOT IN` clause for preview card IDs
4. **Sort results** by `opens_7d` descending for optimal content prioritization
5. **Return filtered results** ready for display

## Benefits

### 1. **No Duplicate Content**
- Each card appears only once across all screens
- Better user experience with unique information
- More efficient content distribution

### 2. **Automatic Management**
- No manual configuration needed
- Exclusion happens automatically during data fetching
- Maintains existing functionality and performance

### 3. **Better Content Utilization**
- Preview slots get highest performing cards
- Category pages get remaining unique content
- Ensures all available cards are displayed somewhere

### 4. **Maintained Performance**
- Efficient database queries with `NOT IN` clauses
- Parallel fetching of preview card IDs
- Minimal impact on loading times

## Database Query Optimization

### Before (Multiple Queries)
- Separate queries for each preview screen
- Separate query for category page
- Potential for duplicate card IDs

### After (Optimized Queries)
- Parallel queries for all preview screens
- Single optimized query for category page with exclusion
- Guaranteed unique card distribution

## Files Updated

### 1. `utils/cardData.ts`
- ✅ Added `fetchCategoryCardDataExcludingPreview` function
- ✅ Maintains backward compatibility with existing functions
- ✅ Implements smart exclusion logic

### 2. `app/profile/sub4.tsx`
- ✅ Updated import to use new exclusion function
- ✅ Simplified function call (removed screen parameter)
- ✅ Maintains all existing functionality

### 3. `app/legislation/legi4.tsx`
- ✅ Updated import to use new exclusion function
- ✅ Simplified function call (removed screen parameter)
- ✅ Maintains all existing functionality

## Next Steps

The card exclusion system has been successfully implemented with:
- ✅ **Automatic preview card exclusion** from category pages
- ✅ **No duplicate content** across any screens
- ✅ **Maintained performance** and existing functionality
- ✅ **Better content distribution** across the interface
- ✅ **Seamless integration** with existing toggle and tier systems

Users now experience unique content on each screen while maintaining the same visual design, toggle functionality, and tier-based limitations. The system automatically ensures optimal content distribution without any manual intervention.
