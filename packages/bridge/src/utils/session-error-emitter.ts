/**
 * Session Error Emitter Utility
 *
 * Consolidates the 3-event error emission pattern for session failures.
 * This pattern appears in multiple handlers and ensures consistent
 * error reporting to the UI.
 *
 * Consolidates duplicate emission from:
 * - message-handler.ts pipeline path (lines 348-375)
 * - message-handler.ts legacy path (lines 591-617)
 *
 * Events emitted:
 * 1. SESSION_HALTED - Visual indicator in UI
 * 2. SESSION_RESPONSE - Error message as system message
 * 3. MESSAGE_STATUS - Clear processing state in UI
 */

import type { Socket } from 'socket.io-client';
import { SOCKET_EVENTS, generateMessageId, now } from '@capybara-chat/types';
import type { HaltReason } from './error-formatter.js';

/**
 * Options for emitting session error events
 */
export interface SessionErrorOptions {
  /** Session ID */
  sessionId: string;
  /** Original message ID (if available) */
  messageId?: string;
  /** Formatted error message to display */
  errorMessage: string;
  /** Reason for the halt */
  haltReason: HaltReason;
  /** Whether the session can be resumed (default: true) */
  canResume?: boolean;
}

/**
 * Emit session error events to notify the UI of a failure.
 *
 * This function emits three events in sequence:
 * 1. SESSION_HALTED - Shows visual error indicator
 * 2. SESSION_RESPONSE - Displays error as system message
 * 3. MESSAGE_STATUS - Clears [BUSY]/[THINKING] indicator
 *
 * @param socket - Socket.io client instance
 * @param options - Error details to emit
 *
 * @example
 * ```typescript
 * const { message, haltReason } = formatCLIError(error);
 * emitSessionError(socket, {
 *   sessionId,
 *   messageId,
 *   errorMessage: message,
 *   haltReason,
 * });
 * ```
 */
export function emitSessionError(
  socket: Socket | null,
  options: SessionErrorOptions
): void {
  if (!socket) {
    return;
  }

  const {
    sessionId,
    messageId,
    errorMessage,
    haltReason,
    canResume = true,
  } = options;

  // 1. SESSION_HALTED - Visual indicator (189-session-failure-ui)
  socket.emit(SOCKET_EVENTS.SESSION_HALTED, {
    sessionId,
    reason: haltReason,
    errorMessage,
    canResume,
    timestamp: now(),
  });

  // 2. SESSION_RESPONSE - Error as system message
  socket.emit(SOCKET_EVENTS.SESSION_RESPONSE, {
    sessionId,
    messageId,
    message: {
      id: generateMessageId(),
      content: errorMessage,
      role: 'system',
      createdAt: now(),
    },
  });

  // 3. MESSAGE_STATUS - Clear processing state (196-session-status-sanity)
  // Without this, assistant sessions stay stuck showing [BUSY]/[THINKING]
  socket.emit(SOCKET_EVENTS.MESSAGE_STATUS, {
    sessionId,
    messageId: messageId || 'session-error',
    status: 'failed',
  });
}
