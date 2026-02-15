/**
 * Stream Response Stage
 *
 * Streams Claude's response with timeout protection and AbortSignal support.
 * This is the longest-running stage (up to 5 minutes).
 *
 * State transitions:
 * - streaming → finalizing (after response complete)
 */

import type { SessionContext } from '../session-context.js';
import type { PipelineStage, BridgeDependencies } from '../pipeline-stage.js';
import type { SessionLogger } from '../session-logger.js';

/**
 * Stage 4: Stream Claude Response
 *
 * Sends message to Claude and streams the response back.
 */
export class StreamResponseStage implements PipelineStage {
  name = 'stream_response';
  timeout = 300000; // 5 minutes for streaming

  /**
   * Execute Claude streaming
   *
   * Checks signal.aborted:
   * - At start
   * - Passes signal to streamClaudeResponse (if supported)
   * - After streaming completes
   *
   * @param ctx - Session context
   * @param deps - External dependencies
   * @param log - Session logger
   * @param signal - Abort signal for cancellation
   * @returns Updated context with response and usage data
   */
  async execute(
    ctx: SessionContext,
    deps: BridgeDependencies,
    log: SessionLogger,
    signal: AbortSignal
  ): Promise<SessionContext> {
    log.info('Starting Claude stream');
    ctx.status = 'streaming';

    // Check if aborted
    if (signal.aborted) {
      throw signal.reason || new Error('Stage aborted');
    }

    // Stream response - pass signal for timeout support
    log.debug('Calling streamClaudeResponse', {
      messageLength: ctx.currentMessage.content.length,
      hasClaudeSession: !!ctx.claudeSessionId,
    });

    const result = await deps.streamClaudeResponse(ctx, signal);

    // Check if aborted after streaming
    if (signal.aborted) {
      throw signal.reason || new Error('Stage aborted after streaming');
    }

    // Update context with response
    ctx.claudeSessionId = ctx.claudeSessionId || result.messageId; // Capture session ID
    ctx.contextUsage = result.contextUsage;

    // Add response to outbound queue
    ctx.queue.outbound.push({
      id: result.messageId,
      content: result.content,
      createdAt: result.createdAt,
      // Note: ChatMessage type includes additional fields like role, status, etc.
      // The actual response handling adds these via socket events
    } as any);

    log.info('Claude stream complete', {
      responseLength: result.content.length,
      contextUsage: result.contextUsage.percent + '%',
    });

    return ctx;
  }
}
