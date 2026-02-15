/**
 * Socket Connection Manager
 *
 * Provides idempotent socket connection/disconnection logic with automatic
 * handler cleanup to prevent duplicate registrations.
 *
 * Use this for any service that needs to maintain a socket connection with
 * registered event handlers.
 *
 * Task: 195-socket-duplication-audit
 */

import type { Socket } from 'socket.io-client';
import { createLogger } from '@capybara-chat/types';
import { cleanupListeners, registerListeners, detectDuplicateSocket } from './socket-deduplication.js';

const log = createLogger('SocketConnectionManager');

/**
 * Handler registration for cleanup tracking
 */
export interface HandlerRegistration {
  event: string;
  handler: (...args: unknown[]) => void;
}

/**
 * Socket connection state
 */
interface SocketConnection {
  socket: Socket;
  handlers: HandlerRegistration[];
  cleanup?: () => void;
}

/**
 * Socket Connection Manager
 *
 * Manages socket connection lifecycle with automatic handler cleanup.
 *
 * @example
 * const manager = new SocketConnectionManager('MyService');
 *
 * // Connect with handlers
 * manager.connect(socket, [
 *   { event: 'my-event', handler: this.handleMyEvent },
 * ]);
 *
 * // Reconnect (automatically cleans up old handlers)
 * manager.connect(newSocket, [
 *   { event: 'my-event', handler: this.handleMyEvent },
 * ]);
 *
 * // Disconnect
 * manager.disconnect();
 */
export class SocketConnectionManager {
  private connection: SocketConnection | null = null;

  constructor(private serviceName: string) {}

  /**
   * Connect to a socket with event handlers.
   *
   * Automatically:
   * - Detects duplicate socket instances
   * - Disconnects old socket if different
   * - Cleans up old event handlers
   * - Registers new event handlers
   *
   * @param socket - Socket to connect to
   * @param handlers - Event handlers to register (optional)
   * @param cleanup - Optional cleanup function (e.g., for custom resources)
   */
  connect(
    socket: Socket,
    handlers?: HandlerRegistration[],
    cleanup?: () => void
  ): void {
    // Detect duplicate/replacement
    if (this.connection) {
      detectDuplicateSocket(this.connection.socket, socket, this.serviceName);

      // If different socket, disconnect old one
      if (this.connection.socket.id !== socket.id) {
        log.info(`${this.serviceName}: Disconnecting old socket before connecting new`, {
          oldSocketId: this.connection.socket.id,
          newSocketId: socket.id,
        });
        this.disconnect();
      } else {
        // Same socket, just clean up handlers
        log.debug(`${this.serviceName}: Reconnecting with same socket instance`);
        this.cleanupHandlers();
      }
    } else {
      log.info(`${this.serviceName}: First time connection`, {
        socketId: socket.id,
      });
    }

    // Register new handlers
    const registeredHandlers = handlers
      ? registerListeners(socket, handlers, this.serviceName)
      : [];

    // Store new connection
    this.connection = {
      socket,
      handlers: registeredHandlers,
      cleanup,
    };
  }

  /**
   * Disconnect from current socket.
   *
   * Automatically:
   * - Cleans up event handlers
   * - Calls custom cleanup function if provided
   * - Disconnects socket if still connected
   */
  disconnect(): void {
    if (!this.connection) {
      log.debug(`${this.serviceName}: No connection to disconnect`);
      return;
    }

    log.info(`${this.serviceName}: Disconnecting`, {
      socketId: this.connection.socket.id,
      hadHandlers: this.connection.handlers.length > 0,
      hadCleanup: !!this.connection.cleanup,
    });

    // Clean up handlers (this now also calls custom cleanup function)
    this.cleanupHandlers();

    // Disconnect socket if still connected
    if (this.connection.socket.connected) {
      this.connection.socket.disconnect();
    }

    this.connection = null;
  }

  /**
   * Check if currently connected
   */
  isConnected(): boolean {
    return this.connection !== null && this.connection.socket.connected;
  }

  /**
   * Get current socket (or null if not connected)
   */
  getSocket(): Socket | null {
    return this.connection?.socket ?? null;
  }

  /**
   * Internal: Clean up event handlers without disconnecting
   */
  private cleanupHandlers(): void {
    if (!this.connection) return;

    // Clean up tracked handlers
    cleanupListeners(
      this.connection.socket,
      this.connection.handlers,
      this.serviceName
    );

    this.connection.handlers = [];

    // DUPLICATION FIX: Also call custom cleanup function if provided
    // This ensures handlers registered outside socket manager are cleaned up on reconnect
    if (this.connection.cleanup) {
      log.debug(`${this.serviceName}: Calling custom cleanup function`);
      this.connection.cleanup();
      // Set to undefined after calling to prevent double-cleanup
      this.connection.cleanup = undefined;
    }
  }
}

/**
 * Create a socket connection manager for a service
 *
 * @param serviceName - Name of the service (for logging)
 * @returns Socket connection manager instance
 */
export function createSocketConnectionManager(serviceName: string): SocketConnectionManager {
  return new SocketConnectionManager(serviceName);
}
