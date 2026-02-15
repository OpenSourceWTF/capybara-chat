/**
 * MarkdownTextarea - Textarea with edit/preview mode for markdown content
 *
 * Combines LockableTextarea with markdown preview toggle.
 */

import { forwardRef, TextareaHTMLAttributes, useState } from 'react';
import { Eye, Pencil } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Markdown } from './Markdown';
import {
  type LockableBaseProps,
  FieldWrapper,
  LockIconOverlay,
  AiTypingIndicator,
  getLockableClasses,
} from './WithLockable';

export interface MarkdownTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement>, LockableBaseProps {
  /** Start in preview mode */
  defaultPreview?: boolean;
}

export const MarkdownTextarea = forwardRef<HTMLTextAreaElement, MarkdownTextareaProps>(
  ({ className, locked, lockedBy, label, error, aiTyping, aiFilled, disabled, defaultPreview = false, value, ...props }, ref) => {
    const [isPreview, setIsPreview] = useState(defaultPreview);
    const isDisabled = disabled || locked;
    const textValue = String(value ?? '');

    return (
      <FieldWrapper label={label} locked={locked} lockedBy={lockedBy} error={error}>
        <div className="relative">
          {/* Mode toggle */}
          <div className="absolute top-2 right-2 z-10 flex items-center gap-0.5 bg-muted/80 backdrop-blur-sm p-0.5 border border-border/50">
            <button
              type="button"
              onClick={() => setIsPreview(false)}
              className={cn(
                'p-1 transition-colors',
                !isPreview
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              title="Edit"
              disabled={isDisabled}
            >
              <Pencil className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => setIsPreview(true)}
              className={cn(
                'p-1 transition-colors',
                isPreview
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              title="Preview"
            >
              <Eye className="w-3 h-3" />
            </button>
          </div>

          {isPreview ? (
            /* Preview mode */
            <div
              className={cn(
                'min-h-[120px] w-full rounded-none border border-border bg-background px-3 py-2 pr-14',
                getLockableClasses(locked, aiTyping, !!error, aiFilled),
                className
              )}
            >
              {textValue ? (
                <Markdown>{textValue}</Markdown>
              ) : (
                <span className="text-muted-foreground/50 text-sm italic">No content to preview</span>
              )}
            </div>
          ) : (
            /* Edit mode */
            <textarea
              ref={ref}
              disabled={isDisabled}
              value={value}
              className={cn(
                'flex min-h-[120px] w-full rounded-none border border-border bg-background px-3 py-2 pr-14 text-sm font-mono shadow-sm',
                'placeholder:text-muted-foreground/50',
                'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary',
                'disabled:cursor-not-allowed disabled:opacity-50',
                'resize-y',
                getLockableClasses(locked, aiTyping, !!error, aiFilled),
                className
              )}
              aria-invalid={!!error}
              aria-describedby={error && label ? `${label.toLowerCase().replace(/\s+/g, '-')}-error` : undefined}
              {...props}
            />
          )}

          {/* Lock icon overlay - positioned at top */}
          {locked && <LockIconOverlay position="top" />}

          {/* AI typing indicator - positioned at top */}
          {aiTyping && !locked && <AiTypingIndicator position="top" />}
        </div>
      </FieldWrapper>
    );
  }
);

MarkdownTextarea.displayName = 'MarkdownTextarea';
