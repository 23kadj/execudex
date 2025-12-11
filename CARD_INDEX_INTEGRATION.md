# Card Index Table Integration

This document describes the implementation of dynamic card content population using the `card_index` table across all profile and legislation pages.

## Overview

All profile and legislation pages now dynamically populate their card buttons using data from the `card_index` table instead of hardcoded text. The system now properly separates preview cards from category cards based on the `is_preview` flag.

## Data Source

- **Table**: `card_index`
- **Key Fields**:
  - `owner_id`: Links to the profile/legislation ID
  - `is_ppl`: Boolean indicating profile type (true = politician, false = legislation)
  - `screen`: Determines which page the card appears on
  - `is_preview`: Boolean indicating if the card should be displayed
  - `title`: Card title text
  - `subtext`: Card subtitle text
  - `opens_7d`: Traffic metric for prioritization

- **Tier Source**: 
  - **Politicians**: `tier` is read from `ppl_index` table
  - **Legislation**: `tier` is read from `legi_index` table

## Card Separation Logic

### Preview vs Category Cards

The system now properly separates two types of cards based on the `is_preview` flag:

**Preview Cards (`is_preview = true`):**
- **Purpose**: Main profile overview content
- **Location**: Main profile screens (`sub1`, `sub2`, `sub3`, `legi1`, `legi2`, `legi3`)
- **Function**: Show high-level information and navigation options
- **Data Source**: `fetchCardData()` function

**Category Cards (`is_preview = false`):**
- **Purpose**: Detailed category-specific content
- **Location**: Category pages with filtering functionality (e.g., `sub4` with "Allow Media Sourcing" toggle)
- **Function**: Show filtered, category-specific information
- **Data Source**: `fetchCategoryCardData()` function

## Filtering Logic

### 1. Profile Type Determination
- **Politicians** (`is_ppl = true`): Use `ppl_index` for ID resolution
- **Legislation** (`is_ppl = false`): Use `legi_index` for ID resolution

### 2. Screen Mapping
- **Profile Pages**:
  - `sub1` → `agenda`
  - `sub2` → `identity` 
  - `sub3` → `affiliates`
- **Legislation Pages**:
  - `legi1` → `agenda`
  - `legi2` → `impact`
  - `legi3` → `discourse`

### 3. Card Selection Criteria

**Preview Cards (Main Profile Screens):**
- Only cards where `is_preview = true`
- Appear on: `sub1`, `sub2`, `sub3` (politicians) and `legi1`, `legi2`, `legi3` (legislation)
- Match `owner_id` with current profile/legislation ID
- Match `is_ppl` with current profile type
- Match `screen` with current page

**Category Cards (Category Pages):**
- Only cards where `is_preview = false`
- Appear on category pages with filtering functionality (e.g., `sub4` with "Allow Media Sourcing" toggle)
- Follow all category filtering rules and toggle states
- Match `owner_id` with current profile/legislation ID
- Match `is_ppl` with current profile type
- Match `screen` with current page

### 4. Tier-Based Limits
- **base**: Maximum 10 cards
- **soft**: Maximum 4 cards  
- **hard**: Maximum 3 cards
- When more cards exist than allowed, prioritize by highest `opens_7d` values
- **Tier Application**: Limits are applied by each component using tier values from `ppl_index` (politicians) or `legi_index` (legislation)

## Implementation Details

### Utility Functions (`utils/cardData.ts`)

- `fetchCardData()`: Retrieves preview cards (`is_preview = true`) for main profile screens
- `fetchCategoryCardData()`: Retrieves non-preview cards (`is_preview = false`) for category pages
- `getScreenForPage()`: Maps page names to screen identifiers
- `getScreenMapping()`: Provides screen-to-page mappings

### Profile Pages

All profile subpages now include:
- Card data state management
- Automatic data fetching on component mount
- Dynamic title/subtitle population
- Fallback to default text when no data exists

### Legislation Pages

All legislation pages now include:
- Card data state management  
- Automatic data fetching on component mount
- Dynamic title/subtitle population
- Fallback to default text when no data exists

## Usage Example

```typescript
// Fetch card data for a politician's agenda page
const cards = await fetchCardData({
  ownerId: 123,
  isPpl: true,
  screen: 'agenda'
});

// Cards will be automatically limited by tier and sorted by traffic
```

## Fallback Behavior

When no card data is available from the database:
- Profile pages show default text like "Card 1 Title", "Card 1 subtitle text"
- Legislation pages show default text like "No data", "no data"
- Layout and functionality remain unchanged

## Notes

- **Legislation Implementation**: Currently uses placeholder `ownerId: 1` - proper implementation requires resolving the actual legislation ID from the `legi_index` table
- **Tier Implementation**: Tier values are now properly sourced from `ppl_index` (politicians) and `legi_index` (legislation) instead of `card_index`
- **Card Separation**: Preview cards and category cards are now properly separated using `fetchCardData()` and `fetchCategoryCardData()` respectively
- **Category Pages**: Only pages with filtering functionality (like sub4 with "Allow Media Sourcing" toggle) use non-preview cards
- **Performance**: Card data is fetched once per page load and cached in component state
- **Error Handling**: Database errors are logged and result in empty card arrays (fallback to defaults)
- **No Layout Changes**: Only card content is modified; positioning, styling, and navigation remain identical
