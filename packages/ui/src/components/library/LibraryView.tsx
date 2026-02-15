/**
 * LibraryView - Generic library component for browsing and managing entities
 * 
 * Consolidates common patterns from all entity libraries:
 * - Tag filtering with tag cloud
 * - Search input
 * - Grid/list display
 * - Delete confirmation
 * - Empty state handling
 * - Loading state
 */

import React, { useState, ReactNode, useEffect, useMemo } from 'react';
import { Plus, Search } from 'lucide-react';
import { SERVER_DEFAULTS, SOCKET_EVENTS } from '@capybara-chat/types';
import { Button, Input, LoadingSpinner, EmptyState, ConfirmDeleteDialog } from '../ui';
import { useFetchList, removeById } from '../../hooks/useFetchList';
import { useDelete } from '../../hooks/useApiMutation';
import { useSocket } from '../../context/SocketContext';
import { entityEvents } from '../../lib/entity-events';
import { cn } from '../../lib/utils';
import { createLogger } from '../../lib/logger';

const log = createLogger('LibraryView');

/**
 * Base entity interface - all entities must have at least an id
 */
interface BaseEntity {
  id: string;
  name?: string;
  title?: string;
  tags?: string[];
}

/**
 * Tag count from the tags API
 */
interface TagCount {
  tag: string;
  count: number;
}

/**
 * Map API paths to socket events for real-time updates
 */
function getSocketEventsForPath(apiPath: string): string[] {
  if (apiPath.includes('/specs')) {
    return [SOCKET_EVENTS.SPEC_CREATED, SOCKET_EVENTS.SPEC_UPDATED, SOCKET_EVENTS.SPEC_DELETED];
  }
  if (apiPath.includes('/documents')) {
    return [SOCKET_EVENTS.DOCUMENT_CREATED, SOCKET_EVENTS.DOCUMENT_UPDATED, SOCKET_EVENTS.DOCUMENT_DELETED];
  }
  if (apiPath.includes('/prompts')) {
    return [SOCKET_EVENTS.PROMPT_CREATED, SOCKET_EVENTS.PROMPT_UPDATED, SOCKET_EVENTS.PROMPT_DELETED];
  }
  if (apiPath.includes('/agent-definitions')) {
    return [SOCKET_EVENTS.AGENT_DEFINITION_CREATED, SOCKET_EVENTS.AGENT_DEFINITION_UPDATED, SOCKET_EVENTS.AGENT_DEFINITION_DELETED];
  }
  return [];
}

/**
 * Props for the LibraryView component
 */
export interface LibraryViewProps<T extends BaseEntity> {
  /** API base path (e.g., '/api/documents') */
  apiPath: string;
  /** Key in the API response containing the items array */
  dataKey: string;
  /** Display name for the entity (e.g., 'Document') */
  entityDisplayName: string;
  /** Plural display name (e.g., 'Documents') */
  entityPluralName: string;
  /** Optional server URL override */
  serverUrl?: string;
  /** Whether to show tags */
  showTags?: boolean;
  /** Render function for each item card */
  renderCard: (
    item: T,
    onDelete: (e: React.MouseEvent) => void,
    onClone?: (e: React.MouseEvent) => void
  ) => ReactNode;
  /** Called when an item is selected */
  onSelect?: (item: T) => void;
  /** Called when "New" button is clicked */
  onNew?: () => void;
  /** Called when clone is clicked - receives the item to clone */
  onClone?: (item: T) => void;
  /** Custom empty message */
  emptyMessage?: string;
  /** Test ID prefix */
  testIdPrefix?: string;
  /** Extra header content (between title and New button) */
  headerExtra?: ReactNode;
  /** Filter component (between tag cloud and search) */
  filterComponent?: ReactNode;
}

/**
 * Generic library view component
 */
