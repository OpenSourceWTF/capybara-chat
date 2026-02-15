/**
 * useWorkspaceGitHubStats - Hook for fetching open issues and PRs count
 */

import { useState, useEffect, useCallback } from 'react';
import { api } from '../../lib/api';
import { createLogger } from '../../lib/logger';
import { getErrorMessage } from '../../lib/errors';
import { useServer } from '../../context/ServerContext';

const log = createLogger('useWorkspaceGitHubStats');

export interface UseWorkspaceGitHubStatsOptions {
  skip?: boolean;
  /** Auto-refresh interval in ms (default: 60000 = 1 min, 0 to disable) */
  refreshInterval?: number;
}

export interface GitHubStats {
  issuesCount: number;
  prsCount: number;
}

/**
 * Hook for fetching open issues and PRs count for a workspace
 *
 * @example
 * const { stats, loading } = useWorkspaceGitHubStats('wks_123');
 */
export function useWorkspaceGitHubStats(
  workspaceId: string | undefined,
  options: UseWorkspaceGitHubStatsOptions = {}
): { stats: GitHubStats; loading: boolean; error: string | null; refetch: () => Promise<void> } {
  const { skip = false, refreshInterval = 60000 } = options;
  const { serverUrl } = useServer();
  const [stats, setStats] = useState<GitHubStats>({ issuesCount: 0, prsCount: 0 });
  const [loading, setLoading] = useState(!skip && !!workspaceId);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    if (skip || !workspaceId) return;

    setLoading(true);
    setError(null);

    try {
      const res = await api.get(`${serverUrl}/api/workspaces/${workspaceId}/github-stats`);
      if (res.ok) {
        const data = (await res.json()) as { openIssuesCount: number; openPRsCount: number };
        setStats({
          issuesCount: data.openIssuesCount || 0,
          prsCount: data.openPRsCount || 0,
        });
      } else {
        const text = await res.text().catch(() => res.statusText);
        setError(text || 'Failed to fetch GitHub stats');
      }
    } catch (err) {
      log.error('Failed to fetch GitHub stats', { error: err, workspaceId });
      setError(getErrorMessage(err, 'Failed to fetch GitHub stats'));
    } finally {
      setLoading(false);
    }
  }, [workspaceId, skip, serverUrl]);

  // Initial fetch
  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Heartbeat auto-refresh
  useEffect(() => {
    if (skip || !workspaceId || refreshInterval <= 0) return;

    const intervalId = setInterval(fetchStats, refreshInterval);
    return () => clearInterval(intervalId);
  }, [fetchStats, refreshInterval, skip, workspaceId]);

  return { stats, loading, error, refetch: fetchStats };
}
