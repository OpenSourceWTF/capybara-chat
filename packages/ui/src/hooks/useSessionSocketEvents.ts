/**
 * useSessionSocketEvents - Centralized socket event handling for sessions
 *
 * Consolidates the repeated socket event patterns across components:
 * - Session response handling
 * - Message status updates
 * - Session error handling
 * - Session lifecycle events (created, hidden, updated)
 *
 * Uses sessionIdRef pattern internally to avoid stale closures.
 */

import { useEffect, useRef, useCallback } from 'react';
import { useSocket } from '../context/SocketContext';
import { SOCKET_EVENTS, MessageStatus, FormEntityType } from '@capybara-chat/types';

// ===== Response Event Types =====

export interface SessionResponseData {
  sessionId: string;
  messageId?: string;  // User message ID (for status tracking)
  message: {
    id: string;
    role: string;
    content: string;
    createdAt: number;
    streaming?: boolean;  // CRITICAL: Was missing - needed for proper message updates
    toolUse?: { name: string; input: unknown; result?: string };
  };
}

export interface MessageStatusData {
  sessionId: string;
  messageId: string;
  status: MessageStatus;
}

export interface SessionErrorData {
  sessionId: string;
  error: string;
}

export interface SessionContextInjectedData {
  sessionId: string;
  messageId?: string;
  entityType: FormEntityType;
  entityId?: string;
  contextType: 'full' | 'minimal';
  contextPreview?: string;
  timestamp?: number;  // 137-context-timing: Server timestamp for correct ordering
}

// ===== Activity Event Types =====

export interface SessionActivityData {
  sessionId: string;
  activity: {
    type: 'tool_start' | 'tool_end' | 'thinking' | 'subagent' | 'resuming' | 'starting';
    toolName?: string;
    subagentName?: string;
    status: 'running' | 'complete' | 'error';
  };
}

export interface SessionProgressData {
  sessionId: string;
  message: string;
  phase?: 'analyzing' | 'implementing' | 'testing' | 'finalizing';
  timestamp?: number;
}

export interface SessionBlockedData {
  sessionId: string;
  reason: string;
  blockedOn: string;
  timestamp?: number;
}

export interface SessionHaltedData {
  sessionId: string;
  reason: 'timeout' | 'cli_error' | 'process_exit';
  errorMessage: string;
  canResume: boolean;
  timestamp?: number;
}

export interface SessionHumanInputData {
  sessionId: string;
  question: string;
  context?: string;
  options?: string[];
  timestamp?: number;
}

export interface SessionHumanInputResponseData {
  sessionId: string;
  response: string;
}

export interface SessionCostData {
  sessionId: string;
  cost: number;
  turnCost?: number;
}

export interface SessionContextResetData {
  sessionId: string;
  reason: string;
  previousClaudeSessionId?: string;
}

export interface SessionThinkingData {
  sessionId: string;
  content: string;
  timestamp: number;
}

// ===== Tool Use Event Types (Task 084, 131-tool-embedding) =====

export interface SessionToolUseData {
  sessionId: string;
  toolUseId: string;
  toolName: string;
  input: unknown;
  output?: unknown;
  error?: string;
  parentToolUseId?: string | null;
  elapsedMs?: number;
  timestamp: number;
  messageId?: string;  // Links tool to parent message for embedding (131-tool-embedding)
}

// ===== Lifecycle Event Types =====

export interface SessionCreatedData {
  session: {
    id: string;
    name?: string;
    startedAt: number;
    lastActivityAt?: number;
  };
}

export interface SessionHiddenData {
  sessionId: string;
}

export interface SessionUpdatedData {
  sessionId: string;
  name?: string;
  lastActivityAt?: number;
  messageCount?: number;
  lastMessagePreview?: string;
  hasUnread?: boolean;
}

// ===== Hook Types =====

