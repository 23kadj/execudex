import { supabase } from '../utils/supabase';

interface CardGenerationResult {
  success: boolean;
  message: string;
  lowMateriality?: boolean;
  suggestUI?: {
    collapse_pages?: string[];
    show_synopsis_link?: boolean;
    congress_link?: string;
  };
}


export class CardGenerationService {
  /**
   * Check card count for politician main screens (sub1, sub2, sub3)
   */
  static async checkPoliticianCardCount(politicianId: number, screen: string): Promise<number> {
    try {
      let screenValue = '';
      switch (screen) {
        case 'sub1':
          screenValue = 'agenda_ppl';
          break;
        case 'sub2':
          screenValue = 'identity';
          break;
        case 'sub3':
          screenValue = 'affiliates';
          break;
        default:
          return 0;
      }

      const { count, error } = await supabase
        .from('card_index')
        .select('*', { count: 'exact', head: true })
        .eq('owner_id', politicianId)
        .eq('is_ppl', true)
        .eq('screen', screenValue)
        .eq('is_active', true);

      if (error) {
        console.error(`Error checking card count for ${screen}:`, error);
        return 0;
      }

      return count || 0;
    } catch (error) {
      console.error('Error in checkPoliticianCardCount:', error);
      return 0;
    }
  }

  /**
   * Check card count for politician category pages (sub4)
   */
  static async checkCategoryCardCount(politicianId: number, category: string): Promise<number> {
    try {
      const { count, error } = await supabase
        .from('card_index')
        .select('*', { count: 'exact', head: true })
        .eq('owner_id', politicianId)
        .eq('is_ppl', true)
        .eq('category', category)
        .eq('is_active', true);

      if (error) {
        console.error(`Error checking category card count for politicians:`, error);
        return 0;
      }

      return count || 0;
    } catch (error) {
      console.error('Error checking category card count for politicians:', error);
      return 0;
    }
  }

  /**
   * Check card count for legislation (legi3)
   */
  static async checkLegislationCardCount(legislationId: number): Promise<number> {
    try {
      const { count, error } = await supabase
        .from('card_index')
        .select('*', { count: 'exact', head: true })
        .eq('owner_id', legislationId)
        .eq('is_ppl', false)
        .eq('is_active', true);

      if (error) {
        console.error('Error checking legislation card count:', error);
        return 0;
      }

      return count || 0;
    } catch (error) {
      console.error('Error in checkLegislationCardCount:', error);
      return 0;
    }
  }


  /**
   * Execute ppl_round2 script
   */
  static async executePplRound2(politicianId: number, categories: string[]): Promise<CardGenerationResult> {
    try {
      console.log(`Executing ppl_round2 for politician ${politicianId} with categories:`, categories);
      
      const { data, error } = await supabase.functions.invoke('ppl_round2', {
        body: {
          id: politicianId,
          categories: categories
        }
      });

      if (error) {
        console.error('Error in ppl_round2:', error);
        return { success: false, message: 'Failed to search for new content' };
      }

      console.log('ppl_round2 completed successfully:', data);
      return { success: true, message: 'Content search completed' };
    } catch (error) {
      console.error('Error executing ppl_round2:', error);
      return { success: false, message: 'Failed to search for new content' };
    }
  }

  /**
   * Execute ppl_card_gen script
   */
  static async executePplCardGen(politicianId: number, webIds?: number[]): Promise<CardGenerationResult & { data?: any }> {
    try {
      console.log(`Executing ppl_card_gen for politician ${politicianId}`, webIds ? `with web_ids: ${webIds.join(',')}` : '');
      
      const requestBody: any = { id: politicianId };
      if (webIds && webIds.length > 0) {
        requestBody.web_ids = webIds;
      }

      const { data, error } = await supabase.functions.invoke('ppl_card_gen', {
        body: requestBody
      });

      if (error) {
        console.error('Error in ppl_card_gen:', error);
        return { success: false, message: 'Failed to generate cards' };
      }

      console.log('ppl_card_gen completed successfully:', data);
      return { success: true, message: 'Cards generated successfully', data };
    } catch (error) {
      console.error('Error executing ppl_card_gen:', error);
      return { success: false, message: 'Failed to generate cards' };
    }
  }

