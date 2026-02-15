/**
 * useLogsQuery - Hook for fetching logs with filtering and infinite scroll
 *
 * Uses cursor-based pagination for efficient infinite scroll.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { api } from '../lib/api';
import { createLogger } from '../lib/logger';
import { getErrorMessage } from '../lib/errors';
import type { PersistedLogEntry, LogLevel } from '@capybara-chat/types';

const log = createLogger('useLogsQuery');

export interface LogFilters {
  level?: LogLevel;
  source?: string;
  search?: string;
}

export interface LogsQueryResult {
  logs: PersistedLogEntry[];
  nextCursor: string | null;
  total: number;
}

export interface UseLogsQueryState {
  logs: PersistedLogEntry[];
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  total: number;
}

export interface UseLogsQueryReturn extends UseLogsQueryState {
  /** Load more logs (for infinite scroll) */
  loadMore: () => Promise<void>;
  /** Refresh logs (start from beginning) */
  refresh: () => Promise<void>;
  /** Clear all logs */
  clearLogs: () => Promise<void>;
  /** Update filters */
  setFilters: (filters: LogFilters) => void;
  /** Current filters */
  filters: LogFilters;
}

const PAGE_SIZE = 50;

export function useLogsQuery(): UseLogsQueryReturn {
  const [state, setState] = useState<UseLogsQueryState>({
    logs: [],
    loading: true,
    loadingMore: false,
    error: null,
    hasMore: false,
    total: 0,
  });

  const [filters, setFilters] = useState<LogFilters>({});
  const cursorRef = useRef<string | null>(null);

  // Build URL with query params
  const buildUrl = useCallback((cursor?: string | null) => {
    const params = new URLSearchParams();
    params.set('limit', String(PAGE_SIZE));

    if (cursor) params.set('cursor', cursor);
    if (filters.level) params.set('level', filters.level);
    if (filters.source) params.set('source', filters.source);
    if (filters.search) params.set('search', filters.search);

    return `/api/logs?${params.toString()}`;
  }, [filters]);

  // Fetch logs
  const fetchLogs = useCallback(async (append = false) => {
    const cursor = append ? cursorRef.current : null;

    if (append) {
      setState((prev) => ({ ...prev, loadingMore: true, error: null }));
    } else {
      setState((prev) => ({ ...prev, loading: true, error: null, logs: [] }));
      cursorRef.current = null;
    }

    try {
      const url = buildUrl(cursor);
      const res = await api.get(url);

      if (res.ok) {
        const result = (await res.json()) as LogsQueryResult;
        cursorRef.current = result.nextCursor;

        setState((prev) => ({
          logs: append ? [...prev.logs, ...result.logs] : result.logs,
          loading: false,
          loadingMore: false,
          error: null,
          hasMore: result.nextCursor !== null,
          total: result.total,
        }));
      } else {
        const text = await res.text().catch(() => res.statusText);
        setState((prev) => ({
          ...prev,
          loading: false,
          loadingMore: false,
          error: text || 'Failed to fetch logs',
        }));
      }
    } catch (err) {
      log.error('Failed to fetch logs', { error: err });
      setState((prev) => ({
        ...prev,
        loading: false,
        loadingMore: false,
        error: getErrorMessage(err, 'Failed to fetch logs'),
      }));
    }
  }, [buildUrl]);

  // Load more for infinite scroll
  const loadMore = useCallback(async () => {
    if (state.loadingMore || !state.hasMore) return;
    await fetchLogs(true);
  }, [fetchLogs, state.loadingMore, state.hasMore]);

  // Refresh from beginning
  const refresh = useCallback(async () => {
    cursorRef.current = null;
    await fetchLogs(false);
  }, [fetchLogs]);

  // Clear all logs
  const clearLogs = useCallback(async () => {
    try {
      await api.delete('/api/logs');
      setState((prev) => ({
        ...prev,
        logs: [],
        total: 0,
        hasMore: false,
        cursor: null,
      }));
      cursorRef.current = null;
    } catch (err) {
      log.error('Failed to clear logs', { error: err });
    }
  }, []);

  // Initial fetch and refetch on filter changes
  useEffect(() => {
    cursorRef.current = null;
    fetchLogs(false);
  }, [filters.level, filters.source, filters.search, fetchLogs]);

  return {
    ...state,
    loadMore,
    refresh,
    clearLogs,
    setFilters,
    filters,
  };
}
