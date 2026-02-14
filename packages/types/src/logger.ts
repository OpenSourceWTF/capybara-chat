/**
 * Capybara Unified Logger
 *
 * Pluggable logging system with configurable transport middleware.
 * Supports stdout, JSON (pino-compatible), and custom transports.
 *
 * @example
 * // Basic usage
 * const log = createLogger('MyService');
 * log.info('Server started', { port: 3000 });
 *
 * @example
 * // Add custom transport (e.g., for Grafana Loki)
 * logRegistry.addTransport({
 *   name: 'loki',
 *   log: (entry) => sendToLoki(entry),
 * });
 *
 * @example
 * // Use JSON transport for pino compatibility
 * logRegistry.addTransport(createJsonTransport());
 * logRegistry.removeTransport('console'); // Remove default console
 */

// ===== Types =====

export const LogLevel = {
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
} as const;
export type LogLevel = (typeof LogLevel)[keyof typeof LogLevel];

export interface LogContext {
  [key: string]: unknown;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  prefix: string;
  message: string;
  context?: LogContext;
  error?: {
    message: string;
    stack?: string;
    name?: string;
  };
}

/**
 * Transport interface for log output plugins.
 * Implement this to send logs to custom destinations.
 */
export interface LogTransport {
  /** Unique name for this transport */
  name: string;

  /** Process a log entry */
  log(entry: LogEntry): void | Promise<void>;

  /** Optional: Called when transport is added */
  init?(): void | Promise<void>;

  /** Optional: Called when transport is removed or shutdown */
  close?(): void | Promise<void>;

  /** Optional: Filter which log levels this transport handles */
  levels?: LogLevel[];
}

/**
 * Logger instance interface
 */
export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, error?: Error | LogContext, context?: LogContext): void;

  /** Create a child logger with additional prefix */
  child(prefix: string): Logger;
}

// ===== Log Level Management =====

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function getEnvLogLevel(): LogLevel {
  // Check for browser environment
  if (typeof globalThis !== 'undefined' && 'window' in globalThis) {
    return 'info';
  }
  try {
    // Node.js environment - use globalThis to avoid direct process reference
    const proc = (globalThis as Record<string, unknown>).process as
      | { env?: { LOG_LEVEL?: string } }
      | undefined;
    const level = proc?.env?.LOG_LEVEL;
    if (level && ['debug', 'info', 'warn', 'error'].includes(level)) {
      return level as LogLevel;
    }
  } catch {
    // Fallback
  }
  return 'info';
}

let globalLogLevel: LogLevel = getEnvLogLevel();

/**
 * Set the global minimum log level
 */
export function setLogLevel(level: LogLevel): void {
  globalLogLevel = level;
}

/**
 * Get the current global log level
 */
export function getLogLevel(): LogLevel {
  return globalLogLevel;
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[globalLogLevel];
}

// ===== Transport Registry =====

class LogTransportRegistry {
  private transports: Map<string, LogTransport> = new Map();
  private initialized = false;

  constructor() {
    // Add default console transport
    this.addTransport(createConsoleTransport());
  }

  /**
   * Add a transport to the registry
   */
  async addTransport(transport: LogTransport): Promise<void> {
    if (this.transports.has(transport.name)) {
      console.warn(`[Logger] Transport "${transport.name}" already exists, replacing`);
      await this.removeTransport(transport.name);
    }

    if (transport.init) {
      await transport.init();
    }

    this.transports.set(transport.name, transport);
  }

  /**
   * Remove a transport by name
   */
  async removeTransport(name: string): Promise<boolean> {
    const transport = this.transports.get(name);
    if (!transport) return false;

    if (transport.close) {
      await transport.close();
    }

    return this.transports.delete(name);
  }

  /**
   * Get a transport by name
   */
  getTransport(name: string): LogTransport | undefined {
    return this.transports.get(name);
  }

  /**
   * List all registered transports
   */
  listTransports(): string[] {
    return Array.from(this.transports.keys());
  }

  /**
   * Clear all transports (useful for testing)
   */
  async clearTransports(): Promise<void> {
    for (const name of this.transports.keys()) {
      await this.removeTransport(name);
    }
  }

