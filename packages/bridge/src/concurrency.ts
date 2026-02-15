/**
 * Session Concurrency Control
 *
 * Prevents concurrent message processing per session.
 * The Claude SDK doesn't support concurrent messages on the same session
 * and will error with "tried to resume an already running conversation".
 *
 * This module implements a proper lock handoff pattern to prevent race conditions:
 * - Only ONE message can be processed per session at a time
 * - If session is busy, messages are queued and processed sequentially
 * - Lock handoff keeps processing=true when handing off to a queued message
 *   to prevent new messages from stealing the lock
 */

import { createLogger } from '@capybara-chat/types';

const log = createLogger('Concurrency');

/**
 * Message data that gets queued when session is busy
 */
export interface QueuedMessageData {
  sessionId: string;
  content: string;
  messageId?: string;
  type?: string;

}

/**
 * State for tracking session processing
 */
export interface SessionProcessingState {
  /** Whether a message is currently being processed */
  processing: boolean;
  /** ID of the message currently being processed (173-heartbeat) */
  processingMessageId?: string;
  /** Messages waiting to be processed */
  pendingMessages: Array<{
    data: QueuedMessageData;
    resolve: () => void;
    reject: (error: Error) => void;
  }>;
}

/**
 * Manages session processing locks
 */
export class SessionConcurrencyManager {
  private sessionState = new Map<string, SessionProcessingState>();

  /**
   * Get or create processing state for a session
   */
  getState(sessionId: string): SessionProcessingState {
    let state = this.sessionState.get(sessionId);
    if (!state) {
      state = { processing: false, pendingMessages: [] };
      this.sessionState.set(sessionId, state);
    }
    return state;
  }

  /**
   * Attempt to acquire the processing lock for a session.
   * If the lock is held, the message will be queued and the caller should await
   * the returned promise.
   *
   * @returns An object with:
   * - acquired: true if lock was acquired immediately
   * - waitPromise: If not acquired, a promise to await before proceeding
   */
  acquireLock(
    sessionId: string,
    data: QueuedMessageData
  ): { acquired: boolean; waitPromise?: Promise<void> } {
    const state = this.getState(sessionId);

    if (state.processing) {
      // Session is busy - queue this message and return a promise to wait on
      log.info('Session busy, queueing message', {
        sessionId,
        messageId: data.messageId,
        content: data.content?.slice(0, 30),
        queueLength: state.pendingMessages.length + 1,
        currentlyProcessing: state.processingMessageId,
      });

      const waitPromise = new Promise<void>((resolve, reject) => {
        state.pendingMessages.push({ data, resolve, reject });
      });

      return { acquired: false, waitPromise };
    }

    // Lock not held - acquire it
    log.info('Lock acquired', {
      sessionId,
      messageId: data.messageId,
      content: data.content?.slice(0, 30),
    });
    state.processing = true;
    state.processingMessageId = data.messageId;
    return { acquired: true };
  }

  /**
   * Release the processing lock for a session, or hand it off to the next waiter.
   *
   * CRITICAL: This implements proper lock handoff to prevent race conditions.
   * When a message completes, we either:
   * 1. Hand the lock to the next waiting message (keep processing=true)
   * 2. Release the lock (set processing=false) only if no one is waiting
   *
   * This prevents a race where a new message could acquire the lock between
   * when we release it and when a queued message resumes from its await.
   */
  releaseLock(sessionId: string): void {
    const state = this.getState(sessionId);

    if (state.pendingMessages.length > 0) {
      // Hand lock to next waiter
      const next = state.pendingMessages.shift()!;
      // KEEP processing=true - we're handing the lock to the next waiter
      state.processingMessageId = next.data.messageId;
      log.info('Handing lock to next queued message', {
        sessionId,
        nextMessageId: next.data.messageId,
        nextContent: next.data.content?.slice(0, 30),
        queueLength: state.pendingMessages.length,
      });
      next.resolve(); // Unblock the waiting message (lock already held)
    } else {
      // ONLY release lock when no one is waiting
      state.processing = false;
      state.processingMessageId = undefined;
      log.info('Released session lock (queue empty)', { sessionId });
    }
  }

  /**
   * Check if a session is currently processing a message
   */
  isProcessing(sessionId: string): boolean {
    const state = this.sessionState.get(sessionId);
    return state?.processing ?? false;
  }

  /**
   * Get the queue length for a session
   */
  getQueueLength(sessionId: string): number {
    const state = this.sessionState.get(sessionId);
    return state?.pendingMessages.length ?? 0;
  }

  /**
   * Clear state for a session (e.g., when session is deleted).
   * Rejects any pending promises to prevent them from hanging forever.
   */
  clearSession(sessionId: string): void {
    const state = this.sessionState.get(sessionId);
    if (state && state.pendingMessages.length > 0) {
      log.info('Clearing session with pending messages', {
        sessionId,
        pendingCount: state.pendingMessages.length,
      });
      // Reject all pending promises so callers don't hang
      const error = new Error(`Session ${sessionId} was cleared while messages were pending`);
      for (const pending of state.pendingMessages) {
        pending.reject(error);
      }
    }
    this.sessionState.delete(sessionId);
  }

  /**
   * Get all session IDs with active state
   */
  getActiveSessions(): string[] {
    return Array.from(this.sessionState.keys());
  }

  /**
   * 173-heartbeat: Get all message IDs currently being processed or queued.
   * Used by the bridge heartbeat to report active work to the server.
   * The server compares this against DB state to identify truly orphaned messages.
   */
  getActiveMessageIds(): string[] {
    const ids: string[] = [];
    for (const state of this.sessionState.values()) {
      // Include the currently-processing message
      if (state.processingMessageId) {
        ids.push(state.processingMessageId);
      }
      // Include queued messages waiting their turn
      for (const pending of state.pendingMessages) {
        if (pending.data.messageId) {
          ids.push(pending.data.messageId);
        }
      }
    }
    return ids;
  }
}

// Singleton instance for use across the bridge
let concurrencyManager: SessionConcurrencyManager | null = null;

/**
 * Get the global concurrency manager instance
 */
export function getConcurrencyManager(): SessionConcurrencyManager {
  if (!concurrencyManager) {
    concurrencyManager = new SessionConcurrencyManager();
  }
  return concurrencyManager;
}

/**
 * Reset the global concurrency manager (for testing)
 */
export function resetConcurrencyManager(): void {
  concurrencyManager = null;
}
