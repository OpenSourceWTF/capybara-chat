/**
 * Context Injection State Manager
 *
 * Tracks MCP Forms context injection state per session.
 * This is needed because UI always sends formContextInjected=false (stale state).
 *
 * Design:
 * - Key: sessionId
 * - Value: { entityKey (id or "__new__"), injected }
 * - Tracks whether full context has been injected for each session/entity pair
 */

import { createLogger } from '@capybara-chat/types';

const log = createLogger('ContextInjectionState');

/**
 * State for a single session's context injection
 */
interface SessionContextState {
  entityKey: string;
  injected: boolean;
}

/**
 * Context Injection State Manager
 *
 * Handles tracking of context injection state per session.
 * Extracted from bridge.ts for testability.
 */
export class ContextInjectionStateManager {
  private state = new Map<string, SessionContextState>();

  /**
   * Get the entity key for context tracking.
   * Uses "__new__" for new/unsaved entities (entityId is undefined).
   */
  getEntityKey(entityId?: string): string {
    return entityId || '__new__';
  }

  /**
   * Check if we should inject full context for this session/entity.
   * Returns true if this is the first message for this entity (needs full context).
   */
  shouldInjectFullContext(sessionId: string, entityId?: string): boolean {
    const currentState = this.state.get(sessionId);
    const entityKey = this.getEntityKey(entityId);

    // No state yet, or entity changed - need full context
    if (!currentState || currentState.entityKey !== entityKey) {
      return true;
    }

    // Same entity, check if already injected
    return !currentState.injected;
  }

  /**
   * Mark that full context has been injected for this session/entity.
   */
  markContextInjected(sessionId: string, entityId?: string): void {
    const entityKey = this.getEntityKey(entityId);
    this.state.set(sessionId, { entityKey, injected: true });
    log.debug('Marked context injected', { sessionId, entityId, entityKey });
  }

  /**
   * Reset context injection state for a session (called after compaction).
   */
  resetSession(sessionId: string): void {
    const currentState = this.state.get(sessionId);
    if (currentState) {
      currentState.injected = false;
      log.debug('Reset context injection state', { sessionId, entityKey: currentState.entityKey });
    }
  }

  /**
   * Clear context state for a session (called when session is deleted).
   */
  clearSession(sessionId: string): void {
    this.state.delete(sessionId);
    log.debug('Cleared context injection state', { sessionId });
  }

  /**
   * Get current state for a session (for testing/debugging).
   */
  getState(sessionId: string): SessionContextState | undefined {
    return this.state.get(sessionId);
  }

  /**
   * Reset all state (for testing).
   */
  reset(): void {
    this.state.clear();
  }
}

// Singleton instance
let defaultManager: ContextInjectionStateManager | null = null;

/**
 * Get the default context injection state manager.
 */
export function getContextInjectionStateManager(): ContextInjectionStateManager {
  if (!defaultManager) {
    defaultManager = new ContextInjectionStateManager();
  }
  return defaultManager;
}

/**
 * Reset the default context injection state manager (for testing).
 */
export function resetContextInjectionStateManager(): void {
  defaultManager = null;
}

/**
 * Create a context injection state manager (for testing).
 */
export function createContextInjectionStateManager(): ContextInjectionStateManager {
  return new ContextInjectionStateManager();
}