  /**
   * Execute bill_cards script for legislation
   */
  static async executeBillCards(legislationId: number): Promise<CardGenerationResult & { data?: any }> {
    try {
      console.log(`Executing bill_cards for legislation ${legislationId}`);
      
      const { data, error } = await supabase.functions.invoke('bill_cards', {
        body: {
          id: legislationId
        }
      });

      if (error) {
        console.error('Error in bill_cards:', error);
        return { success: false, message: 'Failed to generate bill cards' };
      }

      console.log('bill_cards completed successfully:', data);
      
      // Check for low_materiality status
      if (data?.status === 'low_materiality') {
        return { 
          success: true, 
          message: 'Bill cards generated successfully',
          lowMateriality: true,
          suggestUI: data.suggest_ui,
          data
        };
      }
      
      return { success: true, message: 'Bill cards generated successfully', data };
    } catch (error) {
      console.error('Error executing bill_cards:', error);
      return { success: false, message: 'Failed to generate bill cards' };
    }
  }

  /**
   * Execute bill_coverage script for legislation
   */
  static async executeBillCoverage(legislationId: number): Promise<CardGenerationResult> {
    try {
      console.log(`Executing bill_coverage for legislation ${legislationId}`);
      
      const { data, error } = await supabase.functions.invoke('bill_coverage', {
        body: {
          id: legislationId
        }
      });

      if (error) {
        console.error('Error in bill_coverage:', error);
        return { success: false, message: 'Failed to generate bill coverage' };
      }

      console.log('bill_coverage completed successfully:', data);
      
      // Check if no cards were inserted (insufficient material)
      if (data?.inserted === 0) {
        return { 
          success: true, 
          message: 'Bill coverage generated successfully',
          lowMateriality: true
        };
      }
      
      return { success: true, message: 'Bill coverage generated successfully' };
    } catch (error) {
      console.error('Error executing bill_coverage:', error);
      return { success: false, message: 'Failed to generate bill coverage' };
    }
  }

  /**
   * Map category display name to enum value
   */
  static mapCategoryToEnum(displayName: string): string {
    const categoryMap: { [key: string]: string } = {
      'economy': 'economy',
      'immigration': 'immigration',
      'healthcare': 'healthcare',
      'defense': 'defense',
      'environment': 'environment',
      'education': 'education',
      'background': 'background',
      'career': 'career',
      'public image': 'public image',
      'accomplishments': 'accomplishments',
      'statements': 'statements',
      'awards': 'awards',
      'party': 'party',
      'organizations': 'organizations',
      'businesses': 'businesses',
      'politicians': 'politicians',
      'medias': 'medias',
      'donors': 'donors',
      'more': 'more',
      'social programs': 'social programs',
      'national security': 'national security',
      'beliefs': 'beliefs',
      'enterprises': 'enterprises',
      'action': 'action',
      'scope': 'scope',
      'process': 'process',
      'exceptions': 'exceptions',
      'sectors': 'sectors',
      'demographics': 'demographics',
      'regions': 'regions',
      'aftermath': 'aftermath',
      'backers': 'backers',
      'opposers': 'opposers',
      'narratives': 'narratives',
      'coverage': 'coverage'
    };

    // Case-insensitive matching
    const lowerDisplayName = displayName.toLowerCase();
    return categoryMap[lowerDisplayName] || lowerDisplayName;
  }

