/**
 * ProgressSpinner - Unified progress/loading indicator
 *
 * Uses the dedicated `progress` color (warm teal) which is:
 * - Distinct from warm palette (amber/orange)
 * - Distinct from status colors (green/red/yellow)
 * - Classic terminal "processing" feel (ANSI cyan family)
 *
 * Size variants:
 * - xs: 12px - inline with small text (timestamps, badges)
 * - sm: 14px - inline with body text (tool calls, activity)
 * - md: 18px - standalone indicators
 * - lg: 24px - block-level loading states
 */

import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface ProgressSpinnerProps {
  /** Size variant */
  size?: 'xs' | 'sm' | 'md' | 'lg';
  /** Optional label text */
  label?: string;
  /** Additional CSS classes */
  className?: string;
}

const SIZE_CLASSES = {
  xs: 'w-3 h-3',
  sm: 'w-3.5 h-3.5',
  md: 'w-4.5 h-4.5',
  lg: 'w-6 h-6',
} as const;

const LABEL_CLASSES = {
  xs: 'text-2xs',
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
} as const;

/**
 * Inline progress spinner with optional label
 *
 * @example
 * // Inline spinner in tool call
 * <ProgressSpinner size="sm" />
 *
 * @example
 * // With label
 * <ProgressSpinner size="sm" label="Processing..." />
 */
export function ProgressSpinner({
  size = 'sm',
  label,
  className,
}: ProgressSpinnerProps) {
  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <Loader2
        className={cn(
          SIZE_CLASSES[size],
          'animate-spin text-progress',
        )}
      />
      {label && (
        <span className={cn(LABEL_CLASSES[size], 'text-progress-muted')}>
          {label}
        </span>
      )}
    </span>
  );
}

/**
 * Block-level loading state with centered spinner
 *
 * @example
 * <ProgressSpinnerBlock message="Loading data..." />
 */
export function ProgressSpinnerBlock({
  message = 'Loading...',
  height = 'h-32',
  className,
}: {
  message?: string;
  height?: string;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3', height, className)}>
      <Loader2 className="w-6 h-6 animate-spin text-progress" />
      <span className="text-xs font-mono uppercase tracking-wider text-progress-muted">{message}</span>
    </div>
  );
}

export default ProgressSpinner;
