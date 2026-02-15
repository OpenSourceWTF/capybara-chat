/**
 * useSessionList - Session list state management hook
 *
 * Extracted from SessionSidebar for better separation of concerns.
 * Handles WebSocket-based session list updates and API operations.
 *
 * Uses WEBSOCKET PUSH for real-time updates - NO POLLING.
 * Listens to socket events: session:created, session:hidden, session:updated, sync:full
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { SessionListItem } from '../components/session/SessionCard';
import { api } from '../lib/api';
import { createLogger } from '../lib/logger';
import { useServer } from '../context/ServerContext';
import { useSocket } from '../context/SocketContext';
import { SOCKET_EVENTS, sessionPath } from '@capybara-chat/types';
import type { SessionType } from '@capybara-chat/types';

const log = createLogger('useSessionList');

export interface UseSessionListOptions {
  /** Current session ID - used to clear unread status and handle updates */
  currentSessionId: string | null;
  /** Callback when a session is deleted */
  onSessionDelete?: (sessionId: string) => void;
}

export interface UseSessionListResult {
  /** List of sessions */
  sessions: SessionListItem[];
  /** Whether initial load is in progress */
  loading: boolean;
  /** Delete (hide) a session */
  handleDelete: (sessionId: string) => Promise<void>;
  /** Rename a session */
  handleRename: (sessionId: string, newName: string) => Promise<void>;
  /** Whether there are more sessions to load from server (optional, for pagination) */
  hasMore?: boolean;
  /** Load more sessions from server (optional, for pagination) */
  loadMore?: () => void;
}

