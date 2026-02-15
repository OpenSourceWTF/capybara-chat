/**
 * Session State Manager
 *
 * Manages local caches for session state:
 * - capturedClaudeSessionIds: Local cache of Claude session IDs (handles race with server DB)
 * - contextUsageCache: Context usage for auto-compaction decisions
 *
 * Extracted from bridge.ts for testability and separation of concerns.
 */

import { createLogger, type AgentModel } from '@capybara-chat/types';

const log = createLogger('SessionStateManager');

/**
 * Context usage information for auto-compaction
 */
export interface ContextUsage {
  used: number;
  total: number;
  percent: number;
}

/**
 * Session State Manager
 *
 * Manages local caches for session state to handle race conditions
 * between bridge and server DB updates.
 */
export class SessionStateManager {
  private capturedClaudeSessionIds = new Map<string, string>();
  private contextUsageCache = new Map<string, ContextUsage>();
  // 135-assistant-model-switch: Store model overrides per session
  private modelOverrides = new Map<string, AgentModel>();

  /**
   * Get cached Claude session ID for a session
   */
  getClaudeSessionId(sessionId: string): string | undefined {
    return this.capturedClaudeSessionIds.get(sessionId);
  }

  /**
   * Cache a Claude session ID locally
   * This handles the race where a subsequent message arrives before
   * the server DB is updated with the new Claude session ID.
   */
  setClaudeSessionId(sessionId: string, claudeSessionId: string): void {
    this.capturedClaudeSessionIds.set(sessionId, claudeSessionId);
    log.debug('Cached Claude session ID', { sessionId, claudeSessionId });
  }

  /**
   * Clear cached Claude session ID
   */
  clearClaudeSessionId(sessionId: string): void {
    this.capturedClaudeSessionIds.delete(sessionId);
    log.debug('Cleared cached Claude session ID', { sessionId });
  }

  /**
   * Get context usage for a session
   */
  getContextUsage(sessionId: string): ContextUsage | undefined {
    return this.contextUsageCache.get(sessionId);
  }

  /**
   * Update context usage for a session
   */
  setContextUsage(sessionId: string, usage: ContextUsage): void {
    this.contextUsageCache.set(sessionId, usage);
  }

  /**
   * Clear context usage for a session
   */
  clearContextUsage(sessionId: string): void {
    this.contextUsageCache.delete(sessionId);
  }

  // 135-assistant-model-switch: Model override methods
  /**
   * Get model override for a session
   */
  getModelOverride(sessionId: string): AgentModel | undefined {
    return this.modelOverrides.get(sessionId);
  }

  /**
   * Set model override for a session
   * This will be applied when the session is next created
   */
  setModelOverride(sessionId: string, model: AgentModel): void {
    this.modelOverrides.set(sessionId, model);
    log.info('Set model override', { sessionId, model });
  }

  /**
   * Clear model override for a session
   */
  clearModelOverride(sessionId: string): void {
    this.modelOverrides.delete(sessionId);
  }

  /**
   * Clear all state for a session
   */
  clearSession(sessionId: string): void {
    this.capturedClaudeSessionIds.delete(sessionId);
    this.contextUsageCache.delete(sessionId);
    this.modelOverrides.delete(sessionId);
    log.debug('Cleared all session state', { sessionId });
  }

  /**
   * Reset all state (for testing)
   */
  reset(): void {
    this.capturedClaudeSessionIds.clear();
    this.contextUsageCache.clear();
    this.modelOverrides.clear();
  }
}

// Singleton instance
let defaultManager: SessionStateManager | null = null;

/**
 * Get the default session state manager
 */
export function getSessionStateManager(): SessionStateManager {
  if (!defaultManager) {
    defaultManager = new SessionStateManager();
  }
  return defaultManager;
}

/**
 * Reset the default session state manager (for testing)
 */
export function resetSessionStateManager(): void {
  defaultManager = null;
}

/**
 * Create a session state manager (for testing)
 */
export function createSessionStateManager(): SessionStateManager {
  return new SessionStateManager();
}
