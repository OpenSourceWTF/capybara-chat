import { useState, useEffect } from 'react';
import { STORAGE_KEYS } from '../constants';

export type RoleColorKey = 'emerald' | 'blue' | 'amber' | 'rose' | 'violet' | 'cyan' | 'orange' | 'pink' | 'teal' | 'indigo';

export interface ChatColors {
  user: RoleColorKey;
  assistant: RoleColorKey;
  system: RoleColorKey;
}

export interface RoleColorClasses {
  bg: string;
  borderL: string;
  badge: string;
  event: ContextEventClasses;
}

export interface ContextEventClasses {
  btn: string;
  icon: string;
  text: string;
  muted: string;
}

const DEFAULT_COLORS: ChatColors = {
  user: 'emerald',
  assistant: 'blue',
  system: 'amber',
};

const VALID_KEYS: RoleColorKey[] = ['emerald', 'blue', 'amber', 'rose', 'violet', 'cyan', 'orange', 'pink', 'teal', 'indigo'];

// Static color class mapping - all classes listed explicitly for Tailwind's purge
const COLOR_CLASSES: Record<RoleColorKey, RoleColorClasses> = {
  emerald: {
    bg: 'bg-emerald-500/[0.05] border-l-emerald-500/50',
    borderL: 'border-l-emerald-500/50',
    badge: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
    event: { btn: 'bg-emerald-500/[0.03] hover:bg-emerald-500/[0.06] border-emerald-500/15', icon: 'text-emerald-500/60', text: 'text-emerald-500/80', muted: 'text-emerald-500/40' },
  },
  blue: {
    bg: 'bg-blue-500/[0.03] border-l-blue-400/40',
    borderL: 'border-l-blue-400/40',
    badge: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    event: { btn: 'bg-blue-500/[0.03] hover:bg-blue-500/[0.06] border-blue-500/15', icon: 'text-blue-500/60', text: 'text-blue-500/80', muted: 'text-blue-500/40' },
  },
  amber: {
    bg: 'bg-amber-500/[0.04] border-l-amber-500/50',
    borderL: 'border-l-amber-500/50',
    badge: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
    event: { btn: 'bg-amber-500/[0.03] hover:bg-amber-500/[0.06] border-amber-500/15', icon: 'text-amber-500/60', text: 'text-amber-500/80', muted: 'text-amber-500/40' },
  },
  rose: {
    bg: 'bg-rose-500/[0.05] border-l-rose-500/50',
    borderL: 'border-l-rose-500/50',
    badge: 'bg-rose-500/15 text-rose-700 dark:text-rose-400',
    event: { btn: 'bg-rose-500/[0.03] hover:bg-rose-500/[0.06] border-rose-500/15', icon: 'text-rose-500/60', text: 'text-rose-500/80', muted: 'text-rose-500/40' },
  },
  violet: {
    bg: 'bg-violet-500/[0.05] border-l-violet-500/50',
    borderL: 'border-l-violet-500/50',
    badge: 'bg-violet-500/15 text-violet-700 dark:text-violet-400',
    event: { btn: 'bg-violet-500/[0.03] hover:bg-violet-500/[0.06] border-violet-500/15', icon: 'text-violet-500/60', text: 'text-violet-500/80', muted: 'text-violet-500/40' },
  },
  cyan: {
    bg: 'bg-cyan-500/[0.05] border-l-cyan-500/50',
    borderL: 'border-l-cyan-500/50',
    badge: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-400',
    event: { btn: 'bg-cyan-500/[0.03] hover:bg-cyan-500/[0.06] border-cyan-500/15', icon: 'text-cyan-500/60', text: 'text-cyan-500/80', muted: 'text-cyan-500/40' },
  },
  orange: {
    bg: 'bg-orange-500/[0.05] border-l-orange-500/50',
    borderL: 'border-l-orange-500/50',
    badge: 'bg-orange-500/15 text-orange-700 dark:text-orange-400',
    event: { btn: 'bg-orange-500/[0.03] hover:bg-orange-500/[0.06] border-orange-500/15', icon: 'text-orange-500/60', text: 'text-orange-500/80', muted: 'text-orange-500/40' },
  },
  pink: {
    bg: 'bg-pink-500/[0.05] border-l-pink-500/50',
    borderL: 'border-l-pink-500/50',
    badge: 'bg-pink-500/15 text-pink-700 dark:text-pink-400',
    event: { btn: 'bg-pink-500/[0.03] hover:bg-pink-500/[0.06] border-pink-500/15', icon: 'text-pink-500/60', text: 'text-pink-500/80', muted: 'text-pink-500/40' },
  },
  teal: {
    bg: 'bg-teal-500/[0.05] border-l-teal-500/50',
    borderL: 'border-l-teal-500/50',
    badge: 'bg-teal-500/15 text-teal-700 dark:text-teal-400',
    event: { btn: 'bg-teal-500/[0.03] hover:bg-teal-500/[0.06] border-teal-500/15', icon: 'text-teal-500/60', text: 'text-teal-500/80', muted: 'text-teal-500/40' },
  },
  indigo: {
    bg: 'bg-indigo-500/[0.05] border-l-indigo-500/50',
    borderL: 'border-l-indigo-500/50',
    badge: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-400',
    event: { btn: 'bg-indigo-500/[0.03] hover:bg-indigo-500/[0.06] border-indigo-500/15', icon: 'text-indigo-500/60', text: 'text-indigo-500/80', muted: 'text-indigo-500/40' },
  },
};

// Swatch display colors for the settings UI
export const SWATCH_COLORS: Record<RoleColorKey, string> = {
  emerald: 'bg-emerald-500',
  blue: 'bg-blue-500',
  amber: 'bg-amber-500',
  rose: 'bg-rose-500',
  violet: 'bg-violet-500',
  cyan: 'bg-cyan-500',
  orange: 'bg-orange-500',
  pink: 'bg-pink-500',
  teal: 'bg-teal-500',
  indigo: 'bg-indigo-500',
};

export function getColorClasses(colorKey: RoleColorKey): RoleColorClasses {
  return COLOR_CLASSES[colorKey];
}

export function getColorsForRole(role: 'user' | 'assistant' | 'system', colors: ChatColors): RoleColorClasses {
  const key = role === 'user' ? colors.user : role === 'assistant' ? colors.assistant : colors.system;
  return COLOR_CLASSES[key];
}

function isValidColorKey(key: string): key is RoleColorKey {
  return VALID_KEYS.includes(key as RoleColorKey);
}

export function useChatColors() {
  const [colors, setColors] = useState<ChatColors>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(STORAGE_KEYS.CHAT_COLORS);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (
            parsed &&
            isValidColorKey(parsed.user) &&
            isValidColorKey(parsed.assistant) &&
            isValidColorKey(parsed.system)
          ) {
            return parsed;
          }
        }
      } catch {
        // ignore parse errors
      }
    }
    return DEFAULT_COLORS;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CHAT_COLORS, JSON.stringify(colors));
  }, [colors]);

  const resetColors = () => setColors(DEFAULT_COLORS);

  return { colors, setColors, resetColors, VALID_KEYS };
}
