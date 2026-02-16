/**
 * EntityAutocomplete - Dropdown for selecting entities by name or ID
 *
 * Shows matching entities when user is typing an entity reference
 * in a slash command (e.g., "/edit prompt my-prompt").
 */

import { useEffect, useRef } from 'react';
import type { FormEntityType } from '@capybara-chat/types';
import type { EntitySearchResult } from '../../hooks/useEntitySearch';
import type { EntitySelectionState } from '../../lib/slash-command-parser';
import { FileText, File, Bot } from 'lucide-react';

/**
 * Props for EntityAutocomplete
 */
interface EntityAutocompleteProps {
  /** Current entity selection state */
  selectionState: EntitySelectionState;
  /** Search results to display */
  results: EntitySearchResult[];
  /** Whether search is loading */
  loading: boolean;
  /** Whether search is in progress (debouncing) */
  isSearching: boolean;
  /** Currently selected index */
  selectedIndex: number;
  /** Called when an entity is selected */
  onSelect: (result: EntitySearchResult) => void;
}

/**
 * Icon for each entity type
 */
const ENTITY_ICONS: Record<FormEntityType, typeof FileText> = {
  prompt: FileText,
  document: File,
  agentDefinition: Bot,
};

/**
 * EntityAutocomplete component
 */
export function EntityAutocomplete({
  selectionState,
  results,
  loading,
  isSearching,
  selectedIndex,
  onSelect,
}: EntityAutocompleteProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);

  // Clamp selectedIndex to valid range
  const clampedIndex = Math.max(0, Math.min(selectedIndex, results.length - 1));

  // Scroll selected item into view
  useEffect(() => {
    if (selectedRef.current && listRef.current) {
      selectedRef.current.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      });
    }
  }, [clampedIndex]);

  // Show loading state
  if (loading || isSearching) {
    return (
      <div
        className="absolute bottom-full left-2 right-2 mb-1 bg-popover border border-border shadow-lg overflow-hidden z-50"
        data-testid="entity-autocomplete"
      >
        <div className="px-3 py-2 text-sm text-muted-foreground">
          Searching {selectionState.entityType}s...
        </div>
      </div>
    );
  }

  // Show empty state when no results
  if (results.length === 0) {
    // If no search query and no results, the entity list is empty
    if (!selectionState.searchQuery.trim()) {
      return (
        <div
          className="absolute bottom-full left-2 right-2 mb-1 bg-popover border border-border shadow-lg overflow-hidden z-50"
          data-testid="entity-autocomplete"
        >
          <div className="px-3 py-2 text-sm text-muted-foreground">
            No {selectionState.entityType}s available. Create one first.
          </div>
        </div>
      );
    }

    return (
      <div
        className="absolute bottom-full left-2 right-2 mb-1 bg-popover border border-border shadow-lg overflow-hidden z-50"
        data-testid="entity-autocomplete"
      >
        <div className="px-3 py-2 text-sm text-muted-foreground">
          No {selectionState.entityType}s found matching &quot;{selectionState.searchQuery}&quot;
        </div>
      </div>
    );
  }

  const Icon = selectionState.entityType ? ENTITY_ICONS[selectionState.entityType] : FileText;

  return (
    <div
      className="absolute bottom-full left-2 right-2 mb-1 bg-popover border border-border shadow-lg overflow-hidden z-50"
      data-testid="entity-autocomplete"
    >
      <div ref={listRef} className="max-h-48 overflow-y-auto">
        {results.map((result, index) => (
          <button
            key={result.id}
            ref={index === clampedIndex ? selectedRef : undefined}
            onClick={() => onSelect(result)}
            className={`w-full text-left px-3 py-2 hover:bg-muted transition-colors ${
              index === clampedIndex ? 'bg-muted' : ''
            }`}
            data-testid={`entity-suggestion-${index}`}
          >
            <div className="flex items-center gap-2">
              <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">
                  {result.displayName}
                </div>
                <div className="text-xs text-muted-foreground font-mono truncate">
                  {result.id}
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
      <div className="px-3 py-1.5 border-t border-border bg-muted/50 text-2xs text-muted-foreground">
        ↑↓ to navigate • Enter to select • Esc to close
      </div>
    </div>
  );
}
