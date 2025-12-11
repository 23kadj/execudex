# Unified Bookmark System Implementation

## Overview
This document summarizes the implementation of the new unified bookmark system that replaces the previous separate bookmark structures for different content types.

## 🧱 New Table Structure

The `bookmarks` table now uses a unified structure with:
- `id`: auto-incrementing primary key
- `user_id`: ID of the authenticated user
- `owner_id`: ID of the bookmarked item (from `ppl_index`, `legi_index`, or `card_index`)
- `bookmark_type`: enum with values `"ppl"`, `"legi"`, `"card"`

## 🔁 Updated Components

### 1. `app/bookmarks.tsx`
- **Updated interface**: Now uses `BookmarkData` from `utils/bookmarkUtils.ts`
- **Authentication integration**: Only shows bookmarks for authenticated users
- **Unified data fetching**: Fetches data from all three index tables based on `bookmark_type`
- **Navigation**: Routes to appropriate screens (`index1`, `index2`, `sub5`) based on bookmark type
- **Visual enhancements**: Added bookmark type badges to distinguish between content types

### 2. `app/index1.tsx` (Politician Profiles)
- **New bookmark logic**: Uses `user_id`, `owner_id`, and `bookmark_type: 'ppl'`
- **Authentication check**: Only shows bookmark button for authenticated users
- **State management**: Properly tracks bookmark status and syncs with database
- **Icon swapping**: Automatically switches between `bookmark1` (outline) and `bookmark2` (filled)

### 3. `app/index2.tsx` (Legislation Profiles)
- **Updated bookmark structure**: Uses new unified fields with `bookmark_type: 'legi'`
- **User authentication**: Integrates with `useAuth` hook
- **Database operations**: Proper insert/delete operations with error handling

### 4. `app/index3.tsx` (General Content)
- **Authentication integration**: Added user authentication check
- **Bookmark button**: Shows only for authenticated users (functionality limited due to no specific profile ID)

### 5. `app/profile/sub5.tsx` (Card Previews)
- **New bookmark functionality**: Added bookmark support for cards with `bookmark_type: 'card'`
- **Header integration**: Bookmark button appears in header when `cardId` is available
- **State management**: Tracks bookmark status and updates UI accordingly

### 6. `app/legislation/legi5.tsx` (Legislation Cards)
- **Bookmark integration**: Added bookmark functionality for legislation cards
- **Header enhancement**: Bookmark button in header with proper state management
- **Database operations**: Full CRUD operations for bookmarks

## 🛠️ New Utility Functions

### `utils/bookmarkUtils.ts`
Created centralized utility functions for bookmark operations:
- `checkBookmarkStatus()`: Check if an item is bookmarked
- `addBookmark()`: Add a new bookmark
- `removeBookmark()`: Remove an existing bookmark
- `toggleBookmark()`: Toggle bookmark status
- `getUserBookmarks()`: Fetch all bookmarks for a user

## 🎨 Icon Swapping Implementation

All bookmark buttons now automatically switch between:
- `bookmark1.png` (outline) when **not bookmarked**
- `bookmark2.png` (filled) when **bookmarked**

This applies to all screens:
- ✅ `index1` for politician profiles
- ✅ `index2` for legislation profiles  
- ✅ `sub5` for card previews
- ✅ `legi5` for legislation cards

## 🔒 Authentication Integration

- **User requirement**: All bookmark operations now require user authentication
- **Context usage**: Integrated with `useAuth` hook across all components
- **Conditional rendering**: Bookmark buttons only appear for authenticated users
- **Error handling**: Proper error handling for unauthenticated states

## 🔍 Bookmarks Page Features

The main bookmarks screen now:
- **Shows all content types**: Displays ppl, legi, and card bookmarks in one unified list
- **Type identification**: Each bookmark shows a type badge (PPL, LEGI, CARD)
- **Proper navigation**: Clicking reopens the corresponding screen with correct bookmark state
- **Data consistency**: Uses `title` and `subtext` from respective index tables

## 🚫 Removed/Refactored

- **Old bookmark structures**: Removed separate `profile_id` and `is_ppl` fields
- **Duplicate logic**: Eliminated code duplication through utility functions
- **Outdated queries**: Updated all database queries to use new structure
- **Inconsistent behavior**: Standardized bookmark behavior across all content types

## 📱 User Experience Improvements

1. **Consistent behavior**: All bookmark buttons work the same way across the app
2. **Visual feedback**: Immediate icon changes provide clear bookmark status
3. **Authentication awareness**: Users must sign in to use bookmark features
4. **Unified management**: Single bookmarks page shows all saved content
5. **Seamless navigation**: Bookmarks reopen the exact content they were saved from

## 🔧 Technical Implementation Details

### Database Schema
```sql
CREATE TABLE bookmarks (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  owner_id TEXT NOT NULL,
  bookmark_type TEXT CHECK (bookmark_type IN ('ppl', 'legi', 'card')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Component Integration Pattern
```typescript
// 1. Import auth and utilities
import { useAuth } from '../components/AuthProvider';
import { checkBookmarkStatus, toggleBookmark } from '../utils/bookmarkUtils';

// 2. Add state and user context
const { user } = useAuth();
const [isBookmarked, setIsBookmarked] = useState(false);

// 3. Check status on mount
useEffect(() => {
  if (user && ownerId) {
    checkBookmarkStatus(user.id, ownerId, bookmarkType).then(setIsBookmarked);
  }
}, [user, ownerId]);

// 4. Handle toggle
const handleBookmarkToggle = async () => {
  if (!user || !ownerId) return;
  
  const success = await toggleBookmark(user.id, ownerId, bookmarkType, isBookmarked);
  if (success) {
    setIsBookmarked(!isBookmarked);
  }
};
```

## ✅ Testing Checklist

- [ ] Bookmark buttons appear only for authenticated users
- [ ] Icon swaps correctly between outline and filled states
- [ ] Bookmarks are saved to database with correct type
- [ ] Bookmarks page displays all content types correctly
- [ ] Navigation from bookmarks opens correct screens
- [ ] Bookmark state persists across app sessions
- [ ] Error handling works for failed operations
- [ ] Performance is acceptable with new queries

## 🚀 Future Enhancements

1. **Real-time updates**: Consider WebSocket integration for live bookmark sync
2. **Offline support**: Cache bookmarks locally for offline viewing
3. **Batch operations**: Allow bulk bookmark management
4. **Analytics**: Track bookmark usage patterns
5. **Sharing**: Allow users to share bookmark collections

## 📝 Notes

- All existing bookmarks from the old system will need to be migrated to the new structure
- The new system requires user authentication, so anonymous bookmarking is no longer supported
- Performance impact should be minimal as queries are optimized and use proper indexing
- The unified approach makes future bookmark features easier to implement across all content types
