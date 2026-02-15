/**
 * Socket Deduplication Utilities
 *
 * Provides consistent patterns for managing socket connections and preventing
 * duplicate event handler registration.
 *
 * Two patterns:
 * 1. Listener Services: Register socket.on() handlers → MUST clean up on reconnect
 * 2. Emit-Only Services: Only call socket.emit() → No cleanup needed
 *
 * Context: Socket.io client reuses the same socket instance on reconnect, so calling
 * setSocket() multiple times with the same instance would create duplicate handlers.
 *
 * Task: 195-socket-duplication-audit
 */

import type { Socket } from 'socket.io-client';
import { createLogger } from '@capybara-chat/types';

const log = createLogger('SocketDedup');

/**
 * Event handler cleanup tracker
 */
interface HandlerRegistration {
  event: string;
  handler: (...args: unknown[]) => void;
}

/**
 * Pattern 1: Service that registers event listeners
 *
 * Use this when your service calls socket.on() to listen for events.
 * This ensures old listeners are removed before registering new ones.
 *
 * @example
 * class MyService {
 *   private socket: Socket | null = null;
 *   private handlers: HandlerRegistration[] = [];
 *
 *   setSocket(socket: Socket): void {
 *     cleanupListeners(this.socket, this.handlers, 'MyService');
 *     this.socket = socket;
 *     this.handlers = registerListeners(socket, [
 *       { event: 'my-event', handler: this.handleMyEvent },
 *     ], 'MyService');
 *   }
 *
 *   private handleMyEvent = (data: unknown) => { ... };
 * }
 */

/**
 * Remove all registered listeners from a socket
 *
 * @param socket - Socket to clean up (null = no-op)
 * @param handlers - Handler registrations to remove
 * @param serviceName - Service name for logging
 */
export function cleanupListeners(
  socket: Socket | null,
  handlers: HandlerRegistration[],
  serviceName: string
): void {
  if (!socket || handlers.length === 0) return;

  log.debug(`Cleaning up ${handlers.length} listeners for ${serviceName}`, {
    events: handlers.map(h => h.event),
  });

  for (const { event, handler } of handlers) {
    socket.off(event, handler);
  }
}

/**
 * Register event listeners on a socket
 *
 * @param socket - Socket to register on
 * @param handlers - Handler registrations to add
 * @param serviceName - Service name for logging
 * @returns Handler registrations (store these for cleanup)
 */
export function registerListeners(
  socket: Socket,
  handlers: HandlerRegistration[],
  serviceName: string
): HandlerRegistration[] {
  log.debug(`Registering ${handlers.length} listeners for ${serviceName}`, {
    events: handlers.map(h => h.event),
  });

  for (const { event, handler } of handlers) {
    socket.on(event, handler);
  }

  return handlers;
}

/**
 * Pattern 2: Service that only emits events
 *
 * Use this when your service only calls socket.emit() and never socket.on().
 * No cleanup needed for emit-only services.
 *
 * @example
 * class MyEmitOnlyService {
 *   private socket: Socket | null = null;
 *
 *   setSocket(socket: Socket | null): void {
 *     this.socket = socket;
 *   }
 *
 *   doSomething(): void {
 *     this.socket?.emit('my-event', { data: 'foo' });
 *   }
 * }
 */

// No utility needed for Pattern 2 - just assign socket directly

/**
 * Detect if setSocket is being called with the same socket instance
 * (useful for debugging reconnection issues)
 *
 * @param oldSocket - Previously stored socket
 * @param newSocket - New socket being set
 * @param serviceName - Service name for logging
 */
export function detectDuplicateSocket(
  oldSocket: Socket | null,
  newSocket: Socket,
  serviceName: string
): void {
  if (oldSocket && oldSocket.id === newSocket.id) {
    log.warn(`${serviceName}.setSocket() called with same socket instance (reconnect)`, {
      socketId: newSocket.id,
      connected: newSocket.connected,
    });
  } else if (oldSocket) {
    log.info(`${serviceName}.setSocket() called with different socket`, {
      oldSocketId: oldSocket.id,
      newSocketId: newSocket.id,
      oldConnected: oldSocket.connected,
      newConnected: newSocket.connected,
    });
  } else {
    log.info(`${serviceName}.setSocket() called for first time`, {
      socketId: newSocket.id,
      connected: newSocket.connected,
    });
  }
}
