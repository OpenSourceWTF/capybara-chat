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
export declare const LogLevel: {
    readonly DEBUG: "debug";
    readonly INFO: "info";
    readonly WARN: "warn";
    readonly ERROR: "error";
};
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
/**
 * Set the global minimum log level
 */
export declare function setLogLevel(level: LogLevel): void;
/**
 * Get the current global log level
 */
export declare function getLogLevel(): LogLevel;
declare class LogTransportRegistry {
    private transports;
    private initialized;
    constructor();
    /**
     * Add a transport to the registry
     */
    addTransport(transport: LogTransport): Promise<void>;
    /**
     * Remove a transport by name
     */
    removeTransport(name: string): Promise<boolean>;
    /**
     * Get a transport by name
     */
    getTransport(name: string): LogTransport | undefined;
    /**
     * List all registered transports
     */
    listTransports(): string[];
    /**
     * Clear all transports (useful for testing)
     */
    clearTransports(): Promise<void>;
    /**
     * Dispatch a log entry to all transports
     */
    dispatch(entry: LogEntry): void;
    /**
     * Shutdown all transports gracefully
     */
    shutdown(): Promise<void>;
}
/** Global transport registry */
export declare const logRegistry: LogTransportRegistry;
/**
 * Console transport - outputs formatted text to stdout/stderr
 */
export declare function createConsoleTransport(): LogTransport;
/**
 * JSON transport - outputs newline-delimited JSON (pino-compatible)
 */
export declare function createJsonTransport(options?: {
    /** Custom output function (default: console.log) */
    output?: (json: string) => void;
    /** Pretty print JSON (default: false) */
    pretty?: boolean;
}): LogTransport;
/**
 * Silent transport - discards all logs (useful for testing)
 */
export declare function createSilentTransport(): LogTransport;
/**
 * Buffer transport - stores logs in memory (useful for testing)
 */
export declare function createBufferTransport(): LogTransport & {
    entries: LogEntry[];
    clear(): void;
};
/**
 * Create a logger with a specific prefix
 */
export declare function createLogger(prefix: string): Logger;
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
export declare function createDatabaseTransport(options: DatabaseTransportOptions): LogTransport;
/**
 * Persisted log entry with additional metadata
 */
export interface PersistedLogEntry extends LogEntry {
    id: string;
    source: 'server' | 'agent-bridge' | 'gateway' | 'huddle';
    createdAt: number;
}
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
export declare function createRemoteTransport(options: RemoteTransportOptions): LogTransport;
/** Default application logger */
export declare const log: Logger;
export {};
//# sourceMappingURL=logger.d.ts.map