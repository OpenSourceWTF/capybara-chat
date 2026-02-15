/**
 * Task Message Queue (090-task-resume)
 *
 * Manages per-session message queues for RUNNING task sessions.
 * When a user sends a message to a running task, it's queued here
 * instead of interrupting the active turn. The task executor drains
 * this queue after each turn completes.
 *
 * Separate from MessageQueueManager which handles general message flow.
 * This is specifically for the task resume feature with:
 * - Max queue size (10) to prevent memory issues
 * - Socket event emission for UI feedback
 * - FIFO processing at turn boundaries
 */

import { createLogger, SOCKET_EVENTS, type SocketEventPayloads } from '@capybara-chat/types';
import type { Socket } from 'socket.io-client';

const log = createLogger('TaskMessageQueue');

const MAX_QUEUE_SIZE = 10;

export interface QueuedTaskMessage {
  content: string;
  messageId: string;
  timestamp: number;
}

export class TaskMessageQueue {
  private queues: Map<string, QueuedTaskMessage[]> = new Map();
  private socket: Socket | null = null;
  /**
   * 144-timeout-fix: Callbacks to notify when messages are enqueued.
   * Used by task executor to reset idle timeout when user sends messages.
   */
  private enqueueCallbacks: Map<string, () => void> = new Map();

  /**
   * Set the socket for emitting events.
   * Called when bridge connects to server.
   */
  setSocket(socket: Socket): void {
    this.socket = socket;
  }

  /**
   * 144-timeout-fix: Register a callback to be called when a message is enqueued.
   * Used by task executor to reset idle timeout on user activity.
   *
   * @param sessionId - Session to watch for messages
   * @param callback - Function to call when a message is enqueued
   * @returns Cleanup function to remove the callback
   */
  onEnqueue(sessionId: string, callback: () => void): () => void {
    this.enqueueCallbacks.set(sessionId, callback);
    return () => {
      this.enqueueCallbacks.delete(sessionId);
    };
  }

  /**
   * Queue a message for a running task.
   * @returns true if queued successfully, false if queue is full
   */
  enqueue(sessionId: string, message: QueuedTaskMessage): boolean {
    const queue = this.queues.get(sessionId) || [];

    if (queue.length >= MAX_QUEUE_SIZE) {
      log.warn('Queue full, rejecting message', { sessionId, queueSize: queue.length });
      return false;
    }

    queue.push(message);
    this.queues.set(sessionId, queue);

    log.info('Message queued for running task', {
      sessionId,
      messageId: message.messageId,
      position: queue.length,
    });

    // Emit socket event for UI feedback
    if (this.socket) {
      const payload: SocketEventPayloads[typeof SOCKET_EVENTS.SESSION_MESSAGE_QUEUED] = {
        sessionId,
        messageId: message.messageId,
        position: queue.length,
        queueSize: queue.length,
      };
      this.socket.emit(SOCKET_EVENTS.SESSION_MESSAGE_QUEUED, payload);
    }

    // 144-timeout-fix: Notify task executor to reset idle timeout
    const callback = this.enqueueCallbacks.get(sessionId);
    if (callback) {
      log.debug('Calling enqueue callback for session', { sessionId });
      callback();
    }

    return true;
  }

  /**
   * Peek at the next message without removing it.
   */
  peek(sessionId: string): QueuedTaskMessage | undefined {
    return this.queues.get(sessionId)?.[0];
  }

  /**
   * Remove and return the next message (FIFO).
   */
  dequeue(sessionId: string): QueuedTaskMessage | undefined {
    const queue = this.queues.get(sessionId);
    if (!queue || queue.length === 0) return undefined;

    const message = queue.shift()!;

    if (queue.length === 0) {
      this.queues.delete(sessionId);
    }

    log.info('Message dequeued for processing', {
      sessionId,
      messageId: message.messageId,
      remaining: queue.length,
    });

    // Emit socket event for UI feedback
    if (this.socket) {
      const payload: SocketEventPayloads[typeof SOCKET_EVENTS.SESSION_MESSAGE_DEQUEUED] = {
        sessionId,
        messageId: message.messageId,
        remaining: queue.length,
      };
      this.socket.emit(SOCKET_EVENTS.SESSION_MESSAGE_DEQUEUED, payload);
    }

    return message;
  }

  /**
   * Get all queued messages and clear the queue.
   */
  drain(sessionId: string): QueuedTaskMessage[] {
    const queue = this.queues.get(sessionId) || [];
    this.queues.delete(sessionId);
    return queue;
  }

  /**
   * Check if there are messages waiting.
   */
  hasMessages(sessionId: string): boolean {
    return (this.queues.get(sessionId)?.length || 0) > 0;
  }

  /**
   * Get the number of queued messages.
   */
  getQueueSize(sessionId: string): number {
    return this.queues.get(sessionId)?.length || 0;
  }

  /**
   * Clear the queue for a session (e.g., on task failure/cancellation).
   */
  clear(sessionId: string): void {
    this.queues.delete(sessionId);
    this.enqueueCallbacks.delete(sessionId);
  }

  /**
   * Reset all state - for tests only!
   */
  reset(): void {
    this.queues.clear();
    this.enqueueCallbacks.clear();
  }
}

// Production singleton
let instance: TaskMessageQueue | null = null;

/**
 * Get the singleton instance (for production use)
 */
export function getTaskMessageQueue(): TaskMessageQueue {
  if (!instance) {
    instance = new TaskMessageQueue();
  }
  return instance;
}

/**
 * Reset the singleton - for tests only!
 */
export function resetTaskMessageQueue(): void {
  instance?.reset();
  instance = null;
}
