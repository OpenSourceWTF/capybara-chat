/**
 * useFetch - Generic hook for data fetching with loading/error states
 *
 * Eliminates duplicate fetch-setState-error patterns across components.
 */

import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { handleApiError, extractResponseError } from '../lib/api-error-handler';

export interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export interface UseFetchOptions {
  /** Skip initial fetch (useful for conditional fetching) */
  skip?: boolean;
  /** Dependencies that trigger refetch when changed */
  deps?: unknown[];
}

/**
 * Hook for fetching data from an API endpoint
 *
 * @example
 * const { data, loading, error, refetch } = useFetch<Document[]>('/api/documents');
 */
export function useFetch<T>(
  url: string,
  options: UseFetchOptions = {}
): FetchState<T> & { refetch: () => Promise<void> } {
  const { skip = false, deps = [] } = options;
  const [state, setState] = useState<FetchState<T>>({
    data: null,
    loading: !skip,
    error: null,
  });

  const fetchData = useCallback(async () => {
    if (skip) return;

    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const res = await api.get(url);
      if (res.ok) {
        const data = await res.json() as T;
        setState({ data, loading: false, error: null });
      } else {
        const error = await extractResponseError(res, 'Fetch failed');
        setState({ data: null, loading: false, error });
      }
    } catch (err) {
      const error = handleApiError('Fetch failed', err, { url });
      setState({ data: null, loading: false, error });
    }
  }, [url, skip]);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchData, ...deps]);

  return { ...state, refetch: fetchData };
}

/**
 * Hook for lazy fetching (manually triggered)
 *
 * @example
 * const { data, loading, error, fetch } = useLazyFetch<Document>('/api/documents');
 * // Later: fetch()
 */
export function useLazyFetch<T>(url: string): FetchState<T> & {
  fetch: () => Promise<T | null>;
} {
  const [state, setState] = useState<FetchState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  const fetchData = useCallback(async (): Promise<T | null> => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const res = await api.get(url);
      if (res.ok) {
        const data = await res.json() as T;
        setState({ data, loading: false, error: null });
        return data;
      } else {
        const error = await extractResponseError(res, 'Fetch failed');
        setState({ data: null, loading: false, error });
        return null;
      }
    } catch (err) {
      const error = handleApiError('Fetch failed', err, { url });
      setState({ data: null, loading: false, error });
      return null;
    }
  }, [url]);

  return { ...state, fetch: fetchData };
}
