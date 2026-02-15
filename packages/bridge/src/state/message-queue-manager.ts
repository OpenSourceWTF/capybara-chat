/**
 * Message Queue Manager
 *
 * Manages inbound/outbound message queues per session.
 * Extracted from bridge.ts for testability - enables isolated testing
 * with clean state reset between tests.
 */

import { generateMessageId, now, createLogger } from '@capybara-chat/types';

const log = createLogger('MessageQueueManager');

/**
 * Message queue for a single session
 */
export interface MessageQueue {
  inbound: Array<{ id: string; content: string; createdAt: number }>;
  outbound: Array<{ id: string; content: string; role?: string; createdAt: number }>;
}

/**
 * Manages message queues for all sessions.
 * Use getInstance() for production singleton, or new MessageQueueManager() for tests.
 */
export class MessageQueueManager {
  private queues = new Map<string, MessageQueue>();

  /**
   * Get or create a message queue for a session
   */
  getOrCreate(sessionId: string): MessageQueue {
    let queue = this.queues.get(sessionId);
    if (!queue) {
      queue = { inbound: [], outbound: [] };
      this.queues.set(sessionId, queue);
      log.debug('Created message queue', { sessionId });
    }
    return queue;
  }

  /**
   * Get queue if it exists, undefined otherwise
   */
  get(sessionId: string): MessageQueue | undefined {
    return this.queues.get(sessionId);
  }

  /**
   * Check if queue exists for session
   */
  has(sessionId: string): boolean {
    return this.queues.has(sessionId);
  }

  /**
   * Delete queue for session
   */
  delete(sessionId: string): boolean {
    return this.queues.delete(sessionId);
  }

  /**
   * Add inbound message (user → Claude)
   */
  addInbound(sessionId: string, content: string): { id: string; content: string; createdAt: number } {
    const queue = this.getOrCreate(sessionId);
    const message = {
      id: generateMessageId(),
      content,
      createdAt: now(),
    };
    queue.inbound.push(message);
    return message;
  }

  /**
   * Add outbound message (Claude → user)
   */
  addOutbound(
    sessionId: string,
    content: string,
    role: string = 'assistant',
    id?: string,
    createdAt?: number
  ): { id: string; content: string; role: string; createdAt: number } {
    const queue = this.getOrCreate(sessionId);
    const message = {
      id: id || generateMessageId(),
      content,
      role,
      createdAt: createdAt || now(),
    };
    queue.outbound.push(message);
    return message;
  }

  /**
   * Get and clear outbound messages
   */
  popOutbound(sessionId: string): Array<{ id: string; content: string; role?: string; createdAt: number }> {
    const queue = this.queues.get(sessionId);
    if (!queue) return [];
    const messages = [...queue.outbound];
    queue.outbound = [];
    return messages;
  }

  /**
   * Get all session IDs with queues
   */
  getSessionIds(): string[] {
    return Array.from(this.queues.keys());
  }

  /**
   * Reset all state - for tests only!
   */
  reset(): void {
    this.queues.clear();
  }
}

// Production singleton
let instance: MessageQueueManager | null = null;

/**
 * Get the singleton instance (for production use)
 */
export function getMessageQueueManager(): MessageQueueManager {
  if (!instance) {
    instance = new MessageQueueManager();
  }
  return instance;
}

/**
 * Reset the singleton - for tests only!
 */
export function resetMessageQueueManager(): void {
  instance?.reset();
  instance = null;
}
