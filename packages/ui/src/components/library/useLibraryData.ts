import { useState, useCallback, useEffect, useMemo } from 'react';
import { api } from '../../lib/api';
import { createLogger } from '../../lib/logger';
import { useSocket } from '../../context/SocketContext';
import { SOCKET_EVENTS } from '@capybara-chat/types';

const log = createLogger('useLibraryData');

interface UseLibraryDataReturn<T> {
  items: T[];
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
}

/**
 * Map API paths to entity event types for real-time updates
 */
function getEntityEventsForPath(apiPath: string): string[] {
  // Extract entity type from path (e.g., /api/specs -> spec)
  const match = apiPath.match(/\/api\/(\w+)/);
  if (!match) return [];

  const entityType = match[1];

  switch (entityType) {
    case 'specs':
      return [SOCKET_EVENTS.SPEC_CREATED, SOCKET_EVENTS.SPEC_UPDATED, SOCKET_EVENTS.SPEC_DELETED];
    case 'documents':
      return [SOCKET_EVENTS.DOCUMENT_CREATED, SOCKET_EVENTS.DOCUMENT_UPDATED, SOCKET_EVENTS.DOCUMENT_DELETED];
    case 'prompts':
      return [SOCKET_EVENTS.PROMPT_CREATED, SOCKET_EVENTS.PROMPT_UPDATED, SOCKET_EVENTS.PROMPT_DELETED];
    case 'agent-definitions':
      return [SOCKET_EVENTS.AGENT_DEFINITION_CREATED, SOCKET_EVENTS.AGENT_DEFINITION_UPDATED, SOCKET_EVENTS.AGENT_DEFINITION_DELETED];
    default:
      return [];
  }
}

export function useLibraryData<T extends { id: string }>(
  serverUrl: string,
  apiPath: string,
  dataKey: string
): UseLibraryDataReturn<T> {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const { socket } = useSocket();

  // Get entity-specific events for this path
  const entityEvents = useMemo(() => getEntityEventsForPath(apiPath), [apiPath]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get(`${serverUrl}${apiPath}`);
      const data = await res.json();
      setItems(data[dataKey] || []);
      setError(null);
    } catch (err) {
      log.error(`Failed to fetch ${apiPath}`, { error: err });
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [serverUrl, apiPath, dataKey]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Listen for real-time updates - both entity-specific events AND SYNC_FULL
  useEffect(() => {
    if (!socket) return;

    const handleUpdate = () => {
      log.debug('Refreshing data due to socket event', { apiPath });
      fetchData();
    };

    // Listen for SYNC_FULL (catch-all for initial sync)
    socket.on(SOCKET_EVENTS.SYNC_FULL, handleUpdate);

    // Listen for entity-specific events (triggered by huddle-mcp CRUD operations)
    entityEvents.forEach(event => {
      socket.on(event, handleUpdate);
    });

    return () => {
      socket.off(SOCKET_EVENTS.SYNC_FULL, handleUpdate);
      entityEvents.forEach(event => {
        socket.off(event, handleUpdate);
      });
    };
  }, [socket, fetchData, entityEvents]);

  const deleteItem = useCallback(async (id: string) => {
    try {
      await api.delete(`${serverUrl}${apiPath}/${id}`);
      // Optimistic update
      setItems(prev => prev.filter(item => item.id !== id));
      // Then strict refresh
      fetchData();
    } catch (err) {
      log.error('Failed to delete item', { error: err });
      alert('Failed to delete item');
    }
  }, [serverUrl, apiPath, fetchData]);

  return { items, loading, error, refresh: fetchData, deleteItem };
}
