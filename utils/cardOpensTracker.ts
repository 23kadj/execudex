import { getSupabaseClient } from './supabase';

/**
 * Calls the card_opens edge function to increment the opens_7d counter
 * @param cardId - The ID of the card to increment
 */
export const trackCardOpen = async (cardId: string): Promise<void> => {
  try {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase.functions.invoke('card_opens', {
      body: { cardId },
    });

    if (error) {
      console.error('Error calling card_opens function:', error);
      return;
    }

    console.log('Card open tracked successfully:', data);
  } catch (err) {
    console.error('Unexpected error tracking card open:', err);
  }
};

