/**
 * Shared Streaming Types
 *
 * Interfaces for the hook-based stream processor used by both
 * bridge.ts (assistant sessions) and task-executor.ts (background tasks).
 *
 * Design source: 088-shared-streaming-loop-design
 */

/** Message types from Claude SDK streaming */
export type StreamMessageType =
  | 'message'
  | 'session_init'
  | 'complete'
  | 'error'
  | 'tool_use'
  | 'tool_progress'
  | 'result';

/** Data structure for tool use events */
export interface ToolUseData {
  toolUseId: string;
  toolName: string;
  input?: unknown;
  parentToolUseId?: string | null;
  source?: string;
  /** Timestamp from SDK event (102-timestamp-ordering-fix) */
  timestamp?: number;
}

/** Data structure for tool progress events */
export interface ToolProgressData {
  toolUseId?: string;
  toolName?: string;
  tool?: string; // Legacy field
  agent?: string; // Legacy field (subagent name)
  parentToolUseId?: string | null;
  elapsedSeconds?: number;
  /** Timestamp from SDK event (102-timestamp-ordering-fix) */
  timestamp?: number;
}

/** Data structure for tool result events (tool completed with output) */
export interface ToolResultData {
  toolUseId: string;
  output: unknown;
  error?: string;
  /** Timestamp from SDK event (102-timestamp-ordering-fix) */
  timestamp?: number;
}

/** Data structure for result events */
export interface ResultData {
  cost?: number;
  subtype?: string;
  result?: string; // Important: may contain subagent output
}

/** Data structure for session init events */
export interface SessionInitData {
  claudeSessionId: string;
}

/**
 * Hook callbacks for stream event handling.
 * All hooks are optional - processor handles core logic.
 */
export interface StreamEventHooks {
  // Content handling
  /** Called when a message chunk is received */
  onMessageChunk?: (chunk: string, accumulated: string) => void;
  /** Called to emit streaming updates to clients */
  onStreamingEmit?: (accumulated: string) => void;
  /** Called with final accumulated content when stream ends */
  onFinalContent?: (content: string) => void;

  // Session management
  /** Called when Claude session ID is captured */
  onSessionInit?: (data: SessionInitData) => void | Promise<void>;

  // Tool events
  /** Called when a tool is invoked */
  onToolUse?: (data: ToolUseData) => void;
  /** Called for tool progress updates */
  onToolProgress?: (data: ToolProgressData) => void;
  /** Called when a tool completes with output */
  onToolResult?: (data: ToolResultData) => void;

  // Result/completion
  /** Called when result message is received (contains cost and final output) */
  onResult?: (data: ResultData) => void | Promise<void>;
  /** Called when stream completes */
  onComplete?: () => void;

  // Error handling
  /** Called when an error occurs in the stream */
  onError?: (error: string) => void;

  // Thinking/reasoning content
  /** Called when thinking/reasoning content is received from Claude */
  onThinking?: (content: string) => void;

  // Activity tracking (optional - bridge uses, task-executor doesn't)
  /** Called when activity starts (e.g., 'thinking') */
  onActivityStart?: (type: string) => void;
  /** Called when activity ends */
  onActivityEnd?: (type: string) => void;
}

/**
 * Configuration for stream processing
 */
export interface StreamProcessorConfig {
  /** Capybara session ID */
  sessionId: string;
  /** Pre-generated message ID for consistent response tracking */
  messageId: string;
  /** Pre-generated timestamp for consistent message metadata */
  createdAt: number;
  /** Optional abort signal for cancellation */
  abortSignal?: AbortSignal;
  /**
   * Capture result.result text into accumulated content.
   * This captures subagent output and other result text.
   * DEFAULT: true (use `false` to disable)
   */
  captureResultText?: boolean;
  /**
   * Callback invoked on every stream event (137-idle-timeout).
   * Used for resetting idle timeouts in long-running operations.
   * Called with the message type for each event received.
   */
  onStreamActivity?: (messageType: string) => void;
}

/**
 * Result of stream processing
 */
export interface StreamProcessorResult {
  /** Accumulated content from all messages */
  content: string;
  /** Claude session ID if captured from session_init */
  claudeSessionId?: string;
  /** Total cost from result message */
  cost?: number;
  /** Whether the stream was aborted */
  wasAborted: boolean;
}
