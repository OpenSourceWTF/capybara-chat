/**
 * Validation Middleware
 *
 * Express middleware for validating requests using Zod schemas.
 */

import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { ZodError, type ZodSchema, type ZodIssue } from 'zod';
import { HttpError } from './error-handler.js';

function formatZodError(error: ZodError): string {
  return error.issues
    .map((issue: ZodIssue) => {
      const path = issue.path.length > 0 ? `${issue.path.join('.')}: ` : '';
      return `${path}${issue.message}`;
    })
    .join(', ');
}

export function validateBody<T>(schema: ZodSchema<T>): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        next(new HttpError(400, formatZodError(error)));
      } else {
        next(error);
      }
    }
  };
}

export function validateQuery<T>(schema: ZodSchema<T>): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      req.query = schema.parse(req.query) as typeof req.query;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        next(new HttpError(400, formatZodError(error)));
      } else {
        next(error);
      }
    }
  };
}

export function validateParams<T>(schema: ZodSchema<T>): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      req.params = schema.parse(req.params) as typeof req.params;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        next(new HttpError(400, formatZodError(error)));
      } else {
        next(error);
      }
    }
  };
}

export const idParamSchema = {
  id: { type: 'string', format: 'uuid' },
};
