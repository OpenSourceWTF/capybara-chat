/**
 * LazyFallback - Loading state for lazy-loaded components
 *
 * Used as Suspense fallback for React.lazy() components.
 * Matches the terminal aesthetic with minimal visual disruption.
 */

import { LoadingSpinner } from './LoadingSpinner';

interface LazyFallbackProps {
  /** Optional message to show */
  message?: string;
}

/**
 * Default fallback for lazy-loaded view components
 */
export function ViewFallback({ message = 'Loading...' }: LazyFallbackProps) {
  return <LoadingSpinner message={message} height="h-64" />;
}

/**
 * Compact fallback for lazy-loaded modals
 */
export function ModalFallback() {
  return <LoadingSpinner message="Loading..." height="h-32" />;
}
