import React, { createContext, useContext, useEffect, useState } from 'react';
import { Appearance, useColorScheme } from 'react-native';

type ColorScheme = 'light' | 'dark' | null;

type ThemeContextType = {
  colorScheme: ColorScheme;
  isDark: boolean;
  colors: {
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    border: string;
    primary: string;
    error: string;
    inputBackground: string;
    buttonBackground: string;
    buttonText: string;
  };
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const lightColors = {
  background: '#ffffff',
  surface: '#f8f9fa',
  text: '#000000',
  textSecondary: '#666666',
  border: '#e0e0e0',
  primary: '#4285F4',
  error: '#ff4444',
  inputBackground: '#ffffff',
  buttonBackground: '#4285F4',
  buttonText: '#ffffff',
};

const darkColors = {
  background: '#000000',
  surface: '#1a1a1a',
  text: '#ffffff',
  textSecondary: '#aaaaaa',
  border: '#333333',
  primary: '#4285F4',
  error: '#ff4444',
  inputBackground: '#1a1a1a',
  buttonBackground: '#4285F4',
  buttonText: '#ffffff',
};

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [colorScheme, setColorScheme] = useState<ColorScheme>(systemColorScheme);

  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme: newColorScheme }) => {
      setColorScheme(newColorScheme);
    });

    return () => subscription?.remove();
  }, []);

  const isDark = colorScheme === 'dark';
  const colors = isDark ? darkColors : lightColors;

  const value = {
    colorScheme,
    isDark,
    colors,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

