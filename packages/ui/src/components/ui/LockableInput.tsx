/**
 * LockableInput - Input field with lock state indicator
 *
 * Shows when a field is locked by another user/AI.
 * Refactored to use shared withLockable utilities.
 */

import { forwardRef, InputHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';
import {
  type LockableBaseProps,
  FieldWrapper,
  LockIconOverlay,
  AiTypingIndicator,
  getLockableClasses,
} from './WithLockable';

export interface LockableInputProps extends InputHTMLAttributes<HTMLInputElement>, LockableBaseProps { }

export const LockableInput = forwardRef<HTMLInputElement, LockableInputProps>(
  ({ className, locked, lockedBy, label, error, aiTyping, aiFilled, disabled, ...props }, ref) => {
    const isDisabled = disabled || locked;

    return (
      <FieldWrapper label={label} locked={locked} lockedBy={lockedBy} error={error}>
        <div className="relative">
          <input
            ref={ref}
            disabled={isDisabled}
            className={cn(
              'flex h-10 w-full rounded-none border border-input bg-background px-3 py-2 text-sm',
              'ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium font-mono',
              'placeholder:text-muted-foreground',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              'disabled:cursor-not-allowed disabled:opacity-50',
              getLockableClasses(locked, aiTyping, !!error, aiFilled),
              className
            )}
            aria-invalid={!!error}
            aria-describedby={error && label ? `${label.toLowerCase().replace(/\s+/g, '-')}-error` : undefined}
            {...props}
          />

          {/* Lock icon overlay */}
          {locked && <LockIconOverlay position="center" />}

          {/* AI typing indicator */}
          {aiTyping && !locked && <AiTypingIndicator position="center" />}
        </div>
      </FieldWrapper>
    );
  }
);

LockableInput.displayName = 'LockableInput';
