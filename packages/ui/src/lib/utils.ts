/**
 * Utility Functions - Shared helpers
 * 
 * Extracted from components for reuse across the codebase.
 */

/**
 * Format timestamp for time display (e.g., "10:30 AM")
 */
export function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Format timestamp for date display with smart labels
 * Returns "Today", "Yesterday", or date string
 */
export function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  } else if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  }
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
  });
}

/**
 * Format relative time (e.g., "Just now", "5m ago", "2h ago", "Yesterday", "3d ago")
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return days === 1 ? 'Yesterday' : `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'Just now';
}

/**
 * Format timestamp for full datetime display (e.g., "Jan 15, 2024, 10:30 AM")
 */
export function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Format short date without year if current year (e.g., "Jan 15" or "Jan 15, 2023")
 */
export function formatShortDate(timestamp: number | undefined): string {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  const isThisYear = date.getFullYear() === now.getFullYear();

  const month = date.toLocaleDateString('en-US', { month: 'short' });
  const day = date.getDate();

  if (isThisYear) {
    return `${month} ${day}`;
  }
  return `${month} ${day}, ${date.getFullYear()}`;
}

/**
 * Truncate ID for display (default 8 characters)
 */
export function truncateId(id: string, length = 8): string {
  return id.slice(0, length);
}

/**
 * Merge class names, filtering out falsy values
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

/**
 * Map of Tailwind text color classes to CSS color values
 * Used to convert dynamic preference classes to actual colors for inline styles
 */
const TAILWIND_COLOR_MAP: Record<string, string> = {
  // Primary (uses CSS variable)
  'text-primary': 'hsl(25 80% 45%)',

  // Reds
  'text-red-400': '#f87171',
  'text-red-500': '#ef4444',
  'text-red-600': '#dc2626',

  // Oranges
  'text-orange-400': '#fb923c',
  'text-orange-500': '#f97316',
  'text-orange-600': '#ea580c',

  // Ambers
  'text-amber-400': '#fbbf24',
  'text-amber-500': '#f59e0b',
  'text-amber-600': '#d97706',

  // Yellows
  'text-yellow-400': '#facc15',
  'text-yellow-500': '#eab308',
  'text-yellow-600': '#ca8a04',

  // Limes
  'text-lime-400': '#a3e635',
  'text-lime-500': '#84cc16',
  'text-lime-600': '#65a30d',

  // Greens
  'text-green-400': '#4ade80',
  'text-green-500': '#22c55e',
  'text-green-600': '#16a34a',

  // Emeralds
  'text-emerald-400': '#34d399',
  'text-emerald-500': '#10b981',
  'text-emerald-600': '#059669',

  // Teals
  'text-teal-400': '#2dd4bf',
  'text-teal-500': '#14b8a6',
  'text-teal-600': '#0d9488',

  // Cyans
  'text-cyan-400': '#22d3ee',
  'text-cyan-500': '#06b6d4',
  'text-cyan-600': '#0891b2',

  // Skys
  'text-sky-400': '#38bdf8',
  'text-sky-500': '#0ea5e9',
  'text-sky-600': '#0284c7',

  // Blues
  'text-blue-400': '#60a5fa',
  'text-blue-500': '#3b82f6',
  'text-blue-600': '#2563eb',

  // Indigos
  'text-indigo-400': '#818cf8',
  'text-indigo-500': '#6366f1',
  'text-indigo-600': '#4f46e5',

  // Violets
  'text-violet-400': '#a78bfa',
  'text-violet-500': '#8b5cf6',
  'text-violet-600': '#7c3aed',

  // Purples
  'text-purple-400': '#c084fc',
  'text-purple-500': '#a855f7',
  'text-purple-600': '#9333ea',

  // Fuchsias
  'text-fuchsia-400': '#e879f9',
  'text-fuchsia-500': '#d946ef',
  'text-fuchsia-600': '#c026d3',

  // Pinks
  'text-pink-400': '#f472b6',
  'text-pink-500': '#ec4899',
  'text-pink-600': '#db2777',

  // Roses
  'text-rose-400': '#fb7185',
  'text-rose-500': '#f43f5e',
  'text-rose-600': '#e11d48',

  // Destructive (uses CSS variable)
  'text-destructive': 'hsl(8 75% 45%)',
};

/**
 * Extract CSS color value from Tailwind text color class
 * Handles both light and dark mode classes like "text-sky-600 dark:text-sky-400"
 * Returns the light mode color (first class)
 */
export function tailwindClassToColor(textClass: string): string {
  // Get the first (light mode) class
  const firstClass = textClass.split(' ')[0];
  return TAILWIND_COLOR_MAP[firstClass] || '#888888';
}

/**
 * Format cost as USD with appropriate precision
 * - <$0.01: Shows 4 decimal places ($0.0012)
 * - <$1.00: Shows 3 decimal places ($0.123)
 * - ≥$1.00: Shows 2 decimal places ($1.23)
 *
 * @param cost - Cost in USD (can be undefined/null)
 * @param options - Formatting options
 * @returns Formatted cost string or null if no cost
 */
export function formatCost(
  cost: number | undefined | null,
  options?: { showDollarSign?: boolean }
): string | null {
  if (cost === undefined || cost === null || cost <= 0) {
    return null;
  }

  const { showDollarSign = true } = options || {};
  const prefix = showDollarSign ? '$' : '';

  if (cost < 0.01) {
    return `${prefix}${cost.toFixed(4)}`;
  }
  if (cost < 1) {
    return `${prefix}${cost.toFixed(3)}`;
  }
  return `${prefix}${cost.toFixed(2)}`;
}
