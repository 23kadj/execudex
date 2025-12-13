import { getSupabaseClient } from './supabase';

export interface CardData {
  id: number;
  title: string;
  subtext: string;
  screen: string;
  category?: string;
  opens_7d: number;
  score?: number;
}

export interface CardIndexParams {
  ownerId: number;
  isPpl: boolean;
  screen: string;
}

export interface CategoryCardParams {
  ownerId: number;
  isPpl: boolean;
  screen: string;
  category: string;
}

/**
 * Fetches all card data from card_index table for preview card assignment
 * Cards are sorted by opens_7d descending (with fallback to score) and will be limited by tier in the calling component
 */
export async function fetchCardData({
  ownerId,
  isPpl,
  screen
}: CardIndexParams): Promise<CardData[]> {
  try {
    // Get Supabase client
    const supabase = getSupabaseClient();
    // Build the query with is_active filter
    let query = supabase
      .from('card_index')
      .select('id, title, subtext, screen, category, opens_7d, score')
      .eq('owner_id', ownerId)
      .eq('is_ppl', isPpl)
      .eq('screen', screen)
      .eq('is_active', true);

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching card data:', error);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Sort by opens_7d descending (with fallback to score) to prioritize high-traffic cards
    const sortedData = data.sort((a, b) => {
      // Primary ordering: opens_7d (descending)
      if (a.opens_7d !== null && a.opens_7d !== undefined && 
          b.opens_7d !== null && b.opens_7d !== undefined) {
        return b.opens_7d - a.opens_7d;
      }
      
      // Fallback ordering: score (descending) when opens_7d is not available
      if (a.score !== null && a.score !== undefined && 
          b.score !== null && b.score !== undefined) {
        return b.score - a.score;
      }
      
      // If neither has opens_7d, prioritize the one with score
      if (a.score !== null && a.score !== undefined) return -1;
      if (b.score !== null && b.score !== undefined) return 1;
      
      // If neither has opens_7d nor score, maintain original order
      return 0;
    });

    // Return all matching cards - tier limits will be applied by the calling component
    return sortedData;

  } catch (error) {
    console.error('Error in fetchCardData:', error);
    return [];
  }
}

/**
 * Fetches preview cards based on tier-based allocation with fallback to score
 * This implements the proper procedure: get all cards, sort by opens_7d (fallback to score), allocate by tier
 */
export async function fetchPreviewCardsByTier({
  ownerId,
  isPpl,
  tier
}: {
  ownerId: number;
  isPpl: boolean;
  tier: string;
}): Promise<CardData[]> {
  try {
    // Get Supabase client
    const supabase = getSupabaseClient();
    // Get all active cards for this owner/type
    const { data: allCards, error: allCardsError } = await supabase
      .from('card_index')
      .select('id, title, subtext, screen, category, opens_7d, score')
      .eq('owner_id', ownerId)
      .eq('is_ppl', isPpl)
      .eq('is_active', true);
    
    if (allCardsError) {
      console.error('Error fetching all cards for preview:', allCardsError);
      return [];
    }
    
    if (!allCards || allCards.length === 0) {
      return [];
    }
    
    // Sort cards with fallback logic: opens_7d first, then score
    const sortedCards = allCards.sort((a, b) => {
      // Primary ordering: opens_7d (descending)
      if (a.opens_7d !== null && a.opens_7d !== undefined && 
          b.opens_7d !== null && b.opens_7d !== undefined) {
        return b.opens_7d - a.opens_7d;
      }
      
      // Fallback ordering: score (descending) when opens_7d is not available
      if (a.score !== null && a.score !== undefined && 
          b.score !== null && b.score !== undefined) {
        return b.score - a.score;
      }
      
      // If neither has opens_7d, prioritize the one with score
      if (a.score !== null && a.score !== undefined) return -1;
      if (b.score !== null && b.score !== undefined) return 1;
      
      // If neither has opens_7d nor score, maintain original order
      return 0;
    });
    
    // Determine preview capacity based on tier
    if (isPpl) {
      // Base tier politicians show all active cards (no limit)
      if (tier.toLowerCase() === 'base') {
        return sortedCards; // Return all active cards for base tier
      }
      
      // Apply limits for non-base tiers
      let previewCapacity: number;
      switch (tier.toLowerCase()) {
        case 'hard':
          previewCapacity = 3;  // Up to 3 preview cards
          break;
        case 'soft':
          previewCapacity = 4;  // Up to 4 preview cards
          break;
        default:
          previewCapacity = 10; // Default to base tier behavior
      }
      
      // Return the top N cards by opens_7d and score for preview pages
      // These cards will be excluded from category pages to prevent duplication
      return sortedCards.slice(0, previewCapacity);
    } else {
      // legi profiles always show top 4
      return sortedCards.slice(0, 4);
    }
    
  } catch (error) {
    console.error('Error in fetchPreviewCardsByTier:', error);
    return [];
  }
}

