/**
 * Frontend Error Utilities
 *
 * Provides error handling utilities for the frontend.
 * Maintains backwards compatibility with existing code while
 * using the unified error types from @capybara-chat/types internally.
 */

import {
  getErrorMessage as baseGetErrorMessage,
  AppError,
  Errors,
  HttpError,
  requireFound,
  requireDeleted,
  isHttpError,
  wrapResult,
  require as requireCondition,
} from '@capybara-chat/types';

// Re-export types that are compatible
export type { Result, VoidResult } from '@capybara-chat/types';
export { AppError, Errors, requireFound, requireDeleted, isHttpError, wrapResult, HttpError };
export { requireCondition as require };

/**
 * Custom error class for API errors.
 * Captures HTTP status code and response body for better error handling.
 *
 * Note: This maintains backwards compatibility with the original ApiError
 * while internally extending from the unified HttpError.
 *
 * @example
 * try {
 *   const res = await api.get('/resource');
 *   await assertResponse(res, 'fetch resource');
 * } catch (err) {
 *   if (err instanceof ApiError) {
 *     if (err.status === 404) handleNotFound();
 *     else if (err.status === 401) handleUnauthorized();
 *   }
 * }
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Alias for status for compatibility with HttpError */
  get statusCode(): number {
    return this.status;
  }

  /** Check if error is a client error (4xx) */
  get isClientError(): boolean {
    return this.status >= 400 && this.status < 500;
  }

  /** Check if error is a server error (5xx) */
  get isServerError(): boolean {
    return this.status >= 500;
  }

  /** Check if error is a not found error (404) */
  get isNotFound(): boolean {
    return this.status === 404;
  }

  /** Check if error is an unauthorized error (401) */
  get isUnauthorized(): boolean {
    return this.status === 401;
  }
}

/**
 * Assert that an HTTP response is successful.
 * Throws ApiError if the response is not ok.
 *
 * @param res - The Response object to check
 * @param context - Description of the operation for error messages
 * @throws ApiError if response is not ok
 *
 * @example
 * const res = await api.post('/users', userData);
 * await assertResponse(res, 'create user');
 * const user = await res.json();
 */
export async function assertResponse(res: Response, context: string): Promise<void> {
  if (!res.ok) {
    const body = await res.text().catch(() => undefined);
    const message = body || res.statusText || `${context} failed`;
    throw new ApiError(res.status, `${context}: ${message}`, body);
  }
}

/**
 * Extract error message from an unknown error type
 *
 * @param err - The error to extract message from
 * @param fallback - Default message if extraction fails
 */
export function getErrorMessage(err: unknown, fallback = 'An error occurred'): string {
  if (err instanceof ApiError) {
    return err.message;
  }
  return baseGetErrorMessage(err, fallback);
}

/**
 * Extract error text from a failed HTTP response
 *
 * @param res - The Response object
 * @param fallback - Default message if extraction fails
 */
export async function getResponseError(res: Response, fallback = 'Request failed'): Promise<string> {
  try {
    const text = await res.text();
    return text || res.statusText || fallback;
  } catch {
    return res.statusText || fallback;
  }
}

/**
 * Check if an HTTP response indicates an error
 */
export function isErrorResponse(res: Response): boolean {
  return !res.ok;
}

/**
 * Format an API error for display
 *
 * @param url - The URL that was requested
 * @param error - The error that occurred
 */
export function formatApiError(url: string, error: unknown): string {
  const message = getErrorMessage(error);
  return `Request to ${url} failed: ${message}`;
}
