/**
 * SearchableSelect - Async search dropdown with keyboard navigation
 *
 * A reusable component for searching and selecting from a remote list.
 * Supports debounced search, keyboard navigation, and flexible rendering.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { Search, ChevronDown, X, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface SearchableSelectProps<T> {
  /** Fetch options based on search query */
  fetchOptions: (query: string) => Promise<T[]>;
  /** How to render each option in the dropdown */
  renderOption: (item: T) => React.ReactNode;
  /** Get display label for selected item */
  getLabel: (item: T) => string;
  /** Get unique value for item */
  getValue: (item: T) => string;
  /** Currently selected value (null = nothing selected) */
  value: string | null;
  /** Called when selection changes */
  onChange: (value: string | null, item: T | null) => void;
  /** Pre-selected item object (for externally-set selections) */
  selectedItem?: T | null;
  placeholder?: string;
  disabled?: boolean;
  debounceMs?: number;
  emptyMessage?: string;
  className?: string;
}

export function SearchableSelect<T>({
  fetchOptions,
  renderOption,
  getLabel,
  getValue,
  value,
  onChange,
  selectedItem: externalSelectedItem,
  placeholder = 'Search...',
  disabled = false,
  debounceMs = 300,
  emptyMessage = 'No results found',
  className,
}: SearchableSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [internalSelectedItem, setInternalSelectedItem] = useState<T | null>(null);

  // Use external selectedItem if provided, otherwise use internal state
  const selectedItem = externalSelectedItem !== undefined ? externalSelectedItem : internalSelectedItem;

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Fetch on query change with debounce
  useEffect(() => {
    if (!isOpen) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const results = await fetchOptions(query);
        setOptions(results);
        setHighlightIndex(-1);
      } catch {
        setOptions([]);
      } finally {
        setLoading(false);
      }
    }, debounceMs);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, isOpen, fetchOptions, debounceMs]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleOpen = useCallback(() => {
    if (disabled) return;
    setIsOpen(true);
    setQuery('');
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [disabled]);

  const handleSelect = useCallback((item: T) => {
    setInternalSelectedItem(item);
    onChange(getValue(item), item);
    setIsOpen(false);
    setQuery('');
  }, [onChange, getValue]);

  const handleClear = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setInternalSelectedItem(null);
    onChange(null, null);
  }, [onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightIndex(i => Math.min(i + 1, options.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightIndex(i => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightIndex >= 0 && options[highlightIndex]) {
          handleSelect(options[highlightIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        break;
    }
  }, [isOpen, options, highlightIndex, handleSelect]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('[data-option]');
      items[highlightIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightIndex]);

  const displayLabel = selectedItem ? getLabel(selectedItem) : (value ? `ID: ${value}` : null);

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {/* Trigger */}
      <button
        type="button"
        onClick={handleOpen}
        disabled={disabled}
        className={cn(
          'w-full flex items-center gap-2 px-3 py-2 text-sm rounded-none border transition-colors text-left font-mono',
          'bg-background hover:border-primary/40 focus:outline-none focus:border-primary',
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
          isOpen ? 'border-primary' : 'border-border',
        )}
      >
        {displayLabel ? (
          <>
            <span className="flex-1 truncate text-foreground">{displayLabel}</span>
            <X
              className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground shrink-0"
              onClick={handleClear}
            />
          </>
        ) : (
          <>
            <Search className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
            <span className="flex-1 text-muted-foreground/60">{placeholder}</span>
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
          </>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-card border border-border rounded-none shadow-md overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
          {/* Search input */}
          <div className="p-2 border-b border-border/30">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                className="w-full pl-8 pr-3 py-1.5 text-sm bg-muted/30 rounded-none border-0 outline-none placeholder:text-muted-foreground/50 font-mono"
              />
              {loading && (
                <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50 animate-spin" />
              )}
            </div>
          </div>

          {/* Options list */}
          <div ref={listRef} className="max-h-[200px] overflow-y-auto py-1">
            {!loading && options.length === 0 && (
              <div className="px-3 py-4 text-center text-2xs text-muted-foreground/60 font-mono">
                {emptyMessage}
              </div>
            )}
            {options.map((item, idx) => (
              <div
                key={getValue(item)}
                data-option
                onClick={() => handleSelect(item)}
                className={cn(
                  'px-3 py-2 cursor-pointer transition-colors text-sm font-mono',
                  idx === highlightIndex
                    ? 'bg-primary/10 text-foreground'
                    : 'hover:bg-muted/50 text-foreground/90',
                )}
              >
                {renderOption(item)}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