/**
 * Fetches category-specific card data from card_index table for category pages
 * Filters by category and sorts by opens_7d descending (with fallback to score)
 */
export async function fetchCategoryCardData({
  ownerId,
  isPpl,
  screen,
  category
}: CategoryCardParams): Promise<CardData[]> {
  try {
    // Get Supabase client
    const supabase = getSupabaseClient();
    // Build the query for category pages with category filter
    let query = supabase
      .from('card_index')
      .select('id, title, subtext, screen, category, opens_7d, score')
      .eq('owner_id', ownerId)
      .eq('is_ppl', isPpl)
      .eq('screen', screen)
      .eq('category', category)
      .eq('is_active', true);

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching category card data:', error);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Sort by opens_7d descending (with fallback to score)
    const sortedData = data.sort((a, b) => {
      // Primary ordering: opens_7d (descending)
      if (a.opens_7d !== null && a.opens_7d !== undefined && 
          b.opens_7d !== null && b.opens_7d !== undefined) {
        return b.opens_7d - a.opens_7d;
      }
      
      // Fallback ordering: score (descending) when opens_7d is not available
      if (a.score !== null && a.score !== undefined && 
          b.score !== null && b.score !== undefined) {
        return b.score - a.score;
      }
      
      // If neither has opens_7d, prioritize the one with score
      if (a.score !== null && a.score !== undefined) return -1;
      if (b.score !== null && b.score !== undefined) return 1;
      
      // If neither has opens_7d nor score, maintain original order
      return 0;
    });

    return sortedData;

  } catch (error) {
    console.error('Error in fetchCategoryCardData:', error);
    return [];
  }
}

/**
 * Fetches category-specific card data while excluding cards already used in preview slots
 * This ensures each card only appears once across all screens
 * Cards are sorted by opens_7d descending (with fallback to score)
 */
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
    
    // Get Supabase client
    const supabase = getSupabaseClient();
    // Get all cards from preview screens to exclude them
    const previewCardsPromises = previewScreens.map(screen => 
      supabase
        .from('card_index')
        .select('id')
        .eq('owner_id', ownerId)
        .eq('is_ppl', isPpl)
        .eq('screen', screen)
        .eq('is_active', true)
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
      .select('id, title, subtext, screen, category, opens_7d, score')
      .eq('owner_id', ownerId)
      .eq('is_ppl', isPpl)
      .eq('category', category)
      .eq('is_active', true)
      .not('id', 'in', `(${Array.from(previewCardIds).join(',')})`);
    
    if (error) {
      console.error('Error fetching category card data excluding preview:', error);
      return [];
    }
    
    if (!data || data.length === 0) {
      return [];
    }
    
    // Sort by opens_7d descending (with fallback to score)
    const sortedData = data.sort((a, b) => {
      // Primary ordering: opens_7d (descending)
      if (a.opens_7d !== null && a.opens_7d !== undefined && 
          b.opens_7d !== null && b.opens_7d !== undefined) {
        return b.opens_7d - a.opens_7d;
      }
      
      // Fallback ordering: score (descending) when opens_7d is not available
      if (a.score !== null && a.score !== undefined && 
          b.score !== null && b.score !== undefined) {
        return b.score - a.score;
      }
      
      // If neither has opens_7d, prioritize the one with score
      if (a.score !== null && a.score !== undefined) return -1;
      if (b.score !== null && b.score !== undefined) return 1;
      
      // If neither has opens_7d nor score, maintain original order
      return 0;
    });
    
    return sortedData;
    
  } catch (error) {
    console.error('Error in fetchCategoryCardDataExcludingPreview:', error);
    return [];
  }
}

