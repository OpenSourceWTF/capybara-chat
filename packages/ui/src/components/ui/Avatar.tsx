/**
 * Avatar - ID-based generated avatars for agents
 *
 * Two variants designed to trigger anthropomorphic tendencies:
 * - RobotFaceAvatar: 5x5 pixel grid with guaranteed "eyes"
 * - ASCIIFaceAvatar: Inline text faces like [■_■]
 *
 * Both use the same hash → personality mapping for consistency.
 *
 * Pure functions extracted to lib/avatar-utils.ts for unit testing.
 */
import { useMemo } from 'react';
import {
  hashCode,
  getColor,
  generateFacePattern,
  generateASCIIFace,
} from '../../lib/avatar-utils';

interface RobotFaceAvatarProps {
  /** Unique identifier to generate the face from */
  id: string;
  /** Size in pixels (default: 24) */
  size?: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * 5x5 pixel grid avatar with robot face
 *
 * @example
 * <RobotFaceAvatar id="agent-123" size={32} />
 */
export function RobotFaceAvatar({
  id,
  size = 24,
  className = '',
}: RobotFaceAvatarProps) {
  const { pattern, color } = useMemo(() => {
    const seed = hashCode(id);
    return {
      pattern: generateFacePattern(seed),
      color: getColor(seed >> 4),
    };
  }, [id]);

  const cellSize = size / 5;

  return (
    <div
      className={`grid grid-cols-5 border border-border flex-shrink-0 ${className}`}
      style={{ width: size, height: size }}
      title={id}
      aria-label={`Avatar for ${id}`}
    >
      {pattern.map((on, i) => (
        <div
          key={i}
          style={{
            width: cellSize,
            height: cellSize,
            backgroundColor: on ? color : 'transparent',
          }}
        />
      ))}
    </div>
  );
}

// ============================================================================
// ASCII Face Avatar (Inline Text)
// ============================================================================

interface ASCIIFaceAvatarProps {
  /** Unique identifier to generate the face from */
  id: string;
  /** Show brackets around face (default: true) */
  showBrackets?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Inline text face avatar like [■_■]
 *
 * @example
 * <ASCIIFaceAvatar id="agent-123" />
 * // Renders: [■_■] or [▪‿▪] etc.
 */
export function ASCIIFaceAvatar({
  id,
  showBrackets = true,
  className = '',
}: ASCIIFaceAvatarProps) {
  const { face, color } = useMemo(() => {
    const seed = hashCode(id);
    return generateASCIIFace(seed);
  }, [id]);

  const content = showBrackets ? `[${face}]` : face;

  return (
    <span
      className={`font-mono text-sm ${className}`}
      style={{ color }}
      title={id}
      aria-label={`Avatar for ${id}`}
    >
      {content}
    </span>
  );
}

// ============================================================================
// Combined Avatar (Auto-selects based on context)
// ============================================================================

interface AvatarProps {
  /** Unique identifier to generate the avatar from */
  id: string;
  /** Variant: 'grid' for pixel face, 'ascii' for text face */
  variant?: 'grid' | 'ascii';
  /** Size for grid variant (default: 24) */
  size?: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Unified avatar component that renders either grid or ASCII variant
 *
 * @example
 * // Grid variant (for headers, cards)
 * <Avatar id="agent-123" variant="grid" size={32} />
 *
 * // ASCII variant (for inline text, logs)
 * <Avatar id="agent-123" variant="ascii" />
 */
export function Avatar({
  id,
  variant = 'grid',
  size = 24,
  className = '',
}: AvatarProps) {
  if (variant === 'ascii') {
    return <ASCIIFaceAvatar id={id} className={className} />;
  }

  return <RobotFaceAvatar id={id} size={size} className={className} />;
}

export default Avatar;