export interface UseSessionResponseEventsOptions {
  /** The current session ID to filter events for */
  sessionId: string | null;
  /** Handler for assistant response messages */
  onResponse?: (data: SessionResponseData) => void;
  /** Handler for message status updates */
  onMessageStatus?: (data: MessageStatusData) => void;
  /** Handler for session errors */
  onError?: (data: SessionErrorData) => void;
  /** Handler for context injection events */
  onContextInjected?: (data: SessionContextInjectedData) => void;
}

export interface UseSessionLifecycleEventsOptions {
  /** Handler for new session creation */
  onCreated?: (data: SessionCreatedData) => void;
  /** Handler for session hidden/deleted */
  onHidden?: (data: SessionHiddenData) => void;
  /** Handler for session updates */
  onUpdated?: (data: SessionUpdatedData) => void;
}

/**
 * Hook for handling session response events (messages, status, errors).
 * Filters events to only the current sessionId.
 *
 * @example
 * useSessionResponseEvents({
 *   sessionId,
 *   onResponse: (data) => addAssistantMessage(data.message),
 *   onMessageStatus: (data) => updateMessageStatus(data.messageId, data.status),
 *   onError: (data) => console.error('Session error:', data.error),
 * });
 */
export function useSessionResponseEvents(options: UseSessionResponseEventsOptions): void {
  const { sessionId, onResponse, onMessageStatus, onError, onContextInjected } = options;
  const { on, off } = useSocket();

  // Use ref to track current session for closure safety
  const sessionIdRef = useRef(sessionId);
  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  // Memoized handlers that check sessionId
  const handleResponse = useCallback((data: SessionResponseData) => {
    if (data.sessionId === sessionIdRef.current) {
      onResponse?.(data);
    }
  }, [onResponse]);

  const handleMessageStatus = useCallback((data: MessageStatusData) => {
    if (data.sessionId === sessionIdRef.current) {
      onMessageStatus?.(data);
    }
  }, [onMessageStatus]);

  const handleError = useCallback((data: SessionErrorData) => {
    if (data.sessionId === sessionIdRef.current) {
      onError?.(data);
    }
  }, [onError]);

  const handleContextInjected = useCallback((data: SessionContextInjectedData) => {
    if (data.sessionId === sessionIdRef.current) {
      onContextInjected?.(data);
    }
  }, [onContextInjected]);

  // Register/unregister event listeners
  useEffect(() => {
    if (!sessionId) return;

    if (onResponse) {
      on(SOCKET_EVENTS.SESSION_RESPONSE, handleResponse);
    }
    if (onMessageStatus) {
      on(SOCKET_EVENTS.MESSAGE_STATUS, handleMessageStatus);
    }
    if (onError) {
      on(SOCKET_EVENTS.SESSION_ERROR, handleError);
    }
    if (onContextInjected) {
      on(SOCKET_EVENTS.SESSION_CONTEXT_INJECTED, handleContextInjected);
    }

    return () => {
      if (onResponse) {
        off(SOCKET_EVENTS.SESSION_RESPONSE, handleResponse);
      }
      if (onMessageStatus) {
        off(SOCKET_EVENTS.MESSAGE_STATUS, handleMessageStatus);
      }
      if (onError) {
        off(SOCKET_EVENTS.SESSION_ERROR, handleError);
      }
      if (onContextInjected) {
        off(SOCKET_EVENTS.SESSION_CONTEXT_INJECTED, handleContextInjected);
      }
    };
  }, [sessionId, on, off, onResponse, onMessageStatus, onError, onContextInjected, handleResponse, handleMessageStatus, handleError, handleContextInjected]);
}

/**
 * Hook for handling session lifecycle events (created, hidden, updated).
 * These events are not filtered by sessionId - they apply globally.
 *
 * @example
 * useSessionLifecycleEvents({
 *   onCreated: (data) => addSession(data.session),
 *   onHidden: (data) => removeSession(data.sessionId),
 *   onUpdated: (data) => updateSession(data.sessionId, data),
 * });
 */
