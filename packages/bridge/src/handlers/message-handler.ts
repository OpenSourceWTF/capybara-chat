/**
 * Session Message Handler
 *
 * Handles incoming user messages from the server and processes them through Claude.
 * Extracted from bridge.ts for better testability and separation of concerns.
 *
 * Key responsibilities:
 * - Task session detection and delegation
 * - Concurrency control (Claude SDK doesn't support concurrent messages)
 * - Entity editing context injection (full/minimal)
 * - Slash command handling
 * - Claude streaming with timeout protection
 * - Auto-document and auto-compaction
 */

import type { Socket } from 'socket.io-client';
import type { AssistantPool, AssistantContextType } from '../pool/assistant-pool.js';
import { formatCLIError } from '../utils/error-formatter.js';
import { getApiClient } from '../utils/api-client.js';
import type { SessionConcurrencyManager } from '../concurrency.js';
import { emitSessionError } from '../utils/session-error-emitter.js';
import {
  generateMessageId,
  now,
  createLogger,
  SessionStatus,
  SOCKET_EVENTS,
  SessionMode,
  type FormEntityType,
  type ChatMessage,
} from '@capybara-chat/types';

import {
  MessagePipeline,
  SessionContextStore,
  SessionLogBuffer,
  AcquireLockStage,
  CheckContextInjectionStage,
  InjectContextStage,
  StreamResponseStage,
  FinalizeStage,
  createBridgeDependenciesAdapter,
  getSessionContextStore,
  type SessionContext,
} from '../session/index.js';

const log = createLogger('MessageHandler');

/**
 * Message payload from server SESSION_MESSAGE event.
 */
export interface SessionMessageData {
  sessionId: string;
  content: string;
  messageId?: string;
  type?: string;

}

/**
 * Dependencies required by MessageHandler.
 * All dependencies are injected for testability.
 */
export interface MessageHandlerDeps {
  /** Socket for emitting events to server */
  getSocket: () => Socket | null;
  /** Assistant pool for Claude sessions */
  getAssistantPool: () => AssistantPool | null;
  /** Session initialization service */


  /** Concurrency manager for session locks */
  concurrency: SessionConcurrencyManager;
}

/**
 * Handler for processing incoming session messages.
 *
 * This class encapsulates the complex logic for handling user messages,
 * including context injection, streaming, and auto-services.
 */
export class MessageHandler {
  private contextStore: SessionContextStore | null = null;
  private logBuffer: SessionLogBuffer | null = null;
  private pipeline: MessagePipeline | null = null;

  /**
   * Get the context store for debug purposes (Phase 4).
   *
   * @returns SessionContextStore or null if pipeline not enabled
   */
  getContextStore(): SessionContextStore | null {
    return this.contextStore;
  }

  /**
   * Get the log buffer for debug purposes (Phase 4).
   *
   * @returns SessionLogBuffer or null if pipeline not enabled
   */
  getLogBuffer(): SessionLogBuffer | null {
    return this.logBuffer;
  }

  constructor(private deps: MessageHandlerDeps) {
    // 199-pipeline-architecture-cleanup: Always initialize pipeline (feature flag removed)
    const socket = deps.getSocket();
    // 199-Task-1.3: Use shared singleton instead of local instance
    this.contextStore = getSessionContextStore();
    this.logBuffer = new SessionLogBuffer(socket);

    // Create pipeline with all 5 stages
    this.pipeline = new MessagePipeline(
      [
        new AcquireLockStage(),
        new CheckContextInjectionStage(),
        new InjectContextStage(),
        new StreamResponseStage(),
        new FinalizeStage(),
      ],
      this.deps.concurrency,
      this.contextStore,
      this.logBuffer,
      socket
    );

    log.info('Session pipeline initialized', {
      stages: ['acquire-lock', 'check-context', 'inject-context', 'stream-response', 'finalize']
    });
  }

  /**
   * Update socket for real-time event emission.
   * Called after socket connection is established.
   *
   * @param socket - Connected socket to emit events to
   */
  setSocket(socket: Socket | null): void {
    if (this.pipeline) {
      this.pipeline.setSocket(socket);
    }
    if (this.logBuffer) {
      this.logBuffer.setSocket(socket);
    }
  }

