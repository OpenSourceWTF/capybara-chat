/**
 * Finalize Stage
 *
 * Completes message processing:
 * - Transitions status to complete
 * - Prepares for next message
 * - Could trigger auto-document or auto-compaction (future)
 *
 * State transitions:
 * - streaming → finalizing → complete
 */

import type { SessionContext } from '../session-context.js';
import type { PipelineStage, BridgeDependencies } from '../pipeline-stage.js';
import type { SessionLogger } from '../session-logger.js';

/**
 * Stage 5: Finalize Response
 *
 * Completes the message processing cycle.
 */
export class FinalizeStage implements PipelineStage {
  name = 'finalize';
  timeout = 5000; // 5 seconds

  /**
   * Execute finalization
   *
   * Checks signal.aborted at start.
   *
   * @param ctx - Session context
   * @param deps - External dependencies
   * @param log - Session logger
   * @param signal - Abort signal for cancellation
   * @returns Updated context with complete status
   */
  async execute(
    ctx: SessionContext,
    deps: BridgeDependencies,
    log: SessionLogger,
    signal: AbortSignal
  ): Promise<SessionContext> {
    log.debug('Finalizing response');

    // Check if aborted
    if (signal.aborted) {
      throw signal.reason || new Error('Stage aborted');
    }

    ctx.status = 'finalizing';

    // Clear inbound queue (message has been processed)
    ctx.queue.inbound = [];

    // Transition to complete
    ctx.status = 'complete';

    log.info('Response finalized', {
      outboundCount: ctx.queue.outbound.length,
    });

    return ctx;
  }
}
