/**
 * Task Stream Hooks
 *
 * Hook factory for background task execution in task-executor.ts.
 * Emits socket events for real-time UI updates and task tracking.
 *
 * Design source: 088-shared-streaming-loop-design
 * Enhanced: 132-tool-splits-messages (tool-triggered message splitting)
 */

import type { Socket } from 'socket.io-client';
import { SOCKET_EVENTS, generateMessageId } from '@capybara-chat/types';
import type { StreamEventHooks, ToolUseData, ToolProgressData, ToolResultData, ResultData } from './types.js';

/**
 * Configuration for task stream hooks
 */
export interface TaskHooksConfig {
  /** Socket.io client for server communication */
  socket: Socket;
  /** Task ID for task-specific events */
  taskId: string;
  /** Capybara session ID for message persistence */
  capybaraSessionId: string;
  /** Pre-generated message ID for response */
  messageId: string;
  /** Pre-generated timestamp for response */
  createdAt: number;
  /** Async callback when Claude session ID is captured (for API patch) */
  onClaudeSessionCapture?: (id: string) => Promise<void>;
  /** Async callback for cost updates (for API patch and state tracking) */
  onCostUpdate?: (cost: number) => Promise<void>;
}

/**
 * Final segment info returned by getFinalSegment().
 * Used by task-executor.ts to correctly emit the final message.
 */
export interface TaskFinalSegmentInfo {
  /** Current message ID (may differ from original if tools were used) */
  id: string;
  /** Where this message's content starts in the accumulated string */
  startOffset: number;
  /** Timestamp for this message */
  createdAt: number;
  /** Whether any tools were used (i.e., message was split) */
  wasSplit: boolean;
}

/**
 * Extended hooks interface that includes getFinalSegment accessor.
 */
export interface TaskHooksWithSegmentInfo extends StreamEventHooks {
  /** Get info about the final message segment for correct persistence */
  getFinalSegment(): TaskFinalSegmentInfo;
}

/**
 * Create hooks for task execution streaming.
 *
 * Emits:
 * - TASK_OUTPUT (delta only - complete is handled by task-executor.ts)
 * - SESSION_RESPONSE (streaming only - final is handled by task-executor.ts via apiPost)
 * - SESSION_TOOL_USE (tool events)
 * - TASK_COST_UPDATE (cost tracking)
 *
 * Tool-triggered message splitting (132-tool-splits-messages):
 * When a tool is used, subsequent text content starts a new message.
 * This makes tools appear BETWEEN message segments rather than after.
 *
 * Returns TaskHooksWithSegmentInfo which includes getFinalSegment() for
 * correct final message emission by task-executor.ts.
 */
