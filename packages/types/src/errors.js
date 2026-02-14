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
// ===== Base Error Classes =====
/**
 * Base error class for all Capybara errors.
 * Provides consistent structure and helper methods.
 */
export class AppError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = 'AppError';
        // Maintains proper stack trace for where error was thrown (V8 engines)
        Error.captureStackTrace?.(this, this.constructor);
    }
}
/**
 * HTTP error with status code.
 * Use for API responses and HTTP-layer errors.
 */
export class HttpError extends AppError {
    statusCode;
    body;
    constructor(statusCode, message, code, body) {
        super(message, code);
        this.statusCode = statusCode;
        this.body = body;
        this.name = 'HttpError';
    }
    /** Alias for statusCode for compatibility with ApiError */
    get status() {
        return this.statusCode;
    }
    /** Check if error is a client error (4xx) */
    get isClientError() {
        return this.statusCode >= 400 && this.statusCode < 500;
    }
    /** Check if error is a server error (5xx) */
    get isServerError() {
        return this.statusCode >= 500;
    }
    /** Check if error is a not found error (404) */
    get isNotFound() {
        return this.statusCode === 404;
    }
    /** Check if error is an unauthorized error (401) */
    get isUnauthorized() {
        return this.statusCode === 401;
    }
    /** Check if error is a forbidden error (403) */
    get isForbidden() {
        return this.statusCode === 403;
    }
    /** Check if error is a bad request error (400) */
    get isBadRequest() {
        return this.statusCode === 400;
    }
    /** Check if error is a conflict error (409) */
    get isConflict() {
        return this.statusCode === 409;
    }
}
// ===== Error Factory Functions =====
/**
 * Common HTTP error factory functions.
 * Use these for consistent error creation.
 */
export const Errors = {
    notFound: (resource) => new HttpError(404, `${resource} not found`, 'NOT_FOUND'),
    badRequest: (message) => new HttpError(400, message, 'BAD_REQUEST'),
    unauthorized: (message = 'Unauthorized') => new HttpError(401, message, 'UNAUTHORIZED'),
    forbidden: (message = 'Forbidden') => new HttpError(403, message, 'FORBIDDEN'),
    conflict: (message) => new HttpError(409, message, 'CONFLICT'),
    internal: (message = 'Internal server error') => new HttpError(500, message, 'INTERNAL_ERROR'),
    validation: (message) => new HttpError(422, message, 'VALIDATION_ERROR'),
    timeout: (message = 'Request timeout') => new HttpError(408, message, 'TIMEOUT'),
    tooManyRequests: (message = 'Too many requests') => new HttpError(429, message, 'RATE_LIMITED'),
};
// ===== Assertion Helpers =====
/**
 * Assert that a value is not null/undefined.
 * Throws NotFound error if value is missing.
 *
 * @example
 * const session = requireFound(repo.findById(id), 'Session');
 * // session is now non-null
 */
export function requireFound(value, resourceName) {
    if (value === null || value === undefined) {
        throw Errors.notFound(resourceName);
    }
    return value;
}
/**
 * Assert that a delete operation succeeded.
 * Throws NotFound error if deletion failed.
 *
 * @example
 * requireDeleted(repo.delete(id), 'Session');
 */
export function requireDeleted(deleted, resourceName) {
    if (!deleted) {
        throw Errors.notFound(resourceName);
    }
}
/**
 * Assert that a condition is true.
 * Throws BadRequest error with the provided message if condition is false.
 *
 * @example
 * require(user.isAdmin, 'Only admins can perform this action');
 */
export function require(condition, message) {
    if (!condition) {
        throw Errors.badRequest(message);
    }
}
// ===== Error Utilities =====
/**
 * Extract error message from unknown error type.
 *
 * @example
 * try { ... } catch (e) {
 *   const message = getErrorMessage(e);
 * }
 */
export function getErrorMessage(error, fallback = 'An error occurred') {
    if (error instanceof Error) {
        return error.message;
    }
    if (typeof error === 'string') {
        return error;
    }
    return fallback;
}
/**
 * Check if an error is an HttpError with a specific status code.
 */
export function isHttpError(error, statusCode) {
    if (!(error instanceof HttpError))
        return false;
    if (statusCode !== undefined)
        return error.statusCode === statusCode;
    return true;
}
/**
 * Wrap an async function to return a Result instead of throwing.
 *
 * @example
 * const safeFetch = wrapResult(fetch);
 * const result = await safeFetch('/api/data');
 * if (result.ok) { ... }
 */
export function wrapResult(fn) {
    return async (...args) => {
        try {
            const data = await fn(...args);
            return { ok: true, data };
        }
        catch (error) {
            if (error instanceof AppError) {
                return { ok: false, error };
            }
            return { ok: false, error: new AppError(getErrorMessage(error)) };
        }
    };
}
//# sourceMappingURL=errors.js.map