import { CardIndex } from '../types/pplDataTypes';
import { getSupabaseClient } from '../utils/supabase';

export interface HousekeepingResult {
  ownerId: number;
  cardsScanned: number;
  cardsDeactivated: number;
  cardsReactivated?: number;
  contentDeleted: number;
  contentProtected: number;
  errors: string[];
  timestamp: string;
}

export class HousekeepingService {
  /**
   * Perform 7-day housekeeping for a specific politician
   * This is the main housekeeping function that should be called when a politician profile is opened
   */
  static async performHousekeeping(ownerId: number): Promise<HousekeepingResult> {
    const result: HousekeepingResult = {
      ownerId,
      cardsScanned: 0,
      cardsDeactivated: 0,
      cardsReactivated: 0,
      contentDeleted: 0,
      contentProtected: 0,
      errors: [],
      timestamp: new Date().toISOString()
    };

    try {
      console.log(`Starting housekeeping for owner ${ownerId}...`);

      // Step 1: Get all cards for this owner (active and inactive)
      const { data: allCards, error: cardsError } = await supabase
        .from('card_index')
        .select('*')
        .eq('owner_id', ownerId);

      if (cardsError) {
        result.errors.push(`Failed to fetch cards: ${cardsError.message}`);
        return result;
      }

      if (!allCards || allCards.length === 0) {
        console.log(`No cards found for owner ${ownerId}`);
        return result;
      }

      result.cardsScanned = allCards.length;
      console.log(`Found ${allCards.length} cards for owner ${ownerId}`);

      // Step 2: Calculate 7-day cutoff date
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      // Step 3: Process each card
      for (const card of allCards) {
        await this.processCard(card, sevenDaysAgo, result);
      }

      console.log(`Housekeeping completed for owner ${ownerId}:`, {
        cardsScanned: result.cardsScanned,
        cardsDeactivated: result.cardsDeactivated,
        cardsReactivated: result.cardsReactivated,
        contentDeleted: result.contentDeleted,
        contentProtected: result.contentProtected
      });

    } catch (error) {
      result.errors.push(`Housekeeping failed: ${error.message}`);
      console.error('Housekeeping error:', error);
    }

    return result;
  }

  /**
   * Process a single card for housekeeping
   */
  private static async processCard(
    card: CardIndex, 
    sevenDaysAgo: Date, 
    result: HousekeepingResult
  ): Promise<void> {
    try {
      const cardCreatedAt = new Date(card.created_at);
      const isOlderThan7Days = cardCreatedAt < sevenDaysAgo;

      // Process cards based on their age and current status
      if (card.is_active && isOlderThan7Days) {
        // Deactivate old active cards
        console.log(`Deactivating old card ${card.id} (created: ${card.created_at})`);

        const { error: deactivateError } = await supabase
          .from('card_index')
          .update({ is_active: false })
          .eq('id', card.id);

        if (deactivateError) {
          result.errors.push(`Failed to deactivate card ${card.id}: ${deactivateError.message}`);
          return;
        }

        result.cardsDeactivated++;

        // Check if card content should be deleted
        await this.processCardContent(card.id, result);
        
      } else if (!card.is_active && !isOlderThan7Days) {
        // Reactivate recent inactive cards
        console.log(`Reactivating recent card ${card.id} (created: ${card.created_at})`);

        const { error: reactivateError } = await supabase
          .from('card_index')
          .update({ is_active: true })
          .eq('id', card.id);

        if (reactivateError) {
          result.errors.push(`Failed to reactivate card ${card.id}: ${reactivateError.message}`);
          return;
        }

        result.cardsReactivated = (result.cardsReactivated || 0) + 1;
      }
    } catch (error) {
      result.errors.push(`Failed to process card ${card.id}: ${error.message}`);
    }
  }

