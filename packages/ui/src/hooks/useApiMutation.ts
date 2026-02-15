/**
 * useApiMutation - Reusable hook for API mutations (POST, PATCH, DELETE)
 *
 * Eliminates duplicate mutation patterns across components.
 */

import { useState, useCallback } from 'react';
import { api } from '../lib/api';
import { handleApiError, extractResponseError } from '../lib/api-error-handler';

export interface MutationResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export interface UseDeleteOptions {
  /** Called after successful deletion */
  onSuccess?: (id: string) => void;
}

/**
 * Hook for delete operations with error handling
 *
 * NOTE: Confirmation should be handled by the component using ConfirmDeleteDialog,
 * not by this hook. Call deleteItem only after user confirms.
 */
export function useDelete(baseUrl: string, options: UseDeleteOptions = {}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deleteItem = useCallback(async (id: string): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const res = await api.delete(`${baseUrl}/${id}`);
      if (res.ok) {
        options.onSuccess?.(id);
        return true;
      } else {
        const error = await extractResponseError(res, 'Delete failed');
        setError(error);
        return false;
      }
    } catch (err) {
      const error = handleApiError('Delete failed', err, { id });
      setError(error);
      return false;
    } finally {
      setLoading(false);
    }
  }, [baseUrl, options.onSuccess]);

  return { deleteItem, loading, error };
}

/**
 * Hook for POST operations with error handling
 */
export function usePost<TInput, TOutput>(url: string) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const post = useCallback(async (data?: TInput): Promise<TOutput | null> => {
    setLoading(true);
    setError(null);

    try {
      const res = await api.post(url, data);
      if (res.ok) {
        return await res.json() as TOutput;
      } else {
        const error = await extractResponseError(res, 'Request failed');
        setError(error);
        return null;
      }
    } catch (err) {
      const error = handleApiError('POST failed', err, { url });
      setError(error);
      return null;
    } finally {
      setLoading(false);
    }
  }, [url]);

  return { post, loading, error };
}

/**
 * Hook for PATCH operations with error handling
 */
export function usePatch<TInput, TOutput>(baseUrl: string) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const patch = useCallback(async (id: string, data: TInput): Promise<TOutput | null> => {
    setLoading(true);
    setError(null);

    try {
      const res = await api.patch(`${baseUrl}/${id}`, data);
      if (res.ok) {
        return await res.json() as TOutput;
      } else {
        const error = await extractResponseError(res, 'Update failed');
        setError(error);
        return null;
      }
    } catch (err) {
      const error = handleApiError('PATCH failed', err, { url: baseUrl, id });
      setError(error);
      return null;
    } finally {
      setLoading(false);
    }
  }, [baseUrl]);

  return { patch, loading, error };
}
