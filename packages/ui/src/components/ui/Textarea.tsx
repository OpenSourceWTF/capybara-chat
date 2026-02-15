/**
 * Textarea - Terminal-style textarea component
 *
 * Variants:
 * - default: Full border box (legacy)
 * - terminal: Border-bottom only, transparent, compact (preferred)
 */

import { TextareaHTMLAttributes, forwardRef } from 'react';
import { cn } from '../../lib/utils';
import { getFieldClasses, type FieldVariant } from '../../lib/terminal-field-styles';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Style variant - use 'terminal' for Cozy Terminal aesthetic */
  variant?: FieldVariant;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className = '', variant = 'default', ...props }, ref) => {
    return (
      <textarea
        className={cn(
          getFieldClasses('textarea', variant, 'flex min-h-[80px] leading-relaxed'),
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);

Textarea.displayName = 'Textarea';
