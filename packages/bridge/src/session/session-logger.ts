/**
 * Session Logger
 *
 * Provides per-session logging with:
 * 1. Console output with session prefix
 * 2. In-memory buffer for UI consumption
 * 3. Real-time socket emission to UI (Phase 4)
 *
 * Separation of concerns:
 * - SessionLogger: I/O operations (console, buffer, socket)
 * - SessionContext.events: Pure data audit trail
 */

import type { Socket } from 'socket.io-client';
import { SOCKET_EVENTS } from '@capybara-chat/types';

/**
 * Log entry stored in memory
 */
export interface LogEntry {
  level: 'info' | 'debug' | 'warn' | 'error';
  message: string;
  data?: unknown;
  timestamp: number;
}

/**
 * Session Logger interface
 *
 * External to SessionContext (I/O, not pure data)
 */
export interface SessionLogger {
  info(msg: string, data?: unknown): void;
  debug(msg: string, data?: unknown): void;
  warn(msg: string, data?: unknown): void;
  error(msg: string, error: Error): void;
}

/**
 * Session Log Buffer
 *
 * Bounded in-memory capture of logs per session for UI consumption.
 * Integrates with UI via API endpoints and socket events (Phase 4).
 */
export class SessionLogBuffer {
  private logs = new Map<string, LogEntry[]>();
  private readonly maxLogsPerSession = 500;
  private socket: Socket | null;

  constructor(socket?: Socket | null) {
    this.socket = socket ?? null;
  }

  /**
   * Update socket for real-time log emission
   *
   * @param socket - Socket.io socket to emit logs to
   */
  setSocket(socket: Socket | null): void {
    this.socket = socket;
  }

  /**
   * Add log entry to buffer
   *
   * @param sessionId - Session ID
   * @param entry - Log entry
   * @param source - Optional source identifier (pipeline, stage, adapter)
   */
  addLog(sessionId: string, entry: LogEntry, source?: 'pipeline' | 'stage' | 'adapter'): void {
    let sessionLogs = this.logs.get(sessionId);
    if (!sessionLogs) {
      sessionLogs = [];
      this.logs.set(sessionId, sessionLogs);
    }

    sessionLogs.push(entry);

    // Trim if exceeds max
    if (sessionLogs.length > this.maxLogsPerSession) {
      sessionLogs.shift();
    }

    // Emit to UI via socket (Phase 4)
    if (this.socket) {
      this.socket.emit(SOCKET_EVENTS.SESSION_LOG, {
        sessionId,
        level: entry.level,
        message: entry.message,
        context: entry.data as Record<string, unknown> | undefined,
        timestamp: entry.timestamp,
        source,
      });
    }
    // Note: No warning logged if socket is null - socket may not be set yet during initialization
  }

  /**
   * Get logs for a session
   *
   * @param sessionId - Session ID
   * @param limit - Max number of recent logs to return
   * @returns Array of log entries
   */
  getLogs(sessionId: string, limit?: number): LogEntry[] {
    const sessionLogs = this.logs.get(sessionId) || [];
    if (limit && limit > 0) {
      return sessionLogs.slice(-limit);
    }
    return [...sessionLogs];
  }

  /**
   * Clear logs for a session
   *
   * @param sessionId - Session ID
   */
  clearLogs(sessionId: string): void {
    this.logs.delete(sessionId);
  }

  /**
   * Get all session IDs with logs
   *
   * @returns Array of session IDs
   */
  getAllSessionIds(): string[] {
    return Array.from(this.logs.keys());
  }
}

/**
 * Create per-session logger with dual output
 *
 * Outputs to:
 * 1. Console (with prefix)
 * 2. In-memory buffer (for UI)
 * 3. Socket events (for real-time UI updates)
 *
 * @param sessionId - Session ID
 * @param logBuffer - Optional log buffer for UI integration
 * @param source - Optional source identifier (pipeline, stage, adapter)
 * @returns Session logger
 */
export function createSessionLogger(
  sessionId: string,
  logBuffer?: SessionLogBuffer,
  source?: 'pipeline' | 'stage' | 'adapter'
): SessionLogger {
  const prefix = `[Session:${sessionId.slice(0, 8)}]`;

  return {
    info: (msg: string, data?: unknown) => {
      console.log(`${prefix} ${msg}`, data || '');
      if (logBuffer) {
        logBuffer.addLog(sessionId, {
          level: 'info',
          message: msg,
          data,
          timestamp: Date.now(),
        }, source);
      }
    },
    debug: (msg: string, data?: unknown) => {
      console.debug(`${prefix} ${msg}`, data || '');
      if (logBuffer) {
        logBuffer.addLog(sessionId, {
          level: 'debug',
          message: msg,
          data,
          timestamp: Date.now(),
        }, source);
      }
    },
    warn: (msg: string, data?: unknown) => {
      console.warn(`${prefix} ${msg}`, data || '');
      if (logBuffer) {
        logBuffer.addLog(sessionId, {
          level: 'warn',
          message: msg,
          data,
          timestamp: Date.now(),
        }, source);
      }
    },
    error: (msg: string, error: Error) => {
      console.error(`${prefix} ${msg}`, error);
      if (logBuffer) {
        logBuffer.addLog(sessionId, {
          level: 'error',
          message: msg,
          data: {
            message: error.message,
            stack: error.stack,
          },
          timestamp: Date.now(),
        }, source);
      }
    },
  };
}
