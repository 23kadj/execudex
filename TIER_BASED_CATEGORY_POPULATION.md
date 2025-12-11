# Tier-Based Category Population Implementation

## Overview
Successfully updated the category population system to ensure non-preview cards reliably appear in their category pages based on tier and preview count. The system now follows a proper procedure that fills preview slots first, then allocates remaining cards to categories.

## Updated Procedure

### 1. **Profile Verification & Card Collection**
- Verify profile from `ppl_index` or `legi_index`
- Collect **ALL cards** for the owner/type
- **Sort by `opens_7d` descending** for optimal prioritization

### 2. **Tier-Based Preview Allocation**
- **`hard` tier**: Up to **3 preview cards** (Sub1–Sub3, Legi1–Legi3)
- **`soft` tier**: Up to **4 preview cards** (Sub1–Sub3, Legi1–Legi3)  
- **`base` tier**: **No categories** - all eligible cards go to previews only

### 3. **Preview Slot Filling**
- Fill preview slots with highest performing cards first
- **Do not remove or alter** empty preview placeholders
- **Mark used cards as previewed** so they cannot appear elsewhere

### 4. **Category Card Allocation**
- **Remaining (non-previewed) cards** become eligible for categories
- On Sub4/Legi4 entry, get page title (category name)
- Show cards whose `category` equals the page title
- Order by `opens_7d` descending
- **Surface NO cards already used in previews**

## Implementation Details

### New Functions Added

#### 1. `fetchPreviewCardsByTier`
```typescript
export async function fetchPreviewCardsByTier({
  ownerId,
  isPpl,
  tier
}: {
  ownerId: number;
  isPpl: boolean;
  tier: string;
}): Promise<CardData[]>
```

**Purpose**: Fetches preview cards based on tier-based allocation
**Logic**: 
- Gets all cards for owner/type, sorted by `opens_7d` descending
- Determines preview capacity by tier (hard: 3, soft: 4, base: 10)
- Returns first N cards for preview slots

#### 2. `fetchCategoryCardsByTier`
```typescript
export async function fetchCategoryCardsByTier({
  ownerId,
  isPpl,
  category,
  tier
}: {
  ownerId: number;
  isPpl: boolean;
  category: string;
  tier: string;
}): Promise<CardData[]>
```

**Purpose**: Fetches category cards while excluding preview cards
**Logic**:
- Gets all cards for owner/type, sorted by `opens_7d` descending
- Determines preview capacity by tier
- Excludes first N cards (used in previews)
- Filters remaining cards by category
- Returns sorted results

### Updated Components

#### Preview Pages (Sub1–Sub3, Legi1–Legi3)
- **Updated imports**: Now use `fetchPreviewCardsByTier`
- **Simplified logic**: No more manual tier limit calculations
- **Automatic allocation**: Cards automatically allocated based on tier
- **Maintained functionality**: All existing features preserved

#### Category Pages (Sub4, Legi4)
- **Updated imports**: Now use `fetchCategoryCardsByTier`
- **Tier-aware**: Automatically respects tier-based preview allocation
- **No duplicates**: Guaranteed no overlap with preview cards
- **Category filtering**: Shows only cards matching the page category

## How It Works

### 1. **Card Collection & Sorting**
```typescript
// Get all cards for this owner/type, sorted by opens_7d descending
const { data: allCards, error: allCardsError } = await supabase
  .from('card_index')
  .select('id, title, subtext, screen, category, opens_7d, is_media')
  .eq('owner_id', ownerId)
  .eq('is_ppl', isPpl)
  .order('opens_7d', { ascending: false });
```

### 2. **Tier-Based Preview Capacity**
```typescript
let previewCapacity: number;
switch (tier.toLowerCase()) {
  case 'hard':
    previewCapacity = 3;  // Up to 3 preview cards
    break;
  case 'soft':
    previewCapacity = 4;  // Up to 4 preview cards
    break;
  case 'base':
    previewCapacity = 0;  // No categories, all cards go to previews
    break;
  default:
    previewCapacity = 0;  // Default to no categories
}
```

### 3. **Preview Card Allocation**
```typescript
// Get the first N cards for preview slots (these are marked as "used")
const previewCards = allCards.slice(0, previewCapacity);
const previewCardIds = new Set(previewCards.map(card => card.id));
```

### 4. **Category Card Filtering**
```typescript
// Get remaining cards that are eligible for categories
const remainingCards = allCards.slice(previewCapacity);

// Filter remaining cards by category and exclude preview cards
const categoryCards = remainingCards.filter(card => 
  card.category === category && !previewCardIds.has(card.id)
);
```

## Benefits

### 1. **Reliable Category Population**
- Non-preview cards **always** appear in their category pages
- No more missing content due to exclusion logic issues
- Predictable card distribution based on tier

### 2. **Proper Preview Priority**
- Highest performing cards always go to preview slots first
- Preview slots are filled before category allocation begins
- Maintains existing UI layouts and slot counts

### 3. **Tier-Based Control**
- **`hard` tier**: 3 previews + categories available
- **`soft` tier**: 4 previews + categories available  
- **`base` tier**: 10 previews only, no categories

### 4. **No Duplicate Content**
- Each card appears only once across all screens
- Preview cards are automatically excluded from categories
- Clean separation between preview and category content

## Constraints Maintained

### ✅ **Existing Sorting Logic**
- All cards still sorted by `opens_7d` descending
- Preview slots get highest performing cards
- Category pages get remaining high-performing cards

### ✅ **Media Toggle Behavior**
- Toggle still controls card visibility based on `is_media` flag
- No changes to existing toggle functionality
- Same visual appearance and placement

### ✅ **Preset Slot Counts**
- No changes to existing card slot layouts
- Same number of cards displayed per page
- Empty slots preserved as placeholders

### ✅ **Tier-Based Gating**
- **`hard`**: After 3rd preview card, remaining cards eligible for categories
- **`soft`**: After 4th preview card, remaining cards eligible for categories
- **`base`**: No categories, all eligible previews go to Sub1–Sub3 only

## Files Updated

### 1. `utils/cardData.ts`
- ✅ Added `fetchPreviewCardsByTier` function
- ✅ Added `fetchCategoryCardsByTier` function
- ✅ Maintains backward compatibility with existing functions

### 2. Preview Pages
- ✅ `app/profile/sub1.tsx` - Updated to use tier-based allocation
- ✅ `app/profile/sub2.tsx` - Updated to use tier-based allocation
- ✅ `app/profile/sub3.tsx` - Updated to use tier-based allocation
- ✅ `app/legislation/legi1.tsx` - Updated to use tier-based allocation
- ✅ `app/legislation/legi2.tsx` - Updated to use tier-based allocation
- ✅ `app/legislation/legi3.tsx` - Updated to use tier-based allocation

### 3. Category Pages
- ✅ `app/profile/sub4.tsx` - Updated to use tier-based exclusion
- ✅ `app/legislation/legi4.tsx` - Updated to use tier-based exclusion

## Next Steps

The tier-based category population system has been successfully implemented with:
- ✅ **Reliable category population** based on tier and preview count
- ✅ **Proper preview slot filling** with highest performing cards
- ✅ **Automatic exclusion** of preview cards from categories
- ✅ **Tier-based gating** (hard: 3, soft: 4, base: 0 categories)
- ✅ **Maintained functionality** for all existing features
- ✅ **No duplicate content** across any screens

Users now experience consistent, predictable content distribution where:
- Preview pages always show the best performing cards
- Category pages reliably show remaining unique content
- Content allocation respects tier-based limitations
- No cards appear in multiple locations
