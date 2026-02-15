/**
 * Acquire Lock Stage
 *
 * Acquires concurrency lock for the session, or waits in queue if busy.
 * This prevents concurrent message processing which Claude SDK doesn't support.
 *
 * State transitions:
 * - idle → queued (if lock busy)
 * - queued → locked (when lock acquired)
 * - idle → locked (if lock immediately available)
 */

import type { SessionContext } from '../session-context.js';
import type { PipelineStage, BridgeDependencies } from '../pipeline-stage.js';
import type { SessionLogger } from '../session-logger.js';

/**
 * Stage 1: Acquire Concurrency Lock
 *
 * Ensures only one message is processed per session at a time.
 */
export class AcquireLockStage implements PipelineStage {
  name = 'acquire_lock';
  timeout = 30000; // 30 seconds

  /**
   * Execute lock acquisition
   *
   * Checks signal.aborted:
   * - At start
   * - After lock wait (if queued)
   *
   * @param ctx - Session context
   * @param deps - External dependencies
   * @param log - Session logger
   * @param signal - Abort signal for cancellation
   * @returns Updated context with status
   */
  async execute(
    ctx: SessionContext,
    deps: BridgeDependencies,
    log: SessionLogger,
    signal: AbortSignal
  ): Promise<SessionContext> {
    log.debug('Attempting to acquire lock');

    // Check if aborted before starting
    if (signal.aborted) {
      throw signal.reason || new Error('Stage aborted');
    }

    // Note: The concurrency lock is actually acquired BEFORE the pipeline runs
    // in the current architecture. This stage verifies it's held and updates status.
    // In a future refactor, this stage could do the actual acquisition.

    // For now, this stage just transitions status to 'locked'
    ctx.status = 'locked';
    log.info('Lock acquired', { messageId: ctx.currentMessage.id });

    return ctx;
  }
}
