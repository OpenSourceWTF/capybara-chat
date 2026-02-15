/**
 * Input - Terminal-style input component
 *
 * Variants:
 * - default: Full border box (legacy)
 * - terminal: Border-bottom only, transparent, compact (preferred)
 */

import { InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '../../lib/utils';
import { getFieldClasses, type FieldVariant } from '../../lib/terminal-field-styles';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Style variant - use 'terminal' for Cozy Terminal aesthetic */
  variant?: FieldVariant;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', type = 'text', variant = 'default', ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          getFieldClasses('input', variant, 'flex file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground'),
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';
