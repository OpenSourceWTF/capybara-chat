/**
 * Server Logger
 *
 * Re-exports the unified logger from @capybara-chat/types.
 * Adds request logging middleware.
 */

import { createLogger } from '@capybara-chat/types';
import type { Request, Response, NextFunction } from 'express';

export {
  createLogger,
  log,
  logRegistry,
  setLogLevel,
  getLogLevel,
  createConsoleTransport,
  createJsonTransport,
  createSilentTransport,
  createBufferTransport,
  type Logger,
  type LogLevel,
  type LogContext,
  type LogEntry,
  type LogTransport,
} from '@capybara-chat/types';

const httpLog = createLogger('HTTP');

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    httpLog.info(`${req.method} ${req.originalUrl}`, {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });
  });
  next();
}
