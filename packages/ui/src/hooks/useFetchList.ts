/**
 * useFetchList - Reusable hook for fetching lists with filtering
 *
 * Eliminates duplicate fetch patterns across components.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../lib/api';
import { handleApiError, extractResponseError } from '../lib/api-error-handler';

/**
 * Deep comparison of two objects for use in dependency arrays
 * Avoids JSON.stringify in useCallback dependencies which runs every render
 */
function useDeepCompareMemoize<T>(value: T): T {
  const ref = useRef<T>(value);
  const signalRef = useRef<number>(0);

  if (!deepEqual(value, ref.current)) {
    ref.current = value;
    signalRef.current += 1;
  }

  // Return a stable reference that only changes when the deep value changes
  return ref.current;
}

/**
 * Simple deep equality check for params objects
 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object' || a === null || b === null) return false;

  const keysA = Object.keys(a as Record<string, unknown>);
  const keysB = Object.keys(b as Record<string, unknown>);

  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!keysB.includes(key)) return false;
    if (!deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])) {
      return false;
    }
  }

  return true;
}

export interface FetchListOptions {
  /** Base URL for the API endpoint */
  url: string;
  /** Key to extract from response (e.g., 'sessions', 'specs', 'segments') */
  dataKey: string;
  /** URL params to include */
  params?: Record<string, string | undefined>;
  /** Whether to fetch immediately (default: true) */
  enabled?: boolean;
}

export interface FetchListResult<T> {
  items: T[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  setItems: React.Dispatch<React.SetStateAction<T[]>>;
}

/**
 * Hook for fetching lists with automatic loading state and error handling
 */
export function useFetchList<T>({
  url,
  dataKey,
  params = {},
  enabled = true,
}: FetchListOptions): FetchListResult<T> {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Use deep comparison for params to avoid unnecessary refetches
  const stableParams = useDeepCompareMemoize(params);

  const fetchData = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    try {
      setError(null);
      const searchParams = new URLSearchParams();

      // Add non-undefined params
      Object.entries(stableParams).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          searchParams.set(key, value);
        }
      });

      const queryString = searchParams.toString();
      const fullUrl = queryString ? `${url}?${queryString}` : url;

      const res = await api.get(fullUrl);
      if (res.ok) {
        const data = await res.json();
        setItems(data[dataKey] || []);
      } else {
        const error = await extractResponseError(res, 'Failed to fetch data');
        setError(error);
      }
    } catch (err) {
      const error = handleApiError('Failed to fetch data', err, { url });
      setError(error);
    } finally {
      setLoading(false);
    }
  }, [url, dataKey, enabled, stableParams]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { items, loading, error, refetch: fetchData, setItems };
}

/**
 * Helper to remove an item from the list after deletion
 */
export function removeById<T extends { id: string }>(
  setItems: React.Dispatch<React.SetStateAction<T[]>>,
  id: string
): void {
  setItems((prev) => prev.filter((item) => item.id !== id));
}

/**
 * Helper to prepend an item to the list after creation
 */
export function prependItem<T>(
  setItems: React.Dispatch<React.SetStateAction<T[]>>,
  item: T
): void {
  setItems((prev) => [item, ...prev]);
}
