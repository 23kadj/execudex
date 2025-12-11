# Media Sourcing Toggle Implementation - Sub4 & Legi4

## Overview
Successfully implemented the "Allow Media Sourcing" toggle in both Sub4 and Legi4 with identical visuals, placement, and styling. The toggle now controls card visibility based on the `is_media` flag while maintaining the same number of preset card slots.

## Toggle Behavior

### When Toggle is OFF (Default State):
- **Hide**: Cards where `is_media = true` (media-sourced cards)
- **Show**: Cards where `is_media = false` (non-media-sourced cards)
- **Maintain**: Same total number of preset card slots
- **Fill**: Empty slots with placeholder content if needed

### When Toggle is ON:
- **Show**: Cards where `is_media = true` (media-sourced cards) - prioritized first
- **Show**: Cards where `is_media = false` (non-media-sourced cards) - fill remaining slots
- **Maintain**: Same total number of preset card slots

## Key Implementation Details

### 1. Card Slot Preservation
- **No slots are added or removed** when toggle changes
- **Same number of cards** always displayed based on tier limits
- **Empty slots filled** with placeholder content if insufficient cards

### 2. Smart Card Filtering
- **Media cards prioritized** when toggle is ON
- **Non-media cards** always visible regardless of toggle state
- **Automatic slot filling** maintains consistent UI layout

### 3. Tier-Based Limits
- **base tier**: max 10 card slots
- **soft tier**: max 4 card slots  
- **hard tier**: max 3 card slots

## Code Implementation

### State Management
```typescript
const [allowMediaSourcing, setAllowMediaSourcing] = useState(false);
```

### Card Filtering Logic
```typescript
const getVisibleCards = () => {
  if (!cardData || cardData.length === 0) return [];
  
  // Separate media and non-media cards
  const mediaCards = cardData.filter(card => card.is_media === true);
  const nonMediaCards = cardData.filter(card => card.is_media !== true);
  
  // Determine how many cards we need to fill the preset slots
  const tierLimits: Record<string, number> = {
    'base': 10,
    'soft': 4,
    'hard': 3
  };
  const maxCards = tierLimits[tier.toLowerCase()] || 10;
  
  let result: typeof cardData = [];
  
  if (allowMediaSourcing) {
    // When toggle is ON: prioritize media cards, then fill with non-media cards
    result = [...mediaCards, ...nonMediaCards].slice(0, maxCards);
  } else {
    // When toggle is OFF: only show non-media cards, but maintain the same number of slots
    result = nonMediaCards.slice(0, maxCards);
  }
  
  // Always return the same number of cards to maintain preset slot count
  // If we don't have enough cards, fill remaining slots with empty placeholders
  while (result.length < maxCards) {
    result.push({
      id: -1,
      title: 'No data now', // or 'Card Title' for Legi4
      subtext: 'no data now', // or 'Card description text' for Legi4
      screen: '',
      opens_7d: 0,
      is_media: false
    });
  }
  
  return result;
};
```

### Card Rendering
```typescript
// All cards use getVisibleCards() for dynamic content
<Text style={styles.title1}>{getVisibleCards()[0]?.title || 'No data now'}</Text>
<Text style={styles.subtext1}>{getVisibleCards()[0]?.subtext || 'no data now'}</Text>
```

## Visual Implementation

### Toggle Placement
- **Location**: Right side of the profile header in both Sub4 and Legi4
- **Layout**: Uses `headerRow` with `leftContent` and `toggleContainer`
- **Spacing**: Identical margins and positioning across both components

### Toggle Styling
- **Container**: `toggleContainer` with centered alignment
- **Label**: "Allow Media Sourcing" text with white color and 13px font
- **Switch**: 44x24px rounded rectangle with 2px padding
- **Knob**: 20x20px circular knob that slides left/right
- **Colors**: 
  - Toggle OFF: Dark gray background (#333) with gray knob (#666)
  - Toggle ON: White background (#fff) with black knob (#000)

## Integration Points

### Card Data Fetching
- **Dependency**: Added `allowMediaSourcing` to useEffect dependencies
- **Re-filtering**: Cards are re-filtered whenever toggle state changes
- **Performance**: Filtering happens client-side for immediate response

### Card Rendering
- **Dynamic titles**: Card titles use `getVisibleCards()[index]?.title`
- **Dynamic subtexts**: Card descriptions use `getVisibleCards()[index]?.subtext`
- **Navigation params**: Card navigation uses filtered card data
- **Consistent slots**: Same number of cards always displayed

## Benefits

1. **Identical User Experience**: Toggle looks and behaves exactly the same in both Sub4 and Legi4
2. **Smart Content Filtering**: Cards automatically show/hide based on media sourcing preference
3. **Consistent Layout**: Same number of card slots maintained regardless of toggle state
4. **Real-time Updates**: Changes are immediate without page refresh
5. **Maintained Performance**: Filtering is efficient and doesn't impact rendering
6. **Consistent Styling**: All visual elements match across both components

## Files Updated

### 1. `utils/cardData.ts`
- ✅ Added `is_media` field to `CardData` interface
- ✅ Updated `fetchCardData` to include `is_media` in SELECT queries
- ✅ Updated `fetchCategoryCardData` to include `is_media` in SELECT queries

### 2. `app/profile/sub4.tsx`
- ✅ Added `getVisibleCards()` function with proper filtering logic
- ✅ Updated all card references to use `getVisibleCards()`
- ✅ Added `allowMediaSourcing` dependency to useEffect
- ✅ Maintained existing UI structure and card layouts

### 3. `app/legislation/legi4.tsx`
- ✅ Added identical toggle UI and styling
- ✅ Implemented same `getVisibleCards()` function
- ✅ Updated card rendering to use dynamic data
- ✅ Added all necessary styles and state management

## Next Steps

The "Allow Media Sourcing" toggle has been successfully implemented in both Sub4 and Legi4 with:
- ✅ **Identical visuals** across both components
- ✅ **Identical placement** in the header
- ✅ **Identical styling** and animations
- ✅ **Full functionality** for controlling card visibility
- ✅ **Smart slot preservation** maintaining consistent layouts
- ✅ **Integration** with the card data system

Both components now provide the same user experience, allowing users to control which media-sourced content is displayed while maintaining the existing UI structure, card layouts, and preset slot counts.