/**
 * Fetches category cards based on tier-based preview allocation with fallback to score
 * This implements the proper procedure: fill preview slots first, then allocate remaining cards to categories
 * Preview cards are excluded from category pages to ensure exclusivity
 */
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
}): Promise<CardData[]> {
  try {
    // Get Supabase client
    const supabase = getSupabaseClient();
    // Get all active cards for this owner/type
    const { data: allCards, error: allCardsError } = await supabase
      .from('card_index')
      .select('id, title, subtext, screen, category, opens_7d, score')
      .eq('owner_id', ownerId)
      .eq('is_ppl', isPpl)
      .eq('is_active', true);
    
    if (allCardsError) {
      console.error('Error fetching all cards:', allCardsError);
      return [];
    }
    
    if (!allCards || allCards.length === 0) {
      return [];
    }
    
    // Sort cards with fallback logic: opens_7d first, then score
    const sortedCards = allCards.sort((a, b) => {
      // Primary ordering: opens_7d (descending)
      if (a.opens_7d !== null && a.opens_7d !== undefined && 
          b.opens_7d !== null && b.opens_7d !== undefined) {
        return b.opens_7d - a.opens_7d;
      }
      
      // Fallback ordering: score (descending) when opens_7d is not available
      if (a.score !== null && a.score !== undefined && 
          b.score !== null && b.score !== undefined) {
        return b.score - a.score;
      }
      
      // If neither has opens_7d, prioritize the one with score
      if (a.score !== null && a.score !== undefined) return -1;
      if (b.score !== null && b.score !== undefined) return 1;
      
      // If neither has opens_7d nor score, maintain original order
      return 0;
    });
    
    // Determine preview capacity based on tier
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
    
    // If base tier, no categories allowed
    if (previewCapacity === 0) {
      return [];
    }
    
    // Get the first N cards for preview slots (these are marked as "used")
    const previewCards = sortedCards.slice(0, previewCapacity);
    const previewCardIds = new Set(previewCards.map(card => card.id));
    
    // Get remaining cards that are eligible for categories
    const remainingCards = sortedCards.slice(previewCapacity);
    
    // Filter remaining cards by category and exclude preview cards
    const categoryCards = remainingCards.filter(card => 
      card.category === category && !previewCardIds.has(card.id)
    );
    
    // Sort by opens_7d descending (with fallback to score)
    const sortedCategoryCards = categoryCards.sort((a, b) => {
      // Primary ordering: opens_7d (descending)
      if (a.opens_7d !== null && a.opens_7d !== undefined && 
          b.opens_7d !== null && b.opens_7d !== undefined) {
        return b.opens_7d - a.opens_7d;
      }
      
      // Fallback ordering: score (descending) when opens_7d is not available
      if (a.score !== null && a.score !== undefined && 
          b.score !== null && b.score !== undefined) {
        return b.score - a.score;
      }
      
      // If neither has opens_7d, prioritize the one with score
      if (a.score !== null && a.score !== undefined) return -1;
      if (b.score !== null && b.score !== undefined) return 1;
      
      // If neither has opens_7d nor score, maintain original order
      return 0;
    });
    
    return sortedCategoryCards;
    
  } catch (error) {
    console.error('Error in fetchCategoryCardsByTier:', error);
    return [];
  }
}

/**
 * Returns default tier for legislation (legi_index.tier column was removed)
 */
export async function fetchLegislationTier(legislationId: number): Promise<string> {
  // Always return 'base' since legi_index.tier column was removed
  return 'base';
}

/**
 * Fetches cards filtered by screen value AND category from card_index table
 * This ensures cards only appear in the correct category pages based on both screen and category
 * AND excludes preview cards from category pages to prevent duplication
 */
