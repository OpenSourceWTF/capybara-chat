/**
 * Avatar Utilities - Pure functions for avatar generation
 *
 * Extracted from Avatar.tsx for unit testing.
 * These functions generate deterministic avatars based on ID strings.
 */

// ============================================================================
// Types
// ============================================================================

export type Expression = 'neutral' | 'happy' | 'surprised' | 'skeptical';

// ============================================================================
// Constants
// ============================================================================

export const EXPRESSIONS: Expression[] = ['neutral', 'happy', 'surprised', 'skeptical'];

export const WARM_COLORS = [
  'hsl(25 80% 45%)',   // Primary orange
  'hsl(35 85% 55%)',   // Golden accent
  'hsl(15 70% 50%)',   // Terracotta
  'hsl(30 95% 45%)',   // Burnt orange
  'hsl(45 80% 45%)',   // Amber
  'hsl(8 65% 50%)',    // Warm red
  'hsl(20 75% 40%)',   // Rust
  'hsl(40 70% 50%)',   // Ochre
];

export const EYES = ['■', '▪', '█', '●', '◆'];

export const MOUTHS: Record<Expression, string> = {
  neutral: '_',
  happy: '‿',
  surprised: '□',
  skeptical: '~',
};

/**
 * Mouth patterns for each expression (5 cells wide, rows 3-4)
 * 1 = filled, 0 = empty
 */
export const MOUTH_PATTERNS: Record<Expression, number[][]> = {
  neutral: [
    [0, 0, 0, 0, 0],
    [0, 0, 1, 0, 0],
  ],
  happy: [
    [0, 0, 0, 0, 0],
    [0, 1, 1, 1, 0],
  ],
  surprised: [
    [0, 0, 0, 0, 0],
    [0, 1, 0, 1, 0],
  ],
  skeptical: [
    [0, 0, 0, 0, 0],
    [0, 1, 0, 1, 0],
  ],
};

// ============================================================================
// Pure Functions
// ============================================================================

/**
 * Simple string hash function (djb2 algorithm)
 * Returns a positive 32-bit integer
 */
export function hashCode(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
  }
  return Math.abs(hash);
}

/**
 * Get consistent expression from seed
 */
export function getExpression(seed: number): Expression {
  return EXPRESSIONS[seed % EXPRESSIONS.length];
}

/**
 * Get consistent color from seed
 */
export function getColor(seed: number): string {
  return WARM_COLORS[seed % WARM_COLORS.length];
}

/**
 * Generate a 5x5 face pattern with guaranteed eyes
 */
export function generateFacePattern(seed: number): number[] {
  const expression = getExpression(seed);
  const hasAntenna = (seed >> 8) % 4 === 0;
  const hasEars = (seed >> 10) % 3 === 0;

  // Start with empty 5x5 grid
  const grid: number[][] = [
    [0, 0, 0, 0, 0], // Row 0: Antenna/top
    [0, 0, 0, 0, 0], // Row 1: Eyes
    [0, 0, 0, 0, 0], // Row 2: Nose area
    [0, 0, 0, 0, 0], // Row 3: Mouth top
    [0, 0, 0, 0, 0], // Row 4: Mouth bottom/chin
  ];

  // Always add eyes at positions (1,1) and (3,1)
  grid[1][1] = 1;
  grid[1][3] = 1;

  // Add mouth based on expression
  const mouth = MOUTH_PATTERNS[expression];
  grid[3] = mouth[0];
  grid[4] = mouth[1];

  // Optional: Add antenna
  if (hasAntenna) {
    grid[0][0] = 1;
    grid[0][4] = 1;
  }

  // Optional: Add ears (side pixels)
  if (hasEars) {
    grid[1][0] = 1;
    grid[1][4] = 1;
  }

  // Flatten to 1D array
  return grid.flat();
}

/**
 * Generate ASCII face from seed
 */
export function generateASCIIFace(seed: number): { face: string; color: string } {
  const eye = EYES[seed % EYES.length];
  const expression = getExpression(seed >> 4);
  const mouth = MOUTHS[expression];

  return {
    face: `${eye}${mouth}${eye}`,
    color: getColor(seed >> 4),
  };
}
