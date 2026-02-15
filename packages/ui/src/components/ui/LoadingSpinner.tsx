/**
 * LoadingSpinner - Reusable loading state component
 *
 * Uses the unified ProgressSpinner for consistent styling.
 */

import { ProgressSpinnerBlock } from './ProgressSpinner';

export interface LoadingSpinnerProps {
  /** Loading message to display */
  message?: string;
  /** Height class (default: h-64) */
  height?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Centered loading spinner with optional message
 *
 * @deprecated Use ProgressSpinnerBlock from './ProgressSpinner' instead
 */
export function LoadingSpinner({
  message = 'Loading...',
  height = 'h-64',
  className,
}: LoadingSpinnerProps) {
  return (
    <ProgressSpinnerBlock message={message} height={height} className={className} />
  );
}
