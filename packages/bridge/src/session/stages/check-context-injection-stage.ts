/**
 * Check Context Injection Stage
 *
 * Determines if full context injection is needed for entity-editing sessions.
 * Context is injected once per entity, then minimal prefixes are used.
 *
 * State transitions:
 * - locked → context_injecting (if full context needed)
 * - locked → streaming (if no context needed)
 */

import type { SessionContext } from '../session-context.js';
import type { PipelineStage, BridgeDependencies } from '../pipeline-stage.js';
import type { SessionLogger } from '../session-logger.js';

/**
 * Stage 2: Check Context Injection Need
 *
 * Determines if this message needs full context injection or minimal prefix.
 */
export class CheckContextInjectionStage implements PipelineStage {
  name = 'check_context_injection';
  timeout = 5000; // 5 seconds

  /**
   * Execute context injection check
   *
   * Checks signal.aborted at start.
   *
   * @param ctx - Session context
   * @param deps - External dependencies
   * @param log - Session logger
   * @param signal - Abort signal for cancellation
   * @returns Updated context with injection flag
   */
  async execute(
    ctx: SessionContext,
    deps: BridgeDependencies,
    log: SessionLogger,
    signal: AbortSignal
  ): Promise<SessionContext> {
    log.debug('Checking if context injection needed');

    // Check if aborted
    if (signal.aborted) {
      throw signal.reason || new Error('Stage aborted');
    }

    // If no editing context, no injection needed
    if (!ctx.editingContext) {
      log.debug('No editing context, skipping injection');
      return ctx;
    }

    // Check if full context already injected
    if (ctx.editingContext.contextInjected) {
      log.debug('Context already injected, will use minimal prefix');
      return ctx;
    }

    // Full context injection needed
    log.info('Full context injection needed', {
      entityType: ctx.editingContext.entityType,
      entityId: ctx.editingContext.entityId,
    });
    ctx.status = 'context_injecting';

    return ctx;
  }
}
