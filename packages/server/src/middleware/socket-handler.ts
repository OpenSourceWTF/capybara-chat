/**
 * Socket Handler Middleware
 *
 * Provides standardized error handling for Socket.io event handlers.
 * Ensures consistent error logging and client notification.
 */

import type { Socket } from 'socket.io';
import { createLogger, SOCKET_EVENTS } from '@capybara-chat/types';

const log = createLogger('SocketHandler');

/**
 * Options for the socket handler wrapper.
 */
export interface SocketHandlerOptions {
  /** Event name for logging purposes */
  eventName: string;
  /** Whether to emit error back to client (default: true) */
  emitError?: boolean;
  /** Custom error event name (default: SOCKET_EVENTS.SESSION_ERROR) */
  errorEvent?: string;
}

/**
 * Wraps a socket event handler with standardized error handling.
 *
 * - Catches synchronous and asynchronous errors
 * - Logs errors with context
 * - Optionally emits error back to the client
 *
 * @example
 * ```typescript
 * socket.on(SOCKET_EVENTS.SESSION_SEND, socketHandler(socket, {
 *   eventName: 'SESSION_SEND',
 * }, async (data) => {
 *   await processMessage(data);
 * }));
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function socketHandler<T = any>(
  socket: Socket,
  options: SocketHandlerOptions,
  handler: (data: T) => Promise<void> | void
): (data: T) => void {
  const { eventName, emitError = true, errorEvent = SOCKET_EVENTS.SESSION_ERROR } = options;

  return (data: T) => {
    const handleError = (err: unknown) => {
      const error = err instanceof Error ? err : new Error(String(err));
      log.error(`Socket handler failed: ${eventName}`, error, {
        socketId: socket.id,
      });

      if (emitError) {
        socket.emit(errorEvent, {
          error: error.message,
          event: eventName,
        });
      }
    };

    try {
      const result = handler(data);

      if (result instanceof Promise) {
        result.catch(handleError);
      }
    } catch (err: unknown) {
      handleError(err);
    }
  };
}
