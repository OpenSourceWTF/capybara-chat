/**
 * useLibraryData - Shared hook for library component data management
 *
 * Combines:
 * - Data fetching (useFetchList)
 * - Delete mutation (useDelete)
 * - Socket event subscription for real-time updates
 * - Delete target state management
 *
 * This eliminates ~80 lines of duplicated code across library components.
 */

import { useState, useEffect, useCallback } from 'react';
import { useFetchList, removeById } from './useFetchList';
import { useDelete } from './useApiMutation';
import { useSocket } from '../context/SocketContext';

interface BaseEntity {
  id: string;
}

interface UseLibraryDataOptions {
  /** Full URL to fetch items from */
  url: string;
  /** Key in response object containing the array (e.g., 'specs', 'documents') */
  dataKey: string;
  /** Socket events that should trigger a refetch */
  socketEvents: string[];
  /** Callback when delete succeeds */
  onDeleteSuccess?: (id: string) => void;
}

export interface UseLibraryDataResult<T extends BaseEntity> {
  /** List of items */
  items: T[];
  /** Whether initial load is in progress */
  loading: boolean;
  /** Refetch items from server */
  refetch: () => void;
  /** Currently targeted item for deletion (null if none) */
  deleteTarget: T | null;
  /** Set the delete target */
  setDeleteTarget: (item: T | null) => void;
  /** Whether delete is in progress */
  deleting: boolean;
  /** Delete error message if any */
  deleteError: string | null;
  /** Confirm and execute delete of current target */
  confirmDelete: () => Promise<void>;
  /** Cancel pending delete */
  cancelDelete: () => void;
}

/**
 * Hook for managing library data with fetch, delete, and real-time updates
 */
export function useLibraryData<T extends BaseEntity>({
  url,
  dataKey,
  socketEvents,
  onDeleteSuccess,
}: UseLibraryDataOptions): UseLibraryDataResult<T> {
  const [deleteTarget, setDeleteTarget] = useState<T | null>(null);

  // Fetch data
  const { items, loading, refetch, setItems } = useFetchList<T>({
    url,
    dataKey,
  });

  // Delete mutation
  const { deleteItem, loading: deleting, error: deleteError } = useDelete(url, {
    onSuccess: (id) => {
      removeById(setItems, id);
      setDeleteTarget(null);
      onDeleteSuccess?.(id);
    },
  });

  // Subscribe to socket events for real-time updates
  const { on, off, connected } = useSocket();
  useEffect(() => {
    const handleEntityChange = () => refetch();
    socketEvents.forEach(event => on(event, handleEntityChange));
    return () => socketEvents.forEach(event => off(event, handleEntityChange));
  }, [on, off, refetch, connected, socketEvents]);

  // Confirm delete
  const confirmDelete = useCallback(async () => {
    if (deleteTarget) {
      await deleteItem(deleteTarget.id);
    }
  }, [deleteTarget, deleteItem]);

  // Cancel delete
  const cancelDelete = useCallback(() => {
    setDeleteTarget(null);
  }, []);

  return {
    items,
    loading,
    refetch,
    deleteTarget,
    setDeleteTarget,
    deleting,
    deleteError,
    confirmDelete,
    cancelDelete,
  };
}
