import AsyncStorage from '@react-native-async-storage/async-storage';
import { PERSISTENT_ALERT_KEYS } from "../utils/profileAlerts";
import { getSupabaseClient } from "../utils/supabase";

const FUNC_NAME = "delete-account"; // matches your deployed function name

export async function deleteAccountOnServer() {
  // Ensure we have a logged-in user + token
  const { data: { session }, error } = await getSupabaseClient().auth.getSession();
  if (error || !session?.access_token) throw new Error("Not authenticated");

  const { data, error: fnErr } = await getSupabaseClient().functions.invoke(FUNC_NAME, {
    method: "POST",
    headers: {
      // supabase-js will usually attach this automatically, but we're explicit
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
    body: { confirm: true },
  });

  if (fnErr) throw new Error(fnErr.message ?? "Delete failed");
  if (!data?.ok) throw new Error("Delete failed");

  // Sign out locally after server deletes
  await getSupabaseClient().auth.signOut();
  
  // Clear all local caches and storage (but preserve persistent alert preferences)
  try {
    // Save persistent data before clearing
    const persistentData: Record<string, string | null> = {};
    for (const key of PERSISTENT_ALERT_KEYS) {
      persistentData[key] = await AsyncStorage.getItem(key);
    }
    
    // Clear all storage
    await AsyncStorage.clear();
    
    // Restore persistent data
    for (const [key, value] of Object.entries(persistentData)) {
      if (value !== null) {
        await AsyncStorage.setItem(key, value);
      }
    }
  } catch (error) {
    console.warn('Failed to clear AsyncStorage:', error);
  }
  
  return true;
}
