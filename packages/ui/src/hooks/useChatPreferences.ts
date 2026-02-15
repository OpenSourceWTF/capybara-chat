import { useState, useEffect } from 'react';
import { createLogger } from '../lib/logger';

const log = createLogger('useChatPreferences');
const STORAGE_KEY = 'huddle_chat_prefs_v1';

export interface ChatPreferences {
  userColor: string;
  assistantColor: string;
  systemColor: string;
}

const DEFAULT_PREFS: ChatPreferences = {
  userColor: 'text-orange-600 dark:text-orange-400',
  assistantColor: 'text-sky-600 dark:text-sky-400',
  // 136-timeout-spinner-issues: Changed from emerald to amber to match
  // STYLE_GUIDE.md Section 7 which says SYSTEM should be red or yellow,
  // and to fit the warm "Cozy Terminal" palette
  systemColor: 'text-amber-600 dark:text-amber-400',
};

export function useChatPreferences() {
  const [prefs, setPrefs] = useState<ChatPreferences>(DEFAULT_PREFS);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(stored) });
      }
    } catch (e) {
      log.error('Failed to load chat prefs', { error: e });
    }
  }, []);

  const updatePrefs = (newPrefs: Partial<ChatPreferences>) => {
    const updated = { ...prefs, ...newPrefs };
    setPrefs(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      log.error('Failed to save chat prefs', { error: e });
    }
  };

  return { prefs, updatePrefs };
}
