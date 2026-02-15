/**
 * FormField - Terminal-style micro-label wrapper
 *
 * Adds a persistent, subtle label above any form input.
 * Typography: 10px mono bold uppercase tracking-widest (Cozy Terminal style)
 *
 * Enhanced with error state handling:
 * - Terminal-style error display: [!] prefix in destructive color
 * - Terminal-style valid display: [ok] prefix in success color
 * - ARIA attributes for accessibility
 * - Library-agnostic: Works with Formik, React Hook Form, or custom validation
 */

import { useId } from 'react';
import { cn } from '../../lib/utils';

export interface FormFieldProps {
  /** Label text displayed above the field */
  label: string;
  /** Whether the field is required */
  required?: boolean;
  /** Whether to use inline (horizontal) layout vs stacked */
  inline?: boolean;
  /** Additional class names for the wrapper */
  className?: string;
  /** Error message to display */
  error?: string;
  /** Whether to show the error (library-agnostic, parent decides when to show) */
  showError?: boolean;
  /** Whether to show the valid state */
  showValid?: boolean;
  /** Optional ID for the field (used to generate error element ID) */
  id?: string;
  children: React.ReactNode;
}

export function FormField({
  label,
  inline = false,
  required = false,
  className,
  error,
  showError = false,
  showValid = false,
  id,
  children,
}: FormFieldProps) {
  // Generate a stable ID for the error element
  const generatedId = useId();
  const errorId = `${id || generatedId}-error`;

  // Determine if we should display error
  // Only show error when showError is true AND error is a non-empty string
  const hasError =
    showError && typeof error === 'string' && error.trim().length > 0;

  // Determine if we should display valid state
  // Only show valid when showValid is true AND we're not showing an error
  const showValidState = showValid && !hasError;

  return (
    <div
      className={cn(
        inline ? 'flex items-center gap-2' : 'flex flex-col gap-1',
        hasError && 'text-destructive',
        showValidState && 'text-success',
        className
      )}
      aria-invalid={hasError ? 'true' : undefined}
      aria-describedby={hasError ? errorId : undefined}
    >
      <label className="block text-2xs font-mono font-bold text-muted-foreground uppercase tracking-widest select-none whitespace-nowrap">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      {children}
      {hasError && (
        <div role="alert" className="flex items-start gap-1.5 mt-1 font-mono">
          <span className="text-destructive text-xs font-bold" aria-hidden="true">
            [!]
          </span>
          <span id={errorId} className="text-destructive text-2xs">
            {error}
          </span>
        </div>
      )}
      {showValidState && (
        <div className="flex items-center gap-1.5 mt-1 font-mono">
          <span className="text-success text-xs font-bold" aria-hidden="true">
            [ok]
          </span>
          <span className="text-success text-2xs">Valid</span>
        </div>
      )}
    </div>
  );
}
