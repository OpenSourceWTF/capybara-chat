/**
 * Human Loop Handler
 *
 * Manages human-in-the-loop interactions for sessions.
 * Emits events to the server and waits for human responses.
 */

import type { SessionHumanInputData } from '@capybara-chat/types';
import { now, createLogger, SOCKET_EVENTS } from '@capybara-chat/types';
// E2 fix: Import centralized constant
import { HUMAN_INPUT_TIMEOUT_MS } from './config.js';

const log = createLogger('HumanLoop');

/**
 * Local request type without sessionId (passed separately to methods)
 */
export type HumanInputRequestParams = Omit<SessionHumanInputData, 'sessionId'>;

export interface PendingRequest {
  sessionId: string;
  request: HumanInputRequestParams;
  resolve: (response: string) => void;
  reject: (error: Error) => void;
  createdAt: number;
  timeoutId?: NodeJS.Timeout; // GAP-009 fix: Store timeout for cleanup in cancelRequest
}

// E2 fix: Use centralized constant from config.ts
const DEFAULT_TIMEOUT = HUMAN_INPUT_TIMEOUT_MS;

// Event emitter type for sending events to server
export type EventEmitter = (event: string, data: unknown) => void;

export class HumanLoopHandler {
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private emitToServer: EventEmitter | null = null;

  /**
   * Set the event emitter for forwarding events to server
   */
  setEventEmitter(emitter: EventEmitter): void {
    this.emitToServer = emitter;
  }

  /**
   * Request human input - blocks until response or timeout
   * This should only be called when the AI hits an impassible problem
   */
  async requestInput(
    sessionId: string,
    request: HumanInputRequestParams,
    timeout = DEFAULT_TIMEOUT
  ): Promise<string> {
    // Only one pending request per session
    if (this.pendingRequests.has(sessionId)) {
      throw new Error(`Session ${sessionId} already has a pending request`);
    }

    return new Promise<string>((resolve, reject) => {
      const pending: PendingRequest = {
        sessionId,
        request,
        resolve,
        reject,
        createdAt: now(),
      };

      this.pendingRequests.set(sessionId, pending);

      // Emit to server so UI can display the request
      this.emitHumanInputRequested(sessionId, request);

      // Timeout handler
      const timeoutId = setTimeout(() => {
        if (this.pendingRequests.has(sessionId)) {
          this.pendingRequests.delete(sessionId);
          reject(new Error(`Human input request timed out after ${timeout}ms`));
        }
      }, timeout);

      // GAP-009 fix: Store timeoutId on pending request for cleanup in cancelRequest
      pending.timeoutId = timeoutId;

      // Wrap resolve to clear timeout
      const originalResolve = resolve;
      pending.resolve = (response: string) => {
        clearTimeout(timeoutId);
        this.pendingRequests.delete(sessionId);
        originalResolve(response);
      };
    });
  }

  /**
   * Provide human response to a pending request
   */
  provideInput(sessionId: string, response: string): boolean {
    const pending = this.pendingRequests.get(sessionId);
    if (!pending) {
      log.warn('No pending request for session', { sessionId });
      return false;
    }

    log.info('Human provided input', { sessionId });
    pending.resolve(response);
    return true;
  }

  /**
   * Cancel a pending request
   */
  cancelRequest(sessionId: string, reason = 'Cancelled by user'): boolean {
    const pending = this.pendingRequests.get(sessionId);
    if (!pending) {
      return false;
    }

    // GAP-009 fix: Clear timeout to prevent timer leak
    if (pending.timeoutId) {
      clearTimeout(pending.timeoutId);
    }

    pending.reject(new Error(reason));
    this.pendingRequests.delete(sessionId);
    return true;
  }

  /**
   * Get pending request for a session
   */
  getPendingRequest(sessionId: string): PendingRequest | undefined {
    return this.pendingRequests.get(sessionId);
  }

  /**
   * Get all pending requests
   */
  getAllPendingRequests(): PendingRequest[] {
    return Array.from(this.pendingRequests.values());
  }

  // ===== Event Emitters =====

  private emitHumanInputRequested(sessionId: string, request: HumanInputRequestParams): void {
    log.info('Human input requested', { sessionId, question: request.question });

    // Emit to server via Socket.io
    if (this.emitToServer) {
      this.emitToServer(SOCKET_EVENTS.SESSION_HUMAN_INPUT_REQUESTED, {
        sessionId,
        question: request.question,
        context: request.context,
        options: request.options,
        timestamp: now(),
      });
    }
  }
}
