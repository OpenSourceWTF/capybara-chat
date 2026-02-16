/**
 * GenericLibrary - Base component for entity library views
 *
 * Encapsulates ALL common library functionality:
 * - Data fetching with useFetchList
 * - Delete mutations with confirmation UI
 * - Socket event subscriptions for real-time updates
 * - Terminal-styled layout via TerminalLibraryLayout
 * - Tag filtering
 *
 * Entity-specific libraries only need to provide:
 * - Configuration (apiPath, entityType, socketEvents)
 * - Custom renderItem function
 *
 * This reduces ~180 lines per library to ~50 lines of configuration.
 */

import { useCallback, useMemo, ReactNode } from 'react';
import type { FormEntityType } from '@capybara-chat/types';
import { SERVER_DEFAULTS } from '@capybara-chat/types';
import { TerminalLibraryLayout } from './TerminalLibraryLayout';
import { openNewEntity } from '../../lib/entity-events';
import { createTagFilterOptions, createLibraryFilter } from '../../lib/library-utils';
import { useLibraryData } from '../../hooks/useLibraryData';
import { DeleteActionButton } from '../ui/DeleteActionButton';

/**
 * Base entity type - all entities must have id
 * 032-multitenancy: isOwner + createdBy are computed by server (withIsOwnerList)
 */
import { Author } from '@capybara-chat/types';

export interface BaseEntity {
  id: string;
  tags?: string[];
  isOwner?: boolean;
  createdBy?: string | null;
  author?: Author;
}

/**
 * Configuration for a library component
 */
export interface LibraryConfig<T extends BaseEntity> {
  /** API path for this entity type (e.g., '/api/prompts') */
  apiPath: string;
  /** Key in response JSON containing the array (e.g., 'segments') */
  dataKey: string;
  /** Entity type for event bus (e.g., 'prompt') */
  entityType: FormEntityType;
  /** Socket events that trigger refetch */
  socketEvents: string[];
  /** Fields to search when filtering */
  searchFields: (keyof T)[];
  /** Command prefix shown in terminal header (e.g., 'cat prompts/') */
  commandPrefix: string;
  /** Placeholder text for search input */
  searchPlaceholder?: string;
  /** Label for new button (e.g., 'new prompt') */
  newButtonLabel: string;
  /** Test ID for new button */
  newButtonTestId?: string;
  /** Message shown while loading */
  loadingMessage: string;
  /** Message shown when no items */
  emptyMessage: string;
  /** Label for empty state action (e.g., 'touch new_prompt') */
  emptyActionLabel: string;
  /** Delete button label for accessibility */
  deleteLabel?: string;
}

/**
 * Render function for library items
 */
export interface LibraryRenderItemProps<T extends BaseEntity> {
  item: T;
  /** 032-multitenancy: Whether the current user owns this item (false = someone else's) */
  isOwner: boolean;
  onSelect: () => void;
  deleteAction: ReactNode;
}

export interface GenericLibraryProps<T extends BaseEntity> {
  /** Library configuration */
  config: LibraryConfig<T>;
  /** Server URL (defaults to SERVER_DEFAULTS.SERVER_URL) */
  serverUrl?: string;
  /** Called when an item is selected */
  onSelect?: (item: T) => void;
  /** Called when new button is clicked (overrides default) */
  onNew?: () => void;
  /** Render function for each item */
  renderItem: (props: LibraryRenderItemProps<T>) => ReactNode;
  /** Custom header action (rendered in header bar) */
  headerAction?: ReactNode;
  /** Custom filter function (applied before search/tag filters) */
  customFilter?: (item: T) => boolean;
}

/**
 * Generic library component that handles all common library functionality
 */
export function GenericLibrary<T extends BaseEntity>({
  config,
  serverUrl = SERVER_DEFAULTS.SERVER_URL,
  onSelect,
  onNew,
  renderItem,
  headerAction,
  customFilter,
}: GenericLibraryProps<T>) {
  const {
    items: rawItems,
    loading,
    deleteTarget,
    setDeleteTarget,
    deleting,
    confirmDelete,
    cancelDelete,
  } = useLibraryData<T>({
    url: `${serverUrl}${config.apiPath}`,
    dataKey: config.dataKey,
    socketEvents: config.socketEvents,
  });

  // Apply custom filter if provided (before search/tag filters)
  const items = useMemo(
    () => customFilter ? rawItems.filter(customFilter) : rawItems,
    [rawItems, customFilter]
  );

  // Handle new entity creation
  const handleNew = useCallback(() => {
    if (onNew) {
      onNew();
    } else {
      openNewEntity(config.entityType);
    }
  }, [onNew, config.entityType]);

  // Memoized filter function
  const filterFn = useMemo(
    () => createLibraryFilter<T>(config.searchFields as (keyof T)[]),
    [config.searchFields]
  );

  return (
    <TerminalLibraryLayout<T>
      items={items}
      loading={loading}
      commandPrefix={config.commandPrefix}
      searchPlaceholder={config.searchPlaceholder ?? 'filter...'}
      getFilterOptions={createTagFilterOptions}
      filterFn={filterFn}
      sidebarTitle="TAGS"
      onNew={handleNew}
      newButtonLabel={config.newButtonLabel}
      newButtonTestId={config.newButtonTestId}
      loadingMessage={config.loadingMessage}
      emptyMessage={config.emptyMessage}
      emptyActionLabel={config.emptyActionLabel}
      headerAction={headerAction}
      renderItem={(item) =>
        renderItem({
          item,
          isOwner: item.isOwner !== false,
          onSelect: () => onSelect?.(item),
          // 032-multitenancy: hide delete for items the user doesn't own
          deleteAction: item.isOwner === false ? null : (
            <DeleteActionButton
              item={item}
              deleteTarget={deleteTarget}
              onDeleteClick={setDeleteTarget}
              onConfirm={confirmDelete}
              onCancel={cancelDelete}
              isDeleting={deleting}
              deleteLabel={config.deleteLabel ?? `Delete ${config.entityType}`}
            />
          ),
        })
      }
    />
  );
}
