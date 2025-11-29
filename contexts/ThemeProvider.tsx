import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

type ThemeKey = 'pink' | 'grey' | 'purple';

type ThemeColors = {
  primary: string;
  primaryLight: string;
  secondary: string;
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  border: string;
};

const palettes: Record<ThemeKey, ThemeColors> = {
  pink: {
    primary: '#ec4899',
    primaryLight: '#fdf2f8',
    secondary: '#a855f7',
    background: '#ffffff',
    surface: '#fafafa',
    text: '#171717',
    textSecondary: '#737373',
    border: '#e5e5e5',
  },
  grey: {
    primary: '#4b5563',
    primaryLight: '#1f2937',
    secondary: '#9ca3af',
    background: '#0f172a',
    surface: '#111827',
    text: '#f8fafc',
    textSecondary: '#cbd5e1',
    border: '#1f2937',
  },
  purple: {
    primary: '#6366f1',
    primaryLight: '#eef2ff',
    secondary: '#7c3aed',
    background: '#f8fafc',
    surface: '#eef2ff',
    text: '#0f172a',
    textSecondary: '#475569',
    border: '#e2e8f0',
  },
};

type ThemeContextValue = {
  theme: ThemeKey;
  colors: ThemeColors;
  setTheme: (theme: ThemeKey) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);
const STORAGE_KEY = 'app-theme';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeKey>('pink');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (saved === 'pink' || saved === 'grey' || saved === 'purple') {
        setThemeState(saved);
      }
    }).catch(() => {});
  }, []);

  const setTheme = (value: ThemeKey) => {
    setThemeState(value);
    AsyncStorage.setItem(STORAGE_KEY, value).catch(() => {});
  };

  const colors = useMemo(() => palettes[theme], [theme]);

  const value = useMemo(() => ({ theme, colors, setTheme }), [theme, colors]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
