/**
 * LockableTextarea - Textarea field with lock state indicator
 *
 * Shows when a field is locked by another user/AI.
 * Refactored to use shared withLockable utilities.
 */

import { forwardRef, TextareaHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';
import {
  type LockableBaseProps,
  FieldWrapper,
  LockIconOverlay,
  AiTypingIndicator,
  getLockableClasses,
} from './WithLockable';

export interface LockableTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement>, LockableBaseProps { }

export const LockableTextarea = forwardRef<HTMLTextAreaElement, LockableTextareaProps>(
  ({ className, locked, lockedBy, label, error, aiTyping, aiFilled, disabled, ...props }, ref) => {
    const isDisabled = disabled || locked;

    return (
      <FieldWrapper label={label} locked={locked} lockedBy={lockedBy} error={error}>
        <div className="relative">
          <textarea
            ref={ref}
            disabled={isDisabled}
            className={cn(
              'flex min-h-[120px] w-full rounded-none border border-input bg-background px-3 py-2 text-sm font-mono',
              'ring-offset-background',
              'placeholder:text-muted-foreground',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              'disabled:cursor-not-allowed disabled:opacity-50',
              'resize-y',
              getLockableClasses(locked, aiTyping, !!error, aiFilled),
              className
            )}
            aria-invalid={!!error}
            aria-describedby={error && label ? `${label.toLowerCase().replace(/\s+/g, '-')}-error` : undefined}
            {...props}
          />

          {/* Lock icon overlay - positioned at top for textareas */}
          {locked && <LockIconOverlay position="top" />}

          {/* AI typing indicator - positioned at top for textareas */}
          {aiTyping && !locked && <AiTypingIndicator position="top" />}
        </div>
      </FieldWrapper>
    );
  }
);

LockableTextarea.displayName = 'LockableTextarea';
