/**
 * Bridge Stream Hooks
 *
 * Hook factory for assistant sessions in bridge.ts.
 * Emits socket events for real-time UI updates.
 *
 * Design source: 088-shared-streaming-loop-design
 * Enhanced: 132-tool-splits-messages (tool-triggered message splitting)
 */

import type { Socket } from 'socket.io-client';
import { SOCKET_EVENTS, generateMessageId, createLogger } from '@capybara-chat/types';
import type { StreamEventHooks, ToolUseData, ToolProgressData, ToolResultData, ResultData } from './types.js';
import { createIdleTimeout } from './timeout-wrapper.js';
import {
  SUBAGENT_TIMEOUT_MS,
  MAX_METRICS_SIZE,
  STALL_DETECTION_MS,
  ENABLE_SUBAGENT_TIMEOUT,
  ENABLE_CIRCUIT_BREAKER,
} from '../config.js';
import { circuitBreaker } from '../circuit-breaker.js';

const logger = createLogger('BridgeHooks');

// ============================================
// SUBAGENT TIMEOUT STATE MANAGEMENT
// ============================================

/**
 * Metrics tracked per subagent invocation.
 * Used for stall detection and debugging.
 */
interface SubagentMetric {
  subagentType: string;
  startedAt: number;
  lastProgressAt: number;
  progressCount: number;
  toolUseId: string;
}

/**
 * Map of active subagent timeouts (toolUseId -> cleanup function).
 * Cleanup function clears the timeout to prevent resource leak.
 */
const subagentTimeouts = new Map<string, { cleanup: () => void }>();

/**
 * Map of active subagent metrics (toolUseId -> metrics).
 * Subject to MAX_METRICS_SIZE limit to prevent unbounded growth.
 */
const subagentMetrics = new Map<string, SubagentMetric>();

/**
 * Configuration for bridge stream hooks
 */
export interface BridgeHooksConfig {
  /** Socket.io client for server communication */
  socket: Socket;
  /** Capybara session ID */
  sessionId: string;
  /** Pre-generated message ID for response */
  messageId: string;
  /** Pre-generated timestamp for response */
  createdAt: number;
  /** User's original message ID (for marking as completed) */
  userMessageId?: string;
  /** Callback when Claude session ID is captured */
  onClaudeSessionCapture?: (id: string) => void;
}

/**
 * Final segment info returned by getFinalSegment().
 * Used by message-handler.ts to correctly emit the final message.
 */
