import React, { createContext, useContext } from 'react';
import { colors as lightColors } from '../theme';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  return (
    <ThemeContext.Provider value={{ isDark: false, mode: 'light', setThemeMode: () => {}, themeColors: lightColors, isLoaded: true }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useAppTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    return { isDark: false, mode: 'light', setThemeMode: () => {}, themeColors: lightColors, isLoaded: true };
  }
  return ctx;
}
