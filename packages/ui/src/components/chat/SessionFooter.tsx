/**
 * SessionFooter - Displays session cost and metadata
 *
 * Shows cumulative API cost for the current session.
 */

import { DollarSign } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface SessionFooterProps {
  cost: number;
  className?: string;
}

/**
 * Format cost as USD with appropriate precision
 */
function formatCost(cost: number): string {
  if (cost < 0.01) {
    return `$${cost.toFixed(4)}`;
  }
  if (cost < 1) {
    return `$${cost.toFixed(3)}`;
  }
  return `$${cost.toFixed(2)}`;
}

export function SessionFooter({ cost, className }: SessionFooterProps) {
  if (cost <= 0) {
    return null;
  }

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground font-mono',
        className
      )}
    >
      <DollarSign className="w-3 h-3" />
      <span>{formatCost(cost)}</span>
    </div>
  );
}
