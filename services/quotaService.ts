import { QuotaDeficit, QuotaStatus, SCREEN_MAPPING, TIER_CONFIG } from '../types/pplDataTypes';
import { getSupabaseClient } from '../utils/supabase';

export class QuotaService {
  /**
   * Calculate quota deficits for a specific politician and tier
   * This determines how many cards are needed for the politician's specific tier
   * 
   * IMPORTANT: In production, only call this with the politician's actual tier.
   * Do not test all tiers - only calculate deficits for the tier the politician belongs to.
   */
  static async calculateQuotaDeficits(ownerId: number, tier: string): Promise<QuotaDeficit[]> {
    try {
      console.log(`Calculating quota deficits for owner ${ownerId}, tier: ${tier}`);

      // Get current active cards for this owner
      const { data: activeCards, error: cardsError } = await supabase
        .from('card_index')
        .select('*')
        .eq('owner_id', ownerId)
        .eq('is_active', true)
        .eq('is_ppl', true);

      if (cardsError) {
        throw new Error(`Failed to fetch active cards: ${cardsError.message}`);
      }

      const currentCards = activeCards || [];
      console.log(`Found ${currentCards.length} active cards for owner ${ownerId}`);

      // Get tier configuration
      const tierConfig = TIER_CONFIG[tier as keyof typeof TIER_CONFIG];
      if (!tierConfig) {
        throw new Error(`Invalid tier: ${tier}`);
      }

      const deficits: QuotaDeficit[] = [];

      // Calculate deficits for each screen
      for (const [screen, categories] of Object.entries(SCREEN_MAPPING)) {
        if (tier === 'base') {
          // Base tier: count by screen only
          const currentCount = currentCards.filter(card => card.screen === screen).length;
          const requiredCount = tierConfig.quotas.screen;
          const deficit = Math.max(0, requiredCount - currentCount);

          if (deficit > 0) {
            deficits.push({
              screen,
              category: null,
              currentCount,
              requiredCount,
              deficit,
              tier
            });
          }
        } else {
          // Hard/Soft tiers: count by screen + category
          for (const category of categories) {
            const currentCount = currentCards.filter(
              card => card.screen === screen && card.category === category
            ).length;
            
            // Use different quota for "more" category in hard tier
            let requiredCount;
            if (tier === 'hard' && category === 'more') {
              requiredCount = tierConfig.quotas.more;
            } else {
              requiredCount = tierConfig.quotas.named;
            }
            
            const deficit = Math.max(0, requiredCount - currentCount);

            if (deficit > 0) {
              deficits.push({
                screen,
                category,
                currentCount,
                requiredCount,
                deficit,
                tier
              });
            }
          }
        }
      }

      console.log(`Calculated ${deficits.length} quota deficits for tier ${tier}`);
      return deficits;

    } catch (error) {
      console.error('Error calculating quota deficits:', error);
      throw error;
    }
  }

  /**
   * Get quota status summary for a politician
   */
  static async getQuotaStatus(ownerId: number, tier: string): Promise<QuotaStatus> {
    try {
      const deficits = await this.calculateQuotaDeficits(ownerId, tier);
      
      const totalDeficit = deficits.reduce((sum, deficit) => sum + deficit.deficit, 0);
      const totalRequired = deficits.reduce((sum, deficit) => sum + deficit.requiredCount, 0);
      const totalCurrent = deficits.reduce((sum, deficit) => sum + deficit.currentCount, 0);

      return {
        ownerId,
        tier,
        totalDeficit,
        totalRequired,
        totalCurrent,
        deficits,
        isComplete: totalDeficit === 0,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error getting quota status:', error);
      throw error;
    }
  }

  /**
   * Get cards that need to be created to fill deficits
   */
  static async getCardsToCreate(ownerId: number, tier: string): Promise<Array<{
    screen: string;
    category: string | null;
    count: number;
    priority: number;
  }>> {
    try {
      const deficits = await this.calculateQuotaDeficits(ownerId, tier);
      
      return deficits.map(deficit => ({
        screen: deficit.screen,
        category: deficit.category,
        count: deficit.deficit,
        priority: this.calculatePriority(deficit)
      })).sort((a, b) => b.priority - a.priority); // Sort by priority (highest first)

    } catch (error) {
      console.error('Error getting cards to create:', error);
      throw error;
    }
  }

  /**
   * Calculate priority for a deficit (higher = more urgent)
   */
  private static calculatePriority(deficit: QuotaDeficit): number {
    let priority = 0;
    
    // Base priority by tier
    if (deficit.tier === 'hard') priority += 100;
    else if (deficit.tier === 'soft') priority += 50;
    else if (deficit.tier === 'base') priority += 25;
    
    // Priority by deficit size (larger deficits = higher priority)
    priority += deficit.deficit * 10;
    
    // Priority by screen (agenda_ppl is most important)
    if (deficit.screen === 'agenda_ppl') priority += 20;
    else if (deficit.screen === 'identity') priority += 15;
    else if (deficit.screen === 'affiliates') priority += 10;
    
    return priority;
  }

  /**
   * Check if a specific screen/category combination needs cards
   */
  static async needsCards(ownerId: number, tier: string, screen: string, category?: string): Promise<boolean> {
    try {
      const deficits = await this.calculateQuotaDeficits(ownerId, tier);
      
      if (tier === 'base') {
        return deficits.some(deficit => deficit.screen === screen && deficit.category === null);
      } else {
        return deficits.some(deficit => deficit.screen === screen && deficit.category === category);
      }

    } catch (error) {
      console.error('Error checking if cards are needed:', error);
      return false;
    }
  }

  /**
   * Get detailed breakdown of current card distribution
   */
  static async getCardDistribution(ownerId: number): Promise<{
    byScreen: Record<string, number>;
    byCategory: Record<string, number>;
    byTier: Record<string, number>;
    total: number;
  }> {
    try {
      const { data: activeCards, error: cardsError } = await supabase
        .from('card_index')
        .select('*')
        .eq('owner_id', ownerId)
        .eq('is_active', true)
        .eq('is_ppl', true);

      if (cardsError) {
        throw new Error(`Failed to fetch active cards: ${cardsError.message}`);
      }

      const cards = activeCards || [];
      
      const byScreen: Record<string, number> = {};
      const byCategory: Record<string, number> = {};
      const byTier: Record<string, number> = {};

      cards.forEach(card => {
        // Count by screen
        byScreen[card.screen] = (byScreen[card.screen] || 0) + 1;
        
        // Count by category
        if (card.category) {
          byCategory[card.category] = (byCategory[card.category] || 0) + 1;
        }
        
        // Count by tier (infer from category)
        const tier = this.inferTierFromCategory(card.category);
        byTier[tier] = (byTier[tier] || 0) + 1;
      });

      return {
        byScreen,
        byCategory,
        byTier,
        total: cards.length
      };

    } catch (error) {
      console.error('Error getting card distribution:', error);
      throw error;
    }
  }

  /**
   * Infer tier from category
   */
  private static inferTierFromCategory(category: string | null): string {
    if (!category) return 'base';
    
    const hardCategories = TIER_CONFIG.hard.categories;
    const softCategories = TIER_CONFIG.soft.categories;
    
    if (hardCategories.includes(category)) return 'hard';
    if (softCategories.includes(category)) return 'soft';
    return 'base';
  }
}
