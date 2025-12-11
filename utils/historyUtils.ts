import AsyncStorage from '@react-native-async-storage/async-storage';

export type HistoryItemType = 'ppl' | 'legi' | 'card';

export interface ProfileHistoryItem {
  id: string;
  name: string;
  sub_name: string;
  is_ppl: boolean; // Kept for backward compatibility
  item_type?: HistoryItemType; // New field to distinguish between ppl, legi, and card
  timestamp: number;
}

const HISTORY_STORAGE_KEY_PREFIX = 'profile_history_';
const MAX_HISTORY_ITEMS = 100;

/**
 * Get user-specific storage key
 */
const getHistoryStorageKey = (userId: string | undefined): string => {
  if (!userId) {
    // Fallback for legacy/anonymous usage
    return 'profile_history';
  }
  return `${HISTORY_STORAGE_KEY_PREFIX}${userId}`;
};

// --- Tiny async lock to serialize writes (no external deps) ---
let __historyOp = Promise.resolve<void>(undefined);
const withHistoryLock = async <T>(fn: () => Promise<T>): Promise<T> => {
  let resolveChain: (v: void) => void;
  const next = new Promise<void>(res => (resolveChain = res));
  const prev = __historyOp.finally(() => resolveChain!());
  __historyOp = next; // queue
  await prev;         // wait turn
  try {
    return await fn();
  } catch (e) {
    throw e;
  }
};

/**
 * Add a profile to the history
 */
export const addToHistory = async (profile: {
  id: string;
  name: string;
  sub_name: string;
  is_ppl: boolean;
  item_type?: HistoryItemType;
}, userId?: string) => {
  return withHistoryLock(async () => {
    try {
      const existingHistory = await getHistory(userId);

      // Determine item_type if not provided (for backward compatibility)
      const itemType: HistoryItemType = profile.item_type || (profile.is_ppl ? 'ppl' : 'legi');

      // Composite identity: (id, item_type) - more specific than is_ppl
      const filteredHistory = existingHistory.filter(
        (item) => {
          const existingItemType = item.item_type || (item.is_ppl ? 'ppl' : 'legi');
          return !(item.id === profile.id && existingItemType === itemType);
        }
      );

      const newHistoryItem: ProfileHistoryItem = {
        ...profile,
        item_type: itemType,
        timestamp: Date.now(),
      };

      // Prepend newest, then trim to MAX
      const updatedHistory = [newHistoryItem, ...filteredHistory]
        .slice(0, MAX_HISTORY_ITEMS);

      const storageKey = getHistoryStorageKey(userId);
      await AsyncStorage.setItem(
        storageKey,
        JSON.stringify(updatedHistory)
      );

      return updatedHistory;
    } catch (error) {
      console.error('Error adding to history:', error);
      return [];
    }
  });
};

/**
 * Get the current history
 */
export const getHistory = async (userId?: string): Promise<ProfileHistoryItem[]> => {
  try {
    const storageKey = getHistoryStorageKey(userId);
    const historyData = await AsyncStorage.getItem(storageKey);
    if (!historyData) return [];
    let parsed: unknown;
    try {
      parsed = JSON.parse(historyData);
    } catch {
      // Corrupt storage; reset rather than crash
      await AsyncStorage.removeItem(storageKey);
      return [];
    }
    if (!Array.isArray(parsed)) return [];
    const items = parsed as ProfileHistoryItem[];
    // Always present newest first
    return items
      .filter(Boolean)
      .sort((a, b) => (b?.timestamp ?? 0) - (a?.timestamp ?? 0));
  } catch (error) {
    console.error('Error getting history:', error);
    return [];
  }
};

/**
 * Clear all history
 */
export const clearHistory = async (userId?: string) => {
  try {
    const storageKey = getHistoryStorageKey(userId);
    await AsyncStorage.removeItem(storageKey);
  } catch (error) {
    console.error('Error clearing history:', error);
  }
};

/**
 * Remove a specific profile from history
 */
export const removeFromHistory = async (
  profileId: string, 
  isPplOrItemType?: boolean | HistoryItemType, 
  userId?: string
) => {
  try {
    const existingHistory = await getHistory(userId);
    
    let filteredHistory;
    if (typeof isPplOrItemType === 'string') {
      // New behavior: filter by item_type
      filteredHistory = existingHistory.filter(
        (item) => {
          const itemType = item.item_type || (item.is_ppl ? 'ppl' : 'legi');
          return !(item.id === profileId && itemType === isPplOrItemType);
        }
      );
    } else if (typeof isPplOrItemType === 'boolean') {
      // Backward compatible: filter by is_ppl
      filteredHistory = existingHistory.filter((item) => !(item.id === profileId && item.is_ppl === isPplOrItemType));
    } else {
      // No type specified: remove all with this ID
      filteredHistory = existingHistory.filter((item) => item.id !== profileId);
    }
    
    const storageKey = getHistoryStorageKey(userId);
    await AsyncStorage.setItem(storageKey, JSON.stringify(filteredHistory));
    return filteredHistory;
  } catch (error) {
    console.error('Error removing from history:', error);
    return [];
  }
};

