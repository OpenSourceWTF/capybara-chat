/**
 * Socket Connection Manager (Server-side)
 *
 * Provides idempotent socket connection/disconnection logic for Socket.io SERVER.
 * Ensures only one bridge socket is connected at a time, automatically disconnecting
 * old sockets when a new one connects.
 *
 * This is the server-side equivalent of the bridge's SocketConnectionManager.
 *
 * Task: 195-socket-duplication-audit
 */

import type { Socket } from 'socket.io';
import { createLogger, now } from '@capybara-chat/types';

const log = createLogger('SocketConnectionManager');

/**
 * Server-side Socket Connection Manager
 *
 * Manages a single socket connection with automatic replacement/disconnection logic.
 * Use this for services that should only have ONE active socket at a time (like BridgeConnectionService).
 *
 * @example
 * const manager = new ServerSocketConnectionManager('BridgeConnection');
 *
 * // Connect new socket (automatically disconnects old if different)
 * manager.connect(socket, 'bridge-1', { uid: 1000, gid: 1000 });
 *
 * // Disconnect current socket
 * manager.disconnect();
 *
 * // Check connection status
 * if (manager.isConnected()) { ... }
 */
export class ServerSocketConnectionManager<TMetadata = Record<string, unknown>> {
  private socket: Socket | null = null;
  private metadata: TMetadata | null = null;
  private connectedAt: number | null = null;

  constructor(private serviceName: string) { }

  /**
   * Connect to a new socket.
   *
   * Automatically:
   * - Detects duplicate socket instances (same socket ID)
   * - Disconnects old socket if different socket ID
   * - Stores new socket and metadata
   *
   * @param socket - Socket.io server socket
   * @param socketId - Identifier for logging (e.g., bridge ID)
   * @param metadata - Optional metadata to store with connection
   */
  connect(socket: Socket, socketId: string, metadata?: TMetadata): void {
    // Detect duplicate/replacement
    if (this.socket) {
      if (this.socket.id === socket.id) {
        log.warn(`${this.serviceName}: Same socket reconnecting`, {
          socketId: socket.id,
          identifier: socketId,
        });
      } else {
        log.warn(`${this.serviceName}: Disconnecting old socket before connecting new`, {
          oldSocketId: this.socket.id,
          newSocketId: socket.id,
          identifier: socketId,
        });
        this.socket.disconnect();
      }
    } else {
      log.info(`${this.serviceName}: First connection`, {
        socketId: socket.id,
        identifier: socketId,
      });
    }

    // Store new connection
    this.socket = socket;
    this.metadata = metadata ?? null;
    this.connectedAt = now();
  }

  /**
   * Disconnect current socket
   *
   * @returns Metadata from disconnected connection (or null)
   */
  disconnect(): TMetadata | null {
    if (!this.socket) {
      log.debug(`${this.serviceName}: No connection to disconnect`);
      return null;
    }

    log.info(`${this.serviceName}: Disconnecting`, {
      socketId: this.socket.id,
      connectedDuration: this.connectedAt ? now() - this.connectedAt : null,
    });

    const savedMetadata = this.metadata;

    // Clear state
    this.socket = null;
    this.metadata = null;
    this.connectedAt = null;

    return savedMetadata;
  }

  /**
   * Check if currently connected
   */
  isConnected(): boolean {
    return this.socket !== null && this.socket.connected;
  }

  /**
   * Get current socket (or null if not connected)
   */
  getSocket(): Socket | null {
    return this.socket;
  }

  /**
   * Get connection metadata
   */
  getMetadata(): TMetadata | null {
    return this.metadata;
  }

  /**
   * Get connection info
   */
  getStatus(): {
    connected: boolean;
    socketId: string | null;
    connectedAt: number | null;
    metadata: TMetadata | null;
  } {
    return {
      connected: this.isConnected(),
      socketId: this.socket?.id ?? null,
      connectedAt: this.connectedAt,
      metadata: this.metadata,
    };
  }
}

/**
 * Create a server-side socket connection manager
 *
 * @param serviceName - Name of the service (for logging)
 * @returns Socket connection manager instance
 */
export function createServerSocketConnectionManager<TMetadata = Record<string, unknown>>(
  serviceName: string
): ServerSocketConnectionManager<TMetadata> {
  return new ServerSocketConnectionManager<TMetadata>(serviceName);
}
