/**
 * SocketProvider - Centralized WebSocket management
 *
 * Provides a single socket connection shared across all components.
 * Eliminates duplicate connections and centralizes event handling.
 *
 * 032-multitenancy: Authenticates via JWT token (from AuthContext).
 * Falls back to API key for dev-mode without auth.
 * Reconnects automatically when token changes (refresh cycle).
 */

import { createContext, useContext, useEffect, useState, useRef, useCallback, type ReactNode } from 'react';
import { io, type Socket } from 'socket.io-client';
import {
  SOCKET_EVENTS,
  SERVER_DEFAULTS,
  SOCKET_DEFAULTS,
  type SocketEventPayloads,
} from '@capybara-chat/types';
import { createLogger } from '../lib/logger';
import type { StatusType } from '../components/ui/StatusIndicator';
import { API } from '../constants';

const log = createLogger('SocketProvider');

// ===== Types =====

export interface SocketState {
  socket: Socket | null;
  connected: boolean;
  agentStatus: StatusType;
  processingSessions: Set<string>;
}

/**
 * Event handler type - accepts the payload for the event
 */
type EventHandler<T = unknown> = (data: T) => void;

interface SocketContextValue extends SocketState {
  /** Emit an event to the server */
  emit: <E extends keyof SocketEventPayloads>(event: E, data: SocketEventPayloads[E]) => void;
  /** Register an event handler */
  on: <T = unknown>(event: string, handler: EventHandler<T>) => void;
  /** Unregister an event handler */
  off: <T = unknown>(event: string, handler: EventHandler<T>) => void;
  /** 195-ui-usability-pass: Manually clear a session from processingSessions (defensive mechanism) */
  clearProcessingSession: (sessionId: string) => void;
}

interface SocketProviderProps {
  serverUrl?: string;
  /** JWT access token for socket auth (032-multitenancy) */
  authToken?: string | null;
  children: ReactNode;
}

// ===== Context =====

const SocketContext = createContext<SocketContextValue | null>(null);

// ===== Hook =====

export function useSocket(): SocketContextValue {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}

// ===== Singleton Safeguard =====

// Track if SocketProvider is already mounted (195-socket-duplication-audit)
// This prevents accidental duplicate socket connections if SocketProvider
// is rendered multiple times in the React tree.
let activeProviderCount = 0;

// ===== Provider =====

