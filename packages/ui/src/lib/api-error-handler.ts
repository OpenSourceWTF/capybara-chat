/**
 * API Error Handler - Centralized error handling for API operations
 *
 * Provides consistent error extraction, logging, and message formatting
 * across useFetch, useFetchList, and useApiMutation hooks.
 */

import { createLogger } from './logger';
import { getErrorMessage } from './errors';

const log = createLogger('api');

/**
 * Handle a caught exception from an API call
 *
 * @param context - Description of the operation (e.g., 'Fetch failed', 'POST failed')
 * @param error - The caught error
 * @param options - Additional context for logging
 * @returns Formatted error message string
 *
 * @example
 * try {
 *   await api.get(url);
 * } catch (err) {
 *   const message = handleApiError('Failed to fetch data', err, { url });
 *   setError(message);
 * }
 */
export function handleApiError(
  context: string,
  error: unknown,
  options?: { url?: string; id?: string }
): string {
  log.error(context, { error, ...options });
  return getErrorMessage(error, context);
}

/**
 * Extract error message from a failed Response
 *
 * @param response - The failed fetch Response
 * @param fallback - Fallback message if text extraction fails
 * @returns Error message string
 *
 * @example
 * if (!res.ok) {
 *   const message = await extractResponseError(res, 'Request failed');
 *   setError(message);
 * }
 */
export async function extractResponseError(
  response: Response,
  fallback: string
): Promise<string> {
  try {
    const text = await response.text();
    return text || fallback;
  } catch {
    return response.statusText || fallback;
  }
}

/**
 * Handle API response, returning data on success or error message on failure
 *
 * @param response - The fetch Response
 * @param context - Description for error logging
 * @returns Object with either data or error
 *
 * @example
 * const res = await api.get(url);
 * const result = await handleApiResponse<MyData>(res, 'Fetch user data');
 * if (result.error) {
 *   setError(result.error);
 * } else {
 *   setData(result.data);
 * }
 */
export async function handleApiResponse<T>(
  response: Response,
  context: string
): Promise<{ data: T; error: null } | { data: null; error: string }> {
  if (response.ok) {
    const data = await response.json() as T;
    return { data, error: null };
  }

  const error = await extractResponseError(response, context);
  return { data: null, error };
}