export function LibraryView<T extends BaseEntity>({
  apiPath,
  dataKey,
  entityDisplayName,
  entityPluralName,
  serverUrl = SERVER_DEFAULTS.SERVER_URL,
  showTags = true,
  renderCard,
  onSelect: _onSelect,
  onNew,
  onClone,
  emptyMessage,
  testIdPrefix,
  headerExtra,
  filterComponent,
}: LibraryViewProps<T>) {
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<T | null>(null);

  // Fetch items
  const {
    items,
    loading,
    setItems,
    refetch,
  } = useFetchList<T>({
    url: `${serverUrl}${apiPath}`,
    dataKey,
    params: {
      tag: selectedTag || undefined,
      search: searchQuery.trim() || undefined,
    },
  });

  // Fetch tags (only if showTags is true)
  const { items: tags } = useFetchList<TagCount>({
    url: showTags ? `${serverUrl}${apiPath}/tags` : '',
    dataKey: 'tags',
    enabled: showTags,
  });

  // Delete mutation
  const { deleteItem, loading: deleting } = useDelete(`${serverUrl}${apiPath}`, {
    onSuccess: (id) => {
      removeById(setItems, id);
      setDeleteTarget(null);
    },
  });

  // Get socket events for this entity type
  const { on, off, connected } = useSocket();
  const socketEvents = useMemo(() => getSocketEventsForPath(apiPath), [apiPath]);

  // Subscribe to entity:saved events to refresh the list (local saves from UI)
  useEffect(() => {
    const unsubscribe = entityEvents.on('entity:saved', () => {
      // Refetch the list when any entity is saved
      refetch();
    });
    return unsubscribe;
  }, [refetch]);

  // Subscribe to socket events for real-time updates (e.g., agent creates via huddle-mcp)
  useEffect(() => {
    if (socketEvents.length === 0) return;

    const handleEntityChange = () => {
      log.debug('Refreshing list due to socket event', { apiPath });
      refetch();
    };

    // Register handlers for entity CRUD events
    socketEvents.forEach(event => {
      on(event, handleEntityChange);
    });

    return () => {
      socketEvents.forEach(event => {
        off(event, handleEntityChange);
      });
    };
  }, [socketEvents, on, off, refetch, apiPath, connected]);

  const handleDeleteClick = (item: T, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteTarget(item);
  };

  const handleCloneClick = (item: T, e: React.MouseEvent) => {
    e.stopPropagation();
    onClone?.(item);
  };

  const handleConfirmDelete = async () => {
    if (deleteTarget) {
      await deleteItem(deleteTarget.id);
    }
  };

  const getEntityName = (item: T | null): string | undefined => {
    if (!item) return undefined;
    return item.name || item.title;
  };

  if (loading) {
    return <LoadingSpinner message={`Loading ${entityPluralName.toLowerCase()}...`} />;
  }

  return (
    <div className="p-6 space-y-5" data-testid={testIdPrefix ? `${testIdPrefix}-library` : undefined}>
      {/* Delete Confirmation Dialog */}
      <ConfirmDeleteDialog
        open={!!deleteTarget}
        entityType={entityDisplayName.toLowerCase()}
        entityName={getEntityName(deleteTarget)}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
        isDeleting={deleting}
      />

      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold tracking-tight">{entityPluralName}</h2>
          {items.length > 0 && (
            <span className="text-xs font-mono text-muted-foreground/60 bg-muted/50 px-2 py-0.5">
              {items.length}
            </span>
          )}
          {headerExtra}
        </div>
        {onNew && (
          <Button
            onClick={onNew}
            size="sm"
            data-testid={testIdPrefix ? `new-${testIdPrefix}-button` : undefined}
            className="gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> New
          </Button>
        )}
      </div>

      {/* Search & Filters */}
      <div className="space-y-3">
        <div className="relative" role="search">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50" aria-hidden="true" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search ${entityPluralName.toLowerCase()}...`}
            className="pl-9 h-9 bg-muted/30 border-border/30 focus:bg-background focus:border-primary/40"
            data-testid={testIdPrefix ? `${testIdPrefix}-search` : undefined}
            aria-label={`Search ${entityPluralName.toLowerCase()}`}
          />
        </div>

        {/* Tag Cloud */}
        {showTags && tags.length > 0 && (
          <nav aria-label={`Filter ${entityPluralName.toLowerCase()} by tag`}>
            <div className="flex gap-1.5 flex-wrap" role="group">
              <button
                onClick={() => setSelectedTag(null)}
                aria-pressed={!selectedTag}
                className={cn(
                  'px-2.5 py-1 text-xs font-medium font-mono transition-colors',
                  !selectedTag
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                All
              </button>
              {tags.map(({ tag, count }) => (
                <button
                  key={tag}
                  onClick={() => setSelectedTag(tag)}
                  aria-pressed={selectedTag === tag}
                  aria-label={`${tag}, ${count} ${count === 1 ? 'item' : 'items'}`}
                  className={cn(
                    'px-2.5 py-1 text-xs font-medium font-mono transition-colors',
                    selectedTag === tag
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  {tag}
                  <span className="ml-1 opacity-60">{count}</span>
                </button>
              ))}
            </div>
          </nav>
        )}

        {/* Filter Component */}
        {filterComponent}
      </div>

      {/* Items Grid */}
      {items.length === 0 ? (
        <EmptyState
          message={emptyMessage || `No ${entityPluralName.toLowerCase()} found.`}
          action={
            onNew ? (
              <Button onClick={onNew} size="sm" className="gap-1.5">
                <Plus className="w-3.5 h-3.5" aria-hidden="true" /> New {entityDisplayName}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div
          className="grid grid-cols-1 md:grid-cols-2 gap-3"
          role="list"
          aria-label={`${entityPluralName} (${items.length} ${items.length === 1 ? 'item' : 'items'})`}
        >
          {items.map((item) =>
            renderCard(
              item,
              (e) => handleDeleteClick(item, e),
              onClone ? (e) => handleCloneClick(item, e) : undefined
            )
          )}
        </div>
      )}
    </div>
  );
}
