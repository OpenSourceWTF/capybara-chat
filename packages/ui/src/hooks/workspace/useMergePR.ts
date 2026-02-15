/**
 * useMergePR - Hook for merging a PR in a workspace
 */

import { useState, useCallback } from 'react';
import { api } from '../../lib/api';
import { createLogger } from '../../lib/logger';
import { getErrorMessage } from '../../lib/errors';

const log = createLogger('useMergePR');

export interface MergePRInput {
  prNumber: number;
  mergeMethod?: 'merge' | 'squash' | 'rebase';
  commitMessage?: string;
  deleteBranch?: boolean;
}

export interface MergePRResult {
  success: boolean;
  merged?: boolean;
  sha?: string;
}

/**
 * Hook for merging a PR in a workspace
 *
 * @example
 * const { mergePR, loading, error } = useMergePR('wks_123');
 * const result = await mergePR({ prNumber: 42 });
 */
export function useMergePR(workspaceId: string | undefined) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mergePR = useCallback(
    async (input: MergePRInput): Promise<MergePRResult | null> => {
      if (!workspaceId) {
        setError('No workspace ID');
        return null;
      }

      setLoading(true);
      setError(null);

      try {
        const res = await api.post(`/api/workspaces/${workspaceId}/merge-pr`, input);
        if (res.ok) {
          return (await res.json()) as MergePRResult;
        } else {
          const text = await res.text().catch(() => res.statusText);
          setError(text || 'Failed to merge PR');
          return null;
        }
      } catch (err) {
        log.error('Failed to merge PR', { error: err, workspaceId });
        setError(getErrorMessage(err, 'Failed to merge PR'));
        return null;
      } finally {
        setLoading(false);
      }
    },
    [workspaceId]
  );

  return { mergePR, loading, error };
}
