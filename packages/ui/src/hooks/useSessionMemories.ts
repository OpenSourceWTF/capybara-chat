/**
 * useSessionMemories - Hook for fetching agent memories for a session
 *
 * Memories are session-bound documents that persist agent context,
 * observations, decisions, and discoveries during execution.
 */

import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { handleApiError, extractResponseError } from '../lib/api-error-handler';
import type { Document } from '@capybara-chat/types';
import { useSocket } from '../context/SocketContext';
import { SOCKET_EVENTS } from '@capybara-chat/types';

export interface SessionMemoriesState {
  memories: Document[];
  loading: boolean;
  error: string | null;
  total: number;
}

export interface UseSessionMemoriesOptions {
  /** Optional search term to filter memories */
  search?: string;
  /** Skip initial fetch */
  skip?: boolean;
}

/**
 * Hook for fetching and subscribing to session memories
 *
 * @example
 * const { memories, loading, error, refetch } = useSessionMemories(sessionId);
 */
export function useSessionMemories(
  sessionId: string | undefined,
  options: UseSessionMemoriesOptions = {}
): SessionMemoriesState & { refetch: () => Promise<void> } {
  const { search, skip = false } = options;
  const { on, off } = useSocket();

  const [state, setState] = useState<SessionMemoriesState>({
    memories: [],
    loading: !skip && !!sessionId,
    error: null,
    total: 0,
  });

  const fetchMemories = useCallback(async () => {
    if (skip || !sessionId) return;

    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const searchParam = search ? `?search=${encodeURIComponent(search)}` : '';
      const res = await api.get(`/api/sessions/${sessionId}/memories${searchParam}`);

      if (res.ok) {
        const data = await res.json() as { memories: Document[]; total: number };
        setState({
          memories: data.memories,
          loading: false,
          error: null,
          total: data.total,
        });
      } else {
        const error = await extractResponseError(res, 'Failed to fetch memories');
        setState({ memories: [], loading: false, error, total: 0 });
      }
    } catch (err) {
      const error = handleApiError('Failed to fetch memories', err, { url: `/api/sessions/${sessionId}/memories` });
      setState({ memories: [], loading: false, error, total: 0 });
    }
  }, [sessionId, search, skip]);

  // Initial fetch
  useEffect(() => {
    fetchMemories();
  }, [fetchMemories]);

  // Subscribe to real-time memory events
  useEffect(() => {
    if (!sessionId) return;

    const handleMemoryCreated = (payload: { document: Document }) => {
      // Only add if it's for our session
      if (payload.document.sessionId === sessionId) {
        setState((prev) => ({
          ...prev,
          memories: [payload.document, ...prev.memories],
          total: prev.total + 1,
        }));
      }
    };

    const handleMemoryDeleted = (payload: { documentId: string }) => {
      setState((prev) => ({
        ...prev,
        memories: prev.memories.filter((m) => m.id !== payload.documentId),
        total: Math.max(0, prev.total - 1),
      }));
    };

    on(SOCKET_EVENTS.MEMORY_CREATED, handleMemoryCreated);
    on(SOCKET_EVENTS.MEMORY_DELETED, handleMemoryDeleted);

    return () => {
      off(SOCKET_EVENTS.MEMORY_CREATED, handleMemoryCreated);
      off(SOCKET_EVENTS.MEMORY_DELETED, handleMemoryDeleted);
    };
  }, [sessionId, on, off]);

  return { ...state, refetch: fetchMemories };
}
