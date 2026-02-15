/**
 * Select - Terminal-style select component
 *
 * Variants:
 * - default: Full border box (legacy)
 * - terminal: Border-bottom only, transparent, compact (preferred)
 */

import { SelectHTMLAttributes, forwardRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';
import { getFieldClasses, SELECT_CHEVRON_STYLES, type FieldVariant } from '../../lib/terminal-field-styles';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  /** Style variant - use 'terminal' for Cozy Terminal aesthetic */
  variant?: FieldVariant;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className = '', variant = 'default', ...props }, ref) => {
    return (
      <div className="relative w-full">
        <select
          className={cn(
            getFieldClasses('select', variant, 'appearance-none flex'),
            className
          )}
          ref={ref}
          {...props}
        />
        <ChevronDown
          className={cn(
            "absolute h-4 w-4 text-muted-foreground/70 pointer-events-none",
            SELECT_CHEVRON_STYLES[variant]
          )}
        />
      </div>
    );
  }
);

Select.displayName = 'Select';
