import AsyncStorage from '@react-native-async-storage/async-storage';
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
  
  // Clear all local caches and storage
  try {
    await AsyncStorage.clear();
  } catch (error) {
    console.warn('Failed to clear AsyncStorage:', error);
  }
  
  return true;
}
