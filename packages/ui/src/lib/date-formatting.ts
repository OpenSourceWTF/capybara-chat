/**
 * Date Formatting Utilities for Library and Entity Views
 *
 * Provides functions to format timestamps with time-of-day granularity
 * for library views and entity metadata displays.
 */

/**
 * Format timestamp for library view display
 * Shows time down to the minute with smart relative labels
 *
 * Examples:
 * - "Just now" - less than 1 minute ago
 * - "5 min ago" - recent items (< 1 hour)
 * - "Today at 2:34 PM" - earlier today
 * - "Yesterday at 11:20 AM" - yesterday
 * - "Sun at 3:45 PM" - this week
 * - "Jan 27 at 3:45 PM" - this year
 * - "Jan 15, 2025 at 9:00 AM" - other years
 *
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Formatted string with time component
 */
export function formatLibraryTimestamp(timestamp: number | undefined): string {
  if (!timestamp) return '';

  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffDays = Math.floor(diffMs / 86400000);

  // Format time component
  const timeStr = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  // Just now - less than 1 minute ago
  if (diffMins < 1 && diffMs >= 0) {
    return 'Just now';
  }

  // Minutes ago - less than 1 hour
  if (diffMins < 60 && diffMs >= 0) {
    return `${diffMins} min ago`;
  }

  // Today
  if (diffDays === 0) {
    return `Today at ${timeStr}`;
  }

  // Yesterday
  if (diffDays === 1) {
    return `Yesterday at ${timeStr}`;
  }

  // This week (last 7 days)
  if (diffDays < 7) {
    const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
    return `${dayName} at ${timeStr}`;
  }

  // This year
  if (date.getFullYear() === now.getFullYear()) {
    const monthDay = date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
    return `${monthDay} at ${timeStr}`;
  }

  // Previous years
  const fullDate = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  return `${fullDate} at ${timeStr}`;
}

/**
 * Format full timestamp for tooltip/hover display
 * Shows complete date and time information with day of week
 *
 * Example: "Monday, January 27, 2026 at 2:34:15 PM"
 *
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Full formatted string with seconds precision
 */
export function formatFullTimestamp(timestamp: number | undefined): string {
  if (!timestamp) return '';

  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

/**
 * Format timestamp showing both created and updated times
 * Used for entity view metadata display
 *
 * @param createdAt - Creation timestamp in milliseconds
 * @param updatedAt - Last update timestamp in milliseconds
 * @returns Object with formatted created and updated strings
 */
export function formatEntityTimestamps(
  createdAt: number | string | undefined,
  updatedAt: number | string | undefined
): {
  created: string;
  updated: string;
  createdFull: string;
  updatedFull: string;
} {
  const createdNum = Number(createdAt || 0);
  const updatedNum = Number(updatedAt || 0);

  return {
    created: formatLibraryTimestamp(createdNum),
    updated: formatLibraryTimestamp(updatedNum),
    createdFull: formatFullTimestamp(createdNum),
    updatedFull: formatFullTimestamp(updatedNum),
  };
}
