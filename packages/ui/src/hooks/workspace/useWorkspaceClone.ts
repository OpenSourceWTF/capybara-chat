/**
 * useWorkspaceClone - Hook for triggering clone on a pending/failed workspace
 */

import { useState, useCallback } from 'react';
import { api } from '../../lib/api';
import { createLogger } from '../../lib/logger';
import { getErrorMessage } from '../../lib/errors';
import { useServer } from '../../context/ServerContext';

const log = createLogger('useWorkspaceClone');

export interface CloneResult {
  message: string;
}

/**
 * Hook for triggering clone on a pending/failed workspace
 *
 * @example
 * const { clone, loading, error } = useWorkspaceClone('wks_123');
 * await clone();
 */
export function useWorkspaceClone(workspaceId: string | undefined) {
  const { serverUrl } = useServer();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CloneResult | null>(null);

  const clone = useCallback(async (): Promise<CloneResult | null> => {
    if (!workspaceId) {
      setError('No workspace ID');
      return null;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await api.post(`${serverUrl}/api/workspaces/${workspaceId}/clone`);
      if (res.ok) {
        const data = (await res.json()) as CloneResult;
        setResult(data);
        return data;
      } else {
        const text = await res.text().catch(() => res.statusText);
        setError(text || 'Clone failed');
        return null;
      }
    } catch (err) {
      const message = getErrorMessage(err, 'Clone failed');
      log.error('Workspace clone failed', { error: err, workspaceId });
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [workspaceId, serverUrl]);

  return { clone, loading, error, result };
}