export function SocketProvider({ serverUrl = SERVER_DEFAULTS.SERVER_URL, authToken, children }: SocketProviderProps) {
  const [connected, setConnected] = useState(false);
  const [agentStatus, setAgentStatus] = useState<StatusType>('offline');
  const [processingSessions, setProcessingSessions] = useState<Set<string>>(new Set());
  const socketRef = useRef<Socket | null>(null);

  // Track registered handlers so we can re-register on reconnect
  const registeredHandlers = useRef<Map<string, Set<EventHandler>>>(new Map());

  // 195-socket-duplication-audit: Detect multiple SocketProvider instances
  useEffect(() => {
    activeProviderCount++;
    if (activeProviderCount > 1) {
      log.error('Multiple SocketProvider instances detected!', {
        activeCount: activeProviderCount,
        message: 'This will create duplicate socket connections. Check your React component tree.',
      });
    } else {
      log.info('SocketProvider mounted', { activeCount: activeProviderCount });
    }

    return () => {
      activeProviderCount--;
      log.info('SocketProvider unmounted', { activeCount: activeProviderCount });
    };
  }, []);

  // Initialize socket connection — reconnects when serverUrl or authToken changes
  useEffect(() => {
    // Build auth payload: JWT token preferred, API key as fallback
    const auth = authToken
      ? { token: authToken }
      : { apiKey: API.DEFAULT_API_KEY };

    const socket = io(serverUrl, {
      reconnection: SOCKET_DEFAULTS.RECONNECTION,
      reconnectionAttempts: SOCKET_DEFAULTS.RECONNECTION_ATTEMPTS,
      reconnectionDelay: SOCKET_DEFAULTS.RECONNECTION_DELAY,
      auth,
    });
    socketRef.current = socket;

    // When socket is ready, register any pending handlers
    const registerPendingHandlers = () => {
      registeredHandlers.current.forEach((handlers, event) => {
        handlers.forEach((handler) => {
          socket.on(event, handler as (...args: unknown[]) => void);
        });
      });
    };

    // Connection handlers
    socket.on('connect', () => {
      log.info('Socket connected', { socketId: socket.id });
      setConnected(true);
      // Re-register all handlers on reconnect
      registerPendingHandlers();
    });

    socket.on('disconnect', (reason) => {
      log.info('Socket disconnected', { socketId: socket.id, reason });
      setConnected(false);
      setAgentStatus('offline');
      // Clear processingSessions on disconnect to prevent stale state
      setProcessingSessions(new Set());
    });

    // Agent status handler
    socket.on(SOCKET_EVENTS.AGENT_STATUS, (data: SocketEventPayloads[typeof SOCKET_EVENTS.AGENT_STATUS]) => {
      const status: StatusType =
        data.status === 'online' ? 'online' : data.status === 'connecting' ? 'connecting' : 'offline';
      setAgentStatus(status);
    });

    // Full sync handler - includes initial agent status and processing sessions
    // 193-session-reconnect-debug: Restore processingSessions on connect/reconnect
    socket.on(SOCKET_EVENTS.SYNC_FULL, (data: SocketEventPayloads[typeof SOCKET_EVENTS.SYNC_FULL]) => {
      if (data.agentStatus) {
        setAgentStatus(data.agentStatus === 'online' ? 'online' : 'offline');
      }
      // Restore processing sessions state from server
      if (data.processingSessions) {
        setProcessingSessions(new Set(data.processingSessions));
        log.info('Restored processingSessions from SYNC_FULL', {
          count: data.processingSessions.length,
          sessions: data.processingSessions,
        });
      }
    });

    // Processing session tracking
    // 140-thinking-ui-fix: Track when agent-bridge is processing a session
    // - SESSION_MESSAGE: Server received user message, processing starts
    // - MESSAGE_STATUS (completed/failed): Turn fully complete
    // - SESSION_ERROR: Error occurred, processing stopped
    // NOTE: We intentionally do NOT use SESSION_RESPONSE(streaming=false) here
    // because it fires for EACH message segment during multi-tool responses,
    // which would prematurely clear processing state while Claude is still working.
    socket.on(SOCKET_EVENTS.SESSION_MESSAGE, (data: SocketEventPayloads[typeof SOCKET_EVENTS.SESSION_MESSAGE]) => {
      log.info('SESSION_MESSAGE received - adding to processingSessions', { sessionId: data.sessionId });
      setProcessingSessions((prev) => {
        const next = new Set(prev).add(data.sessionId);
        log.info('processingSessions after add', { sessionId: data.sessionId, size: next.size, sessions: Array.from(next) });
        return next;
      });
    });

    socket.on(SOCKET_EVENTS.MESSAGE_STATUS, (data: SocketEventPayloads[typeof SOCKET_EVENTS.MESSAGE_STATUS]) => {
      log.info('MESSAGE_STATUS received', { sessionId: data.sessionId, messageId: data.messageId, status: data.status });
      // 193-audit GAP-004 fix: Also clear on 'sent' status (orphan recovery resets to sent)
      // Orphan recovery happens when bridge crashes/restarts or heartbeat detects stuck messages
      if (data.status === 'completed' || data.status === 'failed' || data.status === 'sent') {
        setProcessingSessions((prev) => {
          const next = new Set(prev);
          next.delete(data.sessionId);
          log.info('processingSessions after remove', { sessionId: data.sessionId, status: data.status, size: next.size, sessions: Array.from(next) });
          return next;
        });
      }
    });

    socket.on(SOCKET_EVENTS.SESSION_ERROR, (data: SocketEventPayloads[typeof SOCKET_EVENTS.SESSION_ERROR]) => {
      log.info('SESSION_ERROR received - removing from processingSessions', { sessionId: data.sessionId });
      setProcessingSessions((prev) => {
        const next = new Set(prev);
        next.delete(data.sessionId);
        log.info('processingSessions after remove (error)', { sessionId: data.sessionId, size: next.size, sessions: Array.from(next) });
        return next;
      });
    });

    // 189-session-failure-ui: Add task sessions to processingSessions when they start running
    // Task sessions don't emit SESSION_MESSAGE (no user messages), but they DO emit SESSION_ACTIVITY
    // This ensures ActivityStatusBar shows indicators for task sessions
    socket.on(SOCKET_EVENTS.SESSION_ACTIVITY, (data: SocketEventPayloads[typeof SOCKET_EVENTS.SESSION_ACTIVITY]) => {
      if (data.activity?.status === 'running') {
        setProcessingSessions((prev) => {
          // Only add if not already present
          if (prev.has(data.sessionId)) return prev;
          const next = new Set(prev).add(data.sessionId);
          log.info('SESSION_ACTIVITY received - adding to processingSessions', {
            sessionId: data.sessionId,
            activityType: data.activity?.type,
            size: next.size,
          });
          return next;
        });
      }
      // 195-ui-usability-pass: Also clear on 'complete' activity status (defensive)
      if (data.activity?.status === 'complete') {
        setProcessingSessions((prev) => {
          if (!prev.has(data.sessionId)) return prev;
          const next = new Set(prev);
          next.delete(data.sessionId);
          log.info('SESSION_ACTIVITY complete - removing from processingSessions', {
            sessionId: data.sessionId,
            size: next.size,
          });
          return next;
        });
      }
    });

    // 195-ui-usability-pass: Clear processingSessions when session is halted (timeout/error)
    socket.on(SOCKET_EVENTS.SESSION_HALTED, (data: SocketEventPayloads[typeof SOCKET_EVENTS.SESSION_HALTED]) => {
      log.info('SESSION_HALTED received - removing from processingSessions', { sessionId: data.sessionId });
      setProcessingSessions((prev) => {
        const next = new Set(prev);
        next.delete(data.sessionId);
        return next;
      });
    });

    // 196-session-status-sanity: Clear processingSessions when tasks complete/fail/cancel
    // These events now include sessionId for exactly this purpose
    socket.on(SOCKET_EVENTS.TASK_COMPLETE, (data: SocketEventPayloads[typeof SOCKET_EVENTS.TASK_COMPLETE]) => {
      if (data.sessionId) {
        log.info('TASK_COMPLETE received - removing from processingSessions', { taskId: data.taskId, sessionId: data.sessionId });
        setProcessingSessions((prev) => {
          const next = new Set(prev);
          next.delete(data.sessionId!);
          return next;
        });
      }
    });

    socket.on(SOCKET_EVENTS.TASK_FAILED, (data: SocketEventPayloads[typeof SOCKET_EVENTS.TASK_FAILED]) => {
      if (data.sessionId) {
        log.info('TASK_FAILED received - removing from processingSessions', { taskId: data.taskId, sessionId: data.sessionId });
        setProcessingSessions((prev) => {
          const next = new Set(prev);
          next.delete(data.sessionId!);
          return next;
        });
      }
    });

    socket.on(SOCKET_EVENTS.TASK_CANCELLED, (data: SocketEventPayloads[typeof SOCKET_EVENTS.TASK_CANCELLED]) => {
      if (data.sessionId) {
        log.info('TASK_CANCELLED received - removing from processingSessions', { taskId: data.taskId, sessionId: data.sessionId });
        setProcessingSessions((prev) => {
          const next = new Set(prev);
          next.delete(data.sessionId!);
          return next;
        });
      }
    });

    // 196-session-status-sanity: Clear processingSessions when task state becomes terminal via TASK_UPDATED
    // This is the main mechanism for clearing - tasks update state via PATCH /api/tasks/:id
    const TERMINAL_TASK_STATES = ['complete', 'failed', 'cancelled'];
    socket.on(SOCKET_EVENTS.TASK_UPDATED, (data: { taskId: string; sessionId?: string; state: string }) => {
      if (data.sessionId && TERMINAL_TASK_STATES.includes(data.state)) {
        log.info('TASK_UPDATED with terminal state - removing from processingSessions', {
          taskId: data.taskId,
          sessionId: data.sessionId,
          state: data.state,
        });
        setProcessingSessions((prev) => {
          const next = new Set(prev);
          next.delete(data.sessionId!);
          return next;
        });
      }
    });

    // Note: registerPendingHandlers is called in the 'connect' handler above
    // No need to call it here - it would cause duplicate handlers

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [serverUrl, authToken]);

  // Emit event to server
  const emit = useCallback(<E extends keyof SocketEventPayloads>(event: E, data: SocketEventPayloads[E]) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, data);
    } else {
      log.warn('Cannot emit, socket not connected', { event });
    }
  }, []);

  // Register handler - tracks in ref and registers on socket if connected
  const on = useCallback(<T = unknown>(event: string, handler: EventHandler<T>) => {
    // Track the handler for reconnection
    if (!registeredHandlers.current.has(event)) {
      registeredHandlers.current.set(event, new Set());
    }
    registeredHandlers.current.get(event)?.add(handler as EventHandler);

    // Only register on socket if connected (otherwise registerPendingHandlers will do it)
    if (socketRef.current?.connected) {
      socketRef.current.on(event, handler as (...args: unknown[]) => void);
    }
  }, []);

  // Unregister handler
  const off = useCallback(<T = unknown>(event: string, handler: EventHandler<T>) => {
    // Remove from tracking
    registeredHandlers.current.get(event)?.delete(handler as EventHandler);

    // If socket exists, unregister
    if (socketRef.current) {
      socketRef.current.off(event, handler as (...args: unknown[]) => void);
    }
  }, []);

  // 195-ui-usability-pass: Manual clear for components that know session is done
  const clearProcessingSession = useCallback((sessionId: string) => {
    setProcessingSessions((prev) => {
      if (!prev.has(sessionId)) return prev;
      const next = new Set(prev);
      next.delete(sessionId);
      log.info('clearProcessingSession called', { sessionId, size: next.size });
      return next;
    });
  }, []);

  const value: SocketContextValue = {
    socket: socketRef.current,
    connected,
    agentStatus,
    processingSessions,
    emit,
    on,
    off,
    clearProcessingSession,
  };

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}
