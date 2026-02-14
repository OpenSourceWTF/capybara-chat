/**
 * MessageQueue - Queue messages for retry when bridge is offline
 * 
 * Extends BaseService for automatic state persistence across server restarts.
 * When bridge comes online, queued messages are automatically sent.
 */

import type { Server as SocketServer } from 'socket.io';
import { SOCKET_EVENTS, now, MessageStatus } from '@capybara-chat/types';
import { BaseService } from './base-service.js';
import { createLogger } from '../middleware/index.js';
import type { MessageStatusService } from './message-status-service.js';
import type { ScopedSocketEmitter } from './scoped-socket-emitter.js';

const log = createLogger('MessageQueue');

interface QueuedMessage {
  sessionId: string;
  messageId: string;
  content: string;
  type?: string;
  queuedAt: number;
  retryCount: number;
}

interface MessageQueueConfig {
  maxRetries: number;
  retryDelayMs: number;
  maxQueueSize: number;
  messageTtlMs: number;
}

const DEFAULT_CONFIG: MessageQueueConfig = {
  maxRetries: 3,
  retryDelayMs: 1000,
  maxQueueSize: 10000,
  messageTtlMs: 60 * 60 * 1000, // 1 hour
};

export class MessageQueue extends BaseService<QueuedMessage[]> {
  private queue: Map<string, QueuedMessage> = new Map(); // messageId -> QueuedMessage
  private io: SocketServer | null = null;
  private messageRepo: { updateStatus: (id: string, status: MessageStatus) => boolean } | null = null;
  private messageStatusService: MessageStatusService | null = null;
  private emitter: ScopedSocketEmitter | null = null;
  private config: MessageQueueConfig;

