/**
 * Pipeline Stage Interface
 *
 * Defines contract for pipeline stages with:
 * - Pure SessionContext input/output
 * - External dependencies injection
 * - Session-scoped logging
 * - Cooperative cancellation via AbortSignal
 *
 * FIX (GAP-031): Added AbortSignal for proper cancellation
 * FIX (GAP-035): Added detailed signal check guidance
 */

import type { SessionContext } from './session-context.js';
import type { SessionLogger } from './session-logger.js';
import type { Socket } from 'socket.io-client';
import type { AssistantPool } from '../pool/assistant-pool.js';

/**
 * Bridge Dependencies
 *
 * All external dependencies injected into pipeline stages.
 * FIX (GAP-033): Added signal parameter to streamClaudeResponse
 */
export interface BridgeDependencies {
  /** Socket for emitting events */
  socket: Socket;

  /** Assistant pool for Claude sessions */
  assistantPool: AssistantPool;

  /** Build full context with entity data */
  buildFullContext(
    editingContext: { entityType: string; entityId?: string },
    userMessage: string
  ): Promise<string>;

  /**
   * Stream Claude response with cancellation support
   *
   * FIX (GAP-033): Added signal parameter for timeout cancellation
   *
   * @param ctx - Session context
   * @param signal - AbortSignal for cancellation
   * @returns Response data
   */
  streamClaudeResponse(
    ctx: SessionContext,
    signal: AbortSignal
  ): Promise<{
    messageId: string;
    content: string;
    createdAt: number;
    contextUsage: { used: number; total: number; percent: number };
  }>;
}

/**
 * Pipeline Stage
 *
 * FIX (GAP-031): Added AbortSignal for cancellation
 * FIX (GAP-035): Added guidance on signal check frequency
 */
export interface PipelineStage {
  name: string;

  /**
   * Execute stage with timeout protection
   *
   * @param ctx - Session context (pure data)
   * @param deps - External dependencies
   * @param log - Session-scoped logger
   * @param signal - AbortSignal for cancellation (timeout, error, etc.)
   *
   * SIGNAL CHECK GUIDANCE (FIX GAP-035):
   *
   * Stages SHOULD check signal.aborted:
   * 1. At the START of execute() - before any work
   * 2. AFTER each async operation (await, Promise)
   * 3. INSIDE loops - every iteration or every N iterations
   * 4. BEFORE expensive operations (DB queries, API calls, heavy computation)
   *
   * For long-running operations:
   * - Pass signal to underlying APIs if supported (fetch, axios, etc.)
   * - Check signal every 100-500ms in loops
   * - Don't check in tight CPU-bound loops (too expensive)
   *
   * Example:
   * ```typescript
   * async execute(ctx, deps, log, signal) {
   *   // 1. Check at start
   *   if (signal.aborted) throw signal.reason || new Error('Aborted');
   *
   *   // 2. After async
   *   const data = await fetchData();
   *   if (signal.aborted) throw signal.reason || new Error('Aborted');
   *
   *   // 3. In loops
   *   for (const item of items) {
   *     if (signal.aborted) throw signal.reason || new Error('Aborted');
   *     await processItem(item);
   *   }
   *
   *   // 4. Pass to APIs
   *   await streamClaudeResponse(ctx, signal);
   *
   *   return ctx;
   * }
   * ```
   *
   * @returns Updated session context
   */
  execute(
    ctx: SessionContext,
    deps: BridgeDependencies,
    log: SessionLogger,
    signal: AbortSignal
  ): Promise<SessionContext>;

  /**
   * Optional: Custom timeout for this stage (ms)
   * Default: 120000 (2 minutes)
   */
  timeout?: number;
}
