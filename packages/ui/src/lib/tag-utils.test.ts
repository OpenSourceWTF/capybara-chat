/**
 * Tag Utilities Tests
 */

import { describe, it, expect } from 'vitest';
import {
  parseTags,
  formatTags,
  filterTagCloud,
  normalizeTag,
  isDuplicateTag,
} from './tag-utils';

describe('parseTags', () => {
  it('parses comma-separated string', () => {
    expect(parseTags('a, b, c')).toEqual(['a', 'b', 'c']);
  });

  it('trims whitespace from tags', () => {
    expect(parseTags('  tag1  ,  tag2  ')).toEqual(['tag1', 'tag2']);
  });

  it('filters empty strings', () => {
    expect(parseTags('a,,b,,')).toEqual(['a', 'b']);
    expect(parseTags(',,')).toEqual([]);
  });

  it('handles empty input', () => {
    expect(parseTags('')).toEqual([]);
  });

  it('handles single tag', () => {
    expect(parseTags('single')).toEqual(['single']);
  });

  it('handles tags with spaces inside', () => {
    expect(parseTags('tag one, tag two')).toEqual(['tag one', 'tag two']);
  });
});

describe('formatTags', () => {
  it('joins tags with comma and space', () => {
    expect(formatTags(['a', 'b', 'c'])).toBe('a, b, c');
  });

  it('handles empty array', () => {
    expect(formatTags([])).toBe('');
  });

  it('handles single tag', () => {
    expect(formatTags(['single'])).toBe('single');
  });
});

describe('filterTagCloud', () => {
  it('filters out already selected tags', () => {
    const known = ['a', 'b', 'c', 'd'];
    const current = ['b', 'd'];
    expect(filterTagCloud(known, current)).toEqual(['a', 'c']);
  });

  it('is case-insensitive', () => {
    const known = ['Tag', 'Other'];
    const current = ['TAG'];
    expect(filterTagCloud(known, current)).toEqual(['Other']);
  });

  it('limits to maxSuggestions', () => {
    const known = Array.from({ length: 20 }, (_, i) => `tag${i}`);
    const result = filterTagCloud(known, [], 5);
    expect(result).toHaveLength(5);
  });

  it('defaults to 12 suggestions', () => {
    const known = Array.from({ length: 20 }, (_, i) => `tag${i}`);
    const result = filterTagCloud(known, []);
    expect(result).toHaveLength(12);
  });

  it('handles empty known tags', () => {
    expect(filterTagCloud([], ['a', 'b'])).toEqual([]);
  });

  it('handles empty current tags', () => {
    expect(filterTagCloud(['a', 'b'], [])).toEqual(['a', 'b']);
  });
});

describe('normalizeTag', () => {
  it('trims and lowercases', () => {
    expect(normalizeTag('  TAG  ')).toBe('tag');
    expect(normalizeTag('MixedCase')).toBe('mixedcase');
  });

  it('handles empty string', () => {
    expect(normalizeTag('')).toBe('');
    expect(normalizeTag('   ')).toBe('');
  });
});

describe('isDuplicateTag', () => {
  it('returns true for duplicate (case-insensitive)', () => {
    expect(isDuplicateTag('TAG', ['tag', 'other'])).toBe(true);
    expect(isDuplicateTag('tag', ['TAG', 'other'])).toBe(true);
  });

  it('returns false for unique tag', () => {
    expect(isDuplicateTag('new', ['existing', 'tags'])).toBe(false);
  });

  it('returns true for empty tag', () => {
    expect(isDuplicateTag('', ['a', 'b'])).toBe(true);
    expect(isDuplicateTag('  ', ['a', 'b'])).toBe(true);
  });

  it('handles empty existing tags', () => {
    expect(isDuplicateTag('new', [])).toBe(false);
  });
});
