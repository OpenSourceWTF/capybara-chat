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
};
// ===== Log Level Management =====
const LOG_LEVELS = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};
function getEnvLogLevel() {
    // Check for browser environment
    if (typeof globalThis !== 'undefined' && 'window' in globalThis) {
        return 'info';
    }
    try {
        // Node.js environment - use globalThis to avoid direct process reference
        const proc = globalThis.process;
        const level = proc?.env?.LOG_LEVEL;
        if (level && ['debug', 'info', 'warn', 'error'].includes(level)) {
            return level;
        }
    }
    catch {
        // Fallback
    }
    return 'info';
}
let globalLogLevel = getEnvLogLevel();
/**
 * Set the global minimum log level
 */
export function setLogLevel(level) {
    globalLogLevel = level;
}
/**
 * Get the current global log level
 */
export function getLogLevel() {
    return globalLogLevel;
}
function shouldLog(level) {
    return LOG_LEVELS[level] >= LOG_LEVELS[globalLogLevel];
}
// ===== Transport Registry =====
class LogTransportRegistry {
    transports = new Map();
    initialized = false;
    constructor() {
        // Add default console transport
        this.addTransport(createConsoleTransport());
    }
    /**
     * Add a transport to the registry
     */
    async addTransport(transport) {
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
    async removeTransport(name) {
        const transport = this.transports.get(name);
        if (!transport)
            return false;
        if (transport.close) {
            await transport.close();
        }
        return this.transports.delete(name);
    }
    /**
     * Get a transport by name
     */
    getTransport(name) {
        return this.transports.get(name);
    }
    /**
     * List all registered transports
     */
    listTransports() {
        return Array.from(this.transports.keys());
    }
    /**
     * Clear all transports (useful for testing)
     */
    async clearTransports() {
        for (const name of this.transports.keys()) {
            await this.removeTransport(name);
        }
    }
    /**
     * Dispatch a log entry to all transports
     */
    dispatch(entry) {
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
            }
            catch (err) {
                console.error(`[Logger] Transport "${transport.name}" error:`, err);
            }
        }
    }
    /**
     * Shutdown all transports gracefully
     */
    async shutdown() {
        const closePromises = [];
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
export function createConsoleTransport() {
    return {
        name: 'console',
        log(entry) {
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
export function createJsonTransport(options) {
    const output = options?.output || console.log;
    const pretty = options?.pretty || false;
    return {
        name: 'json',
        log(entry) {
            let pid = 0;
            let hostname = 'browser';
            // Only access process in Node.js environment
            if (typeof globalThis !== 'undefined' && !('window' in globalThis)) {
                try {
                    const proc = globalThis.process;
                    pid = proc?.pid || 0;
                    hostname = proc?.env?.HOSTNAME || 'unknown';
                }
                catch {
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
export function createSilentTransport() {
    return {
        name: 'silent',
        log() {
            // Intentionally empty
        },
    };
}
/**
 * Buffer transport - stores logs in memory (useful for testing)
 */
export function createBufferTransport() {
    const entries = [];
    return {
        name: 'buffer',
        entries,
        log(entry) {
            entries.push(entry);
        },
        clear() {
            entries.length = 0;
        },
    };
}
// ===== Logger Factory =====
/**
 * Create a logger with a specific prefix
 */
export function createLogger(prefix) {
    const log = (level, message, context, error) => {
        if (!shouldLog(level))
            return;
        const entry = {
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
    const logger = {
        debug(message, context) {
            log('debug', message, context);
        },
        info(message, context) {
            log('info', message, context);
        },
        warn(message, context) {
            log('warn', message, context);
        },
        error(message, errorOrContext, context) {
            if (errorOrContext instanceof Error) {
                log('error', message, context, errorOrContext);
            }
            else {
                log('error', message, errorOrContext);
            }
        },
        child(childPrefix) {
            return createLogger(`${prefix}:${childPrefix}`);
        },
    };
    return logger;
}
/**
 * Database transport - persists logs to database via callback
 * Keeps logger package-agnostic while allowing server to inject persistence.
 */
export function createDatabaseTransport(options) {
    return {
        name: 'database',
        levels: options.levels,
        log(entry) {
            return options.insert(entry);
        },
    };
}
/**
 * Remote transport - batches logs and sends to server via HTTP
 * Used by agent-bridge and huddle to send logs to Capybara server.
 */
export function createRemoteTransport(options) {
    const { serverUrl, source, apiKey, batchSize = 10, flushInterval = 5000, levels, } = options;
    const buffer = [];
    let flushTimer = null;
    const flush = async () => {
        if (buffer.length === 0)
            return;
        const entries = buffer.splice(0, buffer.length);
        try {
            const headers = {
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
        }
        catch {
            // Silently drop logs on failure to avoid infinite loops
            // Could add retry logic here if needed
        }
    };
    const scheduleFlush = () => {
        if (flushTimer)
            return;
        flushTimer = setTimeout(() => {
            flushTimer = null;
            flush();
        }, flushInterval);
    };
    return {
        name: 'remote',
        levels,
        log(entry) {
            buffer.push(entry);
            if (buffer.length >= batchSize) {
                flush();
            }
            else {
                scheduleFlush();
            }
        },
    };
}
// ===== Convenience Exports =====
/** Default application logger */
export const log = createLogger('App');
//# sourceMappingURL=logger.js.map