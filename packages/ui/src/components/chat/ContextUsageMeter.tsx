/**
 * ContextUsageMeter Component
 *
 * Displays context window usage in a terminal-style format.
 *
 * Format: CTX 63% [██████░░░░] 126k/200k
 *
 * Color thresholds (4 bands):
 * - 0-69%: text-success (green)
 * - 70-79%: text-warning (yellow)
 * - 80-89%: text-orange-600 (orange)
 * - 90-100%: text-destructive (red)
 *
 * NOTE: Session type filtering happens in the PARENT component
 * (GeneralConversation.tsx), not here.
 */

import { cn } from '../../lib/utils';
import type { ContextUsage } from '@capybara-chat/types';

export interface ContextUsageMeterProps {
  usage: ContextUsage | null;
  isStale?: boolean;
  className?: string;
}

/**
 * Get color class for 4-band system
 * - 0-69%: text-success
 * - 70-79%: text-warning
 * - 80-89%: text-orange-600
 * - 90%+: text-destructive
 */
function getUsageColor(percent: number): string {
  if (percent >= 90) return 'text-destructive';
  if (percent >= 80) return 'text-orange-600';
  if (percent >= 70) return 'text-warning';
  return 'text-success';
}

/**
 * Generates the progress bar string with clamping
 * Handles edge cases: negative values, values > 100, NaN
 */
function buildBar(percent: number): string {
  const rawFilled = Math.floor(percent / 10);
  // Clamp to 0-10 range, handle NaN by treating it as 0
  const filled = Number.isNaN(rawFilled)
    ? 0
    : Math.min(10, Math.max(0, rawFilled));
  return '█'.repeat(filled) + '░'.repeat(10 - filled);
}

/**
 * Format token count with 'k' suffix
 * Uses Math.round for rounding (e.g., 1500 -> 2k, 500 -> 1k)
 */
function formatTokensK(value: number): string {
  return Math.round(value / 1000) + 'k';
}

/**
 * ContextUsageMeter - displays context window usage in terminal style
 */
export function ContextUsageMeter({
  usage,
  isStale,
  className,
}: ContextUsageMeterProps): JSX.Element | null {
  if (!usage) return null;

  const colorClass = getUsageColor(usage.percent);
  const bar = buildBar(usage.percent);

  return (
    <div
      data-testid="context-usage-meter"
      role="meter"
      aria-valuenow={usage.percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Context usage: ${usage.percent}%`}
      className={cn(
        'font-mono text-2xs',
        colorClass,
        isStale && 'opacity-50',
        className
      )}
    >
      <span>CTX </span>
      <span>{usage.percent}% </span>
      <span>[{bar}] </span>
      <span>
        {formatTokensK(usage.used)}/{formatTokensK(usage.total)}
      </span>
    </div>
  );
}