export function useSessionList({
  currentSessionId,
  onSessionDelete,
}: UseSessionListOptions): UseSessionListResult {
  const { serverUrl } = useServer();
  const { connected: serverConnected, on, off } = useSocket();
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Ref to track current session for event handlers (avoids stale closures)
  const currentSessionRef = useRef(currentSessionId);
  useEffect(() => {
    currentSessionRef.current = currentSessionId;
  }, [currentSessionId]);

  // Delete (hide) a session
  const handleDelete = useCallback(async (sessionId: string) => {
    log.debug('Deleting session', { sessionId });
    try {
      const response = await api.delete(`${serverUrl}${sessionPath(sessionId)}`);
      log.debug('Delete response', { status: response.status, ok: response.ok });
      if (!response.ok && response.status !== 204) {
        const errorText = await response.text();
        log.error('Delete failed', { errorText });
        throw new Error(`Failed to delete session: ${errorText}`);
      }
      // Optimistically remove from local state
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      // Notify parent to clear if current
      onSessionDelete?.(sessionId);
    } catch (error) {
      log.error('Failed to delete session', { error });
    }
  }, [serverUrl, onSessionDelete]);

  // Rename a session
  const handleRename = useCallback(async (sessionId: string, newName: string) => {
    try {
      const response = await api.patch(`${serverUrl}${sessionPath(sessionId)}`, { name: newName });
      if (!response.ok) throw new Error('Failed to rename session');
      // Optimistically update local state
      setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, name: newName } : s));
    } catch (error) {
      log.error('Failed to rename session', { error });
    }
  }, [serverUrl]);

  // Setup socket event handlers for session-specific updates
  useEffect(() => {
    // New session created - add to list with proper field mapping
    const handleSessionCreated = (data: {
      session: {
        id: string;
        name?: string;
        startedAt: number;
        lastActivityAt?: number;
        sessionType?: SessionType;
      }
    }) => {
      log.debug('Session created', { sessionId: data.session.id, sessionType: data.session.sessionType });
      const newSession: SessionListItem = {
        id: data.session.id,
        name: data.session.name || 'New Chat',
        createdAt: data.session.startedAt,
        lastMessageAt: data.session.lastActivityAt ?? data.session.startedAt,
        lastMessagePreview: 'No messages yet...',
        messageCount: 0,
        sessionType: data.session.sessionType,
      };
      setSessions(prev => {
        // Check if session already exists
        if (prev.some(s => s.id === newSession.id)) {
          return prev;
        }
        // Add at the top (most recent)
        return [newSession, ...prev];
      });
    };

    // Session hidden (deleted) - remove from list
    const handleSessionHidden = (data: { sessionId: string }) => {
      log.debug('Session hidden', { sessionId: data.sessionId });
      setSessions(prev => prev.filter(s => s.id !== data.sessionId));
    };

    // Session cost updated - update in list
    const handleSessionCost = (data: { sessionId: string; cost: number }) => {
      setSessions(prev => prev.map(s =>
        s.id === data.sessionId ? { ...s, totalCost: data.cost } : s
      ));
    };

    // Session updated - update in list
    const handleSessionUpdated = (data: {
      sessionId: string;
      name?: string;
      lastActivityAt?: number;
      messageCount?: number;
      lastMessagePreview?: string;
      hasUnread?: boolean;
    }) => {
      const isCurrentSession = data.sessionId === currentSessionRef.current;
      setSessions(prev => {
        const updated = prev.map(s => {
          if (s.id !== data.sessionId) return s;
          return {
            ...s,
            name: data.name ?? s.name,
            lastMessageAt: data.lastActivityAt ?? s.lastMessageAt,
            messageCount: data.messageCount ?? s.messageCount,
            lastMessagePreview: data.lastMessagePreview ?? s.lastMessagePreview,
            // Mark as unread ONLY if we're not viewing this session
            // If currently viewing, clear hasUnread regardless of server value
            hasUnread: isCurrentSession ? false : (data.hasUnread ?? s.hasUnread),
          };
        });
        // Re-sort by lastMessageAt
        return updated.sort((a, b) => b.lastMessageAt - a.lastMessageAt);
      });
    };

    // Full sync on reconnect - includes initial session list
    // This is the PRIMARY source for sessions - no REST fetch needed
    const handleSyncFull = (data: { sessions: SessionListItem[] }) => {
      log.debug('Full sync', { count: data.sessions.length });
      const sorted = data.sessions
        .filter(s => !s.hidden)
        .sort((a, b) => b.lastMessageAt - a.lastMessageAt);
      setSessions(sorted);
      setLoading(false); // Clear loading state - SYNC_FULL provides initial data
    };

    // Register handlers
    on(SOCKET_EVENTS.SESSION_CREATED, handleSessionCreated);
    on(SOCKET_EVENTS.SESSION_HIDDEN, handleSessionHidden);
    on(SOCKET_EVENTS.SESSION_UPDATED, handleSessionUpdated);
    on(SOCKET_EVENTS.SESSION_COST, handleSessionCost);
    on(SOCKET_EVENTS.SYNC_FULL, handleSyncFull);

    // NOTE: No initial REST fetch - SYNC_FULL event provides initial data
    // Server sends SYNC_FULL immediately on socket connect (socket-handlers.ts:299-306)
    // This eliminates duplicate network call and potential race condition

    return () => {
      off(SOCKET_EVENTS.SESSION_CREATED, handleSessionCreated);
      off(SOCKET_EVENTS.SESSION_HIDDEN, handleSessionHidden);
      off(SOCKET_EVENTS.SESSION_UPDATED, handleSessionUpdated);
      off(SOCKET_EVENTS.SESSION_COST, handleSessionCost);
      off(SOCKET_EVENTS.SYNC_FULL, handleSyncFull);
    };
    // Note: including `serverConnected` ensures handlers re-register on reconnect
  }, [on, off, serverConnected]);

  // Clear hasUnread when selecting a session
  useEffect(() => {
    if (currentSessionId) {
      // Mark as read on server (persists to database)
      api.post(`${serverUrl}${sessionPath(currentSessionId, 'read')}`).catch((err) => log.error('Failed to mark session as read', { error: err }));

      // Optimistically update local state
      setSessions(prev => prev.map(s =>
        s.id === currentSessionId ? { ...s, hasUnread: false } : s
      ));
    }
  }, [currentSessionId, serverUrl]);

  return {
    sessions,
    loading,
    handleDelete,
    handleRename,
  };
}
