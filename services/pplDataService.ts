import {
    CardContent,
    CardIndex,
    PPLIndex,
    PPLProfiles,
    QuotaDeficit,
    QuotaStatus,
    SCREEN_MAPPING,
    TIER_CONFIG,
    isValidScreen,
    isValidTier
} from '../types/pplDataTypes';
import { supabase } from '../utils/supabase';
import { ValidationService } from './validationService';

// RPC function calls
export class PPLDataService {
  /**
   * Create a new card with paired content in a single transaction
   */
  static async createCardWithContent(cardData: Partial<CardIndex>, contentData: Partial<CardContent>): Promise<number> {
    const { data, error } = await supabase.functions.invoke('ppl-data-rpc', {
      body: {
        function_name: 'create_card_with_content',
        params: {
          card_data: cardData,
          content_data: contentData
        }
      }
    });

    if (error) throw error;
    return data.card_id;
  }

  /**
   * Revive existing card or insert new one with deduplication
   */
  static async reviveOrInsertCard(
    ownerId: number, 
    normalizedTitle: string, 
    cardData: Partial<CardIndex>, 
    contentData: Partial<CardContent>
  ): Promise<number> {
    const { data, error } = await supabase.functions.invoke('ppl-data-rpc', {
      body: {
        function_name: 'revive_or_insert_card',
        params: {
          owner_id: ownerId,
          normalized_title: normalizedTitle,
          card_data: cardData,
          content_data: contentData
        }
      }
    });

    if (error) throw error;
    return data.card_id;
  }

  /**
   * Get profile data from ppl_index
   */
  static async getProfileIndex(ownerId: number): Promise<PPLIndex | null> {
    const { data, error } = await supabase
      .from('ppl_index')
      .select('id, name, tier')
      .eq('id', ownerId)
      .single();

    if (error) {
      console.error('Error fetching profile index:', error);
      return null;
    }

    return data;
  }

  /**
   * Get existing profile data from ppl_profiles
   */
  static async getProfileData(ownerId: number): Promise<PPLProfiles | null> {
    const { data, error } = await supabase
      .from('ppl_profiles')
      .select('*')
      .eq('index_id', ownerId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error fetching profile data:', error);
      return null;
    }

    return data;
  }

