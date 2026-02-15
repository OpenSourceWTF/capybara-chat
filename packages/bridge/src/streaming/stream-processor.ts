/**
 * Stream Processor
 *
 * Core streaming loop that processes Claude SDK messages with configurable hooks.
 * Used by both bridge.ts (assistant sessions) and task-executor.ts (background tasks).
 *
 * Core responsibilities:
 * - Message accumulation with consistent ID
 * - Abort signal checking
 * - Event dispatching to hooks
 *
 * Consumer responsibilities (via hooks):
 * - Socket emissions (SESSION_RESPONSE, TASK_OUTPUT, etc.)
 * - Session state updates
 * - Cost tracking
 *
 * Design source: 088-shared-streaming-loop-design
 */

import type {
  StreamEventHooks,
  StreamProcessorConfig,
  StreamProcessorResult,
  ToolUseData,
  ToolProgressData,
  ToolResultData,
  ResultData,
} from './types.js';

/**
 * Generic stream message type (matches SDK StreamMessage)
 */
interface StreamMessage {
  type: string;
  content?: string;
  data?: unknown;
  total_cost_usd?: number;
}

/**
 * Process a Claude SDK message stream with configurable hooks.
 *
 * @param stream - AsyncGenerator from AssistantPool.sendMessage or ClaudeV2Provider.streamMessages
 * @param config - Processing configuration (sessionId, messageId, etc.)
 * @param hooks - Optional callbacks for event handling
 * @returns Promise with accumulated content, claudeSessionId, cost, and abort status
 */
export async function processClaudeStream(
  stream: AsyncGenerator<StreamMessage>,
  config: StreamProcessorConfig,
  hooks: StreamEventHooks = {}
): Promise<StreamProcessorResult> {
  let accumulated = '';
  let claudeSessionId: string | undefined;
  let cost: number | undefined;
  let wasAborted = false;

  try {
    for await (const msg of stream) {
      // Check for abort
      if (config.abortSignal?.aborted) {
        wasAborted = true;
        break;
      }

      // 137-idle-timeout: Notify on any stream activity for timeout reset
      config.onStreamActivity?.(msg.type);

      switch (msg.type) {
        case 'message': {
          if (msg.content) {
            // Add space between chunks for continuity (shared behavior)
            if (accumulated && !accumulated.endsWith(' ') && !accumulated.endsWith('\n')) {
              accumulated += ' ';
            }
            accumulated += msg.content;
            hooks.onMessageChunk?.(msg.content, accumulated);
            hooks.onStreamingEmit?.(accumulated);
          }
          break;
        }

        case 'session_init': {
          const data = msg.data as { claudeSessionId?: string } | undefined;
          if (data?.claudeSessionId) {
            claudeSessionId = data.claudeSessionId;
            await hooks.onSessionInit?.({ claudeSessionId });
          }
          break;
        }

        case 'thinking': {
          const data = msg.data as { content?: string } | undefined;
          if (data?.content) {
            hooks.onThinking?.(data.content);
          }
          break;
        }

        case 'tool_use': {
          const data = msg.data as ToolUseData | undefined;
          if (data?.toolUseId && data?.toolName) {
            hooks.onToolUse?.(data);
          }
          break;
        }

        case 'tool_progress': {
          const data = msg.data as ToolProgressData | undefined;
          if (data) {
            hooks.onToolProgress?.(data);
          }
          break;
        }

        case 'tool_result': {
          // Tool completed with output - emit so UI can update tool status
          const data = msg.data as { toolUseId?: string; output?: unknown; error?: string; timestamp?: number } | undefined;
          if (data?.toolUseId) {
            hooks.onToolResult?.({
              toolUseId: data.toolUseId,
              output: data.output,
              error: data.error,
              // Pass through SDK timestamp if present (102-timestamp-ordering-fix)
              timestamp: data.timestamp,
            });
          }
          break;
        }

        case 'result': {
          const data = msg.data as ResultData | undefined;
          // Cost is inside data (from SDK provider)
          const msgCost = data?.cost ?? msg.total_cost_usd;
          if (msgCost !== undefined) {
            cost = msgCost;
          }

          // Capture result text - DEFAULT ENABLED (contains subagent output)
          // CRITICAL FIX (132-tool-splits-messages audit): After capturing result text,
          // we MUST call onStreamingEmit so the UI sees the content and message
          // splitting can occur. Without this, subagent output is invisible during
          // streaming and may be lost on reload.
          const shouldCapture = config.captureResultText !== false; // Default true
          if (shouldCapture && data?.result && typeof data.result === 'string') {
            if (!accumulated) {
              accumulated = data.result;
            } else if (!accumulated.includes(data.result)) {
              // Single line break for result text separation
              if (!accumulated.endsWith('\n')) {
                accumulated += '\n';
              }
              accumulated += data.result;
            }
            // CRITICAL: Emit streaming update so UI sees result content
            // This also triggers message split logic if pendingNewMessage is true
            hooks.onStreamingEmit?.(accumulated);
          }

          await hooks.onResult?.({ ...data, cost: msgCost });
          break;
        }

        case 'complete': {
          hooks.onComplete?.();
          break;
        }

        case 'error': {
          hooks.onError?.(msg.content || 'Unknown error');
          throw new Error(msg.content || 'Unknown error');
        }
      }
    }

    // Emit final content
    if (accumulated && !wasAborted) {
      hooks.onFinalContent?.(accumulated);
    }
  } catch (error) {
    // Re-throw after hooks had a chance to handle
    throw error;
  }

  return {
    content: accumulated,
    claudeSessionId,
    cost,
    wasAborted,
  };
}