export function useSessionLifecycleEvents(options: UseSessionLifecycleEventsOptions): void {
  const { onCreated, onHidden, onUpdated } = options;
  const { on, off } = useSocket();

  useEffect(() => {
    if (onCreated) {
      on(SOCKET_EVENTS.SESSION_CREATED, onCreated);
    }
    if (onHidden) {
      on(SOCKET_EVENTS.SESSION_HIDDEN, onHidden);
    }
    if (onUpdated) {
      on(SOCKET_EVENTS.SESSION_UPDATED, onUpdated);
    }

    return () => {
      if (onCreated) {
        off(SOCKET_EVENTS.SESSION_CREATED, onCreated);
      }
      if (onHidden) {
        off(SOCKET_EVENTS.SESSION_HIDDEN, onHidden);
      }
      if (onUpdated) {
        off(SOCKET_EVENTS.SESSION_UPDATED, onUpdated);
      }
    };
  }, [on, off, onCreated, onHidden, onUpdated]);
}

// ===== Activity Events Hook =====

export interface UseSessionActivityEventsOptions {
  /** The current session ID to filter events for */
  sessionId: string | null;
  /** Handler for tool/subagent activity */
  onActivity?: (data: SessionActivityData) => void;
  /** Handler for progress updates */
  onProgress?: (data: SessionProgressData) => void;
  /** Handler for blocked state */
  onBlocked?: (data: SessionBlockedData) => void;
  /** Handler for halted state (189: timeout/error with resume capability) */
  onHalted?: (data: SessionHaltedData) => void;
  /** Handler for human input requests */
  onHumanInputRequested?: (data: SessionHumanInputData) => void;
  /** Handler for cost updates */
  onCost?: (data: SessionCostData) => void;
  /** Handler for context reset notifications */
  onContextReset?: (data: SessionContextResetData) => void;
  /** Handler for thinking/reasoning content blocks */
  onThinking?: (data: SessionThinkingData) => void;
}

/**
 * Hook for handling session activity events (tool use, progress, blocked, human input).
 * Filters events to only the current sessionId.
 *
 * @example
 * useSessionActivityEvents({
 *   sessionId,
 *   onActivity: (data) => setActivity(data.activity),
 *   onProgress: (data) => setProgress(data.percentComplete),
 *   onBlocked: (data) => setBlocked(data.reason),
 *   onHumanInputRequested: (data) => showHumanInputModal(data),
 *   onCost: (data) => setCost(data.cost),
 *   onContextReset: (data) => showContextResetBanner(data.reason),
 * });
 */