  /**
   * Get active cards for quota calculation
   */
  static async getActiveCards(ownerId: number): Promise<CardIndex[]> {
    const { data, error } = await supabase
      .from('card_index')
      .select('*')
      .eq('owner_id', ownerId)
      .eq('is_active', true);

    if (error) {
      console.error('Error fetching active cards:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Check if metrics need refresh based on updated_at
   */
  static needsMetricsRefresh(profileData: PPLProfiles | null): boolean {
    if (!profileData?.updated_at) return true;
    
    const lastUpdate = new Date(profileData.updated_at);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    return lastUpdate < sevenDaysAgo;
  }

  /**
   * Update profile metrics (only if missing or weekly refresh needed)
   */
  static async updateProfileMetrics(
    ownerId: number, 
    metrics: Partial<Pick<PPLProfiles, 'approval' | 'disapproval' | 'votes' | 'poll_summary' | 'poll_link'>>
  ): Promise<void> {
    // FIRST: Check what already exists
    const existingProfile = await this.getProfileData(ownerId);
    
    if (existingProfile) {
      // Only update if metrics are missing or weekly refresh needed
      const needsRefresh = this.needsMetricsRefresh(existingProfile);
      const hasMissingMetrics = !existingProfile.approval || !existingProfile.disapproval;
      
      if (!needsRefresh && !hasMissingMetrics) {
        console.log(`Profile ${ownerId} metrics are up to date, skipping update`);
        return;
      }
    }

    // Use insert for new profiles, update for existing ones
    if (existingProfile) {
      const { error } = await supabase
        .from('ppl_profiles')
        .update({
          ...metrics,
          updated_at: new Date().toISOString()
        })
        .eq('index_id', ownerId);

      if (error) {
        console.error('Error updating profile metrics:', error);
        throw error;
      }
    } else {
      const { error } = await supabase
        .from('ppl_profiles')
        .insert({
          index_id: ownerId,
          ...metrics,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (error) {
        console.error('Error creating profile metrics:', error);
        throw error;
      }
    }
  }

  /**
   * Update profile synopsis fields (only if missing)
   */
  static async updateProfileSynopsis(
    ownerId: number, 
    synopsis: Partial<Pick<PPLProfiles, 'synopsis' | 'agenda' | 'identity' | 'affiliates'>>
  ): Promise<void> {
    // Validate input data
    const validation = ValidationService.validateProfileData(synopsis);
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    // FIRST: Check what already exists
    const existingProfile = await this.getProfileData(ownerId);
    
    if (existingProfile) {
      // Only update missing fields
      const fieldsToUpdate: any = {};
      let hasUpdates = false;
      
      if (!existingProfile.synopsis && synopsis.synopsis) {
        fieldsToUpdate.synopsis = ValidationService.sanitizeText(synopsis.synopsis);
        hasUpdates = true;
      }
      if (!existingProfile.agenda && synopsis.agenda) {
        fieldsToUpdate.agenda = ValidationService.sanitizeText(synopsis.agenda);
        hasUpdates = true;
      }
      if (!existingProfile.identity && synopsis.identity) {
        fieldsToUpdate.identity = ValidationService.sanitizeText(synopsis.identity);
        hasUpdates = true;
      }
      if (!existingProfile.affiliates && synopsis.affiliates) {
        fieldsToUpdate.affiliates = ValidationService.sanitizeText(synopsis.affiliates);
        hasUpdates = true;
      }
      
      if (!hasUpdates) {
        console.log(`Profile ${ownerId} synopsis fields are complete, skipping update`);
        return;
      }
      
      const { error } = await supabase
        .from('ppl_profiles')
        .update(fieldsToUpdate)
        .eq('index_id', ownerId);

      if (error) {
        console.error('Error updating profile synopsis:', error);
        throw error;
      }
    } else {
      // Create new profile with synopsis
      const sanitizedSynopsis = {
        synopsis: synopsis.synopsis ? ValidationService.sanitizeText(synopsis.synopsis) : undefined,
        agenda: synopsis.agenda ? ValidationService.sanitizeText(synopsis.agenda) : undefined,
        identity: synopsis.identity ? ValidationService.sanitizeText(synopsis.identity) : undefined,
        affiliates: synopsis.affiliates ? ValidationService.sanitizeText(synopsis.affiliates) : undefined,
      };

      const { error } = await supabase
        .from('ppl_profiles')
        .insert({
          index_id: ownerId,
          ...sanitizedSynopsis,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (error) {
        console.error('Error creating profile synopsis:', error);
        throw error;
      }
    }
  }

  /**
   * Calculate quota deficits for a politician
   */
  static async calculateQuotaDeficits(ownerId: number): Promise<QuotaStatus> {
    const profileIndex = await this.getProfileIndex(ownerId);
    if (!profileIndex) {
      throw new Error(`Profile index not found for owner ${ownerId}`);
    }

    const tier = profileIndex.tier;
    if (!isValidTier(tier)) {
      throw new Error(`Invalid tier: ${tier}`);
    }

    const activeCards = await this.getActiveCards(ownerId);
    const deficits: QuotaDeficit[] = [];

    if (tier === 'base') {
      // Base tier: count by screen only
      for (const screen of TIER_CONFIG.base.screens) {
        if (!isValidScreen(screen)) continue;
        
        const current = activeCards.filter(card => card.screen === screen).length;
        const target = TIER_CONFIG.base.quotas.screen;
        const deficit = Math.max(0, target - current);
        
        deficits.push({
          screen,
          current,
          target,
          deficit
        });
      }
    } else {
      // Hard/Soft tier: count by (screen, category) combination
      const tierConfig = TIER_CONFIG[tier];
      
      for (const category of tierConfig.categories) {
        const screen = this.mapCategoryToScreen(category);
        if (!isValidScreen(screen)) continue;
        
        const current = activeCards.filter(card => 
          card.screen === screen && card.category === category
        ).length;
        const target = tierConfig.quotas.named;
        const deficit = Math.max(0, target - current);
        
        deficits.push({
          screen,
          category,
          current,
          target,
          deficit
        });
      }

      // Add "more" category deficits for hard tier
      if (tier === 'hard') {
        for (const screen of TIER_CONFIG.base.screens) {
          if (!isValidScreen(screen)) continue;
          
          const current = activeCards.filter(card => 
            card.screen === screen && card.category === 'more'
          ).length;
          const target = TIER_CONFIG.hard.quotas.more;
          const deficit = Math.max(0, target - current);
          
          deficits.push({
            screen,
            category: 'more',
            current,
            target,
            deficit
          });
        }
      }
    }

    const totalDeficit = deficits.reduce((sum, deficit) => sum + deficit.deficit, 0);

    return {
      ownerId,
      tier,
      deficits,
      totalDeficit
    };
  }

  /**
   * Get cards that need to be created to fill deficits
   */
  static async getCardsToCreate(ownerId: number): Promise<Array<{screen: string, category?: string, count: number}>> {
    const quotaStatus = await this.calculateQuotaDeficits(ownerId);
    
    return quotaStatus.deficits
      .filter(deficit => deficit.deficit > 0)
      .map(deficit => ({
        screen: deficit.screen,
        category: deficit.category,
        count: deficit.deficit
      }));
  }

  /**
   * Map category to screen
   */
  private static mapCategoryToScreen(category: string): string {
    for (const [screen, categories] of Object.entries(SCREEN_MAPPING)) {
      if (categories.includes(category)) {
        return screen;
      }
    }
    return 'agenda_ppl'; // default
  }
}

// Utility functions
export function normalizeTitle(title: string): string {
  return title.toLowerCase().trim().replace(/\s+/g, ' ');
}

export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.hostname}${parsed.pathname}`;
  } catch {
    return url;
  }
}

export function mapCategoryToScreen(category: string): string {
  for (const [screen, categories] of Object.entries(SCREEN_MAPPING)) {
    if (categories.includes(category)) {
      return screen;
    }
  }
  return 'agenda_ppl'; // default
}

export function isOfficialSource(url: string): boolean {
  const officialDomains = ['.gov', '.edu', 'ballotpedia.org', 'britannica.com'];
  return officialDomains.some(domain => url.includes(domain));
}
