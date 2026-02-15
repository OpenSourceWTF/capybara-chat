/**
 * useSessionActivityState - Manages activity display state for a session
 *
 * Combines all activity-related socket events into a single reducer-based state.
 * Handles edge cases like activity timeout, disconnect clearing, etc.
 */

import { useReducer, useEffect, useCallback } from 'react';
import { useSocket } from '../context/SocketContext';
import { SOCKET_EVENTS } from '@capybara-chat/types';
import { useSessionActivityEvents } from './useSessionSocketEvents';
import type {
  SessionActivityData,
  SessionProgressData,
  SessionBlockedData,
  SessionHaltedData,
  SessionHumanInputData,
  SessionCostData,
  SessionContextResetData,
} from './useSessionSocketEvents';

// ===== State Types =====

export interface SessionActivityState {
  activity: SessionActivityData['activity'] | null;
  progress: SessionProgressData | null;
  blocked: SessionBlockedData | null;
  halted: SessionHaltedData | null;
  humanRequest: SessionHumanInputData | null;
  contextReset: SessionContextResetData | null;
  cost: number;
}

type SessionActivityAction =
  | { type: 'SET_ACTIVITY'; payload: SessionActivityData['activity'] | null }
  | { type: 'SET_PROGRESS'; payload: SessionProgressData | null }
  | { type: 'SET_BLOCKED'; payload: SessionBlockedData | null }
  | { type: 'SET_HALTED'; payload: SessionHaltedData | null }
  | { type: 'SET_HUMAN_REQUEST'; payload: SessionHumanInputData | null }
  | { type: 'SET_CONTEXT_RESET'; payload: SessionContextResetData | null }
  | { type: 'SET_COST'; payload: number }
  | { type: 'CLEAR_ALL' };

const initialState: SessionActivityState = {
  activity: null,
  progress: null,
  blocked: null,
  halted: null,
  humanRequest: null,
  contextReset: null,
  cost: 0,
};

function activityReducer(
  state: SessionActivityState,
  action: SessionActivityAction
): SessionActivityState {
  switch (action.type) {
    case 'SET_ACTIVITY':
      // 189-session-failure-ui: Clear halted state when resuming
      if (action.payload?.type === 'resuming') {
        return { ...state, activity: action.payload, halted: null };
      }
      return { ...state, activity: action.payload };
    case 'SET_PROGRESS':
      return { ...state, progress: action.payload };
    case 'SET_BLOCKED':
      return { ...state, blocked: action.payload };
    case 'SET_HALTED':
      return { ...state, halted: action.payload };
    case 'SET_HUMAN_REQUEST':
      return { ...state, humanRequest: action.payload };
    case 'SET_CONTEXT_RESET':
      // 189-audit GAP-001: Clear halted state when context resets (resume failed, new session created)
      return { ...state, contextReset: action.payload, halted: null };
    case 'SET_COST':
      return { ...state, cost: action.payload };
    case 'CLEAR_ALL':
      return initialState;
    default:
      return state;
  }
}

// ===== Hook =====

export interface UseSessionActivityStateOptions {
  sessionId: string | null;
  /** Timeout in ms after which stale activity is cleared (default: 30s) */
  activityTimeoutMs?: number;
  /** Callback fired synchronously when tool_end activity is received (102-tool-end-race-fix) */
  onToolEnd?: () => void;
  /** Callback for thinking/reasoning content (pass-through to useSessionActivityEvents) */
  onThinking?: (data: import('./useSessionSocketEvents').SessionThinkingData) => void;
}

export interface UseSessionActivityStateResult {
  state: SessionActivityState;
  /** Clear a specific state (e.g., dismiss blocked banner) */
  clearBlocked: () => void;
  clearHalted: () => void;
  clearContextReset: () => void;
  clearHumanRequest: () => void;
  /** Clear all state (e.g., on disconnect) */
  clearAll: () => void;
  /** Send human input response back to the agent */
  sendHumanInputResponse: (response: string) => void;
}

/**
 * Hook for managing session activity display state.
 *
 * @example
 * const { state, clearBlocked, sendHumanInputResponse } = useSessionActivityState({ sessionId });
 *
 * return (
 *   <>
 *     {state.humanRequest && (
 *       <HumanInputModal
 *         request={state.humanRequest}
 *         onSubmit={sendHumanInputResponse}
 *       />
 *     )}
 *     {state.blocked && <StatusBanner variant="warning" message={state.blocked.reason} onDismiss={clearBlocked} />}
 *     {state.activity && <SessionActivityBar activity={state.activity} progress={state.progress} />}
 *     {state.cost > 0 && <SessionFooter cost={state.cost} />}
 *   </>
 * );
 */