export function createTaskHooks(config: TaskHooksConfig): TaskHooksWithSegmentInfo {
  const { socket, taskId, capybaraSessionId, messageId, createdAt } = config;

  // Message splitting state (132-tool-splits-messages)
  let currentMessageId = messageId;
  let currentMessageCreatedAt = createdAt;
  let currentMessageStartOffset = 0;  // Where current message content starts in accumulated
  let emittedUpToLength = 0;          // Total length processed (for detecting new content)
  let pendingNewMessage = false;
  let wasSplit = false;               // Track if any splits occurred (for getFinalSegment)

  return {
    /**
     * Get info about the current (final) message segment.
     * Used by task-executor.ts to emit the correct final message after streaming.
     *
     * This is critical for GAP-003/GAP-004 fix:
     * - Returns current message ID (not original) if tools were used
     * - Returns correct startOffset for content slicing
     * - Allows task-executor.ts to finalize the LAST segment properly
     */
    getFinalSegment(): TaskFinalSegmentInfo {
      return {
        id: currentMessageId,
        startOffset: currentMessageStartOffset,
        createdAt: currentMessageCreatedAt,
        wasSplit,
      };
    },

    onMessageChunk: (chunk) => {
      // Task-specific: emit TASK_OUTPUT delta
      socket.emit(SOCKET_EVENTS.TASK_OUTPUT, {
        taskId,
        content: chunk,
        type: 'delta',
        timestamp: Date.now(),
      });
    },

    onStreamingEmit: (accumulated) => {
      // Check if we should start a new message after a tool (132-tool-splits-messages)
      if (pendingNewMessage && accumulated.length > emittedUpToLength) {
        // PERSISTENCE FIX: Finalize the previous message BEFORE creating new one
        // This ensures split messages are persisted to the database
        const previousContent = accumulated.slice(currentMessageStartOffset, emittedUpToLength).trim();
        if (previousContent.length > 0) {
          socket.emit(SOCKET_EVENTS.SESSION_RESPONSE, {
            sessionId: capybaraSessionId,
            message: {
              id: currentMessageId,
              content: previousContent,
              role: 'assistant',
              streaming: false,  // Finalize to trigger persistence
              createdAt: currentMessageCreatedAt,
            },
          });
        }

        // Now create the new message
        currentMessageId = generateMessageId();
        currentMessageCreatedAt = Date.now();
        currentMessageStartOffset = emittedUpToLength;  // New message starts where old ended
        pendingNewMessage = false;
        wasSplit = true;  // Track that a split occurred (for getFinalSegment)
      }

      // Calculate content for this message - from its start offset to current end
      const content = accumulated.slice(currentMessageStartOffset).trimStart();

      // Only emit if there's actual content
      if (content.length > 0 || currentMessageStartOffset === 0) {
        // Session persistence: streaming response
        socket.emit(SOCKET_EVENTS.SESSION_RESPONSE, {
          sessionId: capybaraSessionId,
          message: {
            id: currentMessageId,
            content,
            role: 'assistant',
            streaming: true,
            createdAt: currentMessageCreatedAt,
          },
        });
      }

      // Track total length for detecting new content after tools
      emittedUpToLength = accumulated.length;
    },

    // NOTE: onFinalContent is intentionally NOT implemented here.
    // task-executor.ts handles final persistence manually via apiPost AFTER
    // the stream completes. It also emits TASK_OUTPUT complete via emitOutput.
    // Emitting here would cause double persistence.

    onSessionInit: async ({ claudeSessionId }) => {
      await config.onClaudeSessionCapture?.(claudeSessionId);
    },

    onToolUse: (data: ToolUseData) => {
      socket.emit(SOCKET_EVENTS.SESSION_TOOL_USE, {
        sessionId: capybaraSessionId,
        toolUseId: data.toolUseId,
        toolName: data.toolName,
        input: data.input,
        parentToolUseId: data.parentToolUseId,
        // Use SDK timestamp if available, fallback to Date.now() (102-task-timestamp-fix)
        timestamp: data.timestamp ?? Date.now(),
        messageId: currentMessageId,  // Links tool to current message (132-tool-splits-messages)
      });
      // Mark that next content should start a new message (132-tool-splits-messages)
      pendingNewMessage = true;
    },

    onToolProgress: (data: ToolProgressData) => {
      const toolName = data.toolName || data.tool;

      // 174-task-thinking-indicator: Emit SESSION_ACTIVITY for UI status bar [ACTIVITY] indicator
      // Mirrors bridge-hooks.ts onToolProgress behavior. Without this, the ActivityStatusBar
      // shows nothing during task tool execution because only SESSION_TOOL_USE was emitted
      // (which populates the tool list but doesn't drive the status bar indicator).
      socket.emit(SOCKET_EVENTS.SESSION_ACTIVITY, {
        sessionId: capybaraSessionId,
        activity: {
          type: toolName === 'Task' ? 'subagent' : 'tool_start',
          toolName,
          subagentName: data.agent,
          status: 'running',
        },
      });

      socket.emit(SOCKET_EVENTS.SESSION_TOOL_USE, {
        sessionId: capybaraSessionId,
        toolUseId: data.toolUseId,
        toolName,
        parentToolUseId: data.parentToolUseId,
        elapsedMs: data.elapsedSeconds ? data.elapsedSeconds * 1000 : undefined,
        // Use SDK timestamp if available, fallback to Date.now() (102-task-timestamp-fix)
        timestamp: data.timestamp ?? Date.now(),
        messageId: currentMessageId,  // Links tool to current message (132-tool-splits-messages)
      });
    },

    onToolResult: (data: ToolResultData) => {
      // Emit tool completion with output so UI can mark tool as complete
      socket.emit(SOCKET_EVENTS.SESSION_TOOL_USE, {
        sessionId: capybaraSessionId,
        toolUseId: data.toolUseId,
        toolName: '', // Not available in tool_result, UI will match by toolUseId
        output: data.output,
        error: data.error,
        // Use SDK timestamp if available, fallback to Date.now() (102-task-timestamp-fix)
        timestamp: data.timestamp ?? Date.now(),
        messageId: currentMessageId,  // Links tool to current message (132-tool-splits-messages)
      });
    },

    onResult: async (data: ResultData) => {
      // Emit tool_end activity to signal turn completion (marks all tools as done in UI)
      socket.emit(SOCKET_EVENTS.SESSION_ACTIVITY, {
        sessionId: capybaraSessionId,
        activity: { type: 'tool_end', status: 'complete' },
      });

      // 174-task-thinking-indicator: Emit MESSAGE_STATUS:completed to clear processingSessions in UI
      // For assistant sessions, the server emits this when a turn ends (socket-handlers.ts).
      // For task sessions, we must emit it ourselves since there's no user message to mark complete.
      // The server relays MESSAGE_STATUS from bridge to UI (socket-handlers.ts lines 757-768).
      socket.emit(SOCKET_EVENTS.MESSAGE_STATUS, {
        sessionId: capybaraSessionId,
        messageId: currentMessageId,
        status: 'completed',
      });
      if (data.cost !== undefined) {
        await config.onCostUpdate?.(data.cost);
        // Emit both TASK_COST_UPDATE (for task tracking) and SESSION_COST (for UI display)
        // The UI listens for SESSION_COST to update activityState.cost (102-audit-cost-fix)
        socket.emit(SOCKET_EVENTS.TASK_COST_UPDATE, {
          taskId,
          cost: data.cost,
          timestamp: Date.now(),
        });
        socket.emit(SOCKET_EVENTS.SESSION_COST, {
          sessionId: capybaraSessionId,
          cost: data.cost,
        });
      }
    },
  };
}
