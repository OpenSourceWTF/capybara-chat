/**
 * LockableSelect - Select field with lock state indicator
 *
 * Shows when a field is locked by another user/AI.
 * Refactored to use shared withLockable utilities.
 */

import { forwardRef, SelectHTMLAttributes } from 'react';
import { Lock, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  type LockableBaseProps,
  FieldWrapper,
  getLockableClasses,
} from './WithLockable';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface LockableSelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'>, LockableBaseProps {
  /** Options for the select */
  options: SelectOption[];
  /** Placeholder option text */
  placeholder?: string;
}

export const LockableSelect = forwardRef<HTMLSelectElement, LockableSelectProps>(
  ({ className, options, locked, lockedBy, label, error, aiTyping, aiFilled, placeholder, disabled, ...props }, ref) => {
    const isDisabled = disabled || locked;

    return (
      <FieldWrapper label={label} locked={locked} lockedBy={lockedBy} error={error}>
        <div className="relative">
          <select
            ref={ref}
            disabled={isDisabled}
            className={cn(
              'flex h-10 w-full appearance-none rounded-none border border-input bg-background px-3 py-2 pr-10 text-sm font-mono',
              'ring-offset-background',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              'disabled:cursor-not-allowed disabled:opacity-50',
              getLockableClasses(locked, aiTyping, !!error, aiFilled),
              className
            )}
            aria-invalid={!!error}
            aria-describedby={error && label ? `${label.toLowerCase().replace(/\s+/g, '-')}-error` : undefined}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((option) => (
              <option key={option.value} value={option.value} disabled={option.disabled}>
                {option.label}
              </option>
            ))}
          </select>

          {/* Icons overlay - lock or chevron */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none">
            {locked ? (
              <Lock className="w-4 h-4 text-yellow-500" aria-hidden="true" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
            )}
          </div>
        </div>
      </FieldWrapper>
    );
  }
);

LockableSelect.displayName = 'LockableSelect';