  /**
   * Dispatch a log entry to all transports
   */
  dispatch(entry: LogEntry): void {
    for (const transport of this.transports.values()) {
      // Check if transport handles this log level
      if (transport.levels && !transport.levels.includes(entry.level)) {
        continue;
      }

      try {
        const result = transport.log(entry);
        // Handle async transports (don't await, fire-and-forget)
        if (result instanceof Promise) {
          result.catch((err) => {
            console.error(`[Logger] Transport "${transport.name}" error:`, err);
          });
        }
      } catch (err) {
        console.error(`[Logger] Transport "${transport.name}" error:`, err);
      }
    }
  }

  /**
   * Shutdown all transports gracefully
   */
  async shutdown(): Promise<void> {
    const closePromises: Promise<void>[] = [];

    for (const transport of this.transports.values()) {
      if (transport.close) {
        closePromises.push(Promise.resolve(transport.close()));
      }
    }

    await Promise.all(closePromises);
    this.transports.clear();
  }
}

/** Global transport registry */
export const logRegistry = new LogTransportRegistry();

// ===== Built-in Transports =====

/**
 * Console transport - outputs formatted text to stdout/stderr
 */
export function createConsoleTransport(): LogTransport {
  return {
    name: 'console',
    log(entry: LogEntry): void {
      const contextStr = entry.context ? ` ${JSON.stringify(entry.context)}` : '';
      const errorStr = entry.error ? ` [${entry.error.name || 'Error'}: ${entry.error.message}]` : '';
      const formatted = `${entry.timestamp} [${entry.prefix}] ${entry.message}${errorStr}${contextStr}`;

      switch (entry.level) {
        case 'debug':
          console.debug(formatted);
          break;
        case 'info':
          console.info(formatted);
          break;
        case 'warn':
          console.warn(formatted);
          break;
        case 'error':
          console.error(formatted);
          if (entry.error?.stack) {
            console.error(entry.error.stack);
          }
          break;
      }
    },
  };
}

/**
 * JSON transport - outputs newline-delimited JSON (pino-compatible)
 */
export function createJsonTransport(options?: {
  /** Custom output function (default: console.log) */
  output?: (json: string) => void;
  /** Pretty print JSON (default: false) */
  pretty?: boolean;
}): LogTransport {
  const output = options?.output || console.log;
  const pretty = options?.pretty || false;

  return {
    name: 'json',
    log(entry: LogEntry): void {
      let pid = 0;
      let hostname = 'browser';
      // Only access process in Node.js environment
      if (typeof globalThis !== 'undefined' && !('window' in globalThis)) {
        try {
          const proc = (globalThis as Record<string, unknown>).process as
            | { pid?: number; env?: { HOSTNAME?: string } }
            | undefined;
          pid = proc?.pid || 0;
          hostname = proc?.env?.HOSTNAME || 'unknown';
        } catch {
          // Fallback
        }
      }

      const record = {
        level: LOG_LEVELS[entry.level] * 10 + 10, // pino-style levels: 10, 20, 30, 40
        time: new Date(entry.timestamp).getTime(),
        pid,
        hostname,
        name: entry.prefix,
        msg: entry.message,
        ...entry.context,
        ...(entry.error && {
          err: {
            type: entry.error.name || 'Error',
            message: entry.error.message,
            stack: entry.error.stack,
          },
        }),
      };

      output(pretty ? JSON.stringify(record, null, 2) : JSON.stringify(record));
    },
  };
}

/**
 * Silent transport - discards all logs (useful for testing)
 */
export function createSilentTransport(): LogTransport {
  return {
    name: 'silent',
    log(): void {
      // Intentionally empty
    },
  };
}

/**
 * Buffer transport - stores logs in memory (useful for testing)
 */
export function createBufferTransport(): LogTransport & { entries: LogEntry[]; clear(): void } {
  const entries: LogEntry[] = [];

  return {
    name: 'buffer',
    entries,
    log(entry: LogEntry): void {
      entries.push(entry);
    },
    clear(): void {
      entries.length = 0;
    },
  };
}

// ===== Logger Factory =====

/**
 * Create a logger with a specific prefix
 */
