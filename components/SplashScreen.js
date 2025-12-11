import { useEffect, useRef } from 'react';
import { Animated, Image, StyleSheet } from 'react-native';

export default function SplashScreen({ onFinish }) {
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 10000,
        useNativeDriver: true,
      }).start(() => {
        if (onFinish) onFinish();
      });
    }, 1800); // splash screen visible for 1.8 seconds
  }, []);

  return (
    <Animated.View style={[styles.splashContainer, { opacity: fadeAnim }]}>
      <Image source={require('../assets/wordlogo1.png')} style={styles.splashLogo} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    width: '100%',
    height: '100%',
    zIndex: 2,
  },
  splashLogo: {
    width: 240,
    height: 240,
    resizeMode: 'contain',
  },
});
