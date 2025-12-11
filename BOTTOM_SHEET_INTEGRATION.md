# BottomSheetModal Integration Guide

## Quick Setup

1. **Import the component:**
```tsx
import BottomSheetModal from '../components/BottomSheetModal';
```

2. **Add state:**
```tsx
const [isBottomSheetVisible, setIsBottomSheetVisible] = useState(false);
```

3. **Add handlers:**
```tsx
const handleOption1Press = () => {
  // TODO: Implement Option 1 functionality
  console.log('Option 1 pressed');
};

const handleOption2Press = () => {
  // TODO: Implement Option 2 functionality
  console.log('Option 2 pressed');
};
```

4. **Add to JSX:**
```tsx
<BottomSheetModal
  visible={isBottomSheetVisible}
  onClose={() => setIsBottomSheetVisible(false)}
  onOption1Press={handleOption1Press}
  onOption2Press={handleOption2Press}
/>
```

5. **Update "more" button:**
```tsx
<TouchableOpacity onPress={() => setIsBottomSheetVisible(true)}>
  <Image source={require('../assets/more.png')} />
</TouchableOpacity>
```

## Files to Update

- ✅ `app/index1.tsx` (Politician profiles)
- ✅ `app/index2.tsx` (Legislation profiles)
- `app/index3.tsx`
- `app/profile/see-more.tsx`
- `app/profile/rankings.tsx`
- `app/legislation/legi4.tsx`
- `app/legislation/legi5.tsx`
- `app/profile/sub4.tsx`
- `app/profile/sub5.tsx`

## Features

- Slides up from bottom with smooth animation
- 40% screen height
- Black background with rounded top corners
- Two option buttons + close button
- Haptic feedback on all interactions
- Tap outside to dismiss
- Pinterest-style design 