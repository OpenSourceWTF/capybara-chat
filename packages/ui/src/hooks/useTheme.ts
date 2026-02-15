import { useState, useEffect } from 'react';
import { Theme } from '@capybara-chat/types';
import { STORAGE_KEYS } from '../constants';

export type { Theme };

/**
 * Simple theme persistence hook using localStorage
 */
export function useTheme(defaultTheme: Theme = Theme.COZY) {
  const [theme, setTheme] = useState<Theme>(() => {
    // Check localStorage on init
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEYS.THEME);
      if (stored === Theme.COZY || stored === Theme.MIDNIGHT) {
        return stored;
      }
    }
    return defaultTheme;
  });

  // Persist to localStorage on change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.THEME, theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(theme === Theme.COZY ? Theme.MIDNIGHT : Theme.COZY);
  };

  return { theme, setTheme, toggleTheme };
}