export async function fetchCardsByScreen({
  ownerId,
  isPpl,
  pageName,
  tier,
  category
}: {
  ownerId: number;
  isPpl: boolean;
  pageName: string;
  tier?: string;
  category?: string;
}): Promise<CardData[]> {
  try {
    // Get Supabase client
    const supabase = getSupabaseClient();
    // Get all active cards for this owner/type
    const { data: allCards, error: allCardsError } = await supabase
      .from('card_index')
      .select('id, title, subtext, screen, category, opens_7d, score')
      .eq('owner_id', ownerId)
      .eq('is_ppl', isPpl)
      .eq('is_active', true);
    
    if (allCardsError) {
      console.error('Error fetching all cards:', allCardsError);
      return [];
    }
    
    if (!allCards || allCards.length === 0) {
      return [];
    }
    
    // Determine which screen value should be shown on this page
    let targetScreen: string;
    if (isPpl) {
      // Profile pages
      switch (pageName) {
        case 'sub1': targetScreen = 'agenda_ppl'; break;
        case 'sub2': targetScreen = 'identity'; break;
        case 'sub3': targetScreen = 'affiliates'; break;
        default: targetScreen = 'agenda_ppl';
      }
    } else {
      // Legislation pages
      switch (pageName) {
        case 'legi1': targetScreen = 'agenda_legi'; break;
        case 'legi2': targetScreen = 'impact'; break;
        case 'legi3': targetScreen = 'discourse'; break;
        default: targetScreen = 'agenda_legi';
      }
    }
    
    // FIRST FILTER: Filter cards by screen value (cards only show on correct pages)
    let filteredCards = allCards.filter(card => card.screen === targetScreen);
    
    // SECOND FILTER: If category is provided, also filter by category
    if (category) {
      filteredCards = filteredCards.filter(card => card.category === category);
    }
    
    // THIRD FILTER: PREVIEW CARD EXCLUSION - If this is a category page, exclude preview cards
    if (category) {
      // Get the top N preview cards that should be excluded from categories
      const allSortedCards = allCards.sort((a, b) => {
        // Primary ordering: opens_7d (descending)
        if (a.opens_7d !== null && a.opens_7d !== undefined && 
            b.opens_7d !== null && b.opens_7d !== undefined) {
          return b.opens_7d - a.opens_7d;
        }
        
        // Fallback ordering: score (descending) when opens_7d is not available
        if (a.score !== null && a.score !== undefined && 
            b.score !== null && b.score !== undefined) {
          return b.score - a.score;
        }
        
        // If neither has opens_7d, prioritize the one with score
        if (a.score !== null && a.score !== undefined) return -1;
        if (b.score !== null && b.score !== undefined) return 1;
        
        // If neither has opens_7d nor score, maintain original order
        return 0;
      });
      
      // Determine preview capacity based on tier
      let previewCapacity: number;
      if (isPpl) {
        switch (tier?.toLowerCase() || 'base') {
          case 'hard': previewCapacity = 3; break;
          case 'soft': previewCapacity = 4; break;
          case 'base': previewCapacity = 10; break;
          default: previewCapacity = 10;
        }
      } else {
        previewCapacity = 4; // legi profiles always show top 4
      }
      
      // Get the top N preview card IDs to exclude
      const previewCardIds = new Set(allSortedCards.slice(0, previewCapacity).map(card => card.id));
      
      // Remove preview cards from category results
      filteredCards = filteredCards.filter(card => !previewCardIds.has(card.id));
    }
    
    // Sort remaining cards with fallback logic: opens_7d first, then score
    const sortedCards = filteredCards.sort((a, b) => {
      // Primary ordering: opens_7d (descending)
      if (a.opens_7d !== null && a.opens_7d !== undefined && 
          b.opens_7d !== null && b.opens_7d !== undefined) {
        return b.opens_7d - a.opens_7d;
      }
      
      // Fallback ordering: score (descending) when opens_7d is not available
      if (a.score !== null && a.score !== undefined && 
          b.score !== null && b.score !== undefined) {
        return b.score - a.score;
      }
      
      // If neither has opens_7d, prioritize the one with score
      if (a.score !== null && a.score !== undefined) return -1;
      if (b.score !== null && b.score !== undefined) return 1;
      
      // If neither has opens_7d nor score, maintain original order
      return 0;
    });
    
    // Apply tier-based card limit for legi screens (max 4 preview cards)
    if (!isPpl) {
      return sortedCards.slice(0, 4);
    }
    
    // For profile pages, apply tier-based limits
    // Base tier politicians show all active cards (no limit)
    if (tier?.toLowerCase() === 'base' || !tier) {
      return sortedCards; // Return all active cards for base tier or when tier is not specified
    }
    
    // Apply limits for non-base tiers
    let maxCards: number;
    switch (tier.toLowerCase()) {
      case 'hard':
        maxCards = 10;
        break;
      case 'soft':
        maxCards = 6;
        break;
      default:
        maxCards = 4;
        break;
    }
    
    return sortedCards.slice(0, maxCards);
    
  } catch (error) {
    console.error('Error in fetchCardsByScreen:', error);
    return [];
  }
}

/**
 * Maps screen names to their corresponding page identifiers
 */
