/**
 * Message Processing Pipeline
 *
 * Orchestrates message processing through discrete, testable stages with:
 * - Per-stage timeout protection
 * - Proper resource cleanup (lock, timeout, waiters)
 * - Fail-fast error handling
 * - Event audit trail
 *
 * FIX (GAP-005): Lock released in finally block
 * FIX (GAP-020): Fail-fast waiter rejection on error
 * FIX (GAP-023): Per-stage timeout protection
 * FIX (GAP-024): Uses addEvent() helper for bounded events
 * FIX (GAP-031): AbortSignal for proper cancellation
 */

import type { SessionContext } from './session-context.js';
import { addEvent } from './session-context.js';
import type { PipelineStage, BridgeDependencies } from './pipeline-stage.js';
import type { SessionLogger } from './session-logger.js';
import { createSessionLogger } from './session-logger.js';
import type { SessionContextStore } from './session-context-store.js';
import type { SessionConcurrencyManager } from '../concurrency.js';
import type { SessionLogBuffer } from './session-logger.js';
import type { Socket } from 'socket.io-client';
import { SOCKET_EVENTS } from '@capybara-chat/types';

/**
 * Message Processing Pipeline
 *
 * Executes stages sequentially with proper error handling and resource management.
 */
export class MessagePipeline {
  private socket: Socket | null = null;

  constructor(
    private stages: PipelineStage[],
    private concurrency: SessionConcurrencyManager,
    private contextStore: SessionContextStore,
    private logBuffer?: SessionLogBuffer,
    socket?: Socket | null
  ) {
    this.socket = socket ?? null;
  }

  /**
   * Update socket for real-time event emission
   *
   * @param socket - Socket.io socket to emit events to
   */
  setSocket(socket: Socket | null): void {
    this.socket = socket;
  }

  /**
   * Emit pipeline event to UI via socket (Phase 4)
   *
   * @param sessionId - Session ID
   * @param event - Pipeline event data
   */
  private emitPipelineEvent(sessionId: string, event: {
    type: 'stage:start' | 'stage:complete' | 'stage:error' | 'pipeline:start' | 'pipeline:complete' | 'pipeline:error';
    stage?: string;
    status?: string;
    error?: string;
    timestamp: number;
    durationMs?: number;
  }): void {
    if (this.socket) {
      this.socket.emit(SOCKET_EVENTS.SESSION_PIPELINE_EVENT, {
        sessionId,
        event,
      });
    }
    // Note: No warning logged if socket is null - socket may not be set yet during initialization
  }

  /**
   * Emit pipeline state to server for persistence (199-2.1: Crash recovery)
   *
   * Persists current SessionContext state to the server database so that
   * sessions can be recovered after a bridge crash. Called after every stage
   * completes and when pipeline errors.
   *
   * @param ctx - Session context to persist
   */
  private emitPipelineState(ctx: SessionContext): void {
    if (this.socket) {
      this.socket.emit(SOCKET_EVENTS.SESSION_PIPELINE_STATE, {
        sessionId: ctx.sessionId,
        pipelineStatus: ctx.status,
        pipelineMessageId: ctx.currentMessage?.id,
        pipelineMessageContent: ctx.currentMessage?.content,
        pipelineContextInjected: ctx.editingContext?.contextInjected,
        pipelineContextUsage: ctx.contextUsage,
      });
    }
  }