export function createLogger(prefix: string): Logger {
  const log = (level: LogLevel, message: string, context?: LogContext, error?: Error): void => {
    if (!shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      prefix,
      message,
      context,
    };

    if (error) {
      entry.error = {
        message: error.message,
        stack: error.stack,
        name: error.name,
      };
    }

    logRegistry.dispatch(entry);
  };

  const logger: Logger = {
    debug(message: string, context?: LogContext): void {
      log('debug', message, context);
    },

    info(message: string, context?: LogContext): void {
      log('info', message, context);
    },

    warn(message: string, context?: LogContext): void {
      log('warn', message, context);
    },

    error(message: string, errorOrContext?: Error | LogContext, context?: LogContext): void {
      if (errorOrContext instanceof Error) {
        log('error', message, context, errorOrContext);
      } else {
        log('error', message, errorOrContext);
      }
    },

    child(childPrefix: string): Logger {
      return createLogger(`${prefix}:${childPrefix}`);
    },
  };

  return logger;
}

// ===== Database Transport =====

/**
 * Options for creating a database-backed transport
 */
export interface DatabaseTransportOptions {
  /** Function to insert log entry into database */
  insert: (entry: LogEntry) => void | Promise<void>;
  /** Optional: Filter which log levels this transport handles */
  levels?: LogLevel[];
}

/**
 * Database transport - persists logs to database via callback
 * Keeps logger package-agnostic while allowing server to inject persistence.
 */
export function createDatabaseTransport(options: DatabaseTransportOptions): LogTransport {
  return {
    name: 'database',
    levels: options.levels,
    log(entry: LogEntry): void | Promise<void> {
      return options.insert(entry);
    },
  };
}

/**
 * Persisted log entry with additional metadata
 */
export interface PersistedLogEntry extends LogEntry {
  id: string;
  source: 'server' | 'agent-bridge' | 'gateway' | 'huddle';
  createdAt: number;
}

// ===== Remote Transport =====

/**
 * Options for creating a remote transport that sends logs to server
 */
export interface RemoteTransportOptions {
  /** Server URL to send logs to (e.g., http://server:3000) */
  serverUrl: string;
  /** Source identifier for these logs */
  source: 'agent-bridge' | 'huddle' | 'gateway';
  /** API key for authentication (optional) */
  apiKey?: string;
  /** Batch size - flush when this many logs accumulated (default: 10) */
  batchSize?: number;
  /** Flush interval in ms (default: 5000) */
  flushInterval?: number;
  /** Optional: Filter which log levels this transport handles */
  levels?: LogLevel[];
}

/**
 * Remote transport - batches logs and sends to server via HTTP
 * Used by agent-bridge and huddle to send logs to Capybara server.
 */
export function createRemoteTransport(options: RemoteTransportOptions): LogTransport {
  const {
    serverUrl,
    source,
    apiKey,
    batchSize = 10,
    flushInterval = 5000,
    levels,
  } = options;

  const buffer: LogEntry[] = [];
  let flushTimer: ReturnType<typeof setTimeout> | null = null;

  const flush = async (): Promise<void> => {
    if (buffer.length === 0) return;

    const entries = buffer.splice(0, buffer.length);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (apiKey) {
        headers['x-api-key'] = apiKey;
      }

      // Use globalThis.fetch for browser/Node compatibility 
      const fetchFn = typeof fetch !== 'undefined' ? fetch : globalThis.fetch;
      await fetchFn(`${serverUrl}/api/logs`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ entries, source }),
      });
    } catch {
      // Silently drop logs on failure to avoid infinite loops
      // Could add retry logic here if needed
    }
  };

  const scheduleFlush = (): void => {
    if (flushTimer) return;
    flushTimer = setTimeout(() => {
      flushTimer = null;
      flush();
    }, flushInterval);
  };

  return {
    name: 'remote',
    levels,
    log(entry: LogEntry): void {
      buffer.push(entry);
      if (buffer.length >= batchSize) {
        flush();
      } else {
        scheduleFlush();
      }
    },
  };
}

// ===== Convenience Exports =====

/** Default application logger */
export const log = createLogger('App');
