/**
 * Bridge Dependencies Adapter
 *
 * Adapts existing MessageHandler dependencies to the BridgeDependencies interface
 * required by pipeline stages. This allows gradual migration without rewriting
 * existing message handling logic.
 *
 * Design: Creates a bridge between old and new architectures
 *
 * 199-Task-1.4 Evaluation:
 * - Provides valuable abstraction for streaming logic
 * - Wraps buildFullContext and streamClaudeResponse with pipeline-compatible interfaces
 * - Does NOT depend on old state managers (safe from Task-1.3 migration)
 * - VERDICT: Keep - clean abstraction layer worth maintaining
 */

import type { Socket } from 'socket.io-client';
import type { AssistantPool, AssistantContextType } from '../pool/assistant-pool.js';
import type { BridgeDependencies } from './pipeline-stage.js';
import type { SessionContext } from './session-context.js';
import { buildFullContext as buildContextFn } from '../context-builder.js';
import { SOCKET_EVENTS, generateMessageId, now } from '@capybara-chat/types';
import { createBridgeHooks, createIdleTimeout } from '../streaming/index.js';
import { processClaudeStream } from '../streaming/index.js';
import { STREAM_TIMEOUT_MS_SESSION } from '../config.js';

/**
 * Adapter configuration
 */
export interface BridgeDepsAdapterConfig {
  /** Socket connection to server */
  socket: Socket;
  /** Assistant pool for Claude sessions */
  assistantPool: AssistantPool;
  /** Session initialization service for pool session management */
  getOrCreatePoolSession: (sessionId: string, contextType: AssistantContextType) => Promise<string>;
  /** Callback to capture Claude session ID */
  onClaudeSessionCapture?: (sessionId: string, claudeSessionId: string) => void;
}

/**
 * Creates a BridgeDependencies implementation from existing components
 *
 * This adapter allows pipeline stages to work with existing message handling
 * infrastructure without requiring a full rewrite.
 *
 * @param config - Adapter configuration
 * @returns BridgeDependencies implementation
 */
export function createBridgeDependenciesAdapter(
  config: BridgeDepsAdapterConfig
): BridgeDependencies {
  return {
    socket: config.socket,
    assistantPool: config.assistantPool,

    /**
     * Build full context using existing context builder
     */
    async buildFullContext(editingContext, userMessage) {
      return buildContextFn(
        {
          editingEntityType: editingContext.entityType,
          editingEntityId: editingContext.entityId,
        },
        userMessage
      );
    },

    /**
     * Stream Claude response using existing streaming infrastructure
     *
     * Wraps existing processClaudeStream with pipeline-compatible interface.
     * Passes AbortSignal through to streaming for timeout cancellation.
     */
    async streamClaudeResponse(ctx, signal) {
      const { socket, assistantPool } = config;

      // Get or create pool session
      const poolSessionId = await config.getOrCreatePoolSession(
        ctx.sessionId,
        'general'
      );

      // Generate response message ID
      const responseMessageId = generateMessageId();
      const responseCreatedAt = now();

      // Emit 'thinking' activity
      socket.emit(SOCKET_EVENTS.SESSION_ACTIVITY, {
        sessionId: ctx.sessionId,
        activity: { type: 'thinking', status: 'running' },
      });

      // Create streaming hooks
      const hooks = createBridgeHooks({
        socket,
        sessionId: ctx.sessionId,
        messageId: responseMessageId,
        createdAt: responseCreatedAt,
        userMessageId: ctx.userMessageId,  // Pass user's message ID for completion tracking
        onClaudeSessionCapture: (claudeSessionId) => {
          if (config.onClaudeSessionCapture) {
            config.onClaudeSessionCapture(ctx.sessionId, claudeSessionId);
          }
        },
      });

      // Create idle timeout for stream activity monitoring
      const idleTimeout = createIdleTimeout(
        STREAM_TIMEOUT_MS_SESSION,
        `Stream timeout after ${STREAM_TIMEOUT_MS_SESSION / 60000} minutes of inactivity`
      );

      try {
        // Process Claude stream with correct signature
        // Note: We wrap the stream call and pass config + hooks as separate params
        const streamPromise = processClaudeStream(
          assistantPool.sendMessage(poolSessionId, ctx.currentMessage.content),
          {
            sessionId: ctx.sessionId,
            messageId: responseMessageId,
            createdAt: responseCreatedAt,
            abortSignal: signal,  // Pass AbortSignal to stream processor
            onStreamActivity: () => idleTimeout.resetTimeout(),
          },
          hooks
        );

        // Race stream against idle timeout
        const result = await Promise.race([streamPromise, idleTimeout.promise]);

        // Check if aborted after streaming (cooperative cancellation)
        if (signal.aborted) {
          throw signal.reason || new Error('Stream aborted');
        }

        // Extract response data
        const responseContent = result.content || '';

        // 199-Task-1.4: Context usage is intentionally zeroed here.
        // The Claude SDK's processClaudeStream returns 'cost' but not token counts.
        // Auto-compaction service queries usage separately via getContextUsage().
        // This approach works because:
        // 1. StreamResponseStage can proceed with zero values
        // 2. Auto-compaction queries actual usage when checking thresholds
        // 3. Real usage is stored in ctx.contextUsage by message-handler post-pipeline
        const contextUsage = {
          used: 0,
          total: 200000,
          percent: 0,
        };

        return {
          messageId: responseMessageId,
          content: responseContent,
          createdAt: responseCreatedAt,
          contextUsage,
        };
      } finally {
        idleTimeout.cleanup();
      }
    },
  };
}

/**
 * Integration Note: Context Usage
 *
 * The processClaudeStream() returns 'cost' (API cost) but not detailed token usage.
 * To get accurate context usage (inputTokens, maxTokens, percent), we'd need to:
 * 1. Query the Claude SDK's session info after streaming
 * 2. Add a context usage hook to processClaudeStream
 * 3. Calculate from accumulated message history
 *
 * For now, we return minimal context usage. The auto-compaction service
 * queries usage separately when needed.
 */
