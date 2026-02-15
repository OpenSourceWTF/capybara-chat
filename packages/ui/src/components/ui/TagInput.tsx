/**
 * TagInput - Interactive tag input with tag cloud suggestions
 *
 * Features:
 * - Add tags via typing + Enter/comma/Tab
 * - Remove tags with backspace or click X
 * - Tag cloud of previously used tags as clickable suggestions
 * - Smooth animations on add/remove
 * - AI-filled field visual indicator
 *
 * Pure functions extracted to lib/tag-utils.ts for unit testing.
 */

import { useState, useRef, useCallback, useMemo } from 'react';
import { X, Hash } from 'lucide-react';
import { Badge } from './Badge';
import { cn } from '../../lib/utils';
import {
  parseTags,
  formatTags,
  filterTagCloud as filterCloud,
  isDuplicateTag,
  normalizeTag,
} from '../../lib/tag-utils';

export interface TagInputProps {
  /** Current tags as comma-separated string */
  value: string;
  /** Called when tags change (comma-separated string) */
  onChange: (value: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Whether the field is disabled */
  disabled?: boolean;
  /** Whether the field was AI-filled */
  isAiFilled?: boolean;
  /** Additional class names */
  className?: string;
  /** Known tags for the suggestion cloud (from other entities) */
  knownTags?: string[];
  /** Style variant - use 'terminal' for Cozy Terminal aesthetic */
  variant?: 'default' | 'terminal';
}

const containerStyles = {
  default: 'min-h-[2.5rem] px-3 py-1.5 border border-border bg-background shadow-sm',
  terminal: 'min-h-[32px] px-2 py-1 border-0 border-b border-border bg-transparent shadow-none',
};

export function TagInput({
  value,
  onChange,
  placeholder = 'Add a tag...',
  disabled = false,
  isAiFilled = false,
  className,
  knownTags = [],
  variant = 'default',
}: TagInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse comma-separated string into array (using extracted utility)
  const tags = useMemo(() => parseTags(value), [value]);

  // Build tag cloud: known tags minus already-selected ones (using extracted utility)
  const tagCloud = useMemo(() => filterCloud(knownTags, tags), [knownTags, tags]);

  const updateTags = useCallback(
    (newTags: string[]) => {
      onChange(formatTags(newTags));
    },
    [onChange]
  );

  const addTag = useCallback(
    (tag: string) => {
      const trimmed = normalizeTag(tag);
      if (!trimmed) return;
      if (isDuplicateTag(tag, tags)) return;
      updateTags([...tags, trimmed]);
      setInputValue('');
    },
    [tags, updateTags]
  );

  const removeTag = useCallback(
    (index: number) => {
      const newTags = [...tags];
      newTags.splice(index, 1);
      updateTags(newTags);
    },
    [tags, updateTags]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' || e.key === ',' || e.key === 'Tab') {
        if (inputValue.trim()) {
          e.preventDefault();
          addTag(inputValue);
        } else if (e.key === ',') {
          e.preventDefault();
        }
      } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
        removeTag(tags.length - 1);
      }
    },
    [inputValue, tags, addTag, removeTag]
  );

  const handleBlur = useCallback(() => {
    if (inputValue.trim()) {
      addTag(inputValue);
    }
    // Delay to allow click events on tag cloud
    setTimeout(() => setIsFocused(false), 150);
  }, [inputValue, addTag]);

  const handleContainerClick = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className={cn('space-y-1.5', className)}>
      {/* Main input area */}
      <div
        ref={containerRef}
        onClick={handleContainerClick}
        className={cn(
          'flex flex-wrap items-center gap-1.5 h-auto w-full',
          'rounded-none text-sm font-mono transition-all duration-200 cursor-text',
          containerStyles[variant],
          isFocused
            ? (variant === 'terminal' ? 'border-primary' : 'ring-1 ring-primary border-primary')
            : 'hover:border-primary/50',
          disabled && 'opacity-50 cursor-not-allowed',
          isAiFilled && 'field-ai-filled'
        )}
      >
        {/* Rendered tags */}
        {tags.map((tag, idx) => (
          <span
            key={tag}
            className="inline-flex items-center gap-0.5 animate-in fade-in slide-in-from-left-1 duration-150"
          >
            {variant === 'terminal' ? (
              /* Terminal: Bracketed [tag×] format */
              <span className="inline-flex items-center gap-0.5 text-xs font-mono text-primary">
                [{tag}
                {!disabled && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeTag(idx);
                    }}
                    className="hover:text-destructive transition-colors"
                    aria-label={`Remove ${tag}`}
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                )}
                ]
              </span>
            ) : (
              /* Default: Badge-based tags */
              <Badge
                variant="soft"
                intent="primary"
                isTag
                className="pr-1 gap-0.5 select-none text-xs h-5"
              >
                <span className="opacity-50 text-xs">#</span>
                {tag}
                {!disabled && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeTag(idx);
                    }}
                    className="ml-0.5 p-0.5 hover:bg-primary/20 transition-colors"
                    aria-label={`Remove ${tag}`}
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                )}
              </Badge>
            )}
          </span>
        ))}

        {/* Text input */}
        {!disabled && (
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={handleBlur}
            placeholder={tags.length === 0 ? placeholder : ''}
            className="flex-1 min-w-[60px] bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground/50"
            disabled={disabled}
          />
        )}
      </div>

      {/* Tag cloud suggestions */}
      {isFocused && tagCloud.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-0.5 animate-in fade-in slide-in-from-top-1 duration-200">
          <Hash className="h-3 w-3 text-muted-foreground/40 mt-[5px] mr-0.5" />
          {tagCloud.map((tag) => (
            <button
              key={tag}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault(); // Prevent blur
                addTag(tag);
              }}
              className={cn(
                'inline-flex items-center px-1.5 py-0.5 text-xs font-medium font-mono',
                'border border-dashed border-border/60 text-muted-foreground',
                'hover:border-primary/40 hover:text-primary hover:bg-primary/5',
                'transition-all duration-150 cursor-pointer select-none'
              )}
            >
              {tag}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
