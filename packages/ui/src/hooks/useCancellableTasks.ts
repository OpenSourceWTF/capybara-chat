/**
 * useCancellableTasks - Hook for fetching and tracking cancellable worker tasks
 *
 * Fetches tasks with cancellable states (running, assigned, paused) and
 * listens for socket events to remove tasks when their state changes.
 */

import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { useSocket } from '../context/SocketContext';
import { SOCKET_EVENTS } from '@capybara-chat/types';
import type { WorkerTask } from '@capybara-chat/types';

export function useCancellableTasks() {
  const [tasks, setTasks] = useState<WorkerTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { socket } = useSocket();

  const fetchTasks = useCallback(async () => {
    try {
      const response = await api.get('/api/tasks?state=running,assigned,paused');
      if (response.ok) {
        const data = await response.json() as { tasks: WorkerTask[] };
        setTasks(data.tasks);
      }
    } catch (err) {
      console.error('Failed to fetch cancellable tasks:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Listen for task state changes to remove tasks that are no longer cancellable
  useEffect(() => {
    if (!socket) return;

    const CANCELLABLE_STATES = new Set(['running', 'assigned', 'paused']);

    // Primary: TASK_UPDATED is emitted by PATCH handler for ALL state transitions
    const handleTaskUpdated = (payload: { taskId: string; state: string }) => {
      if (!CANCELLABLE_STATES.has(payload.state)) {
        setTasks(prev => prev.filter(t => t.id !== payload.taskId));
      }
    };

    // Fallback: TASK_CANCELLED is broadcast from bridge via socket-handlers
    const handleTaskRemoval = (payload: { taskId: string }) => {
      setTasks(prev => prev.filter(t => t.id !== payload.taskId));
    };

    socket.on(SOCKET_EVENTS.TASK_UPDATED, handleTaskUpdated);
    socket.on(SOCKET_EVENTS.TASK_CANCELLED, handleTaskRemoval);

    return () => {
      socket.off(SOCKET_EVENTS.TASK_UPDATED, handleTaskUpdated);
      socket.off(SOCKET_EVENTS.TASK_CANCELLED, handleTaskRemoval);
    };
  }, [socket]);

  // Refetch on socket reconnection
  useEffect(() => {
    if (!socket) return;

    const handleReconnect = () => {
      fetchTasks();
    };

    socket.on('connect', handleReconnect);
    return () => {
      socket.off('connect', handleReconnect);
    };
  }, [socket, fetchTasks]);

  return { tasks, isLoading, refetch: fetchTasks };
}
