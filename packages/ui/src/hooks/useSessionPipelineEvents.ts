/**
 * useSessionPipelineEvents - Listen to pipeline logs and events
 *
 * Phase 4: Observability hook for real-time pipeline monitoring
 */

import { useEffect, useState, useCallback } from 'react';
import { useSocket } from '../context/SocketContext';
import { SOCKET_EVENTS } from '@capybara-chat/types';

export interface PipelineLog {
  sessionId: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  context?: Record<string, unknown>;
  timestamp: number;
  source?: 'pipeline' | 'stage' | 'adapter';
}

export interface PipelineEvent {
  sessionId: string;
  event: {
    type: 'stage:start' | 'stage:complete' | 'stage:error' | 'pipeline:start' | 'pipeline:complete' | 'pipeline:error';
    stage?: string;
    status?: string;
    error?: string;
    timestamp: number;
    durationMs?: number;
  };
}

export interface StageTimeline {
  stage: string;
  startTime: number;
  endTime?: number;
  durationMs?: number;
  status: 'running' | 'complete' | 'error';
  error?: string;
}

export function useSessionPipelineEvents(sessionId: string | null) {
  const { socket } = useSocket();
  const [logs, setLogs] = useState<PipelineLog[]>([]);
  const [stages, setStages] = useState<StageTimeline[]>([]);
  const [pipelineStatus, setPipelineStatus] = useState<'idle' | 'running' | 'complete' | 'error'>('idle');

  // Handle incoming logs
  const handleLog = useCallback((data: PipelineLog) => {
    if (sessionId && data.sessionId === sessionId) {
      setLogs(prev => [...prev, data]);
    }
  }, [sessionId]);

  // Handle pipeline events
  const handleEvent = useCallback((data: PipelineEvent) => {
    if (!sessionId || data.sessionId !== sessionId) return;

    const { event } = data;

    switch (event.type) {
      case 'pipeline:start':
        setPipelineStatus('running');
        setStages([]);
        break;

      case 'pipeline:complete':
        setPipelineStatus('complete');
        break;

      case 'pipeline:error':
        setPipelineStatus('error');
        break;

      case 'stage:start':
        if (event.stage) {
          setStages(prev => [...prev, {
            stage: event.stage!,
            startTime: event.timestamp,
            status: 'running',
          }]);
        }
        break;

      case 'stage:complete':
        if (event.stage) {
          setStages(prev => prev.map(s =>
            s.stage === event.stage && s.status === 'running'
              ? {
                  ...s,
                  endTime: event.timestamp,
                  durationMs: event.durationMs,
                  status: 'complete' as const,
                }
              : s
          ));
        }
        break;

      case 'stage:error':
        if (event.stage) {
          setStages(prev => prev.map(s =>
            s.stage === event.stage && s.status === 'running'
              ? {
                  ...s,
                  endTime: event.timestamp,
                  durationMs: event.durationMs,
                  status: 'error' as const,
                  error: event.error,
                }
              : s
          ));
        }
        break;
    }
  }, [sessionId]);

  // Subscribe to socket events
  useEffect(() => {
    if (!socket || !sessionId) return;

    socket.on(SOCKET_EVENTS.SESSION_LOG, handleLog);
    socket.on(SOCKET_EVENTS.SESSION_PIPELINE_EVENT, handleEvent);

    return () => {
      socket.off(SOCKET_EVENTS.SESSION_LOG, handleLog);
      socket.off(SOCKET_EVENTS.SESSION_PIPELINE_EVENT, handleEvent);
    };
  }, [socket, sessionId, handleLog, handleEvent]);

  // Clear logs when session changes
  useEffect(() => {
    setLogs([]);
    setStages([]);
    setPipelineStatus('idle');
  }, [sessionId]);

  return {
    logs,
    stages,
    pipelineStatus,
  };
}
