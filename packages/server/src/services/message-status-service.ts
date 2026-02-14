/**
 * Message Status Service
 *
 * 194-socket-refactor: Centralized message status management.
 * Eliminates duplication of updateStatus + emit MESSAGE_STATUS pattern.
 *
 * 032-multitenancy: Uses ScopedSocketEmitter for session-owner routing.
 */

import { SOCKET_EVENTS, MessageStatus } from '@capybara-chat/types';
import type { SQLiteMessageRepository } from '../repositories/message-repository.js';
import type { ScopedSocketEmitter } from './scoped-socket-emitter.js';
import { createLogger } from '../middleware/index.js';

const log = createLogger('MessageStatusService');

export interface MessageStatusServiceDeps {
  messageRepo: SQLiteMessageRepository;
  emitter: ScopedSocketEmitter;
}

/**
 * Centralized service for updating message status.
 * Combines DB update + scoped socket emission into single atomic operation.
 */
export class MessageStatusService {
  private messageRepo: SQLiteMessageRepository;
  private emitter: ScopedSocketEmitter;

  constructor(deps: MessageStatusServiceDeps) {
    this.messageRepo = deps.messageRepo;
    this.emitter = deps.emitter;
  }

  /**
   * Update message status in DB and notify session owner via socket.
   *
   * @param sessionId - Session containing the message
   * @param messageId - Message to update
   * @param status - New status
   * @param error - Optional error message (for failed status)
   * @param metadata - Optional additional data to emit with status
   */
  updateAndEmit(
    sessionId: string,
    messageId: string,
    status: MessageStatus | string,
    error?: string,
    metadata?: Record<string, unknown>
  ): void {
    try {
      // Update DB
      this.messageRepo.updateStatus(messageId, status as MessageStatus);

      // Emit to session owner
      this.emitter.toSessionOwner(sessionId, SOCKET_EVENTS.MESSAGE_STATUS, {
        sessionId,
        messageId,
        status,
        ...(error && { error }),
        ...metadata,
      });

      log.debug('Message status updated and emitted', {
        sessionId,
        messageId,
        status,
        hasError: !!error,
      });
    } catch (err) {
      log.error('Failed to update message status', {
        error: err instanceof Error ? err.message : String(err),
        sessionId,
        messageId,
        status,
      });
      throw err;
    }
  }

  /**
   * Convenience method for marking message as completed.
   */
  markCompleted(sessionId: string, messageId: string): void {
    this.updateAndEmit(sessionId, messageId, MessageStatus.COMPLETED);
  }

  /**
   * Convenience method for marking message as failed.
   */
  markFailed(sessionId: string, messageId: string, error: string): void {
    this.updateAndEmit(sessionId, messageId, MessageStatus.FAILED, error);
  }

  /**
   * Convenience method for marking message as queued.
   */
  markQueued(sessionId: string, messageId: string, metadata?: Record<string, unknown>): void {
    this.updateAndEmit(sessionId, messageId, MessageStatus.QUEUED, undefined, metadata);
  }

  /**
   * Convenience method for marking message as sent (orphan recovery).
   */
  markSent(sessionId: string, messageId: string): void {
    this.updateAndEmit(sessionId, messageId, MessageStatus.SENT);
  }
}
