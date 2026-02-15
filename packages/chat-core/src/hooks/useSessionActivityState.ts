import { useReducer, useCallback, useEffect } from 'react';
import { useChatTransport } from '../ChatTransportContext';
import {
  SOCKET_EVENTS,
  SessionActivityData,
  SessionProgressData,
  SessionBlockedData,
  SessionHaltedData,
  SessionHumanInputData,
  SessionContextResetData,
  SessionCostData
} from '../types';

interface State {
  activity: SessionActivityData | null;
  progress: SessionProgressData | null;
  blocked: SessionBlockedData | null;
  halted: SessionHaltedData | null;
  humanRequest: SessionHumanInputData | null;
  contextReset: SessionContextResetData | null;
  cost: SessionCostData | null;
}

type Action =
  | { type: 'SET_ACTIVITY'; payload: SessionActivityData }
  | { type: 'SET_PROGRESS'; payload: SessionProgressData }
  | { type: 'SET_BLOCKED'; payload: SessionBlockedData }
  | { type: 'SET_HALTED'; payload: SessionHaltedData }
  | { type: 'SET_HUMAN_REQUEST'; payload: SessionHumanInputData }
  | { type: 'SET_CONTEXT_RESET'; payload: SessionContextResetData }
  | { type: 'SET_COST'; payload: SessionCostData }
  | { type: 'CLEAR_BLOCKED' }
  | { type: 'CLEAR_HALTED' }
  | { type: 'CLEAR_HUMAN_REQUEST' }
  | { type: 'CLEAR_CONTEXT_RESET' }
  | { type: 'RESET_ALL' };

const initialState: State = {
  activity: null,
  progress: null,
  blocked: null,
  halted: null,
  humanRequest: null,
  contextReset: null,
  cost: null,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_ACTIVITY':
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
      return { ...state, contextReset: action.payload };
    case 'SET_COST':
      return { ...state, cost: action.payload };
    case 'CLEAR_BLOCKED':
      return { ...state, blocked: null };
    case 'CLEAR_HALTED':
      return { ...state, halted: null };
    case 'CLEAR_HUMAN_REQUEST':
      return { ...state, humanRequest: null };
    case 'CLEAR_CONTEXT_RESET':
      return { ...state, contextReset: null };
    case 'RESET_ALL':
      return initialState;
    default:
      return state;
  }
}

export function useSessionActivityState(sessionId: string | null) {
  const transport = useChatTransport();
  const [state, dispatch] = useReducer(reducer, initialState);

  // Clear state on session change
  useEffect(() => {
    dispatch({ type: 'RESET_ALL' });
  }, [sessionId]);

  // Handle socket events
  useEffect(() => {
    let safetyTimeout: NodeJS.Timeout;

    const handleActivity = (data: SessionActivityData) => {
      // 1. Auto-clear completed states
      if (['complete', 'error', 'timeout'].includes(data.activity.status)) {
        dispatch({ type: 'SET_ACTIVITY', payload: null as any }); // Clear activity
        clearTimeout(safetyTimeout);
        return;
      }

      // 2. Set active state
      dispatch({ type: 'SET_ACTIVITY', payload: data });

      // 3. Set safety timeout (e.g. 5 minutes for long tool runs)
      // If server crashes, this prevents infinite "Thinking..."
      clearTimeout(safetyTimeout);
      safetyTimeout = setTimeout(() => {
        console.warn('Activity timed out (safety fallback)');
        dispatch({ type: 'SET_ACTIVITY', payload: null as any });
      }, 5 * 60 * 1000); // 5 minutes
    };

    const handleProgress = (data: SessionProgressData) => {
      dispatch({ type: 'SET_PROGRESS', payload: data });
      // Clear progress after 3 seconds of no updates
      // (Simplified logic: progress usually comes in bursts)
    };

    const handleBlocked = (data: SessionBlockedData) => dispatch({ type: 'SET_BLOCKED', payload: data });
    const handleHalted = (data: SessionHaltedData) => dispatch({ type: 'SET_HALTED', payload: data });
    const handleHumanInput = (data: SessionHumanInputData) => dispatch({ type: 'SET_HUMAN_REQUEST', payload: data });
    const handleContextReset = (data: SessionContextResetData) => dispatch({ type: 'SET_CONTEXT_RESET', payload: data });
    const handleCost = (data: SessionCostData) => dispatch({ type: 'SET_COST', payload: data });

    transport.on(SOCKET_EVENTS.SESSION_ACTIVITY, handleActivity);
    transport.on(SOCKET_EVENTS.SESSION_PROGRESS, handleProgress);
    transport.on(SOCKET_EVENTS.SESSION_BLOCKED, handleBlocked);
    transport.on(SOCKET_EVENTS.SESSION_HALTED, handleHalted);
    transport.on(SOCKET_EVENTS.SESSION_HUMAN_INPUT_REQUESTED, handleHumanInput);
    transport.on(SOCKET_EVENTS.SESSION_CONTEXT_RESET, handleContextReset);
    transport.on(SOCKET_EVENTS.SESSION_COST, handleCost);

    return () => {
      clearTimeout(safetyTimeout);
      transport.off(SOCKET_EVENTS.SESSION_ACTIVITY, handleActivity);
      transport.off(SOCKET_EVENTS.SESSION_PROGRESS, handleProgress);
      transport.off(SOCKET_EVENTS.SESSION_BLOCKED, handleBlocked);
      transport.off(SOCKET_EVENTS.SESSION_HALTED, handleHalted);
      transport.off(SOCKET_EVENTS.SESSION_HUMAN_INPUT_REQUESTED, handleHumanInput);
      transport.off(SOCKET_EVENTS.SESSION_CONTEXT_RESET, handleContextReset);
      transport.off(SOCKET_EVENTS.SESSION_COST, handleCost);
    };
  }, [transport]);

  // --- Actions ---

  const sendHumanInputResponse = useCallback((response: string) => {
    if (!sessionId || !state.humanRequest) return;

    transport.emit(SOCKET_EVENTS.SESSION_HUMAN_INPUT_RESPONSE, {
      sessionId,
      requestId: (state.humanRequest as any).requestId, // Cast to any as type might be missing it
      response,
    });

    dispatch({ type: 'CLEAR_HUMAN_REQUEST' });
  }, [sessionId, state.humanRequest, transport]);

  const clearHumanRequest = useCallback(() => {
    dispatch({ type: 'CLEAR_HUMAN_REQUEST' });
  }, []);

  const clearBlocked = useCallback(() => {
    dispatch({ type: 'CLEAR_BLOCKED' });
  }, []);

  const clearHalted = useCallback(() => {
    dispatch({ type: 'CLEAR_HALTED' });
  }, []);

  const clearContextReset = useCallback(() => {
    dispatch({ type: 'CLEAR_CONTEXT_RESET' });
  }, []);

  return {
    state,
    actions: {
      sendHumanInputResponse,
      clearHumanRequest,
      clearBlocked,
      clearHalted,
      clearContextReset,
    }
  };
}
