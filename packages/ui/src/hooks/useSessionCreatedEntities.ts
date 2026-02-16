/**
 * useSessionCreatedEntities - Hook for fetching all entities created by a session
 *
 * Returns documents, prompts, and agent definitions
 * that originated from a specific chat session.
 */

import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { handleApiError, extractResponseError } from '../lib/api-error-handler';
import { useSocket } from '../context/SocketContext';
import { SOCKET_EVENTS } from '@capybara-chat/types';

/**
 * Entity types that can be created during a session
 */
export type SessionEntityType = 'document' | 'prompt' | 'agent_definition';

/**
 * A created entity with normalized fields
 */
export interface SessionCreatedEntity {
  entityType: SessionEntityType;
  id: string;
  name: string;
  createdAt: number;
  status?: string;
  docType?: string; // For documents: 'document' vs 'memory'
}

/**
 * Entity counts by type
 */
export interface SessionEntityCounts {
  documents: number;
  prompts: number;
  agentDefinitions: number;
}

export interface SessionCreatedEntitiesState {
  entities: SessionCreatedEntity[];
  loading: boolean;
  error: string | null;
  total: number;
  counts: SessionEntityCounts;
}

export interface UseSessionCreatedEntitiesOptions {
  /** Skip initial fetch */
  skip?: boolean;
}

/**
 * Hook for fetching all entities created by a session
 *
 * @example
 * const { entities, loading, counts, refetch } = useSessionCreatedEntities(sessionId);
 */
export function useSessionCreatedEntities(
  sessionId: string | undefined,
  options: UseSessionCreatedEntitiesOptions = {}
): SessionCreatedEntitiesState & { refetch: () => Promise<void> } {
  const { skip = false } = options;
  const { on, off } = useSocket();

  const [state, setState] = useState<SessionCreatedEntitiesState>({
    entities: [],
    loading: !skip && !!sessionId,
    error: null,
    total: 0,
    counts: {
      documents: 0,
      prompts: 0,
      agentDefinitions: 0,
    },
  });

  const fetchEntities = useCallback(async () => {
    if (skip || !sessionId) return;

    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const res = await api.get(`/api/sessions/${sessionId}/created-entities`);

      if (res.ok) {
        const data = await res.json() as {
          entities: SessionCreatedEntity[];
          total: number;
          counts: SessionEntityCounts;
        };
        setState({
          entities: data.entities,
          loading: false,
          error: null,
          total: data.total,
          counts: data.counts,
        });
      } else {
        const error = await extractResponseError(res, 'Failed to fetch created entities');
        setState((prev) => ({
          ...prev,
          loading: false,
          error,
        }));
      }
    } catch (err) {
      const error = handleApiError('Failed to fetch created entities', err, {
        url: `/api/sessions/${sessionId}/created-entities`,
      });
      setState((prev) => ({
        ...prev,
        loading: false,
        error,
      }));
    }
  }, [sessionId, skip]);

  // Initial fetch
  useEffect(() => {
    fetchEntities();
  }, [fetchEntities]);

  // Subscribe to real-time entity creation events
  // When any entity with this session_id is created, refetch the list
  useEffect(() => {
    if (!sessionId) return;

    // Listen for entity creation events that might be from this session
    // We refetch on any creation event for simplicity (could be optimized later)
    const handleEntityCreated = () => {
      fetchEntities();
    };

    // Subscribe to relevant creation events
    on(SOCKET_EVENTS.DOCUMENT_CREATED, handleEntityCreated);
    on(SOCKET_EVENTS.PROMPT_CREATED, handleEntityCreated);
    on(SOCKET_EVENTS.AGENT_DEFINITION_CREATED, handleEntityCreated);

    return () => {
      off(SOCKET_EVENTS.DOCUMENT_CREATED, handleEntityCreated);
      off(SOCKET_EVENTS.PROMPT_CREATED, handleEntityCreated);
      off(SOCKET_EVENTS.AGENT_DEFINITION_CREATED, handleEntityCreated);
    };
  }, [sessionId, on, off, fetchEntities]);

  return { ...state, refetch: fetchEntities };
}