export function getScreenMapping(isPpl: boolean): Record<string, string> {
  if (isPpl) {
    // Profile pages
    return {
      'agenda': 'sub1',
      'identity': 'sub2',
      'affiliates': 'sub3'
    };
  } else {
    // Legislation pages
    return {
      'agenda': 'legi1',
      'impact': 'legi2',
      'discourse': 'legi3'
    };
  }
}

/**
 * Gets the appropriate screen name for a given page
 */
export function getScreenForPage(pageName: string, isPpl: boolean): string {
  if (isPpl) {
    switch (pageName) {
      case 'sub1': return 'agenda';
      case 'sub2': return 'identity';
      case 'sub3': return 'affiliates';
      default: return 'agenda';
    }
  } else {
    switch (pageName) {
      case 'legi1': return 'agenda';
      case 'legi2': return 'impact';
      case 'legi3': return 'discourse';
      default: return 'agenda';
    }
  }
}

/**
 * Maps category names to their corresponding page titles
 */
export function getCategoryMapping(): Record<string, string> {
  return {
    // Agenda categories
    'economy': 'Economy',
    'environment': 'Environment',
    'social programs': 'Social Programs',
    'immigration': 'Immigration',
    'healthcare': 'Healthcare',
    'education': 'Education',
    'defense': 'Defense',
    'national security': 'National Security',
    'more': 'More Selections',
    
    // Identity categories
    'background': 'Background',
    'career': 'Career',
    'public image': 'Public Image',
    'accomplishments': 'Accomplishments',
    'statements': 'Statements',
    'awards': 'Awards',
    'beliefs': 'Beliefs',
    
    // Affiliates categories
    'party': 'Party',
    'organizations': 'Organizations',
    'businesses': 'Businesses',
    'politicians': 'Politicians',
    'medias': 'Medias',
    'donors': 'Donors',
    'enterprises': 'Enterprises',
    
    // Legislation agenda categories
    'action': 'Action',
    'scope': 'Scope',
    'process': 'Process',
    'exceptions': 'Exceptions',
    
    // Legislation impact categories
    'sectors': 'Sectors',
    'demographics': 'Demographics',
    'regions': 'Regions',
    'aftermath': 'Aftermath',
    
    // Legislation discourse categories
    'backers': 'Backers',
    'opposers': 'Opposers',
    'narratives': 'Narratives',
    'coverage': 'Coverage'
  };
}

/**
 * Gets the category value from a page title
 */
export function getCategoryFromTitle(title: string): string {
  const mapping = getCategoryMapping();
  const normalizedTitle = title.toLowerCase().trim();
  
  for (const [category, pageTitle] of Object.entries(mapping)) {
    if (pageTitle.toLowerCase() === normalizedTitle) {
      return category;
    }
  }
  
  // Default fallback
  return 'more';
}

/**
 * Fetches category-specific card data for legislation profiles (legi4)
 * Shows all cards that match owner_id, is_ppl=false, category, and is_active=true
 * Does not filter by screen - shows all cards for the category
 */
export async function fetchLegislationCategoryCards({
  ownerId,
  category
}: {
  ownerId: number;
  category: string;
}): Promise<CardData[]> {
  try {
    // Get Supabase client
    const supabase = getSupabaseClient();
    // Build the query for legislation category pages
    let query = supabase
      .from('card_index')
      .select('id, title, subtext, screen, category, opens_7d, score')
      .eq('owner_id', ownerId)
      .eq('is_ppl', false)
      .eq('category', category)
      .eq('is_active', true);

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching legislation category card data:', error);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Sort by opens_7d descending (with fallback to score)
    const sortedData = data.sort((a, b) => {
      // Primary ordering: opens_7d (descending)
      if (a.opens_7d !== null && a.opens_7d !== undefined && 
          b.opens_7d !== null && b.opens_7d !== undefined) {
        return b.opens_7d - a.opens_7d;
      }
      
      // Fallback ordering: score (descending) when opens_7d is not available
      if (a.score !== null && a.score !== undefined && 
          b.score !== null && b.score !== undefined) {
        return b.score - a.score;
      }
      
      // If neither has opens_7d, prioritize the one with score
      if (a.score !== null && a.score !== undefined) return -1;
      if (b.score !== null && b.score !== undefined) return 1;
      
      // If neither has opens_7d nor score, maintain original order
      return 0;
    });

    return sortedData;

  } catch (error) {
    console.error('Error in fetchLegislationCategoryCards:', error);
    return [];
  }
}
