/**
 * BaseService - Abstract base class for stateful services with persistence
 * 
 * Provides automatic state persistence and hydration for services that
 * need to survive server restarts (especially in watch mode).
 * 
 * Usage:
 * ```typescript
 * export class MessageQueue extends BaseService<QueuedMessage[]> {
 *   constructor() {
 *     super('message-queue', []);
 *   }
 * 
 *   get persistableState(): QueuedMessage[] {
 *     return Array.from(this.queue.values());
 *   }
 * 
 *   protected hydrate(state: QueuedMessage[]): void {
 *     for (const msg of state) {
 *       this.queue.set(msg.messageId, msg);
 *     }
 *   }
 * }
 * ```
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { createLogger } from '../middleware/index.js';
import { type FileSystemAdapter, nodeFs } from '../adapters/file-system.js';

const log = createLogger('BaseService');

// Compute state directory path
// Priority:
// 1. STATE_DIR env var (explicit override)
// 2. Derive from DATABASE_PATH env var (Docker: /data/capybara.db → /data/state)
// 3. Fall back to project-relative path (local development)
function computeStateDir(): string {
  // Explicit override
  if (process.env.STATE_DIR) {
    return process.env.STATE_DIR;
  }

  // Derive from DATABASE_PATH (used in Docker)
  // DATABASE_PATH=/data/capybara.db → STATE_DIR=/data/state
  if (process.env.DATABASE_PATH) {
    const dbDir = path.dirname(process.env.DATABASE_PATH);
    return path.join(dbDir, 'state');
  }

  // Fall back to project-relative path (local development)
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const PROJECT_ROOT = path.join(__dirname, '../../../..');
  return path.join(PROJECT_ROOT, 'data', 'state');
}

/** State directory for persisted service state files (exported for tests) */
export const STATE_DIR = computeStateDir();

/**
 * Options for BaseService constructor
 */
export interface BaseServiceOptions {
  /** Custom file system adapter (for testing) */
  fs?: FileSystemAdapter;
  /** Skip auto-registration with ServiceRegistry (for testing) */
  skipRegistry?: boolean;
}

export abstract class BaseService<TState> {
  protected readonly serviceName: string;
  protected readonly defaultState: TState;
  protected readonly fs: FileSystemAdapter;
  private stateFile: string;
  private initialized = false;

  constructor(serviceName: string, defaultState: TState, options?: BaseServiceOptions) {
    this.serviceName = serviceName;
    this.defaultState = defaultState;
    this.fs = options?.fs ?? nodeFs;
    this.stateFile = path.join(STATE_DIR, `${serviceName}.json`);

    // Auto-register with registry (unless disabled for testing)
    if (!options?.skipRegistry) {
      ServiceRegistry.register(this);
    }
  }

  /**
   * Initialize the service - loads persisted state
   * Called automatically by ServiceRegistry.initializeAll()
   */
  init(): void {
    if (this.initialized) return;

    const state = this.loadState();
    if (state) {
      log.info(`[${this.serviceName}] Hydrating from persisted state`);
      this.hydrate(state);
    }

    this.initialized = true;
    log.info(`[${this.serviceName}] Initialized`);
  }

  /**
   * Get the current state to persist
   * Override this to return serializable state
   */
  abstract get persistableState(): TState;

  /**
   * Hydrate the service with loaded state
   * Override this to restore state from loaded data
   */
  protected abstract hydrate(state: TState): void;

  /**
   * Validate loaded state before hydration
   * Override for custom validation (e.g., filter expired entries)
   */
  protected validate(state: TState): TState {
    return state;
  }

  /**
   * Load state from disk
   */
  private loadState(): TState | null {
    if (!this.fs.existsSync(this.stateFile)) {
      return null;
    }

    try {
      const raw = this.fs.readFileSync(this.stateFile, 'utf-8');
      const parsed = JSON.parse(raw) as TState;
      return this.validate(parsed);
    } catch (error) {
      log.warn(`[${this.serviceName}] Failed to load state, using defaults`, { error: String(error) });
      return null;
    }
  }

  /**
   * Persist current state to disk
   * Called by ServiceRegistry.shutdown()
   */
  persist(): void {
    try {
      // Ensure state directory exists
      if (!this.fs.existsSync(STATE_DIR)) {
        this.fs.mkdirSync(STATE_DIR, { recursive: true });
      }

      const state = this.persistableState;
      this.fs.writeFileSync(this.stateFile, JSON.stringify(state, null, 2), 'utf-8');
      log.info(`[${this.serviceName}] State persisted`);
    } catch (error) {
      log.error(`[${this.serviceName}] Failed to persist state`, error as Error);
    }
  }

  /**
   * Cleanup hook for graceful shutdown
   * Override for service-specific cleanup (e.g., clear intervals)
   */
  shutdown(): void {
    this.persist();
  }
}

/**
 * ServiceRegistry - Coordinates service lifecycle
 * 
 * Responsibilities:
 * - Track all BaseService instances
 * - Initialize services on startup
 * - Persist state on shutdown
 * - Handle SIGTERM/SIGINT gracefully
 */
export class ServiceRegistry {
  private static services: BaseService<unknown>[] = [];
  private static shuttingDown = false;
  private static signalsRegistered = false;

  /**
   * Register a service (called automatically by BaseService constructor)
   */
  static register(service: BaseService<unknown>): void {
    this.services.push(service);
    this.registerSignals(); // Ensure signals are hooked
  }

  /**
   * Initialize all registered services
   * Call this once at server startup
   */
  static initializeAll(): void {
    log.info(`Initializing ${this.services.length} services`);
    for (const service of this.services) {
      try {
        service.init();
      } catch (error) {
        log.error(`Failed to initialize service`, error as Error);
      }
    }
  }

  /**
   * Gracefully shutdown all services
   */
  static async shutdown(): Promise<void> {
    if (this.shuttingDown) return;
    this.shuttingDown = true;

    log.info(`Shutting down ${this.services.length} services`);

    for (const service of this.services) {
      try {
        service.shutdown();
      } catch (error) {
        log.error(`Failed to shutdown service`, error as Error);
      }
    }

    log.info('All services shut down');
  }

  /**
   * Register process signal handlers
   */
  private static registerSignals(): void {
    if (this.signalsRegistered) return;
    this.signalsRegistered = true;

    const handleShutdown = async (signal: string) => {
      log.info(`Received ${signal}, initiating graceful shutdown`);
      await this.shutdown();
      process.exit(0);
    };

    process.on('SIGTERM', () => handleShutdown('SIGTERM'));
    process.on('SIGINT', () => handleShutdown('SIGINT'));

    // Also handle uncaught exceptions and unhandled rejections
    process.on('uncaughtException', async (error) => {
      log.error('Uncaught exception, shutting down', error);
      await this.shutdown();
      process.exit(1);
    });

    process.on('unhandledRejection', async (reason) => {
      log.error('Unhandled rejection, shutting down', reason as Error);
      await this.shutdown();
      process.exit(1);
    });

    log.info('Signal handlers registered for graceful shutdown');
  }

  /**
   * Get count of registered services (for monitoring)
   */
  static get count(): number {
    return this.services.length;
  }

  /**
   * Clear all services (for testing)
   */
  static clear(): void {
    this.services = [];
    this.shuttingDown = false;
  }
}
