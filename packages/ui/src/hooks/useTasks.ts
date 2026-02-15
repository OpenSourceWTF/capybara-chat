/**
 * useTasks Hook
 *
 * Fetches and manages worker tasks from the server.
 * Supports real-time updates via WebSocket events.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { WorkerTask, WorkerTaskState, AgentModel } from '@capybara-chat/types';
import { SOCKET_EVENTS } from '@capybara-chat/types';
import { useServer } from '../context/ServerContext';
import { useSocket } from '../context/SocketContext';
import { api } from '../lib/api';

interface UseTasksOptions {
  workspaceId?: string;
  specId?: string;
  state?: WorkerTaskState;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

interface UseTasksResult {
  tasks: WorkerTask[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  createTask: (data: CreateTaskInput) => Promise<WorkerTask>;
  updateTask: (taskId: string, data: UpdateTaskInput) => Promise<WorkerTask>;
  getById: (taskId: string) => WorkerTask | undefined;
}

interface CreateTaskInput {
  name?: string; // Human-readable task name
  specId: string;
  workspaceId: string;
  techniqueId?: string; // Optional - server uses default 'raw' if not provided
  agentDefinitionId?: string; // Optional - agent to execute the task
  variables?: Record<string, unknown>;
  maxAttempts?: number;
  /** Override the main agent model for this task */
  modelOverride?: AgentModel;
  /** Override specific subagent models by name */
  subagentModelOverrides?: Record<string, AgentModel>;
}

interface UpdateTaskInput {
  name?: string; // Human-readable task name
  state?: WorkerTaskState;
  currentPhaseId?: string;
  iteration?: number;
  error?: string;
  position?: number; // 134-kanban-reorder: Manual ordering within state column
}

// Socket event payload types
interface TaskEventPayload {
  taskId: string;
  task?: WorkerTask;
}

interface TaskProgressPayload {
  taskId: string;
  message?: string;
  phase?: string;
  iteration?: number;
}

export function useTasks(options: UseTasksOptions = {}): UseTasksResult {
  const { workspaceId, specId, state, autoRefresh = false, refreshInterval = 5000 } = options;
  const { serverUrl } = useServer();
  const { on, off } = useSocket();

  const [tasks, setTasks] = useState<WorkerTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Track filter options for socket event handling
  const filtersRef = useRef({ workspaceId, specId, state });
  useEffect(() => {
    filtersRef.current = { workspaceId, specId, state };
  }, [workspaceId, specId, state]);

  const fetchTasks = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (workspaceId) params.set('workspaceId', workspaceId);
      if (specId) params.set('specId', specId);
      if (state) params.set('state', state);

      const url = `${serverUrl}/api/tasks${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await api.get(url);

      if (!response.ok) {
        throw new Error(`Failed to fetch tasks: ${response.statusText}`);
      }

      const data = await response.json();
      setTasks(data.tasks || []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, specId, state, serverUrl]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Real-time updates via WebSocket
  // Uses on/off from useSocket for proper reconnection handling
  useEffect(() => {
    // Helper to check if a task matches current filters
    const matchesFilters = (task: WorkerTask): boolean => {
      const { workspaceId, specId, state } = filtersRef.current;
      if (workspaceId && task.workspaceId !== workspaceId) return false;
      if (specId && task.specId !== specId) return false;
      if (state && task.state !== state) return false;
      return true;
    };

    // Handle task created
    const handleTaskCreated = (data: TaskEventPayload) => {
      if (data.task && matchesFilters(data.task)) {
        setTasks(prev => {
          // Avoid duplicates
          if (prev.some(t => t.id === data.task!.id)) return prev;
          return [...prev, data.task!];
        });
      }
    };

    // Handle task state changes (assigned, complete, failed, cancelled)
    const handleTaskStateChange = (data: TaskEventPayload) => {
      if (data.task) {
        setTasks(prev => prev.map(t => t.id === data.task!.id ? data.task! : t));
      } else if (data.taskId) {
        // If we only get taskId, refetch to get updated data
        fetchTasks();
      }
    };

    // Handle task progress updates
    const handleTaskProgress = (data: TaskProgressPayload) => {
      setTasks(prev => prev.map(t => {
        if (t.id !== data.taskId) return t;
        return {
          ...t,
          lastProgressMessage: data.message || t.lastProgressMessage,
          currentPhase: data.phase || t.currentPhase,
          iteration: data.iteration ?? t.iteration,
        };
      }));
    };

    // Subscribe to task events using on/off wrappers for reconnection safety
    on(SOCKET_EVENTS.TASK_CREATED, handleTaskCreated);
    on(SOCKET_EVENTS.TASK_ASSIGNED, handleTaskStateChange);
    on(SOCKET_EVENTS.TASK_PROGRESS, handleTaskProgress);
    on(SOCKET_EVENTS.TASK_PHASE_CHANGED, handleTaskProgress);
    on(SOCKET_EVENTS.TASK_COMPLETE, handleTaskStateChange);
    on(SOCKET_EVENTS.TASK_FAILED, handleTaskStateChange);
    on(SOCKET_EVENTS.TASK_CANCELLED, handleTaskStateChange);

    return () => {
      off(SOCKET_EVENTS.TASK_CREATED, handleTaskCreated);
      off(SOCKET_EVENTS.TASK_ASSIGNED, handleTaskStateChange);
      off(SOCKET_EVENTS.TASK_PROGRESS, handleTaskProgress);
      off(SOCKET_EVENTS.TASK_PHASE_CHANGED, handleTaskProgress);
      off(SOCKET_EVENTS.TASK_COMPLETE, handleTaskStateChange);
      off(SOCKET_EVENTS.TASK_FAILED, handleTaskStateChange);
      off(SOCKET_EVENTS.TASK_CANCELLED, handleTaskStateChange);
    };
  }, [on, off, fetchTasks]);

  // Auto-refresh as fallback (reduced interval since we have real-time updates)
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(fetchTasks, refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, fetchTasks]);

  const createTask = async (data: CreateTaskInput): Promise<WorkerTask> => {
    const response = await api.post(`${serverUrl}/api/tasks`, data);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to create task: ${response.statusText}`);
    }

    const task = await response.json();
    setTasks(prev => [...prev, task]);
    return task;
  };

  const updateTask = async (taskId: string, data: UpdateTaskInput): Promise<WorkerTask> => {
    const response = await api.patch(`${serverUrl}/api/tasks/${taskId}`, data);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to update task: ${response.statusText}`);
    }

    const task = await response.json();
    setTasks(prev => prev.map(t => t.id === taskId ? task : t));
    return task;
  };

  const getById = (taskId: string) => tasks.find(t => t.id === taskId);

  return {
    tasks,
    isLoading,
    error,
    refetch: fetchTasks,
    createTask,
    updateTask,
    getById,
  };
}
