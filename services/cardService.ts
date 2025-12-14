import { getSupabaseClient } from '../utils/supabase';

type LoadingCallback = (loading: boolean) => void;

export class CardService {
  private static abortControllers: Map<number, AbortController> = new Map();

  /**
   * Check if card content already exists in card_content table
   */
  static async hasCardContent(cardId: number): Promise<boolean> {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('card_content')
        .select('id')
        .eq('card_id', cardId)
        .limit(1);

      if (error) {
        console.error('Error checking card content:', error);
        return false;
      }

      const hasContent = data && data.length > 0;
      console.log(`Card ${cardId} has existing content: ${hasContent}`);
      return hasContent;
    } catch (error) {
      console.error('Error in hasCardContent:', error);
      return false;
    }
  }

  /**
   * Cancel card generation for a specific card
   */
  static cancelCardGeneration(cardId: number): void {
    const controller = this.abortControllers.get(cardId);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(cardId);
      console.log(`Card generation cancelled for card ID: ${cardId}`);
    }
  }

  /**
   * Execute full_card_gen script for a card with loading callback and content check
   */
  static async generateFullCard(cardId: number, onLoading?: LoadingCallback, isPpl: boolean = true): Promise<void> {
    // Create abort controller for this card
    const abortController = new AbortController();
    this.abortControllers.set(cardId, abortController);

    try {
      // Check if card content already exists
      const hasContent = await this.hasCardContent(cardId);
      if (hasContent) {
        console.log(`Card ${cardId} already has content, skipping full_card_gen`);
        this.abortControllers.delete(cardId);
        return;
      }

      // Check if already cancelled
      if (abortController.signal.aborted) {
        console.log(`Card generation was cancelled for card ID: ${cardId}`);
        throw new Error('CANCELLED');
      }

      console.log(`Executing full_card_gen for card ID: ${cardId}`);
      
      // Show loading indicator
      onLoading?.(true);
      
      const { data, error } = await getSupabaseClient().functions.invoke('full_card_gen', {
        body: {
          id: cardId,
          is_ppl: isPpl
        }
      });

      // Check if cancelled after async operation
      if (abortController.signal.aborted) {
        console.log(`Card generation was cancelled for card ID: ${cardId}`);
        throw new Error('CANCELLED');
      }

      if (error) {
        console.error('Error in full_card_gen:', error);
        throw error;
      }

      console.log('full_card_gen completed successfully:', data);
    } catch (error: any) {
      // Check if error is due to cancellation
      if (error?.message === 'CANCELLED' || abortController.signal.aborted) {
        console.log('Card generation cancelled by user');
        throw new Error('CANCELLED');
      }
      console.error('Error executing full_card_gen:', error);
      throw error;
    } finally {
      // Hide loading indicator
      onLoading?.(false);
      // Clean up abort controller
      this.abortControllers.delete(cardId);
    }
  }
}
