import { supabase } from './supabase';

export type BookmarkType = 'ppl' | 'legi' | 'card';

export interface BookmarkData {
  id: string;
  user_id?: string;
  owner_id: string;
  bookmark_type: BookmarkType;
  created_at?: string;
}

/**
 * Check if an item is bookmarked by the current user
 */
export async function checkBookmarkStatus(
  userId: string,
  ownerId: string,
  bookmarkType: BookmarkType
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('bookmarks')
      .select('*')
      .eq('user_id', userId)
      .eq('owner_id', ownerId)
      .eq('bookmark_type', bookmarkType)
      .single();

    if (error) {
      return false;
    }

    return !!data;
  } catch (error) {
    console.error('Error checking bookmark status:', error);
    return false;
  }
}

/**
 * Add a bookmark for an item
 */
export async function addBookmark(
  userId: string | undefined,
  ownerId: string,
  bookmarkType: BookmarkType
): Promise<boolean> {
  try {
    const bookmarkData: any = {
      owner_id: ownerId,
      bookmark_type: bookmarkType,
      created_at: new Date().toISOString()
    };
    
    // Only add user_id if provided
    if (userId) {
      bookmarkData.user_id = userId;
    }

    const { error } = await supabase
      .from('bookmarks')
      .insert(bookmarkData);

    if (error) {
      console.error('Error adding bookmark:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error adding bookmark:', error);
    return false;
  }
}

/**
 * Remove a bookmark for an item
 */
export async function removeBookmark(
  userId: string | undefined,
  ownerId: string,
  bookmarkType: BookmarkType
): Promise<boolean> {
  try {
    let query = supabase
      .from('bookmarks')
      .delete()
      .eq('owner_id', ownerId)
      .eq('bookmark_type', bookmarkType);
    
    // If userId is provided, filter by user, otherwise remove all matching bookmarks
    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { error } = await query;

    if (error) {
      console.error('Error removing bookmark:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error removing bookmark:', error);
    return false;
  }
}

/**
 * Toggle bookmark status for an item
 */
export async function toggleBookmark(
  userId: string | undefined,
  ownerId: string,
  bookmarkType: BookmarkType,
  currentStatus: boolean
): Promise<boolean> {
  try {
    if (currentStatus) {
      // Remove bookmark
      return await removeBookmark(userId, ownerId, bookmarkType);
    } else {
      // Add bookmark
      return await addBookmark(userId, ownerId, bookmarkType);
    }
  } catch (error) {
    console.error('Error toggling bookmark:', error);
    return false;
  }
}

/**
 * Get all bookmarks for a specific user
 */
export async function getUserBookmarks(userId: string): Promise<BookmarkData[]> {
  try {
    const { data, error } = await supabase
      .from('bookmarks')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching bookmarks:', error);
      return [];
    }

    // Ensure ordering by created_at (newest first) with client-side sort as backup
    const bookmarks = data || [];
    return bookmarks.sort((a, b) => {
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return dateB - dateA; // Descending order (newest first)
    });
  } catch (error) {
    console.error('Error fetching bookmarks:', error);
    return [];
  }
}