export function useSessionActivityState(
  options: UseSessionActivityStateOptions
): UseSessionActivityStateResult {
  const { sessionId, activityTimeoutMs = 30000, onToolEnd, onThinking } = options;
  const [state, dispatch] = useReducer(activityReducer, initialState);
  const { emit } = useSocket();

  // Clear stale activity after timeout
  // 185-subagent-activity-streaming: Skip timeout for subagent activities.
  // Sub-agents run for minutes and end explicitly via tool_end (onResult).
  // Without this, the UI clears the status after 30s and shows generic "Thinking..."
  useEffect(() => {
    if (!state.activity || state.activity.status !== 'running') {
      return;
    }

    // Subagent activities end explicitly via tool_end — don't timeout
    if (state.activity.type === 'subagent') {
      return;
    }

    const timer = setTimeout(() => {
      dispatch({ type: 'SET_ACTIVITY', payload: null });
    }, activityTimeoutMs);

    return () => clearTimeout(timer);
  }, [state.activity, activityTimeoutMs]);

  // Clear all state when session changes
  useEffect(() => {
    dispatch({ type: 'CLEAR_ALL' });
  }, [sessionId]);

  // Socket event handlers
  const handleActivity = useCallback((data: SessionActivityData) => {
    dispatch({ type: 'SET_ACTIVITY', payload: data.activity });

    // Call onToolEnd callback synchronously BEFORE clearing (102-tool-end-race-fix)
    // This fixes race condition where useEffect in components missed tool_end events
    if (data.activity.type === 'tool_end' && onToolEnd) {
      onToolEnd();
    }

    // Clear activity on completion
    if (data.activity.status === 'complete' || data.activity.status === 'error') {
      setTimeout(() => {
        dispatch({ type: 'SET_ACTIVITY', payload: null });
      }, 500); // Brief delay to show completion state
    }
  }, [onToolEnd]);

  const handleProgress = useCallback((data: SessionProgressData) => {
    dispatch({ type: 'SET_PROGRESS', payload: data });
  }, []);

  const handleBlocked = useCallback((data: SessionBlockedData) => {
    dispatch({ type: 'SET_BLOCKED', payload: data });
  }, []);

  const handleHalted = useCallback((data: SessionHaltedData) => {
    dispatch({ type: 'SET_HALTED', payload: data });
  }, []);

  const handleHumanInput = useCallback((data: SessionHumanInputData) => {
    dispatch({ type: 'SET_HUMAN_REQUEST', payload: data });
  }, []);

  const handleCost = useCallback((data: SessionCostData) => {
    dispatch({ type: 'SET_COST', payload: data.cost });
  }, []);

  const handleContextReset = useCallback((data: SessionContextResetData) => {
    dispatch({ type: 'SET_CONTEXT_RESET', payload: data });
  }, []);

  // Register socket listeners
  useSessionActivityEvents({
    sessionId,
    onActivity: handleActivity,
    onProgress: handleProgress,
    onBlocked: handleBlocked,
    onHalted: handleHalted,
    onHumanInputRequested: handleHumanInput,
    onCost: handleCost,
    onContextReset: handleContextReset,
    onThinking,
  });

  // Dispatch helpers
  const clearBlocked = useCallback(() => {
    dispatch({ type: 'SET_BLOCKED', payload: null });
  }, []);

  const clearHalted = useCallback(() => {
    dispatch({ type: 'SET_HALTED', payload: null });
  }, []);

  const clearContextReset = useCallback(() => {
    dispatch({ type: 'SET_CONTEXT_RESET', payload: null });
  }, []);

  const clearHumanRequest = useCallback(() => {
    dispatch({ type: 'SET_HUMAN_REQUEST', payload: null });
  }, []);

  const clearAll = useCallback(() => {
    dispatch({ type: 'CLEAR_ALL' });
  }, []);

  // Send human input response to the agent
  const sendHumanInputResponse = useCallback((response: string) => {
    if (!sessionId) return;
    emit(SOCKET_EVENTS.SESSION_HUMAN_INPUT_RESPONSE, {
      sessionId,
      response,
    });
    // Clear the request after sending response
    dispatch({ type: 'SET_HUMAN_REQUEST', payload: null });
  }, [sessionId, emit]);

  return {
    state,
    clearBlocked,
    clearHalted,
    clearContextReset,
    clearHumanRequest,
    clearAll,
    sendHumanInputResponse,
  };
}
