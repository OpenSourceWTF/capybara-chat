/**
 * useDeleteWorkspace - Hook for safely deleting a workspace
 */

import { useState, useCallback } from 'react';
import { api } from '../../lib/api';
import { createLogger } from '../../lib/logger';
import { getErrorMessage } from '../../lib/errors';

const log = createLogger('useDeleteWorkspace');

export interface DeleteWorkspaceOptions {
  force?: boolean;
  pushUnpushedBranches?: boolean;
  createPRs?: boolean;
}

export interface DeleteWorkspaceResult {
  deleted: boolean;
  workspaceId: string;
  pushedBranches: string[];
  failedPushes: string[];
  cleanedWorktrees: string[];
  blockedBySessions?: string[];
  error?: string;
}

/**
 * Hook for safely deleting a workspace
 *
 * @example
 * const { deleteWorkspace, loading, error, result } = useDeleteWorkspace();
 * await deleteWorkspace('wks_123', { pushUnpushedBranches: true });
 */
export function useDeleteWorkspace() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DeleteWorkspaceResult | null>(null);

  const deleteWorkspace = useCallback(
    async (workspaceId: string, options: DeleteWorkspaceOptions = {}): Promise<DeleteWorkspaceResult | null> => {
      setLoading(true);
      setError(null);
      setResult(null);

      // Build query params from options
      const params = new URLSearchParams();
      if (options.force) params.set('force', 'true');
      const queryString = params.toString();
      const url = `/api/workspaces/${workspaceId}${queryString ? '?' + queryString : ''}`;

      try {
        const res = await api.delete(url);
        const data = (await res.json()) as DeleteWorkspaceResult;

        if (res.ok) {
          setResult(data);
          return data;
        } else {
          // Handle blocked by sessions (409)
          if (res.status === 409 && data.blockedBySessions) {
            setResult(data);
            setError(data.error || 'Workspace has active sessions');
            return data;
          }
          setError(data.error || 'Delete failed');
          return null;
        }
      } catch (err) {
        log.error('Failed to delete workspace', { error: err, workspaceId });
        setError(getErrorMessage(err, 'Delete failed'));
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { deleteWorkspace, loading, error, result };
}
