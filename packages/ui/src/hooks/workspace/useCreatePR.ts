/**
 * useCreatePR - Hook for creating a PR from a workspace branch
 */

import { useState, useCallback } from 'react';
import { api } from '../../lib/api';
import { createLogger } from '../../lib/logger';
import { getErrorMessage } from '../../lib/errors';

const log = createLogger('useCreatePR');

export interface CreatePRInput {
  branch: string;
  title?: string;
  body?: string;
  draft?: boolean;
}

export interface CreatePRResult {
  success: boolean;
  prNumber?: number;
  prUrl?: string;
  alreadyExists?: boolean;
}

/**
 * Hook for creating a PR from a workspace branch
 *
 * @example
 * const { createPR, loading, error } = useCreatePR('wks_123');
 * const result = await createPR({ branch: 'capybara/feat/my-feature' });
 */
export function useCreatePR(workspaceId: string | undefined) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createPR = useCallback(
    async (input: CreatePRInput): Promise<CreatePRResult | null> => {
      if (!workspaceId) {
        setError('No workspace ID');
        return null;
      }

      setLoading(true);
      setError(null);

      try {
        const res = await api.post(`/api/workspaces/${workspaceId}/pull-request`, input);
        if (res.ok) {
          return (await res.json()) as CreatePRResult;
        } else {
          const text = await res.text().catch(() => res.statusText);
          setError(text || 'Failed to create PR');
          return null;
        }
      } catch (err) {
        log.error('Failed to create PR', { error: err, workspaceId });
        setError(getErrorMessage(err, 'Failed to create PR'));
        return null;
      } finally {
        setLoading(false);
      }
    },
    [workspaceId]
  );

  return { createPR, loading, error };
}
