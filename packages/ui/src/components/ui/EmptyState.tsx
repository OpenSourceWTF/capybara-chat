/**
 * EmptyState - Reusable empty list state component
 *
 * Eliminates duplicate empty state UI patterns across components.
 */

import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

export interface EmptyStateProps {
  /** Main message to display */
  message: string;
  /** Optional description text below message */
  description?: string;
  /** Optional action button or element */
  action?: ReactNode;
  /** Optional icon element */
  icon?: ReactNode;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Centered empty state with message and optional action
 */
export function EmptyState({
  message,
  description,
  action,
  icon,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn('text-center py-8 text-muted-foreground', className)}>
      {icon && <div className="mb-4 flex justify-center">{icon}</div>}
      <p className="mb-2 text-base">{message}</p>
      {description && <p className="mb-4 text-sm opacity-75">{description}</p>}
      {action}
    </div>
  );
}
