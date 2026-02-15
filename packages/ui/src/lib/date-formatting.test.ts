/**
 * Tests for date-formatting utilities
 *
 * Covers all timestamp formatting scenarios including edge cases,
 * timezone handling, and relative time calculations.
 *
 * Uses vi.useFakeTimers() to mock the system clock for consistent
 * relative time calculations.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { formatLibraryTimestamp, formatFullTimestamp, formatEntityTimestamps } from './date-formatting';

describe('formatLibraryTimestamp', () => {
  // Fixed "now" time: January 27, 2026, 2:34:00 PM local time
  const mockNow = new Date(2026, 0, 27, 14, 34, 0, 0);

  beforeEach(() => {
    // Use fake timers to control Date.now() and new Date()
    vi.useFakeTimers();
    vi.setSystemTime(mockNow);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('undefined/empty input', () => {
    it('returns empty string for undefined timestamp', () => {
      expect(formatLibraryTimestamp(undefined)).toBe('');
    });

    it('returns empty string for null-like values', () => {
      expect(formatLibraryTimestamp(0)).toBe('');
    });
  });

  describe('very recent timestamps', () => {
    it('shows "Just now" for timestamps < 1 minute ago', () => {
      const justNow = mockNow.getTime() - 30000; // 30 seconds ago
      expect(formatLibraryTimestamp(justNow)).toBe('Just now');
    });

    it('shows "Just now" for timestamps at exactly 0 minutes', () => {
      const almostNow = mockNow.getTime() - 1000; // 1 second ago
      expect(formatLibraryTimestamp(almostNow)).toBe('Just now');
    });

    it('shows "Just now" for current/future timestamps', () => {
      expect(formatLibraryTimestamp(mockNow.getTime())).toBe('Just now');
    });
  });

  describe('recent timestamps (minutes ago)', () => {
    it('shows "1 min ago" for 1 minute ago', () => {
      const oneMinAgo = mockNow.getTime() - 60000;
      expect(formatLibraryTimestamp(oneMinAgo)).toBe('1 min ago');
    });

    it('shows "5 min ago" for 5 minutes ago', () => {
      const fiveMinAgo = mockNow.getTime() - 300000;
      expect(formatLibraryTimestamp(fiveMinAgo)).toBe('5 min ago');
    });

    it('shows "59 min ago" for 59 minutes ago', () => {
      const fiftyNineMinAgo = mockNow.getTime() - 3540000;
      expect(formatLibraryTimestamp(fiftyNineMinAgo)).toBe('59 min ago');
    });

    it('shows time for exactly 60 minutes ago (transitions to "Today at")', () => {
      const sixtyMinAgo = mockNow.getTime() - 3600000; // exactly 1 hour
      const result = formatLibraryTimestamp(sixtyMinAgo);
      expect(result).toMatch(/Today at \d{1,2}:\d{2} (AM|PM)/);
    });
  });

  describe('today timestamps', () => {
    it('shows "Today at [time]" for earlier today', () => {
      const earlierToday = mockNow.getTime() - 3600000; // 1 hour ago
      const result = formatLibraryTimestamp(earlierToday);
      expect(result).toMatch(/Today at \d{1,2}:\d{2} (AM|PM)/);
    });

    it('shows "Today at [time]" with correct hour format', () => {
      // Create a timestamp for 10:30 AM on the same day
      const sameDay = new Date(2026, 0, 27, 10, 30, 0, 0);
      const result = formatLibraryTimestamp(sameDay.getTime());
      expect(result).toMatch(/Today at 10:30 AM/);
    });

    it('shows "Today at [time]" for midnight', () => {
      const midnight = new Date(2026, 0, 27, 0, 0, 0, 0);
      const result = formatLibraryTimestamp(midnight.getTime());
      expect(result).toMatch(/Today at 12:00 AM/);
    });

    it('shows "Today at [time]" for noon', () => {
      const noon = new Date(2026, 0, 27, 12, 0, 0, 0);
      const result = formatLibraryTimestamp(noon.getTime());
      expect(result).toMatch(/Today at 12:00 PM/);
    });
  });

  describe('yesterday timestamps', () => {
    it('shows "Yesterday at [time]" for yesterday', () => {
      // Use a time earlier in the day so diff > 24 hours (function uses 24-hour periods)
      const yesterday = new Date(2026, 0, 26, 10, 0, 0, 0);
      const result = formatLibraryTimestamp(yesterday.getTime());
      expect(result).toMatch(/Yesterday at \d{1,2}:\d{2} (AM|PM)/);
    });

    it('shows "Yesterday at [time]" with correct time', () => {
      const yesterday = new Date(2026, 0, 26, 9, 15, 0, 0);
      const result = formatLibraryTimestamp(yesterday.getTime());
      expect(result).toMatch(/Yesterday at 9:15 AM/);
    });
  });

  describe('this week timestamps', () => {
    it('shows day name for 2 days ago', () => {
      const twoDaysAgo = new Date(2026, 0, 25, 14, 34, 0, 0);
      const result = formatLibraryTimestamp(twoDaysAgo.getTime());
      expect(result).toMatch(/[A-Z][a-z]{2} at \d{1,2}:\d{2} (AM|PM)/);
      expect(result).not.toContain('Today');
      expect(result).not.toContain('Yesterday');
    });

    it('shows day name for 3 days ago', () => {
      const threeDaysAgo = new Date(2026, 0, 24, 9, 15, 0, 0);
      const result = formatLibraryTimestamp(threeDaysAgo.getTime());
      expect(result).toMatch(/[A-Z][a-z]{2} at 9:15 AM/);
    });

    it('shows day name for 6 days ago (last day of week range)', () => {
      const sixDaysAgo = new Date(2026, 0, 21, 14, 34, 0, 0);
      const result = formatLibraryTimestamp(sixDaysAgo.getTime());
      expect(result).toMatch(/[A-Z][a-z]{2} at \d{1,2}:\d{2} (AM|PM)/);
    });

    it('shows month/day for 7 days ago (outside week range)', () => {
      const sevenDaysAgo = new Date(2026, 0, 20, 14, 34, 0, 0);
      const result = formatLibraryTimestamp(sevenDaysAgo.getTime());
      expect(result).toMatch(/[A-Z][a-z]{2} \d{1,2} at \d{1,2}:\d{2} (AM|PM)/);
      expect(result).not.toContain(','); // No year for this year
    });
  });

  describe('older timestamps this year', () => {
    it('shows "MMM DD at HH:MM AM/PM" for earlier this year', () => {
      const january = new Date(2026, 0, 15, 9, 0, 0, 0);
      const result = formatLibraryTimestamp(january.getTime());
      expect(result).toMatch(/Jan 15 at 9:00 AM/);
    });

    it('shows month/day without year for items from this year', () => {
      // January 10, 2026 - past date in same year (more than 7 days ago)
      const january10 = new Date(2026, 0, 10, 14, 34, 0, 0);
      const result = formatLibraryTimestamp(january10.getTime());
      expect(result).toMatch(/Jan 10 at \d{1,2}:\d{2} (AM|PM)/);
      expect(result).not.toContain('2026');
    });
  });

  describe('previous year timestamps', () => {
    it('shows "MMM DD, YYYY at HH:MM AM/PM" for items from previous year', () => {
      const lastYear = new Date(2025, 11, 20, 4, 30, 0, 0);
      const result = formatLibraryTimestamp(lastYear.getTime());
      expect(result).toMatch(/Dec 20, 2025 at 4:30 AM/);
    });

    it('includes year for very old timestamps', () => {
      const oldDate = new Date(2020, 5, 15, 14, 0, 0, 0);
      const result = formatLibraryTimestamp(oldDate.getTime());
      expect(result).toContain('2020');
    });
  });

  describe('edge cases', () => {
    it('handles future timestamps gracefully', () => {
      const future = mockNow.getTime() + 86400000; // Tomorrow
      const result = formatLibraryTimestamp(future);
      // Future timestamps should show as "Just now" or handle gracefully
      expect(result).toBeDefined();
      expect(result.length > 0).toBe(true);
    });

    it('handles timestamps at year boundaries', () => {
      const newYearEve = new Date(2025, 11, 31, 23, 59, 59, 0);
      const result = formatLibraryTimestamp(newYearEve.getTime());
      expect(result).toContain('2025');
    });

    it('handles DST transition timestamps', () => {
      // Testing with a real timestamp during DST change
      const dstTimestamp = new Date(2026, 2, 8, 2, 0, 0, 0);
      const result = formatLibraryTimestamp(dstTimestamp.getTime());
      expect(result).toBeDefined();
      expect(result.length > 0).toBe(true);
    });
  });
});

describe('formatFullTimestamp', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 27, 14, 34, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns empty string for undefined timestamp', () => {
    expect(formatFullTimestamp(undefined)).toBe('');
  });

  it('returns empty string for zero timestamp', () => {
    expect(formatFullTimestamp(0)).toBe('');
  });

  it('formats timestamp with full details', () => {
    const timestamp = new Date(2026, 0, 27, 14, 34, 15, 0).getTime();
    const result = formatFullTimestamp(timestamp);

    // Should include weekday, full date, and time with seconds
    expect(result).toMatch(/[A-Z][a-z]+,\s/); // Weekday
    expect(result).toMatch(/January/); // Full month
    expect(result).toMatch(/27/); // Day
    expect(result).toMatch(/2026/); // Year
    expect(result).toMatch(/\d{1,2}:\d{2}:\d{2}/); // Time with seconds
    expect(result).toMatch(/(AM|PM)/); // AM/PM indicator
  });

  it('includes day of week', () => {
    const monday = new Date(2026, 0, 26, 12, 0, 0, 0).getTime(); // Monday
    const result = formatFullTimestamp(monday);
    expect(result).toContain('Monday');
  });

  it('formats with seconds precision', () => {
    const timestamp = new Date(2026, 0, 27, 9, 5, 7, 0).getTime();
    const result = formatFullTimestamp(timestamp);
    expect(result).toMatch(/9:05:07/);
  });
});

describe('formatEntityTimestamps', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 27, 14, 34, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns object with created and updated formatted times', () => {
    const createdAt = new Date(2026, 0, 20, 10, 0, 0, 0).getTime();
    const updatedAt = new Date(2026, 0, 27, 9, 0, 0, 0).getTime();

    const result = formatEntityTimestamps(createdAt, updatedAt);

    expect(result).toHaveProperty('created');
    expect(result).toHaveProperty('updated');
    expect(result).toHaveProperty('createdFull');
    expect(result).toHaveProperty('updatedFull');
  });

  it('handles string timestamps', () => {
    const createdAt = String(new Date(2026, 0, 20, 10, 0, 0, 0).getTime());
    const updatedAt = String(new Date(2026, 0, 27, 9, 0, 0, 0).getTime());

    const result = formatEntityTimestamps(createdAt, updatedAt);

    expect(result.created).toBeDefined();
    expect(result.updated).toBeDefined();
  });

  it('handles missing timestamps', () => {
    const result = formatEntityTimestamps(undefined, undefined);

    expect(result.created).toBe('');
    expect(result.updated).toBe('');
    expect(result.createdFull).toBe('');
    expect(result.updatedFull).toBe('');
  });

  it('returns different format for created vs updated', () => {
    const createdAt = new Date(2025, 0, 20, 10, 0, 0, 0).getTime();
    const updatedAt = new Date(2026, 0, 27, 9, 0, 0, 0).getTime();

    const result = formatEntityTimestamps(createdAt, updatedAt);

    expect(result.created).not.toBe(result.updated);
    // Created should include year (2025), updated should be recent
    expect(result.created).toContain('2025');
  });
});
