/**
 * Capybara Unified Error Types
 *
 * Provides a consistent error hierarchy across all packages.
 * Use these instead of package-specific error classes.
 *
 * @example
 * // Server-side: throw HTTP errors
 * throw new HttpError(404, 'Resource not found', 'NOT_FOUND');
 *
 * @example
 * // Client-side: handle API errors
 * if (error instanceof HttpError && error.isNotFound) {
 *   showNotFoundPage();
 * }
 *
 * @example
 * // Use Result type for explicit error handling
 * const result = await fetchData();
 * if (!result.ok) {
 *   console.error(result.error.message);
 * }
 */
/**
 * Base error class for all Capybara errors.
 * Provides consistent structure and helper methods.
 */
export declare class AppError extends Error {
    readonly code?: string | undefined;
    constructor(message: string, code?: string | undefined);
}
/**
 * HTTP error with status code.
 * Use for API responses and HTTP-layer errors.
 */
export declare class HttpError extends AppError {
    readonly statusCode: number;
    readonly body?: string | undefined;
    constructor(statusCode: number, message: string, code?: string, body?: string | undefined);
    /** Alias for statusCode for compatibility with ApiError */
    get status(): number;
    /** Check if error is a client error (4xx) */
    get isClientError(): boolean;
    /** Check if error is a server error (5xx) */
    get isServerError(): boolean;
    /** Check if error is a not found error (404) */
    get isNotFound(): boolean;
    /** Check if error is an unauthorized error (401) */
    get isUnauthorized(): boolean;
    /** Check if error is a forbidden error (403) */
    get isForbidden(): boolean;
    /** Check if error is a bad request error (400) */
    get isBadRequest(): boolean;
    /** Check if error is a conflict error (409) */
    get isConflict(): boolean;
}
/**
 * Common HTTP error factory functions.
 * Use these for consistent error creation.
 */
export declare const Errors: {
    notFound: (resource: string) => HttpError;
    badRequest: (message: string) => HttpError;
    unauthorized: (message?: string) => HttpError;
    forbidden: (message?: string) => HttpError;
    conflict: (message: string) => HttpError;
    internal: (message?: string) => HttpError;
    validation: (message: string) => HttpError;
    timeout: (message?: string) => HttpError;
    tooManyRequests: (message?: string) => HttpError;
};
/**
 * Result type for explicit error handling.
 * Use instead of throwing errors when you want the caller to handle errors explicitly.
 *
 * @example
 * async function fetchUser(id: string): Promise<Result<User>> {
 *   try {
 *     const user = await db.getUser(id);
 *     if (!user) return { ok: false, error: Errors.notFound('User') };
 *     return { ok: true, data: user };
 *   } catch (e) {
 *     return { ok: false, error: new AppError(String(e)) };
 *   }
 * }
 *
 * const result = await fetchUser('123');
 * if (result.ok) {
 *   console.log(result.data.name);
 * } else {
 *   console.error(result.error.message);
 * }
 */
export type Result<T, E extends Error = AppError> = {
    ok: true;
    data: T;
} | {
    ok: false;
    error: E;
};
/**
 * Simple result type for operations that don't return data.
 */
export type VoidResult<E extends Error = AppError> = {
    ok: true;
} | {
    ok: false;
    error: E;
};
/**
 * Assert that a value is not null/undefined.
 * Throws NotFound error if value is missing.
 *
 * @example
 * const session = requireFound(repo.findById(id), 'Session');
 * // session is now non-null
 */
export declare function requireFound<T>(value: T | null | undefined, resourceName: string): T;
/**
 * Assert that a delete operation succeeded.
 * Throws NotFound error if deletion failed.
 *
 * @example
 * requireDeleted(repo.delete(id), 'Session');
 */
export declare function requireDeleted(deleted: boolean, resourceName: string): void;
/**
 * Assert that a condition is true.
 * Throws BadRequest error with the provided message if condition is false.
 *
 * @example
 * require(user.isAdmin, 'Only admins can perform this action');
 */
export declare function require(condition: boolean, message: string): asserts condition;
/**
 * Extract error message from unknown error type.
 *
 * @example
 * try { ... } catch (e) {
 *   const message = getErrorMessage(e);
 * }
 */
export declare function getErrorMessage(error: unknown, fallback?: string): string;
/**
 * Check if an error is an HttpError with a specific status code.
 */
export declare function isHttpError(error: unknown, statusCode?: number): error is HttpError;
/**
 * Wrap an async function to return a Result instead of throwing.
 *
 * @example
 * const safeFetch = wrapResult(fetch);
 * const result = await safeFetch('/api/data');
 * if (result.ok) { ... }
 */
export declare function wrapResult<T, Args extends unknown[]>(fn: (...args: Args) => Promise<T>): (...args: Args) => Promise<Result<T>>;
//# sourceMappingURL=errors.d.ts.map