import {
  getErrorMessage as baseGetErrorMessage,
  AppError
} from '@capybara-chat/types';

/**
 * Custom error class for API errors.
 * Captures HTTP status code and response body for better error handling.
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

  /** Check if error is a client error (4xx) */
  get isClientError(): boolean {
    return this.status >= 400 && this.status < 500;
  }

  /** Check if error is a server error (5xx) */
  get isServerError(): boolean {
    return this.status >= 500;
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

export { AppError };
