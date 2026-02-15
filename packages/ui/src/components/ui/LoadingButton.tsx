/**
 * LoadingButton - Button wrapper with loading state
 *
 * Composition pattern: wraps Button to add loading behavior without
 * violating single responsibility. The spinner uses a terminal-style
 * aesthetic (square edges, no rounded corners).
 *
 * @example
 * <LoadingButton loading={isSaving} loadingText="Saving...">
 *   Save
 * </LoadingButton>
 */

import { Button, ButtonProps } from './Button';

export interface LoadingButtonProps extends ButtonProps {
  /** Show loading state with spinner */
  loading?: boolean;
  /** Text to display while loading (replaces children) */
  loadingText?: string;
}

/**
 * Terminal-style spinner component
 * Uses CSS animation with square corners for terminal aesthetic
 */
function TerminalSpinner() {
  return (
    <span
      role="status"
      className="inline-flex items-center justify-center"
      aria-label="Loading"
    >
      <span
        aria-hidden="true"
        className="inline-block w-3 h-3 border-2 border-current border-t-transparent animate-spin"
        style={{
          // Ensure square corners for terminal aesthetic
          borderRadius: 0,
        }}
      />
    </span>
  );
}

export function LoadingButton({
  loading = false,
  loadingText,
  children,
  disabled,
  ...props
}: LoadingButtonProps) {
  return (
    <Button
      {...props}
      disabled={disabled || loading}
      aria-busy={loading ? 'true' : undefined}
    >
      {loading && <TerminalSpinner />}
      {loading && loadingText ? loadingText : children}
    </Button>
  );
}