  /**
   * Handle message using new pipeline architecture.
   *
   * @param data - The message data from SESSION_MESSAGE event
   * @private
   */
  private async handleMessageWithPipeline(data: SessionMessageData): Promise<void> {
    const { sessionId, content, messageId } = data;

    // Update session status to RUNNING (GAP-PHASE3-004 fix)
    getApiClient().patch(`/api/sessions/${sessionId}`, {
      status: SessionStatus.RUNNING,
    }).catch((err) => {
      log.warn('Failed to transition session to RUNNING', { sessionId, error: String(err) });
    });

    // Acquire concurrency lock (GAP-PHASE3-001 fix)
    const lockResult = this.deps.concurrency.acquireLock(sessionId, {
      sessionId,
      content,
      messageId,
      type: data.type,
    });
    if (!lockResult.acquired) {
      await lockResult.waitPromise;
      log.debug('Resuming from queue with lock held', { sessionId });
    }

    // Declare dependencies outside try block so they're accessible in catch
    let assistantPool: AssistantPool | null = null;
    let socket: Socket | null = null;

    // GAP-PHASE3-005 fix: Move try block BEFORE dependency checks to ensure finally runs
    try {
      // Initialize dependencies from getters
      assistantPool = this.deps.getAssistantPool();
      socket = this.deps.getSocket();

      // Create or get session context
      const ctx: SessionContext = this.contextStore!.getOrCreate(sessionId);

      // 199-Task-1.2: Use SessionContext.queue instead of external messageQueues
      // Generate message ID once for consistency across all usages
      const effectiveMessageId = messageId || generateMessageId();
      const incomingMessage: ChatMessage = {
        id: effectiveMessageId,
        sessionId,
        content,
        role: 'user',
        status: 'pending',
        createdAt: now(),
      };

      // Add to SessionContext queue (pipeline stages use this)
      ctx.queue.inbound.push(incomingMessage);


      // Update context with current message for this turn
      ctx.userMessageId = effectiveMessageId;
      ctx.currentMessage = {
        id: effectiveMessageId,
        content,
        createdAt: incomingMessage.createdAt,
      };



      if (!assistantPool || !socket) {
        throw new Error('Required dependencies not available for pipeline');
      }

      const bridgeDeps = createBridgeDependenciesAdapter({
        socket,
        assistantPool,
        getOrCreatePoolSession: async () => 'mock-session-id', // 199-strip: services removed
        onClaudeSessionCapture: (sessionId, claudeSessionId) => {
          const captureCtx = this.contextStore?.get(sessionId);
          if (captureCtx) {
            captureCtx.claudeSessionId = claudeSessionId;
            this.contextStore?.update(captureCtx);
          }
          log.info('Captured claudeSessionId via pipeline', { sessionId, claudeSessionId });
        },
      });


      // Execute pipeline
      const resultCtx = await this.pipeline!.execute(ctx, bridgeDeps);

      log.info('Pipeline execution complete', {
        sessionId,
        status: resultCtx.status,
        contextUsage: resultCtx.contextUsage,
      });

      // 201-FIX: Emit final message from outbound queue
      // The pipeline collects responses in queue.outbound but never emits them
      // Streaming messages are emitted via bridge-hooks, but the FINAL message (streaming: false)
      // must be emitted here to trigger server-side completion logic
      const outboundQueue = resultCtx.queue?.outbound || [];
      if (outboundQueue.length > 0 && socket) {
        // Get the last message (which should be the final one)
        const finalMessage = outboundQueue[outboundQueue.length - 1];
        log.info('201-FIX: Emitting final message from outbound queue', {
          sessionId,
          messageId: resultCtx.userMessageId,
          assistantMsgId: finalMessage.id,
          contentLength: finalMessage.content?.length || 0,
        });
        socket.emit(SOCKET_EVENTS.SESSION_RESPONSE, {
          sessionId,
          messageId: resultCtx.userMessageId,
          message: {
            id: finalMessage.id,
            content: finalMessage.content,
            role: 'assistant',
            streaming: false,
            createdAt: finalMessage.createdAt,
          },
        });
      }

      // Update the store with the result context (contextUsage lives in SessionContext)
      if (resultCtx.contextUsage) {
        this.contextStore?.update(resultCtx);

        // Emit context usage event for UI
        socket.emit(SOCKET_EVENTS.SESSION_CONTEXT_USAGE, {
          sessionId,
          usage: resultCtx.contextUsage,
          timestamp: Date.now(),
        });
      }


    } catch (error) {
      log.error('Pipeline execution failed', error as Error);

      // Close pool session to kill CLI process (GAP-PHASE3-002 fix)
      // Prevents stale LineReader data from corrupting next message (issue 183)
      if (assistantPool) {
        try {
          await assistantPool.closeSession(sessionId);
        } catch {
          // Ignore cleanup errors
        }
      }

      // Build error message using extracted utility
      const formatted = formatCLIError(error, 'Failed to process message');

      // Emit error events using extracted utility
      // 196-session-status-sanity: emitSessionError emits MESSAGE_STATUS to clear processingSessions
      emitSessionError(socket, {
        sessionId,
        messageId,
        errorMessage: formatted.message,
        haltReason: formatted.haltReason,
      });

      throw error;
    } finally {
      // Always release lock (GAP-PHASE3-001 fix)
      this.deps.concurrency.releaseLock(sessionId);
    }
  }

  /**
   * Handle an incoming session message.
   *
   * @param data - The message data from SESSION_MESSAGE event
   */
  async handleMessage(data: SessionMessageData): Promise<void> {
    const { sessionId, content, messageId } = data;

    log.info('Received message for session', {
      sessionId,
      content: content?.slice(0, 50) ?? '(empty)',
      hasContent: !!content,
    });

    // Validate content
    if (!content) {
      log.warn('Received message with no content, ignoring', {
        sessionId,
        data: JSON.stringify(data),
      });
      return;
    }



    // === PIPELINE ARCHITECTURE (199-cleanup: feature flag removed, always use pipeline) ===
    return this.handleMessageWithPipeline(data);
  }

  // === 199-pipeline-architecture-cleanup ===
  // Legacy methods removed:
  // - processEditingContext() - now in CheckContextInjectionStage + InjectContextStage
  // - streamClaudeResponse() - now in StreamResponseStage + FinalizeStage

}
