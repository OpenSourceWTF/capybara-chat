/**
 * Session Context - Pure Data Architecture
 *
 * CRITICAL: This is a PURE DATA object:
 * - No methods that perform I/O
 * - No function properties
 * - Fully serializable with JSON.stringify()
 * - Passed through pipeline stages (read/write)
 *
 * Design: SESSION_CONTEXT_DESIGN_V4.md
 */

import type { AgentModel, ChatMessage } from '@capybara-chat/types';

/**
 * Session Status - Explicit state machine
 *
 * State transitions:
 * idle → queued → locked → context_injecting → streaming → finalizing → complete → idle
 *
 * Error path:
 * any → error (clearSession + releaseLock in finally) → idle
 */
export type SessionStatus =
  | 'idle'              // No message being processed
  | 'queued'            // Message waiting for lock
  | 'locked'            // Lock acquired, processing starting
  | 'context_injecting' // Injecting full context
  | 'streaming'         // Streaming Claude response
  | 'finalizing'        // Emitting response, preparing for next
  | 'complete'          // Successfully finished this message
  | 'error';            // Failed, lock released, ready for retry

/**
 * Session Event - Pure data audit trail entry
 *
 * Used for debugging, timeline reconstruction, and introspection.
 * Kept in memory only (not persisted to DB).
 */
export interface SessionEvent {
  type: string;
  data?: unknown;
  timestamp: number;
  status: SessionStatus;
}

/**
 * Context usage tracking
 */
export interface ContextUsage {
  used: number;
  total: number;
  percent: number;
}

/**
 * Entity editing context
 */
export interface EditingContext {
  entityType: string;
  entityId?: string;
  contextInjected: boolean;
}

/**
 * Session Context - Complete state for one session
 *
 * PURE DATA OBJECT:
 * - No methods that perform I/O
 * - No function properties
 * - Fully serializable with JSON.stringify()
 * - Passed through pipeline stages (read/write)
 */
export interface SessionContext {
  // === IDENTITY ===
  readonly sessionId: string;
  claudeSessionId?: string;

  // === STATE ===
  status: SessionStatus;

  // === CONFIGURATION ===
  modelOverride?: AgentModel;
  editingContext?: EditingContext;

  // === MESSAGES ===
  userMessageId?: string;  // Original user message ID that triggered this turn
  currentMessage: {
    id: string;
    content: string;
    createdAt: number;
  };
  queue: {
    inbound: ChatMessage[];
    outbound: ChatMessage[];
  };

  // === CONTEXT ===
  contextUsage?: ContextUsage;

  // === AUDIT TRAIL (pure data) ===
  events: SessionEvent[];

  // === METADATA ===
  createdAt: number;
  lastActivityAt: number;
}

/**
 * Maximum events to keep in memory
 * FIX (GAP-024): Prevents unbounded growth
 */
export const MAX_EVENTS = 100;

/**
 * Add event to context and trim if needed
 *
 * FIX (GAP-024): Keeps events[] bounded at MAX_EVENTS
 *
 * @param ctx - Session context to add event to
 * @param type - Event type (e.g., "stage:streaming:start")
 * @param data - Optional event data
 */
export function addEvent(
  ctx: SessionContext,
  type: string,
  data?: unknown
): void {
  ctx.events.push({
    type,
    data,
    timestamp: Date.now(),
    status: ctx.status,
  });

  // Keep last 100 events to prevent unbounded growth
  if (ctx.events.length > MAX_EVENTS) {
    ctx.events.shift();
  }
}
