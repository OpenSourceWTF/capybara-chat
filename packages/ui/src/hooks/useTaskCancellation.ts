/**
 * useTaskCancellation - Hook for cancelling worker tasks
 *
 * Sends PATCH requests to cancel tasks and tracks loading/error state.
 * Handles partial failures gracefully, reporting which tasks failed.
 */

import { useState, useCallback, useMemo } from 'react';
import { api } from '../lib/api';
import type { WorkerTask } from '@capybara-chat/types';

export function useTaskCancellation(tasks: WorkerTask[]) {
  const [isCancelling, setIsCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failedTasks, setFailedTasks] = useState<Array<{ id: string; name: string; error: string }>>([]);

  const taskMap = useMemo(() => new Map(tasks.map(t => [t.id, t])), [tasks]);

  const cancelTasks = useCallback(async (taskIds: string[]) => {
    if (taskIds.length === 0) return;
    setIsCancelling(true);
    setError(null);
    setFailedTasks([]);

    const results = await Promise.allSettled(
      taskIds.map(async (id) => {
        const res = await api.patch(`/api/tasks/${id}`, { state: 'cancelled' });
        if (!res.ok) {
          const text = await res.text().catch(() => 'Unknown error');
          throw new Error(text || `HTTP ${res.status}`);
        }
        return id;
      })
    );

    const failed: Array<{ id: string; name: string; error: string }> = [];
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        const taskId = taskIds[index];
        const task = taskMap.get(taskId);
        failed.push({
          id: taskId,
          name: task?.name || 'Unknown Task',
          error: result.reason?.message || 'Unknown error',
        });
      }
    });

    if (failed.length > 0) {
      setError(`Failed to cancel ${failed.length} task(s)`);
      setFailedTasks(failed);
    }

    setIsCancelling(false);
  }, [taskMap]);

  const clearError = useCallback(() => {
    setError(null);
    setFailedTasks([]);
  }, []);

  return { cancelTasks, isCancelling, error, failedTasks, clearError };
}
