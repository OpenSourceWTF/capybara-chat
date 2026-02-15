import { getErrorMessage as baseGetErrorMessage, AppError } from '@capybara-chat/types';
/**
 * Custom error class for API errors.
 * Captures HTTP status code and response body for better error handling.
 */
export class ApiError extends Error {
    status;
    body;
    constructor(status, message, body) {
        super(message);
        this.status = status;
        this.body = body;
        this.name = 'ApiError';
    }
    /** Check if error is a client error (4xx) */
    get isClientError() {
        return this.status >= 400 && this.status < 500;
    }
    /** Check if error is a server error (5xx) */
    get isServerError() {
        return this.status >= 500;
    }
}
/**
 * Extract error message from an unknown error type
 *
 * @param err - The error to extract message from
 * @param fallback - Default message if extraction fails
 */
export function getErrorMessage(err, fallback = 'An error occurred') {
    if (err instanceof ApiError) {
        return err.message;
    }
    return baseGetErrorMessage(err, fallback);
}
export { AppError };
//# sourceMappingURL=errors.js.map