import { AppError } from '@capybara-chat/types';
/**
 * Custom error class for API errors.
 * Captures HTTP status code and response body for better error handling.
 */
export declare class ApiError extends Error {
    readonly status: number;
    readonly body?: string | undefined;
    constructor(status: number, message: string, body?: string | undefined);
    /** Check if error is a client error (4xx) */
    get isClientError(): boolean;
    /** Check if error is a server error (5xx) */
    get isServerError(): boolean;
}
/**
 * Extract error message from an unknown error type
 *
 * @param err - The error to extract message from
 * @param fallback - Default message if extraction fails
 */
export declare function getErrorMessage(err: unknown, fallback?: string): string;
export { AppError };
//# sourceMappingURL=errors.d.ts.map