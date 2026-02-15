/**
 * useWorkspacePRs - Hook for listing open PRs for a workspace
 */

import { useState, useEffect, useCallback } from 'react';
import { api } from '../../lib/api';
import { createLogger } from '../../lib/logger';
import { getErrorMessage } from '../../lib/errors';
import { useServer } from '../../context/ServerContext';

const log = createLogger('useWorkspacePRs');

export interface WorkspacePR {
  number: number;
  title: string;
  url: string;
  branch: string;
  state: string;
  createdAt: string;
  updatedAt: string;
  /** PR author (from GitHub API) */
  user?: {
    login: string;
  };
}

export interface UseWorkspacePRsOptions {
  /** Skip fetching */
  skip?: boolean;
}

/**
 * Hook for listing open PRs for a workspace
 *
 * @example
 * const { prs, loading, error, refetch } = useWorkspacePRs('wks_123');
 */
export function useWorkspacePRs(
  workspaceId: string | undefined,
  options: UseWorkspacePRsOptions = {}
): { prs: WorkspacePR[]; loading: boolean; error: string | null; refetch: () => Promise<void> } {
  const { skip = false } = options;
  const { serverUrl } = useServer();
  const [prs, setPRs] = useState<WorkspacePR[]>([]);
  const [loading, setLoading] = useState(!skip && !!workspaceId);
  const [error, setError] = useState<string | null>(null);

  const fetchPRs = useCallback(async () => {
    if (skip || !workspaceId) return;

    setLoading(true);
    setError(null);

    try {
      const res = await api.get(`${serverUrl}/api/workspaces/${workspaceId}/pull-requests`);
      if (res.ok) {
        const data = (await res.json()) as { pullRequests: WorkspacePR[] };
        setPRs(data.pullRequests || []);
      } else {
        const text = await res.text().catch(() => res.statusText);
        setError(text || 'Failed to fetch PRs');
      }
    } catch (err) {
      log.error('Failed to fetch PRs', { error: err, workspaceId });
      setError(getErrorMessage(err, 'Failed to fetch PRs'));
    } finally {
      setLoading(false);
    }
  }, [workspaceId, skip, serverUrl]);

  useEffect(() => {
    fetchPRs();
  }, [fetchPRs]);

  // Refetch on window focus
  useEffect(() => {
    const handleFocus = () => fetchPRs();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [fetchPRs]);

  return { prs, loading, error, refetch: fetchPRs };
}