  /**
   * Main function to handle card generation for politician pages
   * NEW LOGIC: Prioritize existing web content before checking card limits
   */
  static async generatePoliticianCards(
    politicianId: number, 
    screen: string, 
    category?: string
  ): Promise<CardGenerationResult> {
    try {
      let keyword = '';
      let maxCards = 0;

      if (screen === 'sub4' && category) {
        // Category page (sub4)
        keyword = this.mapCategoryToEnum(category);
        maxCards = 15;

        // STEP 2: Check for existing web content FIRST (priority)
        const existingWebIds = await this.checkExistingWebContentForCategory(politicianId, keyword);
        
        if (existingWebIds.length > 0) {
          console.log(`Found ${existingWebIds.length} existing web content items for category ${keyword}`);
          return await this.executePplCardGen(politicianId, existingWebIds);
        }

        // STEP 3: No existing content - check card count
        const cardCount = await this.checkCategoryCardCount(politicianId, keyword);
        if (cardCount >= maxCards) {
          return { success: false, message: `Card limit reached (${maxCards} cards)` };
        }

        // STEP 4: Search for new content
        console.log(`No existing web content found for category ${keyword}, searching for new content`);
        const round2Result = await this.executePplRound2(politicianId, [keyword]);
        if (!round2Result.success) {
          return round2Result;
        }
        return await this.executePplCardGen(politicianId);
      } else {
        // Main screen pages (sub1, sub2, sub3)
        switch (screen) {
          case 'sub1':
            keyword = 'agenda';
            break;
          case 'sub2':
            keyword = 'identity';
            break;
          case 'sub3':
            keyword = 'affiliates';
            break;
          default:
            return { success: false, message: 'Invalid screen type' };
        }
        maxCards = 100;

        // STEP 2: Check for existing web content FIRST (priority)
        let existingWebIds = await this.checkExistingWebContentForPage(politicianId, screen);
        
        if (existingWebIds.length === 0) {
          // Fallback: check for any unused web content
          existingWebIds = await this.checkAnyExistingWebContent(politicianId);
        }

        if (existingWebIds.length > 0) {
          console.log(`Found ${existingWebIds.length} existing web content items for page ${screen}`);
          return await this.executePplCardGen(politicianId, existingWebIds);
        }

        // STEP 3: No existing content - check card count
        const cardCount = await this.checkPoliticianCardCount(politicianId, screen);
        if (cardCount >= maxCards) {
          return { success: false, message: `Card limit reached (${maxCards} cards)` };
        }

        // STEP 4: Search for new content
        console.log(`No existing web content found for page ${screen}, searching for new content`);
        const round2Result = await this.executePplRound2(politicianId, [keyword]);
        if (!round2Result.success) {
          return round2Result;
        }
        return await this.executePplCardGen(politicianId);
      }
    } catch (error) {
      console.error('Error in generatePoliticianCards:', error);
      return { success: false, message: 'Failed to generate cards' };
    }
  }

  /**
   * Main function to handle card generation for legislation pages
   */
  static async generateLegislationCards(legislationId: number): Promise<CardGenerationResult> {
    try {
      const cardCount = await this.checkLegislationCardCount(legislationId);
      const maxCards = 100;

      // Check if card limit reached
      if (cardCount >= maxCards) {
        return { success: false, message: `Card limit reached (${maxCards} cards)` };
      }

      // Execute bill_coverage script
      return await this.executeBillCoverage(legislationId);
    } catch (error) {
      console.error('Error in generateLegislationCards:', error);
      return { success: false, message: 'Failed to generate cards' };
    }
  }

  /**
   * Check if Agenda button should be visible for legi1
   * Conditions: is_ppl = false, owner_id matches, used = false/NULL, path contains "billtext"
   */
  static async checkAgendaButtonVisibility(legislationId: number): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('web_content')
        .select('id')
        .eq('owner_id', legislationId)
        .eq('is_ppl', false)
        .or('used.is.null,used.eq.false')
        .ilike('path', '%billtext%')
        .limit(1);

      if (error) {
        console.error('Error checking agenda button visibility:', error);
        return false;
      }

