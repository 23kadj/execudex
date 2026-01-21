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

/**
 * Calls the profile_opens edge function to increment the opens counter for politician profiles
 * @param profileId - The ID of the profile to increment
 */
export const trackProfileOpen = async (profileId: string): Promise<void> => {
  try {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase.functions.invoke('profile_opens', {
      body: { profileId, isPolitician: true },
    });

    if (error) {
      console.error('Error calling profile_opens function:', error);
      return;
    }

    console.log('Profile open tracked successfully:', data);
  } catch (err) {
    console.error('Unexpected error tracking profile open:', err);
  }
};

/**
 * Calls the profile_opens edge function to increment the profile_visits counter for legislation profiles
 * @param profileId - The ID of the profile to increment
 */
export const trackLegislationProfileOpen = async (profileId: string): Promise<void> => {
  try {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase.functions.invoke('profile_opens', {
      body: { profileId, isPolitician: false },
    });

    if (error) {
      console.error('Error calling profile_opens function for legislation:', error);
      return;
    }

    console.log('Legislation profile visit tracked successfully:', data);
  } catch (err) {
    console.error('Unexpected error tracking legislation profile visit:', err);
  }
};