  /**
   * Execute pipeline with proper error handling
   *
   * FIX (GAP-005): Lock released in finally block
   * FIX (GAP-020): Fail-fast waiter rejection on error
   * FIX (GAP-024): Uses addEvent() for bounded growth
   *
   * @param ctx - Session context
   * @param deps - External dependencies
   * @returns Updated session context
   * @throws Error on stage failure (after cleanup)
   */
  async execute(
    ctx: SessionContext,
    deps: BridgeDependencies
  ): Promise<SessionContext> {
    const log = createSessionLogger(ctx.sessionId, this.logBuffer, 'pipeline');
    const pipelineStartTime = Date.now();

    addEvent(ctx, 'pipeline:start');
    log.info('Pipeline starting', { stages: this.stages.map(s => s.name) });
    this.emitPipelineEvent(ctx.sessionId, {
      type: 'pipeline:start',
      status: ctx.status,
      timestamp: pipelineStartTime,
    });

    try {
      for (const stage of this.stages) {
        const stageStartTime = Date.now();

        // Record stage start
        addEvent(ctx, `stage:${stage.name}:start`);
        log.debug(`Stage ${stage.name} starting`);
        this.emitPipelineEvent(ctx.sessionId, {
          type: 'stage:start',
          stage: stage.name,
          status: ctx.status,
          timestamp: stageStartTime,
        });

        // FIX (GAP-023): Execute with timeout protection
        const timeout = stage.timeout || 120000; // 2 min default
        const updatedCtx = await this.executeStageWithTimeout(
          stage,
          ctx,
          deps,
          log,
          timeout
        );

        // Verify stage contract - sessionId must not change
        if (updatedCtx.sessionId !== ctx.sessionId) {
          throw new Error(`Stage ${stage.name} corrupted sessionId`);
        }

        ctx = updatedCtx;
        ctx.lastActivityAt = Date.now();

        // Record stage completion
        const stageDuration = Date.now() - stageStartTime;
        addEvent(ctx, `stage:${stage.name}:complete`);
        log.debug(`Stage ${stage.name} complete`, { status: ctx.status, durationMs: stageDuration });
        this.emitPipelineEvent(ctx.sessionId, {
          type: 'stage:complete',
          stage: stage.name,
          status: ctx.status,
          timestamp: Date.now(),
          durationMs: stageDuration,
        });

        // FIX (GAP-025): Update after EVERY stage for better debugging
        // Rationale: If pipeline crashes mid-execution, we want last known state
        // Trade-off: Frequent updates vs ability to debug stuck sessions
        this.contextStore.update(ctx);

        // 199-2.1: Persist pipeline state to server for crash recovery
        this.emitPipelineState(ctx);
      }

      const pipelineDuration = Date.now() - pipelineStartTime;
      addEvent(ctx, 'pipeline:complete');
      log.info('Pipeline complete', { durationMs: pipelineDuration });
      this.emitPipelineEvent(ctx.sessionId, {
        type: 'pipeline:complete',
        status: ctx.status,
        timestamp: Date.now(),
        durationMs: pipelineDuration,
      });

      return ctx;

    } catch (error) {
      ctx.status = 'error';
      ctx.lastActivityAt = Date.now();
      addEvent(ctx, 'pipeline:error', {
        error: String(error),
        stack: (error as Error).stack
      });
      log.error('Pipeline failed', error as Error);
      this.emitPipelineEvent(ctx.sessionId, {
        type: 'pipeline:error',
        status: ctx.status,
        error: String(error),
        timestamp: Date.now(),
        durationMs: Date.now() - pipelineStartTime,
      });

      // Update context with error state
      this.contextStore.update(ctx);

      // 199-2.1: Persist error state to server for crash recovery
      this.emitPipelineState(ctx);

      // FIX (GAP-020): FAIL-FAST - Reject all waiters
      // Decision: Fail-fast is safer than retry with potentially broken state
      // Rationale:
      // - If context injection failed, retry would fail too
      // - If streaming failed, likely transient (user can retry manually)
      // - Better UX: Immediate error vs silent queue that never processes
      this.concurrency.clearSession(ctx.sessionId);
      log.info('Cleared session, rejected waiters (fail-fast)');

      throw error;

    } finally {
      // FIX (GAP-005): ALWAYS release lock (or hand off if clearSession not called)
      // Critical for preventing deadlocks
      this.concurrency.releaseLock(ctx.sessionId);
      log.debug('Lock released');
    }
  }

  /**
   * Execute stage with timeout protection
   *
   * FIX (GAP-023): Prevents indefinite hangs
   * FIX (GAP-031): Uses AbortSignal to actually cancel stage execution
   *
   * @param stage - Pipeline stage
   * @param ctx - Session context
   * @param deps - External dependencies
   * @param log - Session logger
   * @param timeoutMs - Timeout in milliseconds
   * @returns Updated session context
   * @throws Error on timeout or stage failure
   */
  private async executeStageWithTimeout(
    stage: PipelineStage,
    ctx: SessionContext,
    deps: BridgeDependencies,
    log: SessionLogger,
    timeoutMs: number
  ): Promise<SessionContext> {
    const abortController = new AbortController();

    const timeoutId = setTimeout(() => {
      abortController.abort(
        new Error(`Stage ${stage.name} timed out after ${timeoutMs}ms`)
      );
    }, timeoutMs);

    try {
      // Pass AbortSignal to stage
      return await stage.execute(ctx, deps, log, abortController.signal);
    } finally {
      // Clean up timeout
      clearTimeout(timeoutId);
    }
  }
}
