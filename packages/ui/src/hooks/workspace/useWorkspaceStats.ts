/**
 * useWorkspaceStats - Hook for fetching workspace branch stats
 */

import { useState, useEffect, useCallback } from 'react';
import { api } from '../../lib/api';
import { createLogger } from '../../lib/logger';
import { getErrorMessage } from '../../lib/errors';
import { useServer } from '../../context/ServerContext';
import type { BranchStats } from '@capybara-chat/types';

const log = createLogger('useWorkspaceStats');

export interface UseWorkspaceStatsOptions {
  /** Auto-refresh interval in ms (default: 60000, set to 0 to disable) */
  refreshInterval?: number;
  /** Skip fetching (useful for conditional fetching) */
  skip?: boolean;
}

export interface WorkspaceStatsState {
  stats: BranchStats | null;
  loading: boolean;
  error: string | null;
}

/**
 * Hook for fetching workspace branch stats (ahead/behind/conflicts)
 *
 * @example
 * const { stats, loading, error, refetch } = useWorkspaceStats('wks_123');
 */
export function useWorkspaceStats(
  workspaceId: string | undefined,
  options: UseWorkspaceStatsOptions = {}
): WorkspaceStatsState & { refetch: () => Promise<void> } {
  const { refreshInterval = 60000, skip = false } = options;
  const { serverUrl } = useServer();
  const [state, setState] = useState<WorkspaceStatsState>({
    stats: null,
    loading: !skip && !!workspaceId,
    error: null,
  });

  const fetchStats = useCallback(async () => {
    if (skip || !workspaceId) return;

    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const res = await api.get(`${serverUrl}/api/workspaces/${workspaceId}/branch-stats`);
      if (res.ok) {
        const stats = (await res.json()) as BranchStats;
        setState({ stats, loading: false, error: null });
      } else {
        const text = await res.text().catch(() => res.statusText);
        setState({ stats: null, loading: false, error: text || 'Failed to fetch stats' });
      }
    } catch (err) {
      log.error('Failed to fetch branch stats', { error: err, workspaceId });
      setState({ stats: null, loading: false, error: getErrorMessage(err, 'Failed to fetch stats') });
    }
  }, [workspaceId, skip, serverUrl]);

  // Initial fetch
  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Auto-refresh interval
  useEffect(() => {
    if (skip || !workspaceId || refreshInterval <= 0) return;

    const intervalId = setInterval(fetchStats, refreshInterval);
    return () => clearInterval(intervalId);
  }, [fetchStats, refreshInterval, skip, workspaceId]);

  return { ...state, refetch: fetchStats };
}