  constructor(config: Partial<MessageQueueConfig> = {}) {
    super('message-queue', []);
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ===== BaseService Implementation =====

  /**
   * Get current queue state for persistence
   */
  get persistableState(): QueuedMessage[] {
    return Array.from(this.queue.values());
  }

  /**
   * Restore queue from persisted state
   */
  protected hydrate(state: QueuedMessage[]): void {
    for (const msg of state) {
      this.queue.set(msg.messageId, msg);
    }
    log.info('Hydrated message queue', { count: this.queue.size });
  }

  /**
   * Validate loaded state - filter out expired messages
   */
  protected validate(state: QueuedMessage[]): QueuedMessage[] {
    const cutoff = now() - this.config.messageTtlMs;
    const valid = state.filter(msg => msg.queuedAt > cutoff);
    if (valid.length < state.length) {
      log.info('Filtered expired messages during validation', {
        expired: state.length - valid.length,
        remaining: valid.length
      });
    }
    return valid;
  }

  /**
   * Remove expired messages from the queue
   */
  private cleanupExpired(): number {
    const cutoff = now() - this.config.messageTtlMs;
    let removed = 0;

    for (const [messageId, msg] of this.queue.entries()) {
      if (msg.queuedAt < cutoff) {
        this.markFailed(msg, 'Message expired (TTL exceeded)');
        this.queue.delete(messageId);
        removed++;
      }
    }

    if (removed > 0) {
      log.info('Cleaned up expired messages', { removed, remaining: this.queue.size });
    }
    return removed;
  }

  // ===== Service Methods =====

  /**
   * Initialize with socket.io server and message repository
   * 194-socket-refactor: Added MessageStatusService for centralized status updates
   */
  initDeps(
    io: SocketServer,
    messageRepo: { updateStatus: (id: string, status: MessageStatus) => boolean } | null,
    messageStatusService: MessageStatusService | null = null,
    emitter: ScopedSocketEmitter | null = null,
  ) {
    this.io = io;
    this.messageRepo = messageRepo;
    this.messageStatusService = messageStatusService;
    this.emitter = emitter;
  }

  /**
   * Add a message to the queue when bridge is offline.
   * Enforces queue size limits and cleans up expired messages if needed.
   *
   * @returns The queued message, or null if queue is full and cannot be cleaned
   */
  enqueue(data: { sessionId: string; messageId: string; content: string; type?: string }): QueuedMessage | null {
    // If queue is at limit, try to cleanup expired messages first
    if (this.queue.size >= this.config.maxQueueSize) {
      const cleaned = this.cleanupExpired();
      if (cleaned === 0 && this.queue.size >= this.config.maxQueueSize) {
        log.warn('Queue full, rejecting message', {
          messageId: data.messageId,
          queueSize: this.queue.size,
          maxQueueSize: this.config.maxQueueSize
        });
        // 194-socket-refactor: Use MessageStatusService for centralized status updates
        if (this.messageStatusService) {
          this.messageStatusService.markFailed(
            data.sessionId,
            data.messageId,
            'Message queue is full. Please try again later.'
          );
        } else if (this.emitter) {
          // 032-multitenancy: scoped fallback to session owner
          this.emitter.toSessionOwner(data.sessionId, SOCKET_EVENTS.MESSAGE_STATUS, {
            sessionId: data.sessionId,
            messageId: data.messageId,
            status: 'failed',
            error: 'Message queue is full. Please try again later.',
          });
        }
        return null;
      }
    }

    const msg: QueuedMessage = {
      sessionId: data.sessionId,
      messageId: data.messageId,
      content: data.content,
      type: data.type,
      queuedAt: now(),
      retryCount: 0,
    };

    this.queue.set(data.messageId, msg);
    log.info('Message queued', { messageId: data.messageId, sessionId: data.sessionId, queueSize: this.queue.size });

    // 194-socket-refactor: Use MessageStatusService for centralized status updates
    if (this.messageStatusService) {
      this.messageStatusService.updateAndEmit(
        data.sessionId,
        data.messageId,
        MessageStatus.PENDING,
        undefined,
        { queuePosition: this.getQueuePosition(data.messageId) }
      );
    } else {
      // Fallback for backward compatibility (032-multitenancy: scoped to session owner)
      if (this.messageRepo) {
        this.messageRepo.updateStatus(data.messageId, MessageStatus.PENDING);
      }
      if (this.emitter) {
        this.emitter.toSessionOwner(data.sessionId, SOCKET_EVENTS.MESSAGE_STATUS, {
          sessionId: data.sessionId,
          messageId: data.messageId,
          status: 'pending',
          queuePosition: this.getQueuePosition(data.messageId),
        });
      }
    }

    return msg;
  }

  /**
   * Process all queued messages when bridge comes online
   */
  processQueue(bridgeSocket: { emit: (event: string, data: unknown) => void }) {
    if (this.queue.size === 0) {
      log.debug('Queue is empty, nothing to process');
      return;
    }

    log.info('Processing message queue', { queueSize: this.queue.size });

    // Sort by queuedAt (FIFO)
    const sortedMessages = Array.from(this.queue.values())
      .sort((a, b) => a.queuedAt - b.queuedAt);

    for (const msg of sortedMessages) {
      if (msg.retryCount >= this.config.maxRetries) {
        // Max retries exceeded - mark as failed
        log.warn('Message exceeded max retries', { messageId: msg.messageId, retryCount: msg.retryCount });
        this.markFailed(msg, 'Max retries exceeded');
        this.queue.delete(msg.messageId);
        continue;
      }

      // Attempt to send
      try {
        bridgeSocket.emit(SOCKET_EVENTS.SESSION_MESSAGE, {
          sessionId: msg.sessionId,
          messageId: msg.messageId,
          content: msg.content,
          type: msg.type,
        });

        log.info('Sent queued message to bridge', { messageId: msg.messageId, retryCount: msg.retryCount + 1 });

        // 194-socket-refactor: Use MessageStatusService for centralized status updates
        if (this.messageStatusService) {
          this.messageStatusService.markQueued(msg.sessionId, msg.messageId);
        } else {
          // Fallback for backward compatibility (032-multitenancy: scoped to session owner)
          if (this.messageRepo) {
            this.messageRepo.updateStatus(msg.messageId, MessageStatus.QUEUED);
          }
          if (this.emitter) {
            this.emitter.toSessionOwner(msg.sessionId, SOCKET_EVENTS.MESSAGE_STATUS, {
              sessionId: msg.sessionId,
              messageId: msg.messageId,
              status: 'queued',
            });
          }
        }

        // Emit SESSION_MESSAGE event (032-multitenancy: scoped to session owner)
        if (this.emitter) {
          this.emitter.toSessionOwner(msg.sessionId, SOCKET_EVENTS.SESSION_MESSAGE, { sessionId: msg.sessionId });
        }

        // Remove from queue (successfully sent)
        this.queue.delete(msg.messageId);

      } catch (error) {
        log.error('Failed to send queued message', { messageId: msg.messageId, error });
        msg.retryCount++;
      }
    }
  }

  /**
   * Mark a message as failed
   * 194-socket-refactor: Use MessageStatusService for centralized status updates
   */
  private markFailed(msg: QueuedMessage, error: string) {
    if (this.messageStatusService) {
      this.messageStatusService.markFailed(msg.sessionId, msg.messageId, error);
    } else {
      // Fallback for backward compatibility (032-multitenancy: scoped to session owner)
      if (this.messageRepo) {
        this.messageRepo.updateStatus(msg.messageId, MessageStatus.FAILED);
      }
      if (this.emitter) {
        this.emitter.toSessionOwner(msg.sessionId, SOCKET_EVENTS.MESSAGE_STATUS, {
          sessionId: msg.sessionId,
          messageId: msg.messageId,
          status: 'failed',
          error,
        });
      }
    }
  }

  /**
   * Get queue position for a message (1-indexed)
   */
  getQueuePosition(messageId: string): number {
    const sorted = Array.from(this.queue.values())
      .sort((a, b) => a.queuedAt - b.queuedAt);

    const index = sorted.findIndex(m => m.messageId === messageId);
    return index === -1 ? 0 : index + 1;
  }

  /**
   * Get current queue size
   */
  get size(): number {
    return this.queue.size;
  }

  /**
   * Check if a message is in the queue
   */
  has(messageId: string): boolean {
    return this.queue.has(messageId);
  }

  /**
   * Remove a message from the queue (e.g., user cancelled)
   */
  remove(messageId: string): boolean {
    return this.queue.delete(messageId);
  }

  /**
   * Get all queued message IDs for a session
   */
  getSessionMessages(sessionId: string): string[] {
    return Array.from(this.queue.values())
      .filter(m => m.sessionId === sessionId)
      .map(m => m.messageId);
  }

  /**
   * Get queue statistics for monitoring
   */
  getStats(): {
    size: number;
    maxSize: number;
    utilizationPercent: number;
    oldestMessageAge: number | null;
    config: MessageQueueConfig;
  } {
    const messages = Array.from(this.queue.values());
    const oldestMessage = messages.reduce(
      (oldest, msg) => (!oldest || msg.queuedAt < oldest.queuedAt ? msg : oldest),
      null as QueuedMessage | null
    );

    return {
      size: this.queue.size,
      maxSize: this.config.maxQueueSize,
      utilizationPercent: Math.round((this.queue.size / this.config.maxQueueSize) * 100),
      oldestMessageAge: oldestMessage ? now() - oldestMessage.queuedAt : null,
      config: { ...this.config },
    };
  }

  /**
   * Manually trigger cleanup of expired messages
   */
  runCleanup(): number {
    return this.cleanupExpired();
  }
}

/**
 * Create a new MessageQueue instance with dependencies.
 * Preferred for new code - provides proper dependency injection.
 *
 * @param io - Socket.io server for emitting status updates
 * @param messageRepo - Repository for updating message status
 * @param messageStatusService - Optional service for centralized status updates (194-socket-refactor)
 * @param config - Optional configuration overrides
 */
export function createMessageQueue(
  io: SocketServer,
  messageRepo: { updateStatus: (id: string, status: MessageStatus) => boolean } | null,
  messageStatusService: MessageStatusService | null = null,
  config?: Partial<MessageQueueConfig>
): MessageQueue {
  const queue = new MessageQueue(config);
  queue.initDeps(io, messageRepo, messageStatusService);
  return queue;
}

/**
 * Singleton instance for backward compatibility.
 * Note: Requires initDeps() to be called before use.
 * For new code, prefer createMessageQueue() with proper dependency injection.
 */
export const messageQueue = new MessageQueue();
