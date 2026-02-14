/**
 * Error Handling Middleware & Route Handler Wrapper
 *
 * Provides consistent error handling across all routes.
 */

import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { createLogger } from './logger.js';
import {
  PAGINATION,
  HttpError,
  Errors,
  requireFound,
  requireDeleted,
} from '@capybara-chat/types';
import { GitHubTokenNotConfiguredError } from '../utils/github.js';

const log = createLogger('ErrorHandler');

// Re-export for backwards compatibility
export { HttpError, Errors, requireFound, requireDeleted } from '@capybara-chat/types';

export function getPaginationParams(
  req: Request,
  options?: { defaultLimit?: number }
): { limit: number; offset: number } {
  const defaultLimit = options?.defaultLimit ?? PAGINATION.DEFAULT_LIMIT;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : defaultLimit;
  const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : PAGINATION.DEFAULT_OFFSET;
  return { limit: Math.max(1, Math.min(limit, PAGINATION.MAX_LIMIT)), offset: Math.max(0, offset) };
}

export function parseQueryBool(value: unknown): boolean {
  return value === 'true';
}

type RouteHandler = (req: Request, res: Response) => void | Promise<void>;

export function asyncHandler(handler: RouteHandler): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res)).catch((error) => {
      // Pass to error middleware
      next(error);
    });
  };
}

export function errorMiddleware(
  error: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Determine status code - check for known error types
  let statusCode: number;
  let code: string;

  if (error instanceof HttpError) {
    statusCode = error.statusCode;
    code = error.code ?? 'ERROR';
  } else if (error instanceof GitHubTokenNotConfiguredError) {
    statusCode = 400;
    code = 'BAD_REQUEST';
  } else {
    statusCode = 500;
    code = 'INTERNAL_ERROR';
  }

  // Log all errors - 400s are important for debugging schema mismatches
  if (statusCode >= 500) {
    log.error(`${req.method} ${req.path}`, error, { statusCode, code });
  } else {
    log.warn(`${req.method} ${req.path}: ${error.message}`, { statusCode, code });
  }

  // Send structured error response
  res.status(statusCode).json({
    error: error.message,
    code,
    ...(process.env.NODE_ENV === 'development' && statusCode >= 500 && {
      stack: error.stack,
    }),
  });
}
