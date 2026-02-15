/**
 * Frontend Logger
 *
 * Re-exports the unified logger from @capybara-chat/types.
 * Registers remote transport to send logs to server.
 */

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

import { createLogger, logRegistry, createRemoteTransport } from '@capybara-chat/types';

// Register remote transport to send browser logs to server
// Only register in browser environment and only for warn/error to reduce noise
if (typeof window !== 'undefined') {
  logRegistry.addTransport(createRemoteTransport({
    serverUrl: '', // Empty = relative URL (same origin)
    source: 'huddle',
    batchSize: 5,
    flushInterval: 10000, // Less frequent for browser
    levels: ['warn', 'error'], // Only send warnings and errors from browser
  }));
}

/**
 * Default Huddle logger
 */
export const logger = createLogger('Huddle');
