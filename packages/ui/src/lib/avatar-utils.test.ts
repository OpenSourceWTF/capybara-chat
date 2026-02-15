/**
 * Avatar Utilities Tests
 */

import { describe, it, expect } from 'vitest';
import {
  hashCode,
  getExpression,
  getColor,
  generateFacePattern,
  generateASCIIFace,
  EXPRESSIONS,
  WARM_COLORS,
  EYES,
  MOUTHS,
} from './avatar-utils';

describe('hashCode', () => {
  it('returns consistent hash for same input', () => {
    expect(hashCode('test')).toBe(hashCode('test'));
    expect(hashCode('agent-123')).toBe(hashCode('agent-123'));
  });

  it('returns different hash for different inputs', () => {
    expect(hashCode('test1')).not.toBe(hashCode('test2'));
    expect(hashCode('a')).not.toBe(hashCode('b'));
  });

  it('returns positive number', () => {
    expect(hashCode('test')).toBeGreaterThan(0);
    expect(hashCode('')).toBeGreaterThan(0);
    expect(hashCode('negative-test')).toBeGreaterThan(0);
  });

  it('handles empty string', () => {
    const hash = hashCode('');
    expect(typeof hash).toBe('number');
    expect(hash).toBeGreaterThan(0);
  });

  it('handles unicode characters', () => {
    const hash = hashCode('🤖');
    expect(typeof hash).toBe('number');
    expect(hash).toBeGreaterThan(0);
  });
});

describe('getExpression', () => {
  it('returns valid expression for any seed', () => {
    for (let i = 0; i < 100; i++) {
      const expression = getExpression(i);
      expect(EXPRESSIONS).toContain(expression);
    }
  });

  it('cycles through expressions', () => {
    expect(getExpression(0)).toBe('neutral');
    expect(getExpression(1)).toBe('happy');
    expect(getExpression(2)).toBe('surprised');
    expect(getExpression(3)).toBe('skeptical');
    expect(getExpression(4)).toBe('neutral'); // wraps
  });

  it('is deterministic', () => {
    expect(getExpression(42)).toBe(getExpression(42));
  });
});

describe('getColor', () => {
  it('returns valid color for any seed', () => {
    for (let i = 0; i < 100; i++) {
      const color = getColor(i);
      expect(WARM_COLORS).toContain(color);
    }
  });

  it('cycles through colors', () => {
    expect(getColor(0)).toBe(WARM_COLORS[0]);
    expect(getColor(1)).toBe(WARM_COLORS[1]);
    expect(getColor(WARM_COLORS.length)).toBe(WARM_COLORS[0]); // wraps
  });

  it('is deterministic', () => {
    expect(getColor(42)).toBe(getColor(42));
  });
});

describe('generateFacePattern', () => {
  it('returns 25-element array (5x5 grid)', () => {
    const pattern = generateFacePattern(12345);
    expect(pattern).toHaveLength(25);
  });

  it('always has eyes at positions (1,1) and (3,1)', () => {
    // In flattened array: row 1 = indices 5-9, positions 1 and 3 = indices 6 and 8
    for (let seed = 0; seed < 100; seed++) {
      const pattern = generateFacePattern(seed);
      expect(pattern[6]).toBe(1); // left eye
      expect(pattern[8]).toBe(1); // right eye
    }
  });

  it('is deterministic', () => {
    const pattern1 = generateFacePattern(42);
    const pattern2 = generateFacePattern(42);
    expect(pattern1).toEqual(pattern2);
  });

  it('produces different patterns for different seeds', () => {
    const pattern1 = generateFacePattern(1);
    const pattern2 = generateFacePattern(1000);
    // At least some difference expected (though eyes are always same)
    expect(pattern1.join('')).not.toBe(pattern2.join(''));
  });

  it('has antenna for some seeds', () => {
    // Antenna appears when (seed >> 8) % 4 === 0
    // seed = 0: (0 >> 8) % 4 = 0, has antenna
    const patternWithAntenna = generateFacePattern(0);
    expect(patternWithAntenna[0]).toBe(1); // top-left antenna
    expect(patternWithAntenna[4]).toBe(1); // top-right antenna
  });

  it('has ears for some seeds', () => {
    // Ears appear when (seed >> 10) % 3 === 0
    // Need to find a seed where this is true
    // seed = 0: (0 >> 10) % 3 = 0, has ears
    const patternWithEars = generateFacePattern(0);
    expect(patternWithEars[5]).toBe(1); // left ear (row 1, col 0)
    expect(patternWithEars[9]).toBe(1); // right ear (row 1, col 4)
  });
});

describe('generateASCIIFace', () => {
  it('returns face and color', () => {
    const result = generateASCIIFace(12345);
    expect(result).toHaveProperty('face');
    expect(result).toHaveProperty('color');
  });

  it('face has format: eye + mouth + eye', () => {
    const result = generateASCIIFace(0);
    expect(result.face).toHaveLength(3);
    const [leftEye, mouth, rightEye] = result.face;
    expect(EYES).toContain(leftEye);
    expect(Object.values(MOUTHS)).toContain(mouth);
    expect(EYES).toContain(rightEye);
    expect(leftEye).toBe(rightEye); // symmetric
  });

  it('color is from WARM_COLORS', () => {
    const result = generateASCIIFace(42);
    expect(WARM_COLORS).toContain(result.color);
  });

  it('is deterministic', () => {
    const result1 = generateASCIIFace(42);
    const result2 = generateASCIIFace(42);
    expect(result1).toEqual(result2);
  });
});