      return data && data.length > 0;
    } catch (error) {
      console.error('Error in checkAgendaButtonVisibility:', error);
      return false;
    }
  }

  /**
   * Check if Impact button should be visible for legi2
   * Conditions: is_ppl = false, owner_id matches, used = false/NULL, path contains "coverage"
   */
  static async checkImpactButtonVisibility(legislationId: number): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('web_content')
        .select('id')
        .eq('owner_id', legislationId)
        .eq('is_ppl', false)
        .or('used.is.null,used.eq.false')
        .ilike('path', '%coverage%')
        .limit(1);

      if (error) {
        console.error('Error checking impact button visibility:', error);
        return false;
      }

      return data && data.length > 0;
    } catch (error) {
      console.error('Error in checkImpactButtonVisibility:', error);
      return false;
    }
  }

  /**
   * Check if Discourse button should be visible for legi3
   * Conditions: is_ppl = false, owner_id matches, used = false/NULL, path contains "coverage"
   */
  static async checkDiscourseButtonVisibility(legislationId: number): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('web_content')
        .select('id')
        .eq('owner_id', legislationId)
        .eq('is_ppl', false)
        .or('used.is.null,used.eq.false')
        .ilike('path', '%coverage%')
        .limit(1);

      if (error) {
        console.error('Error checking discourse button visibility:', error);
        return false;
      }

      return data && data.length > 0;
    } catch (error) {
      console.error('Error in checkDiscourseButtonVisibility:', error);
      return false;
    }
  }

  /**
   * Check for existing web content for a specific category
   * Looks for rows with category name in path (e.g., ppl/1/environment.782.federalregister.2.txt)
   */
  static async checkExistingWebContentForCategory(politicianId: number, category: string): Promise<number[]> {
    try {
      const { data, error } = await supabase
        .from('web_content')
        .select('id')
        .eq('owner_id', politicianId)
        .eq('is_ppl', true)
        .or('used.is.null,used.eq.false')
        .ilike('path', `%${category}%`)
        .limit(5);

      if (error) {
        console.error(`Error checking existing web content for category ${category}:`, error);
        return [];
      }

      return (data || []).map(row => row.id);
    } catch (error) {
      console.error('Error in checkExistingWebContentForCategory:', error);
      return [];
    }
  }

  /**
   * Check for existing web content for a specific page
   * Looks for rows with any of the page's categories or page name in path
   */
  static async checkExistingWebContentForPage(politicianId: number, screen: string): Promise<number[]> {
    try {
      // Define page categories
      const pageCategories: { [key: string]: string[] } = {
        'sub1': ['economy', 'immigration', 'healthcare', 'defense', 'environment', 'education', 'agenda'],
        'sub2': ['background', 'career', 'public image', 'accomplishments', 'statements', 'awards', 'identity'],
        'sub3': ['party', 'organizations', 'businesses', 'medias', 'politicians', 'donors', 'affiliates']
      };

      const categories = pageCategories[screen] || [];
      const searchTerms = [...categories, screen.replace('sub', '')]; // Add page name

      // Build ILIKE conditions for all search terms
      const conditions = searchTerms.map(term => `path.ilike.%${term}%`).join(',');

      const { data, error } = await supabase
        .from('web_content')
        .select('id')
        .eq('owner_id', politicianId)
        .eq('is_ppl', true)
        .or('used.is.null,used.eq.false')
        .or(conditions)
        .limit(5);

      if (error) {
        console.error(`Error checking existing web content for page ${screen}:`, error);
        return [];
      }

      return (data || []).map(row => row.id);
    } catch (error) {
      console.error('Error in checkExistingWebContentForPage:', error);
      return [];
    }
  }

  /**
   * Check for any existing unused web content for a politician (fallback)
   */
  static async checkAnyExistingWebContent(politicianId: number): Promise<number[]> {
    try {
      const { data, error } = await supabase
        .from('web_content')
        .select('id')
        .eq('owner_id', politicianId)
        .eq('is_ppl', true)
        .or('used.is.null,used.eq.false')
        .limit(5);

      if (error) {
        console.error('Error checking any existing web content:', error);
        return [];
      }

      return (data || []).map(row => row.id);
    } catch (error) {
      console.error('Error in checkAnyExistingWebContent:', error);
      return [];
    }
  }

  /**
   * Check if there are any unused web content sources available for a politician
   * Returns true if there are unused sources, false if all sources are used
   */
  static async hasUnusedWebContent(politicianId: number): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('web_content')
        .select('id')
        .eq('owner_id', politicianId)
        .eq('is_ppl', true)
        .or('used.is.null,used.eq.false')
        .limit(1);

      if (error) {
        console.error('Error checking for unused web content:', error);
        return false;
      }

      return data && data.length > 0;
    } catch (error) {
      console.error('Error in hasUnusedWebContent:', error);
      return false;
    }
  }

  /**
   * Check if generate button should be shown for politician main screens
   * NEW LOGIC: Show button if EITHER under card limit OR unused sources available
   */
  static async shouldShowGenerateButtonForPage(politicianId: number, screen: string): Promise<boolean> {
    try {
      const cardCount = await this.checkPoliticianCardCount(politicianId, screen);
      const maxCards = 100;
      
      // If under card limit, always show button
      if (cardCount < maxCards) {
        return true;
      }
      
      // If at card limit, check for unused sources
      let existingWebIds = await this.checkExistingWebContentForPage(politicianId, screen);
      
      if (existingWebIds.length === 0) {
        // Fallback: check for any unused web content
        existingWebIds = await this.checkAnyExistingWebContent(politicianId);
      }
      
      // Show button if unused sources available (even if at card limit)
      return existingWebIds.length > 0;
    } catch (error) {
      console.error('Error in shouldShowGenerateButtonForPage:', error);
      return false;
    }
  }

  /**
   * Check if generate button should be shown for politician category pages
   * NEW LOGIC: Show button if EITHER under card limit OR unused sources available
   */
  static async shouldShowGenerateButtonForCategory(politicianId: number, category: string): Promise<boolean> {
    try {
      const cardCount = await this.checkCategoryCardCount(politicianId, category);
      const maxCards = 15;
      
      // If under card limit, always show button
      if (cardCount < maxCards) {
        return true;
      }
      
      // If at card limit, check for unused sources
      const existingWebIds = await this.checkExistingWebContentForCategory(politicianId, category);
      
      if (existingWebIds.length === 0) {
        // Fallback: check for any unused web content
        const anyUnusedIds = await this.checkAnyExistingWebContent(politicianId);
        return anyUnusedIds.length > 0;
      }
      
      // Show button if unused sources available (even if at card limit)
      return existingWebIds.length > 0;
    } catch (error) {
      console.error('Error in shouldShowGenerateButtonForCategory:', error);
      return false;
    }
  }

  /**
   * Generate cards for Agenda button (legi1) - uses bill_cards script
   */
  static async generateAgendaCards(legislationId: number): Promise<CardGenerationResult> {
    try {
      return await this.executeBillCards(legislationId);
    } catch (error) {
      console.error('Error in generateAgendaCards:', error);
      return { success: false, message: 'Failed to generate agenda cards' };
    }
  }

  /**
   * Generate cards for Impact button (legi2) - uses bill_cards script
   */
  static async generateImpactCards(legislationId: number): Promise<CardGenerationResult> {
    try {
      return await this.executeBillCards(legislationId);
    } catch (error) {
      console.error('Error in generateImpactCards:', error);
      return { success: false, message: 'Failed to generate impact cards' };
    }
  }

  /**
   * Generate cards for Discourse button (legi3) - uses bill_coverage script
   */
  static async generateDiscourseCards(legislationId: number): Promise<CardGenerationResult> {
    try {
      return await this.executeBillCoverage(legislationId);
    } catch (error) {
      console.error('Error in generateDiscourseCards:', error);
      return { success: false, message: 'Failed to generate discourse cards' };
    }
  }


  /**
   * Check if legislation is marked as weak
   */
  static async isLegislationWeak(legislationId: number): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('legi_index')
        .select('weak')
        .eq('id', legislationId)
        .maybeSingle();

      if (error || !data) return false;
      return !!data.weak;
    } catch (error) {
      console.error('Error in isLegislationWeak:', error);
      return false;
    }
  }


  /**
   * Mark politician as weak using profile_labeling edge function
   */
  static async markPoliticianAsWeak(politicianId: number): Promise<void> {
    try {
      const { data, error } = await supabase.functions.invoke('profile_labeling', {
        body: {
          profileId: politicianId,
          profileType: 'politician',
          action: 'mark_weak'
        }
      });

      if (error) {
        console.error('Error marking politician as weak:', error);
      } else {
        console.log(`Marked politician ${politicianId} as weak via edge function`);
      }
    } catch (error) {
      console.error('Error in markPoliticianAsWeak:', error);
    }
  }

  /**
   * Mark legislation as weak using profile_labeling edge function
   */
  static async markLegislationAsWeak(legislationId: number): Promise<void> {
    try {
      const { data, error } = await supabase.functions.invoke('profile_labeling', {
        body: {
          profileId: legislationId,
          profileType: 'legislation',
          action: 'mark_weak'
        }
      });

      if (error) {
        console.error('Error marking legislation as weak:', error);
      } else {
        console.log(`Marked legislation ${legislationId} as weak via edge function`);
      }
    } catch (error) {
      console.error('Error in markLegislationAsWeak:', error);
    }
  }

  /**
   * Unlock politician profile by setting weak to false using edge function
   */
  static async unlockPoliticianProfile(politicianId: number): Promise<void> {
    try {
      const { data, error } = await supabase.functions.invoke('profile_labeling', {
        body: {
          profileId: politicianId,
          profileType: 'politician',
          action: 'mark_unweak'
        }
      });

      if (error) {
        console.error('Error unlocking politician profile:', error);
      } else {
        console.log(`Unlocked politician ${politicianId} profile via edge function`);
      }
    } catch (error) {
      console.error('Error in unlockPoliticianProfile:', error);
    }
  }

  /**
   * Unlock legislation profile by setting weak to false using edge function
   */
  static async unlockLegislationProfile(legislationId: number): Promise<void> {
    try {
      const { data, error } = await supabase.functions.invoke('profile_labeling', {
        body: {
          profileId: legislationId,
          profileType: 'legislation',
          action: 'mark_unweak'
        }
      });

      if (error) {
        console.error('Error unlocking legislation profile:', error);
      } else {
        console.log(`Unlocked legislation ${legislationId} profile via edge function`);
      }
    } catch (error) {
      console.error('Error in unlockLegislationProfile:', error);
    }
  }

  /**
   * Check if Generate New Cards button should be shown for synopsis page (politicians)
   * Shows button if: NOT weak AND has no cards
   */
  static async shouldShowGenerateButtonForSynopsis(politicianId: number): Promise<boolean> {
    try {
      // Step 1: Check if politician is marked as weak
      const { data: indexData, error: indexError } = await supabase
        .from('ppl_index')
        .select('weak')
        .eq('id', politicianId)
        .single();

      if (indexError || !indexData) {
        console.error('Error fetching politician weak status:', indexError);
        return false;
      }

      // If profile is marked as weak, don't show button
      if (indexData.weak === true) {
        console.log(`Politician ${politicianId} is marked as weak - hiding button`);
        return false;
      }

      // Step 2: Check if politician has any cards (check all screens)
      const agendaCount = await this.checkPoliticianCardCount(politicianId, 'sub1');
      const identityCount = await this.checkPoliticianCardCount(politicianId, 'sub2');
      const affiliatesCount = await this.checkPoliticianCardCount(politicianId, 'sub3');
      const totalCards = agendaCount + identityCount + affiliatesCount;
      const hasCards = totalCards > 0;
      
      console.log(`Politician ${politicianId} button visibility:`, {
        isWeak: indexData.weak,
        totalCards,
        hasCards,
        shouldShow: !hasCards
      });

      // Show button if NOT weak AND has no cards
      return !hasCards;
    } catch (error) {
      console.error('Error in shouldShowGenerateButtonForSynopsis:', error);
      return false;
    }
  }

  /**
   * Check if Generate New Cards button should be shown for overview page (legislation)
   * Shows button if: NOT weak AND has no cards
   */
  static async shouldShowGenerateButtonForOverview(legislationId: number): Promise<boolean> {
    try {
      // Step 1: Check if legislation is marked as weak
      const { data: indexData, error: indexError } = await supabase
        .from('legi_index')
        .select('weak')
        .eq('id', legislationId)
        .single();

      if (indexError || !indexData) {
        console.error('Error fetching legislation weak status:', indexError);
        return false;
      }

      // If profile is marked as weak, don't show button
      if (indexData.weak === true) {
        console.log(`Legislation ${legislationId} is marked as weak - hiding button`);
        return false;
      }

      // Step 2: Check if legislation has any cards
      const cardCount = await this.checkLegislationCardCount(legislationId);
      const hasCards = cardCount > 0;
      
      console.log(`Legislation ${legislationId} button visibility:`, {
        isWeak: indexData.weak,
        cardCount,
        hasCards,
        shouldShow: !hasCards
      });

      // Show button if NOT weak AND has no cards
      return !hasCards;
    } catch (error) {
      console.error('Error in shouldShowGenerateButtonForOverview:', error);
      return false;
    }
  }
}
