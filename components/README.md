# BottomSheetModal Component

A reusable bottom sheet modal component that slides up from the bottom with smooth animations, designed for use across politician and legislation profile pages.

## Features

- **Smooth Animations**: Slides up from bottom with backdrop fade
- **Pinterest-style Design**: Rounded top corners, handle indicator, clean layout
- **Haptic Feedback**: Provides tactile feedback on all interactions
- **Backdrop Dismissal**: Tap outside to close
- **Customizable Options**: Two configurable option buttons
- **Global Reusability**: Can be used across all profile pages

## Usage

### Basic Implementation

```tsx
import BottomSheetModal from '../components/BottomSheetModal';

// Add state for modal visibility
const [isBottomSheetVisible, setIsBottomSheetVisible] = useState(false);

// Add handlers for options
const handleOption1Press = () => {
  // TODO: Implement Option 1 functionality
  console.log('Option 1 pressed');
};

const handleOption2Press = () => {
  // TODO: Implement Option 2 functionality
  console.log('Option 2 pressed');
};

// Add to your JSX
<BottomSheetModal
  visible={isBottomSheetVisible}
  onClose={() => setIsBottomSheetVisible(false)}
  onOption1Press={handleOption1Press}
  onOption2Press={handleOption2Press}
/>

// Trigger from "more" button
<TouchableOpacity onPress={() => setIsBottomSheetVisible(true)}>
  <Image source={require('../assets/more.png')} />
</TouchableOpacity>
```

### Integration Steps

1. **Import the component** in your profile page
2. **Add state** for modal visibility: `const [isBottomSheetVisible, setIsBottomSheetVisible] = useState(false);`
3. **Add handlers** for the option buttons
4. **Add the component** to your JSX with proper props
5. **Update the "more" button** to trigger the modal: `onPress={() => setIsBottomSheetVisible(true)}`

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `visible` | `boolean` | Yes | Controls modal visibility |
| `onClose` | `() => void` | Yes | Called when modal should close |
| `onOption1Press` | `() => void` | No | Handler for Option 1 button |
| `onOption2Press` | `() => void` | No | Handler for Option 2 button |

## Styling

- **Background**: Solid black (`#000`)
- **Height**: 40% of screen height
- **Border Radius**: 20px top corners
- **Option Buttons**: Dark gray (`#1a1a1a`) with 12px border radius
- **Close Button**: Medium gray (`#3a3a3a`) with 12px border radius
- **Text**: White with medium font weight

## Animation Details

- **Duration**: 300ms for both slide and fade
- **Easing**: Default timing function
- **Native Driver**: Used for transform and opacity animations
- **Backdrop**: Semi-transparent black overlay (50% opacity)

## Files to Update

The following files need the bottom sheet modal integration:

- `app/index1.tsx` ✅ (Politician profiles)
- `app/index2.tsx` ✅ (Legislation profiles)
- `app/index3.tsx` (Additional profile types)
- `app/profile/see-more.tsx` (Profile details)
- `app/profile/rankings.tsx` (Rankings page)
- `app/legislation/legi4.tsx` (Legislation details)
- `app/legislation/legi5.tsx` (Legislation details)
- `app/profile/sub4.tsx` (Profile sub-pages)
- `app/profile/sub5.tsx` (Profile sub-pages)

## Example Integration

See `app/index1.tsx` and `app/index2.tsx` for complete implementation examples. 