  /**
   * Process card content for deletion (only if not bookmarked)
   */
  private static async processCardContent(cardId: number, result: HousekeepingResult): Promise<void> {
    try {
      // Step 1: Check if this card is bookmarked
      const { data: bookmarks, error: bookmarkError } = await supabase
        .from('bookmarks')
        .select('id')
        .eq('owner_id', cardId)
        .eq('bookmark_type', 'card');

      if (bookmarkError) {
        result.errors.push(`Failed to check bookmarks for card ${cardId}: ${bookmarkError.message}`);
        return;
      }

      // Step 2: If bookmarked, protect the content
      if (bookmarks && bookmarks.length > 0) {
        console.log(`Card ${cardId} is bookmarked, protecting content`);
        result.contentProtected++;
        return;
      }

      // Step 3: Delete the card content (not bookmarked)
      const { error: deleteError } = await supabase
        .from('card_content')
        .delete()
        .eq('card_id', cardId);

      if (deleteError) {
        result.errors.push(`Failed to delete content for card ${cardId}: ${deleteError.message}`);
        return;
      }

      console.log(`Deleted content for unbookmarked card ${cardId}`);
      result.contentDeleted++;

    } catch (error) {
      result.errors.push(`Failed to process content for card ${cardId}: ${error.message}`);
    }
  }

  /**
   * Get housekeeping statistics for a politician
   */
  static async getHousekeepingStats(ownerId: number): Promise<{
    totalCards: number;
    activeCards: number;
    inactiveCards: number;
    oldActiveCards: number;
    bookmarkedCards: number;
  }> {
    try {
      // Get all cards
      const { data: allCards, error: cardsError } = await supabase
        .from('card_index')
        .select('id, is_active, created_at')
        .eq('owner_id', ownerId);

      if (cardsError) {
        throw new Error(`Failed to fetch cards: ${cardsError.message}`);
      }

      const totalCards = allCards?.length || 0;
      const activeCards = allCards?.filter(card => card.is_active).length || 0;
      const inactiveCards = totalCards - activeCards;

      // Calculate old active cards (older than 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const oldActiveCards = allCards?.filter(card => 
        card.is_active && new Date(card.created_at) < sevenDaysAgo
      ).length || 0;

      // Get bookmarked cards count
      const { data: bookmarks, error: bookmarkError } = await supabase
        .from('bookmarks')
        .select('owner_id')
        .eq('bookmark_type', 'card')
        .in('owner_id', allCards?.map(card => card.id) || []);

      if (bookmarkError) {
        throw new Error(`Failed to fetch bookmarks: ${bookmarkError.message}`);
      }

      const bookmarkedCards = bookmarks?.length || 0;

      return {
        totalCards,
        activeCards,
        inactiveCards,
        oldActiveCards,
        bookmarkedCards
      };

    } catch (error) {
      console.error('Failed to get housekeeping stats:', error);
      throw error;
    }
  }

  /**
   * Check if housekeeping is needed for a politician
   */
  static async needsHousekeeping(ownerId: number): Promise<boolean> {
    try {
      const stats = await this.getHousekeepingStats(ownerId);
      return stats.oldActiveCards > 0;
    } catch (error) {
      console.error('Failed to check if housekeeping is needed:', error);
      return false;
    }
  }

  /**
   * Get detailed housekeeping report
   */
  static async getHousekeepingReport(ownerId: number): Promise<{
    stats: any;
    oldCards: CardIndex[];
    bookmarkedCards: number[];
  }> {
    try {
      const stats = await this.getHousekeepingStats(ownerId);

      // Get old active cards details
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: oldCards, error: oldCardsError } = await supabase
        .from('card_index')
        .select('*')
        .eq('owner_id', ownerId)
        .eq('is_active', true)
        .lt('created_at', sevenDaysAgo.toISOString());

      if (oldCardsError) {
        throw new Error(`Failed to fetch old cards: ${oldCardsError.message}`);
      }

      // Get bookmarked card IDs
      const { data: bookmarks, error: bookmarkError } = await supabase
        .from('bookmarks')
        .select('owner_id')
        .eq('bookmark_type', 'card')
        .in('owner_id', oldCards?.map(card => card.id) || []);

      if (bookmarkError) {
        throw new Error(`Failed to fetch bookmarks: ${bookmarkError.message}`);
      }

      const bookmarkedCards = bookmarks?.map(b => b.owner_id) || [];

      return {
        stats,
        oldCards: oldCards || [],
        bookmarkedCards
      };

    } catch (error) {
      console.error('Failed to get housekeeping report:', error);
      throw error;
    }
  }
}
