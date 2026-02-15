/**
 * Utility Functions Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  formatTime,
  formatDate,
  formatRelativeTime,
  formatDateTime,
  formatShortDate,
  truncateId,
  cn,
  tailwindClassToColor,
} from './utils';

describe('formatTime', () => {
  it('formats timestamp to time string', () => {
    // Use a fixed timestamp: Jan 15, 2024, 10:30:00 AM UTC
    const timestamp = new Date('2024-01-15T10:30:00Z').getTime();
    const result = formatTime(timestamp);
    // Result depends on locale, but should contain time components
    expect(result).toMatch(/\d{1,2}:\d{2}/);
  });
});

describe('formatDate', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "Today" for current date', () => {
    vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
    const today = Date.now();
    expect(formatDate(today)).toBe('Today');
  });

  it('returns "Yesterday" for previous date', () => {
    vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
    const yesterday = new Date('2024-01-14T12:00:00Z').getTime();
    expect(formatDate(yesterday)).toBe('Yesterday');
  });

  it('returns formatted date for older dates in same year', () => {
    vi.setSystemTime(new Date('2024-06-15T12:00:00Z'));
    const olderDate = new Date('2024-01-15T12:00:00Z').getTime();
    const result = formatDate(olderDate);
    expect(result).toContain('Jan');
    expect(result).toContain('15');
    // Same year, so no year in output
    expect(result).not.toContain('2024');
  });

  it('includes year for dates in different year', () => {
    vi.setSystemTime(new Date('2024-06-15T12:00:00Z'));
    const lastYear = new Date('2023-01-15T12:00:00Z').getTime();
    const result = formatDate(lastYear);
    expect(result).toContain('2023');
  });
});

describe('formatRelativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "Just now" for very recent timestamps', () => {
    vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
    const justNow = Date.now() - 30 * 1000; // 30 seconds ago
    expect(formatRelativeTime(justNow)).toBe('Just now');
  });

  it('returns minutes ago for timestamps under an hour', () => {
    vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    expect(formatRelativeTime(fiveMinutesAgo)).toBe('5m ago');
  });

  it('returns hours ago for timestamps under a day', () => {
    vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
    expect(formatRelativeTime(twoHoursAgo)).toBe('2h ago');
  });

  it('returns "Yesterday" for exactly one day ago', () => {
    vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    expect(formatRelativeTime(oneDayAgo)).toBe('Yesterday');
  });

  it('returns days ago for timestamps over a day', () => {
    vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
    const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;
    expect(formatRelativeTime(threeDaysAgo)).toBe('3d ago');
  });
});

describe('formatDateTime', () => {
  it('formats timestamp to full datetime string', () => {
    const timestamp = new Date('2024-01-15T10:30:00Z').getTime();
    const result = formatDateTime(timestamp);
    // Should contain date and time components
    expect(result).toMatch(/Jan/);
    expect(result).toMatch(/15/);
    expect(result).toMatch(/2024/);
    expect(result).toMatch(/\d{1,2}:\d{2}/);
  });
});

describe('formatShortDate', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns empty string for undefined', () => {
    expect(formatShortDate(undefined)).toBe('');
  });

  it('returns month and day for current year', () => {
    vi.setSystemTime(new Date('2024-06-15T12:00:00Z'));
    const thisYear = new Date('2024-01-15T12:00:00Z').getTime();
    const result = formatShortDate(thisYear);
    expect(result).toContain('Jan');
    expect(result).toContain('15');
    expect(result).not.toContain('2024');
  });

  it('includes year for different year', () => {
    vi.setSystemTime(new Date('2024-06-15T12:00:00Z'));
    const lastYear = new Date('2023-01-15T12:00:00Z').getTime();
    const result = formatShortDate(lastYear);
    expect(result).toContain('Jan');
    expect(result).toContain('15');
    expect(result).toContain('2023');
  });
});

describe('truncateId', () => {
  it('truncates ID to default 8 characters', () => {
    expect(truncateId('abcdefghijklmnop')).toBe('abcdefgh');
  });

  it('truncates ID to specified length', () => {
    expect(truncateId('abcdefghijklmnop', 4)).toBe('abcd');
  });

  it('returns full ID if shorter than length', () => {
    expect(truncateId('abc', 8)).toBe('abc');
  });
});

describe('cn', () => {
  it('joins class names with space', () => {
    expect(cn('class1', 'class2')).toBe('class1 class2');
  });

  it('filters out falsy values', () => {
    expect(cn('class1', undefined, 'class2', null, false, 'class3')).toBe('class1 class2 class3');
  });

  it('returns empty string for all falsy values', () => {
    expect(cn(undefined, null, false)).toBe('');
  });

  it('handles single class', () => {
    expect(cn('class1')).toBe('class1');
  });
});

describe('tailwindClassToColor', () => {
  it('returns mapped color for known class', () => {
    expect(tailwindClassToColor('text-red-500')).toBe('#ef4444');
    expect(tailwindClassToColor('text-blue-400')).toBe('#60a5fa');
    expect(tailwindClassToColor('text-green-600')).toBe('#16a34a');
  });

  it('extracts light mode class from dark mode pair', () => {
    expect(tailwindClassToColor('text-sky-600 dark:text-sky-400')).toBe('#0284c7');
  });

  it('returns fallback color for unknown class', () => {
    expect(tailwindClassToColor('text-unknown-500')).toBe('#888888');
  });

  it('returns primary color', () => {
    expect(tailwindClassToColor('text-primary')).toBe('hsl(25 80% 45%)');
  });

  it('returns destructive color', () => {
    expect(tailwindClassToColor('text-destructive')).toBe('hsl(8 75% 45%)');
  });
});
