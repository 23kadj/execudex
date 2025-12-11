import * as Haptics from 'expo-haptics';
import React, { useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text } from 'react-native';

interface TypeFilterButtonProps {
  label: string;
  isSelected: boolean;
  onPress: () => void;
}

export const TypeFilterButton: React.FC<TypeFilterButtonProps> = ({
  label,
  isSelected,
  onPress,
}) => {
  const scaleValue = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Haptics.selectionAsync();
    Animated.spring(scaleValue, {
      toValue: 0.95,
      friction: 6,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleValue, {
      toValue: 1,
      friction: 6,
      useNativeDriver: true,
    }).start();
  };

  const handlePress = () => {
    onPress();
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleValue }] }}>
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        style={[
          styles.button,
          isSelected ? styles.buttonSelected : styles.buttonUnselected,
        ]}
      >
        <Text
          style={[
            styles.buttonText,
            isSelected ? styles.buttonTextSelected : styles.buttonTextUnselected,
          ]}
        >
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 4,
    marginVertical: 4,
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonUnselected: {
    backgroundColor: '#080808',
    borderWidth: 1,
    borderColor: '#101010',
  },
  buttonSelected: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#fff',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  buttonTextUnselected: {
    color: '#fff',
  },
  buttonTextSelected: {
    color: '#000',
  },
});

