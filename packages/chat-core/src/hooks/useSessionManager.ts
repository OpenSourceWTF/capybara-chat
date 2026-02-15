import { useState, useCallback, useEffect } from 'react';
import { useChatTransport } from '../ChatTransportContext';
import { SessionListResponse, SessionDetailResponse, SessionType, SOCKET_EVENTS, Session } from '../types';
import { getErrorMessage } from '../utils/errors';

interface UseSessionManagerResult {
  sessions: SessionListResponse['sessions'];
  loading: boolean;
  error: string | null;
  fetchSessions: () => Promise<void>;
  createSession: (options?: { agentDefinitionId?: string }) => Promise<{ id: string } | null>;
  deleteSession: (sessionId: string) => Promise<boolean>;
  fetchSession: (sessionId: string) => Promise<SessionDetailResponse | null>;
}

export function useSessionManager(): UseSessionManagerResult {
  const transport = useChatTransport();
  const [sessions, setSessions] = useState<SessionListResponse['sessions']>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await transport.fetchSessions();
      setSessions(res.sessions);
    } catch (err) {
      const msg = getErrorMessage(err, 'Failed to fetch sessions');
      setError(msg);
      console.error(msg, err);
    } finally {
      setLoading(false);
    }
  }, [transport]);

  const createSession = useCallback(async (options?: { agentDefinitionId?: string }) => {
    setLoading(true);
    setError(null);
    try {
      const res = await transport.createSession(options);
      // Refresh list after creation
      await fetchSessions();
      return res;
    } catch (err) {
      const msg = getErrorMessage(err, 'Failed to create session');
      setError(msg);
      console.error(msg, err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [transport, fetchSessions]);

  const deleteSession = useCallback(async (sessionId: string) => {
    try {
      await transport.deleteSession(sessionId);
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      return true;
    } catch (err) {
      const msg = getErrorMessage(err, 'Failed to delete session');
      console.error(msg, err);
      // Don't set main error state for delete failure to avoid UI disruption?
      // Or maybe do? Let's just log for now unless critical.
      return false;
    }
  }, [transport]);

  const fetchSession = useCallback(async (sessionId: string) => {
    try {
      return await transport.fetchSession(sessionId);
    } catch (err) {
      console.error('Failed to fetch session details', err);
      return null;
    }
  }, [transport]);

  return {
    sessions,
    loading,
    error,
    fetchSessions,
    createSession,
    deleteSession,
    fetchSession,
  };
}
