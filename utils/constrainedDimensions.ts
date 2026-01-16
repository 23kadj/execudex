import React from 'react';
import { Dimensions } from 'react-native';
import { isIPad } from './deviceDetection';

/**
 * iPhone 14/15 Pro dimensions (in points)
 */
const IPHONE_WIDTH = 390;
const IPHONE_HEIGHT = 844;

/**
 * Gets the constrained screen width for the current device
 * - On iPad: Returns 390 (iPhone width) to match phone frame
 * - On iPhone: Returns actual device width
 * - On other platforms: Returns actual device width
 */
export const getConstrainedWidth = (): number => {
  if (isIPad()) {
    return IPHONE_WIDTH;
  }
  return Dimensions.get('window').width;
};

/**
 * Gets the constrained screen height for the current device
 * - On iPad: Returns iPhone height (844) or screen height, whichever is smaller
 * - On iPhone: Returns actual device height
 * - On other platforms: Returns actual device height
 */
export const getConstrainedHeight = (): number => {
  if (isIPad()) {
    const screenHeight = Dimensions.get('window').height;
    return Math.min(IPHONE_HEIGHT, screenHeight);
  }
  return Dimensions.get('window').height;
};

/**
 * Gets the actual (unconstrained) screen width
 * Useful for calculations that need the real device width
 */
export const getActualWidth = (): number => {
  return Dimensions.get('window').width;
};

/**
 * Gets the actual (unconstrained) screen height
 * Useful for calculations that need the real device height
 */
export const getActualHeight = (): number => {
  return Dimensions.get('window').height;
};

/**
 * Hook version for React components
 * Returns constrained dimensions that update on screen size changes
 */
export const useConstrainedDimensions = () => {
  const [dimensions, setDimensions] = React.useState({
    width: getConstrainedWidth(),
    height: getConstrainedHeight(),
    actualWidth: getActualWidth(),
    actualHeight: getActualHeight(),
  });

  React.useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions({
        width: isIPad() ? IPHONE_WIDTH : window.width,
        height: isIPad() ? Math.min(IPHONE_HEIGHT, window.height) : window.height,
        actualWidth: window.width,
        actualHeight: window.height,
      });
    });

    return () => subscription?.remove();
  }, []);

  return dimensions;
};
