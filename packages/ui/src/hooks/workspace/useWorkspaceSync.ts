/**
 * useWorkspaceSync - Hook for syncing a workspace with its remote
 */

import { useState, useCallback } from 'react';
import { api } from '../../lib/api';
import { createLogger } from '../../lib/logger';
import { getErrorMessage } from '../../lib/errors';
import { useServer } from '../../context/ServerContext';
import type { SyncResult as BaseSyncResult } from '@capybara-chat/types';

const log = createLogger('useWorkspaceSync');

export type SyncStrategy = 'merge' | 'rebase' | 'reset';

/**
 * Extended SyncResult for UI with additional workspace data.
 * Base type imported from @capybara-chat/types.
 *
 * Two-way sync fields (from route):
 * - pulled: boolean - Whether pull was performed
 * - pushed: boolean - Whether push was performed
 * - commitsPulled: number - Commits pulled from remote
 * - commitsPushed: number - Commits pushed to remote
 */
export interface SyncResult extends BaseSyncResult {
  workspace?: unknown;
}

/**
 * Hook for syncing a workspace with its remote
 *
 * @example
 * const { sync, loading, error, result } = useWorkspaceSync('wks_123');
 * await sync('merge');
 */
export function useWorkspaceSync(workspaceId: string | undefined) {
  const { serverUrl } = useServer();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SyncResult | null>(null);

  const sync = useCallback(
    async (strategy: SyncStrategy = 'merge'): Promise<SyncResult | null> => {
      if (!workspaceId) {
        setError('No workspace ID');
        return null;
      }

      setLoading(true);
      setError(null);
      setResult(null);

      try {
        const res = await api.post(`${serverUrl}/api/workspaces/${workspaceId}/sync`, { strategy });
        const data = (await res.json()) as SyncResult;

        if (res.ok) {
          setResult(data);
          return data;
        } else {
          // Handle conflict response (409)
          // Note: data.conflicts can be empty array [], which is still truthy
          const isConflict = res.status === 409 && (data.conflicts !== undefined || data.error?.includes('conflict'));

          if (isConflict) {
            setResult(data);
            setError(data.error || 'Merge conflict detected');
            return data;
          }
          setError(data.error || 'Sync failed');
          return null;
        }
      } catch (err) {
        const message = getErrorMessage(err, 'Sync failed');
        log.error('Workspace sync failed', { error: err, workspaceId });
        setError(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [workspaceId, serverUrl]
  );

  return { sync, loading, error, result };
}
