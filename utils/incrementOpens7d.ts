import { supabase } from './supabase';

/**
 * Increments the opens_7d column for a card in the card_index table
 * If the value is null, sets it to 1
 * If the value exists, increments it by 1
 * @param cardId - The ID of the card to increment
 */
export const incrementOpens = async (cardId: string) => {
  try {
    const { data, error } = await supabase
      .from("card_index")
      .select("opens_7d")
      .eq("id", cardId)
      .single();

    if (error) {
      console.error("Error fetching opens_7d:", error);
      return;
    }

    const currentValue = data?.opens_7d;
    const newValue = currentValue && Number.isInteger(currentValue)
      ? currentValue + 1
      : 1;

    const { error: updateError } = await supabase
      .from("card_index")
      .update({ opens_7d: newValue })
      .eq("id", cardId);

    if (updateError) {
      console.error("Error updating opens_7d:", updateError);
    }
  } catch (err) {
    console.error("Unexpected error incrementing opens_7d:", err);
  }
};
