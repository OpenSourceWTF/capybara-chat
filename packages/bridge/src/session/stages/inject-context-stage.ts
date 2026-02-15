/**
 * Inject Context Stage
 *
 * Injects full entity context into the message for entity-editing sessions.
 * Uses buildFullContext() to generate ~300 token context with entity data.
 *
 * State transitions:
 * - context_injecting → streaming (after context built)
 */

import type { SessionContext } from '../session-context.js';
import type { PipelineStage, BridgeDependencies } from '../pipeline-stage.js';
import type { SessionLogger } from '../session-logger.js';
import { SOCKET_EVENTS, now } from '@capybara-chat/types';

/**
 * Stage 3: Inject Full Context
 *
 * Builds and prepends full context to the user message.
 */
export class InjectContextStage implements PipelineStage {
  name = 'inject_context';
  timeout = 10000; // 10 seconds (API calls to fetch entity data)

  /**
   * Execute context injection
   *
   * Checks signal.aborted:
   * - At start
   * - After API call to build context
   *
   * @param ctx - Session context
   * @param deps - External dependencies
   * @param log - Session logger
   * @param signal - Abort signal for cancellation
   * @returns Updated context with injected message
   */
  async execute(
    ctx: SessionContext,
    deps: BridgeDependencies,
    log: SessionLogger,
    signal: AbortSignal
  ): Promise<SessionContext> {
    log.debug('Injecting full context');

    // Check if aborted
    if (signal.aborted) {
      throw signal.reason || new Error('Stage aborted');
    }

    // Skip if not in context_injecting status
    if (ctx.status !== 'context_injecting') {
      log.debug('Not in context_injecting status, skipping');
      return ctx;
    }

    // Must have editing context
    if (!ctx.editingContext) {
      log.warn('In context_injecting status but no editingContext');
      return ctx;
    }

    // Build full context
    log.info('Building full context', {
      entityType: ctx.editingContext.entityType,
      entityId: ctx.editingContext.entityId,
    });

    const fullContext = await deps.buildFullContext(
      {
        entityType: ctx.editingContext.entityType,
        entityId: ctx.editingContext.entityId,
      },
      ctx.currentMessage.content
    );

    // Check if aborted after async operation
    if (signal.aborted) {
      throw signal.reason || new Error('Stage aborted after context build');
    }

    // Update message with full context
    ctx.currentMessage.content = fullContext;
    ctx.editingContext.contextInjected = true;

    log.info('Context injected', {
      originalLength: ctx.currentMessage.content.length,
      newLength: fullContext.length,
    });

    // 199-cleanup: Emit SESSION_CONTEXT_INJECTED event (previously in legacy handler)
    const contextPreview =
      fullContext.length > 1000
        ? fullContext.slice(0, 1000) + '\n...[truncated]'
        : fullContext;
    deps.socket.emit(SOCKET_EVENTS.SESSION_CONTEXT_INJECTED, {
      sessionId: ctx.sessionId,
      messageId: ctx.userMessageId,
      entityType: ctx.editingContext.entityType,
      entityId: ctx.editingContext.entityId,
      contextType: 'full',
      contextPreview,
      timestamp: now(),
    });

    return ctx;
  }
}
