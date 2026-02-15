/**
 * TerminalLibraryLayout - Self-contained terminal-style library browser
 * 
 * Features:
 * - CLI-style command prompt header with search
 * - Collapsible tag sidebar with bracketed [tag] styling
 * - Terminal cursor aesthetic on hover
 * - Full terminal typography and zero radii
 */

import { ReactNode, useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { Button, TerminalTag, TerminalSearchBar } from '../ui';
import { cn } from '../../lib/utils';
import { STORAGE_KEYS } from '../../constants';
import { useCollapsiblePane } from '../../hooks/useCollapsiblePane';

export interface FilterOption {
  value: string;
  label: string;
  count: number;
}

interface TerminalLibraryLayoutProps<T> {
  // Data
  items: T[];
  loading: boolean;

  // CLI Header Config
  commandPrefix: string; // e.g., "grep" or "ps aux | grep"
  searchPlaceholder?: string;

  // Filtering
  onSearchChange?: (query: string) => void;
  // Function to derive filter options from the full dataset
  getFilterOptions: (items: T[]) => FilterOption[];
  // Function to filter items based on query and active filters (now supports multiple)
  filterFn: (item: T, query: string, activeFilters: Set<string>) => boolean;

  // Sidebar Config
  sidebarTitle?: string; // e.g., "TAG_MATRIX" or "PROCESS_GROUPS"
  filterPrefix?: string; // e.g. "" (for tags [tag]) or "@" (for roles @role)
  renderFilterOption?: (option: FilterOption, isActive: boolean) => ReactNode;

  // Actions
  onNew?: () => void;
  onNewClick?: () => void; // Alias for onNew
  newButtonLabel: string; // e.g. "touch new_entry" or "spawn new_agent"
  headerAction?: ReactNode; // Additional header action (e.g., GitHub config button)

  // Empty States
  loadingMessage?: string;
  emptyMessage?: string;
  emptyActionLabel?: string;

  // Renderers
  renderItem: (item: T) => ReactNode;
  children?: ReactNode; // fallback

  // Testing
  newButtonTestId?: string;
}

export function TerminalLibraryLayout<T>({
  items,
  loading,
  searchPlaceholder = "filter_query...",
  getFilterOptions,
  filterFn,
  sidebarTitle = "TAGS",
  onNew,
  onNewClick,
  newButtonLabel,
  headerAction,
  loadingMessage = "Loading...",
  emptyMessage = "No entries found.",
  emptyActionLabel,
  renderItem,
  newButtonTestId,
}: TerminalLibraryLayoutProps<T>) {
  // Support onNewClick as alias for onNew
  const handleNew = onNewClick || onNew;
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());

  // Collapsible sidebar
  const {
    isCollapsed,
    isPinned,
    togglePin,
    containerProps,
  } = useCollapsiblePane({
    storageKey: STORAGE_KEYS.TAG_MATRIX_PINNED,
    defaultCollapsed: true,
    hoverEnabled: true, // 141: Left pane expands on hover
  });

  // Toggle a filter on/off (multi-select)
  const toggleFilter = useCallback((value: string) => {
    setActiveFilters(prev => {
      const next = new Set(prev);
      if (next.has(value)) {
        next.delete(value);
      } else {
        next.add(value);
      }
      return next;
    });
  }, []);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setActiveFilters(new Set());
  }, []);

  // Derived state
  const filterOptions = useMemo(() => getFilterOptions(items), [items, getFilterOptions]);

  const filteredItems = useMemo(() => {
    return items.filter(item => filterFn(item, searchQuery, activeFilters));
  }, [items, searchQuery, activeFilters, filterFn]);

  return (
    <div className="flex flex-1 h-full overflow-hidden bg-background font-mono text-sm">
      {/* Sidebar: Tag Matrix */}
      <aside
        className={cn(
          "flex-shrink-0 border-r border-border bg-muted/10 flex flex-col transition-all duration-200 relative",
          isCollapsed ? "w-10" : "w-56"
        )}
        {...containerProps}
      >
        {/* Sidebar Header */}
        <div className={cn(
          "border-b border-border text-2xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 transition-all",
          isCollapsed ? "justify-center py-4 px-0" : "justify-between p-3"
        )}>
          {isCollapsed && (
            <button
              onClick={togglePin}
              className="hover:bg-muted/30 transition-colors text-muted-foreground"
              title="Click to expand/pin sidebar"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
          <AnimatePresence>
            {!isCollapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                className="flex-1 overflow-hidden whitespace-nowrap"
              >
                {sidebarTitle}
              </motion.span>
            )}
          </AnimatePresence>
          {!isCollapsed && (
            <button
              onClick={togglePin}
              className={cn(
                "p-1 text-2xs font-bold transition-colors hover:text-foreground",
                isPinned ? "text-primary" : "text-muted-foreground/50"
              )}
              title={isPinned ? "Unpin sidebar" : "Pin sidebar open"}
            >
              PIN
            </button>
          )}
        </div>

        {/* Sidebar Content - Tag Cloud */}
        <AnimatePresence>
          {!isCollapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex-1 overflow-y-auto p-3 space-y-4"
            >
              {/* Tag Cloud with Bracketed Styling */}
              <div className="flex flex-wrap gap-x-3 gap-y-2">
                {filterOptions.length === 0 ? (
                  <span className="text-muted-foreground/50 text-2xs italic">-- no tags --</span>
                ) : (
                  filterOptions.map((option) => (
                    <TerminalTag
                      key={option.value}
                      active={activeFilters.has(option.value)}
                      count={option.count}
                      onClick={() => toggleFilter(option.value)}
                    >
                      {option.label}
                    </TerminalTag>
                  ))
                )}
              </div>

              {/* Active Filters Summary */}
              {activeFilters.size > 0 && (
                <div className="pt-3 border-t border-border/40 space-y-2">
                  <div className="text-2xs text-muted-foreground uppercase tracking-wide">
                    Active ({activeFilters.size})
                  </div>
                  <button
                    onClick={clearFilters}
                    className="terminal-tag text-destructive hover:text-destructive"
                  >
                    x clear_all
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Terminal Header with Command Prompt */}
        <header className="flex-shrink-0 flex items-center justify-between px-4 py-0 border-b border-border bg-background h-[50px]">
          {/* Command Prompt Input */}
          <TerminalSearchBar
            autoFocus
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder={searchPlaceholder}
          />

          {/* Actions */}
          <div className="flex items-center gap-3 ml-4">
            {/* Item Count */}
            <span className="text-2xs text-muted-foreground font-mono">
              [{filteredItems.length}/{items.length}]
            </span>

            {/* Optional Header Action */}
            {headerAction}

            {/* New Button */}
            {handleNew && (
              <Button
                onClick={handleNew}
                size="sm"
                variant="outline"
                className="border-primary/50 hover:bg-primary/10 hover:text-primary text-xs h-7 font-mono"
                data-testid={newButtonTestId}
              >
                <span className="mr-1">+</span> {newButtonLabel}
              </Button>
            )}
          </div>
        </header>

        {/* Content Stream */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="terminal-empty">
              <div className="terminal-empty-prompt">
                <span>{loadingMessage}</span>
              </div>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="terminal-empty">
              <div className="terminal-empty-prompt">
                <span className="opacity-50">{emptyMessage}</span>
              </div>
              {emptyActionLabel && onNew && (
                <Button
                  variant="link"
                  onClick={onNew}
                  className="font-mono text-xs mt-2"
                >
                  $ {emptyActionLabel}
                </Button>
              )}
            </div>
          ) : (
            <div>
              {filteredItems.map(renderItem)}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