export interface FinalSegmentInfo {
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
export interface BridgeHooksWithSegmentInfo extends StreamEventHooks {
  /** Get info about the final message segment for correct persistence */
  getFinalSegment(): FinalSegmentInfo;
}

/**
 * Cleanup subagent timeout and metrics.
 * Safe to call multiple times (idempotent).
 * Addresses GAP-002 (multi-path cleanup) and GAP-004 (metrics leak).
 *
 * @param toolUseId - The tool use ID to clean up
 * @param reason - Why cleanup is happening (for logging)
 */
function cleanupSubagentResources(toolUseId: string, reason: string) {
  // Cleanup timeout
  const timeoutHandle = subagentTimeouts.get(toolUseId);
  if (timeoutHandle) {
    timeoutHandle.cleanup();
    subagentTimeouts.delete(toolUseId);
    logger.debug('[SubagentCleanup] Cleared timeout', { toolUseId, reason });
  }

  // Cleanup metrics (addresses GAP-004)
  const metric = subagentMetrics.get(toolUseId);
  if (metric) {
    const duration = Date.now() - metric.startedAt;
    logger.info('[SubagentCleanup] Removed metric', {
      toolUseId,
      reason,
      subagentType: metric.subagentType,
      duration,
      progressCount: metric.progressCount,
    });
    subagentMetrics.delete(toolUseId);
  }
}

/**
 * Create hooks for assistant session streaming.
 *
 * Emits:
 * - SESSION_RESPONSE (streaming only - final is handled by bridge.ts after post-processing)
 * - SESSION_CLAUDE_ID (session init)
 * - SESSION_TOOL_USE (tool events)
 * - SESSION_ACTIVITY (tool progress)
 * - SESSION_COST (result)
 *
 * Tool-triggered message splitting (132-tool-splits-messages):
 * When a tool is used, subsequent text content starts a new message.
 * This makes tools appear BETWEEN message segments rather than after.
 *
 * Returns BridgeHooksWithSegmentInfo which includes getFinalSegment() for
 * correct final message emission by message-handler.ts.
 */
export function createBridgeHooks(config: BridgeHooksConfig): BridgeHooksWithSegmentInfo {
  const { socket, sessionId, messageId, createdAt, userMessageId, onClaudeSessionCapture } = config;

  // Message splitting state (132-tool-splits-messages)
  let currentMessageId = messageId;
  let currentMessageCreatedAt = createdAt;
  let currentMessageStartOffset = 0;  // Where current message content starts in accumulated
  let emittedUpToLength = 0;          // Total length processed (for detecting new content)
  let pendingNewMessage = false;
  let wasSplit = false;               // Track if any splits occurred (for getFinalSegment)

  // 137-tool-nesting: Track active Task tools to infer parentToolUseId for child tools
  // When SDK doesn't provide parent_tool_use_id, we use the most recent active Task
  // Stack for nested Tasks (e.g., Task spawns Task which spawns tools)
  const activeTaskStack: string[] = [];

  return {
    /**
     * Get info about the current (final) message segment.
     * Used by message-handler.ts to emit the correct final message after streaming.
     *
     * This is critical for GAP-003/GAP-004 fix:
     * - Returns current message ID (not original) if tools were used
     * - Returns correct startOffset for content slicing
     * - Allows message-handler.ts to finalize the LAST segment properly
     */
    getFinalSegment(): FinalSegmentInfo {
      return {
        id: currentMessageId,
        startOffset: currentMessageStartOffset,
        createdAt: currentMessageCreatedAt,
        wasSplit,
      };
    },

    onStreamingEmit: (accumulated) => {
      // Check if we should start a new message after a tool (132-tool-splits-messages)
      if (pendingNewMessage && accumulated.length > emittedUpToLength) {
        // PERSISTENCE FIX: Finalize the previous message BEFORE creating new one
        // This ensures split messages are persisted to the database
        const previousContent = accumulated.slice(currentMessageStartOffset, emittedUpToLength).trim();
        if (previousContent.length > 0) {
          socket.emit(SOCKET_EVENTS.SESSION_RESPONSE, {
            sessionId,
            messageId: userMessageId,  // User's message ID for completion tracking
            message: {
              id: currentMessageId,
              content: previousContent,
              role: 'assistant',
              streaming: false,  // Finalize to trigger persistence
              createdAt: currentMessageCreatedAt,
            },
          });

          // GAP-008 FIX: Only create new messageId if previous segment had content
          // If previous was empty (tools came first), keep same messageId so tools
          // link to the message that will eventually have content
          currentMessageId = generateMessageId();
          currentMessageCreatedAt = Date.now();
          currentMessageStartOffset = emittedUpToLength;  // New message starts where old ended
          wasSplit = true;  // Track that a split occurred (for getFinalSegment)
        }
        // If previousContent is empty, DON'T create new messageId
        // Tools will correctly link to the message that gets the actual content
        pendingNewMessage = false;
      }

      // Calculate content for this message - from its start offset to current end
      const content = accumulated.slice(currentMessageStartOffset).trimStart();

      // Only emit if there's actual content
      if (content.length > 0 || currentMessageStartOffset === 0) {
        socket.emit(SOCKET_EVENTS.SESSION_RESPONSE, {
          sessionId,
          messageId: userMessageId,  // User's message ID for completion tracking
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
    // bridge.ts handles final emission manually AFTER auto-document processing,
    // which may modify the content. Emitting here would cause double persistence.

    onSessionInit: ({ claudeSessionId }) => {
      onClaudeSessionCapture?.(claudeSessionId);
      socket.emit(SOCKET_EVENTS.SESSION_CLAUDE_ID, { sessionId, claudeSessionId });
    },

    onToolUse: (data: ToolUseData) => {
      // 137-tool-nesting: If this is a Task tool, push to active stack (if not already there)
      // Check prevents duplicates if events arrive out of order (GAP-001 fix)
      if (data.toolName === 'Task' && !activeTaskStack.includes(data.toolUseId)) {
        activeTaskStack.push(data.toolUseId);

        // Defensive check for subagent_type (addresses GAP-010, GAP-009 fix: better type assertion)
        const input = data.input as { subagent_type?: string; type?: string } | undefined;
        const subagentType = input?.subagent_type || input?.type || 'unknown';

        // === INITIALIZE METRICS (GAP-002/GAP-010 fix: create BEFORE circuit breaker check) ===

        // Check size limit before adding (addresses GAP-004)
        if (subagentMetrics.size >= MAX_METRICS_SIZE) {
          // Find oldest metric by startedAt
          const oldestEntry = Array.from(subagentMetrics.entries())
            .sort(([, a], [, b]) => a.startedAt - b.startedAt)[0];

          if (oldestEntry) {
            logger.warn('[SubagentMetrics] Map at max size, removing oldest', {
              toolUseId: oldestEntry[0],
              age: Date.now() - oldestEntry[1].startedAt,
              maxSize: MAX_METRICS_SIZE,
            });
            subagentMetrics.delete(oldestEntry[0]);
          }
        }

        // Add new metric (always, so circuit breaker can record outcomes even when blocked)
        subagentMetrics.set(data.toolUseId, {
          subagentType,
          startedAt: Date.now(),
          lastProgressAt: Date.now(),
          progressCount: 0,
          toolUseId: data.toolUseId,
        });

        // === CIRCUIT BREAKER CHECK (087-prevent-subagent-hangs) ===
        if (ENABLE_CIRCUIT_BREAKER && !circuitBreaker.shouldAllow(subagentType)) {
          logger.error('[CircuitBreaker] Subagent blocked by circuit breaker', {
            toolUseId: data.toolUseId,
            subagentType,
          });

          // Record failure immediately (since we have metric now)
          circuitBreaker.recordFailure(subagentType);

          // Cleanup resources (metric was just created)
          cleanupSubagentResources(data.toolUseId, 'circuit_breaker_blocked');

          // Emit error event
          socket.emit(SOCKET_EVENTS.SESSION_ACTIVITY, {
            sessionId,
            activity: {
              type: 'tool_end',
              toolName: 'Task',
              subagentName: subagentType,
              status: 'error',
            },
          });

          // Remove from stack since we're not spawning it (GAP-008 fix: use splice not pop)
          const stackIndex = activeTaskStack.indexOf(data.toolUseId);
          if (stackIndex !== -1) {
            activeTaskStack.splice(stackIndex, 1);
          }

          // Don't spawn the subagent
          return;
        }

        // === PER-SUBAGENT TIMEOUT (087-prevent-subagent-hangs) ===

        // Only set up timeout if feature is enabled
        if (ENABLE_SUBAGENT_TIMEOUT) {
          // Use createIdleTimeout for consistency (addresses GAP-009)
          const { cleanup } = createIdleTimeout(
            SUBAGENT_TIMEOUT_MS,
            `Subagent ${subagentType} (${data.toolUseId}) exceeded timeout of ${SUBAGENT_TIMEOUT_MS}ms`
          );

          // Wrap cleanup to emit warning on timeout
          const timeoutWithWarning = {
            cleanup: () => {
              cleanup();

              // Check socket connection before emitting (addresses GAP-011)
              if (socket.connected) {
                socket.emit(SOCKET_EVENTS.SESSION_ACTIVITY, {
                  sessionId,
                  activity: {
                    type: 'subagent_timeout',
                    toolUseId: data.toolUseId,
                    subagentName: subagentType,
                    elapsedMs: SUBAGENT_TIMEOUT_MS,
                    status: 'timeout',
                  },
                });
              } else {
                logger.warn('[SubagentTimeout] Socket disconnected, timeout event not sent', {
                  toolUseId: data.toolUseId,
                });
              }

              // Log warning (addresses GAP-001 - timeout doesn't cancel, just warns)
              logger.warn('[SubagentTimeout] Subagent exceeded timeout (still running)', {
                toolUseId: data.toolUseId,
                subagentType,
                elapsed: SUBAGENT_TIMEOUT_MS,
                note: 'Absolute deadline will terminate if still running at 60 minutes',
              });
            },
          };

          subagentTimeouts.set(data.toolUseId, timeoutWithWarning);
        } // End ENABLE_SUBAGENT_TIMEOUT
      }

      // 137-tool-nesting: Infer parentToolUseId from active Task stack if not provided
      // This ensures child tools nest under their parent Task even when SDK doesn't set it
      const effectiveParentId = data.parentToolUseId ??
        (data.toolName !== 'Task' && activeTaskStack.length > 0
          ? activeTaskStack[activeTaskStack.length - 1]
          : undefined);

      socket.emit(SOCKET_EVENTS.SESSION_TOOL_USE, {
        sessionId,
        toolUseId: data.toolUseId,
        toolName: data.toolName,
        input: data.input,
        parentToolUseId: effectiveParentId,
        // Use SDK timestamp if available, fallback to Date.now() (102-timestamp-ordering-fix)
        timestamp: data.timestamp ?? Date.now(),
        messageId: currentMessageId,  // Links tool to current message (132-tool-splits-messages)
      });
      // Mark that next content should start a new message (132-tool-splits-messages)
      pendingNewMessage = true;
    },

    onToolProgress: (data: ToolProgressData) => {
      const toolName = data.toolName || data.tool;
      socket.emit(SOCKET_EVENTS.SESSION_ACTIVITY, {
        sessionId,
        activity: {
          type: toolName === 'Task' ? 'subagent' : 'tool_start',
          toolName,
          subagentName: data.agent,
          status: 'running',
        },
      });

      // === UPDATE METRICS (087-prevent-subagent-hangs) ===
      if (data.toolUseId) {
        const metric = subagentMetrics.get(data.toolUseId);
        if (metric) {
          const now = Date.now();
          const timeSinceLastProgress = now - metric.lastProgressAt;

          // Update progress tracking
          metric.lastProgressAt = now;
          metric.progressCount++;

          // Stall detection (log only, don't cancel)
          if (timeSinceLastProgress > STALL_DETECTION_MS) {
            logger.warn('[SubagentStall] No progress for extended period', {
              toolUseId: data.toolUseId,
              subagentType: metric.subagentType,
              stallDuration: timeSinceLastProgress,
              progressCount: metric.progressCount,
            });
          }
        }
      }

      // 137-tool-nesting: If this is a Task, push to stack (if not already there)
      if (toolName === 'Task' && data.toolUseId && !activeTaskStack.includes(data.toolUseId)) {
        activeTaskStack.push(data.toolUseId);
      }

      // Also emit detailed SESSION_TOOL_USE for tool progress (provides elapsed time)
      if (data.toolUseId && toolName) {
        // 137-tool-nesting: Infer parentToolUseId from active Task stack if not provided
        const effectiveParentId = data.parentToolUseId ??
          (toolName !== 'Task' && activeTaskStack.length > 0
            ? activeTaskStack[activeTaskStack.length - 1]
            : undefined);

        socket.emit(SOCKET_EVENTS.SESSION_TOOL_USE, {
          sessionId,
          toolUseId: data.toolUseId,
          toolName,
          parentToolUseId: effectiveParentId,
          elapsedMs: data.elapsedSeconds ? data.elapsedSeconds * 1000 : undefined,
          // Use SDK timestamp if available, fallback to Date.now() (102-timestamp-ordering-fix)
          timestamp: data.timestamp ?? Date.now(),
          messageId: currentMessageId,  // Links tool to current message (132-tool-splits-messages)
        });
      }
    },

    onToolResult: (data: ToolResultData) => {
      // Get metric to know subagent type (before cleanup deletes it)
      const metric = subagentMetrics.get(data.toolUseId);

      // === CLEANUP RESOURCES (087-prevent-subagent-hangs) ===
      // Addresses GAP-002 (multi-path cleanup) and GAP-004 (metrics leak)
      cleanupSubagentResources(data.toolUseId, 'tool_result');

      // === CIRCUIT BREAKER OUTCOME (087-prevent-subagent-hangs) ===
      if (ENABLE_CIRCUIT_BREAKER && metric) {
        if (data.error) {
          circuitBreaker.recordFailure(metric.subagentType);
        } else {
          circuitBreaker.recordSuccess(metric.subagentType);
        }
      }

      // Emit tool completion with output so UI can mark tool as complete
      socket.emit(SOCKET_EVENTS.SESSION_TOOL_USE, {
        sessionId,
        toolUseId: data.toolUseId,
        toolName: '', // Not available in tool_result, UI will match by toolUseId
        output: data.output,
        error: data.error,
        // Use SDK timestamp if available, fallback to Date.now() (102-timestamp-ordering-fix)
        timestamp: data.timestamp ?? Date.now(),
        messageId: currentMessageId,  // Links tool to current message (132-tool-splits-messages)
      });

      // 137-tool-nesting: Pop from Task stack if this is a completed Task
      // Note: toolName not available in tool_result, so check if toolUseId is in stack
      const stackIndex = activeTaskStack.indexOf(data.toolUseId);
      if (stackIndex !== -1) {
        activeTaskStack.splice(stackIndex, 1);

        // 185-subagent-activity-streaming: Emit activity completion for subagents
        // Without this, the "Subagent: ..." status lingers until the entire turn ends
        socket.emit(SOCKET_EVENTS.SESSION_ACTIVITY, {
          sessionId,
          activity: { type: 'subagent', toolName: 'Task', status: 'complete' },
        });
      }
    },

    onThinking: (content: string) => {
      socket.emit(SOCKET_EVENTS.SESSION_THINKING, {
        sessionId,
        content,
        timestamp: Date.now(),
      });
    },

    onResult: (data: ResultData) => {
      socket.emit(SOCKET_EVENTS.SESSION_ACTIVITY, {
        sessionId,
        activity: { type: 'tool_end', status: 'complete' },
      });
      if (data.cost !== undefined) {
        socket.emit(SOCKET_EVENTS.SESSION_COST, {
          sessionId,
          cost: data.cost,
        });
      }
    },
  };
}

/**
 * Handle session end - cleanup resources for all active subagents.
 * This catches the case where CLI crashes and tool_result never fires.
 * Addresses GAP-002 (multi-path cleanup).
 *
 * @param sessionId - The session ID that ended
 * @param activeTaskStack - Reference to the active task stack to clean
 */
export function handleSessionEnd(sessionId: string, activeTaskStack: string[]) {
  logger.info('[SessionEnd] Cleaning up subagent resources', {
    sessionId,
    activeSubagents: activeTaskStack.length,
  });

  // Clean up all active subagents for this session
  // Note: activeTaskStack contains tool IDs currently running
  const toolIdsToCleanup = [...activeTaskStack];  // Copy array

  toolIdsToCleanup.forEach(toolUseId => {
    cleanupSubagentResources(toolUseId, 'session_end');
  });

  // Clear active stack for this session
  activeTaskStack.length = 0;

  logger.info('[SessionEnd] Cleanup complete', {
    sessionId,
    cleanedUp: toolIdsToCleanup.length,
  });
}

/**
 * Cleanup all subagent resources during bridge shutdown.
 * Addresses GAP-002 (multi-path cleanup).
 * Called from gracefulShutdown in bridge.ts.
 */
export function cleanupAllSubagentResources() {
  logger.info('[Shutdown] Clearing subagent timeouts', {
    count: subagentTimeouts.size,
  });

  subagentTimeouts.forEach((handle, toolUseId) => {
    handle.cleanup();
  });
  subagentTimeouts.clear();

  logger.info('[Shutdown] Clearing subagent metrics', {
    count: subagentMetrics.size,
  });
  subagentMetrics.clear();
}