export function useSessionActivityEvents(options: UseSessionActivityEventsOptions): void {
  const { sessionId, onActivity, onProgress, onBlocked, onHalted, onHumanInputRequested, onCost, onContextReset, onThinking } = options;
  const { on, off } = useSocket();

  // Use ref to track current session for closure safety
  const sessionIdRef = useRef(sessionId);
  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  // Memoized handlers that check sessionId
  const handleActivity = useCallback((data: SessionActivityData) => {
    if (data.sessionId === sessionIdRef.current) {
      onActivity?.(data);
    }
  }, [onActivity]);

  const handleProgress = useCallback((data: SessionProgressData) => {
    if (data.sessionId === sessionIdRef.current) {
      onProgress?.(data);
    }
  }, [onProgress]);

  const handleBlocked = useCallback((data: SessionBlockedData) => {
    if (data.sessionId === sessionIdRef.current) {
      onBlocked?.(data);
    }
  }, [onBlocked]);

  const handleHalted = useCallback((data: SessionHaltedData) => {
    if (data.sessionId === sessionIdRef.current) {
      onHalted?.(data);
    }
  }, [onHalted]);

  const handleHumanInput = useCallback((data: SessionHumanInputData) => {
    if (data.sessionId === sessionIdRef.current) {
      onHumanInputRequested?.(data);
    }
  }, [onHumanInputRequested]);

  const handleCost = useCallback((data: SessionCostData) => {
    if (data.sessionId === sessionIdRef.current) {
      onCost?.(data);
    }
  }, [onCost]);

  const handleContextReset = useCallback((data: SessionContextResetData) => {
    if (data.sessionId === sessionIdRef.current) {
      onContextReset?.(data);
    }
  }, [onContextReset]);

  const handleThinking = useCallback((data: SessionThinkingData) => {
    if (data.sessionId === sessionIdRef.current) {
      onThinking?.(data);
    }
  }, [onThinking]);

  // Register/unregister event listeners
  useEffect(() => {
    if (!sessionId) return;

    if (onActivity) {
      on(SOCKET_EVENTS.SESSION_ACTIVITY, handleActivity);
    }
    if (onProgress) {
      on(SOCKET_EVENTS.SESSION_PROGRESS, handleProgress);
    }
    if (onBlocked) {
      on(SOCKET_EVENTS.SESSION_BLOCKED, handleBlocked);
    }
    if (onHalted) {
      on(SOCKET_EVENTS.SESSION_HALTED, handleHalted);
    }
    if (onHumanInputRequested) {
      on(SOCKET_EVENTS.SESSION_HUMAN_INPUT_REQUESTED, handleHumanInput);
    }
    if (onCost) {
      on(SOCKET_EVENTS.SESSION_COST, handleCost);
    }
    if (onContextReset) {
      on(SOCKET_EVENTS.SESSION_CONTEXT_RESET, handleContextReset);
    }
    if (onThinking) {
      on(SOCKET_EVENTS.SESSION_THINKING, handleThinking);
    }

    return () => {
      if (onActivity) {
        off(SOCKET_EVENTS.SESSION_ACTIVITY, handleActivity);
      }
      if (onProgress) {
        off(SOCKET_EVENTS.SESSION_PROGRESS, handleProgress);
      }
      if (onBlocked) {
        off(SOCKET_EVENTS.SESSION_BLOCKED, handleBlocked);
      }
      if (onHalted) {
        off(SOCKET_EVENTS.SESSION_HALTED, handleHalted);
      }
      if (onHumanInputRequested) {
        off(SOCKET_EVENTS.SESSION_HUMAN_INPUT_REQUESTED, handleHumanInput);
      }
      if (onCost) {
        off(SOCKET_EVENTS.SESSION_COST, handleCost);
      }
      if (onContextReset) {
        off(SOCKET_EVENTS.SESSION_CONTEXT_RESET, handleContextReset);
      }
      if (onThinking) {
        off(SOCKET_EVENTS.SESSION_THINKING, handleThinking);
      }
    };
  }, [sessionId, on, off, onActivity, onProgress, onBlocked, onHalted, onHumanInputRequested, onCost, onContextReset, onThinking, handleActivity, handleProgress, handleBlocked, handleHalted, handleHumanInput, handleCost, handleContextReset, handleThinking]);
}

// ===== Tool Use Events Hook (Task 084) =====

export interface UseSessionToolUseEventsOptions {
  /** The current session ID to filter events for */
  sessionId: string | null;
  /** Handler for tool use events (invocation, completion, progress) */
  onToolUse?: (data: SessionToolUseData) => void;
}

/**
 * Hook for handling SESSION_TOOL_USE events.
 * These events provide detailed tool invocation data for inline display.
 *
 * @example
 * useSessionToolUseEvents({
 *   sessionId,
 *   onToolUse: (data) => addToolUseToTimeline(data),
 * });
 */
export function useSessionToolUseEvents(options: UseSessionToolUseEventsOptions): void {
  const { sessionId, onToolUse } = options;
  const { on, off } = useSocket();

  // Use ref to track current session for closure safety
  const sessionIdRef = useRef(sessionId);
  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  // Memoized handler that checks sessionId
  const handleToolUse = useCallback((data: SessionToolUseData) => {
    if (data.sessionId === sessionIdRef.current) {
      onToolUse?.(data);
    }
  }, [onToolUse]);

  // Register/unregister event listeners
  useEffect(() => {
    if (!sessionId || !onToolUse) return;

    on(SOCKET_EVENTS.SESSION_TOOL_USE, handleToolUse);

    return () => {
      off(SOCKET_EVENTS.SESSION_TOOL_USE, handleToolUse);
    };
  }, [sessionId, on, off, onToolUse, handleToolUse]);
}
