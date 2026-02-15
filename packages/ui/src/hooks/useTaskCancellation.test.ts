/**
 * Tests for useTaskCancellation hook
 *
 * TDD tests - written BEFORE implementation.
 *
 * Covers:
 * - Sending PATCH requests to cancel tasks
 * - Loading state during cancellation
 * - Error handling for failed cancellations
 * - Partial failure tracking
 * - Error clearing
 * - Task name resolution from tasks array
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { WorkerTask } from '@capybara-chat/types';

// Mock the api module
vi.mock('../lib/api', () => ({
  api: {
    patch: vi.fn(),
  },
}));

import { api } from '../lib/api';

// Import the hook under test (does not exist yet - TDD)
import { useTaskCancellation } from './useTaskCancellation';

// ===== Test Fixtures =====

const createMockTask = (overrides: Partial<WorkerTask> = {}): WorkerTask => ({
  id: `task-${Math.random().toString(36).substr(2, 9)}`,
  name: 'Test Task',
  specId: 'spec-1',
  workspaceId: 'ws-1',
  techniqueId: 'tech-1',
  variables: {},
  state: 'running',
  iteration: 1,
  maxAttempts: 3,
  attempt: 1,
  queuedAt: Date.now() - 60000,
  createdBy: null,
  ...overrides,
});

// STABLE references to prevent infinite render loops
const STABLE_EMPTY_TASKS: WorkerTask[] = [];

describe('useTaskCancellation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should initialize with isCancelling=false, error=null, and empty failedTasks', () => {
      const { result } = renderHook(() => useTaskCancellation(STABLE_EMPTY_TASKS));

      expect(result.current.isCancelling).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.failedTasks).toEqual([]);
    });

    it('should provide a cancelTasks function', () => {
      const { result } = renderHook(() => useTaskCancellation(STABLE_EMPTY_TASKS));

      expect(typeof result.current.cancelTasks).toBe('function');
    });

    it('should provide a clearError function', () => {
      const { result } = renderHook(() => useTaskCancellation(STABLE_EMPTY_TASKS));

      expect(typeof result.current.clearError).toBe('function');
    });
  });

  describe('cancelTasks - successful cancellation', () => {
    it('should send PATCH request for each task ID', async () => {
      const task1 = createMockTask({ id: 'task-1', name: 'Task One' });
      const task2 = createMockTask({ id: 'task-2', name: 'Task Two' });
      const STABLE_TASKS = [task1, task2];

      vi.mocked(api.patch).mockResolvedValue({
        ok: true,
      } as Response);

      const { result } = renderHook(() => useTaskCancellation(STABLE_TASKS));

      await act(async () => {
        await result.current.cancelTasks(['task-1', 'task-2']);
      });

      expect(api.patch).toHaveBeenCalledTimes(2);
      expect(api.patch).toHaveBeenCalledWith(
        expect.stringContaining('task-1'),
        expect.objectContaining({ state: 'cancelled' })
      );
      expect(api.patch).toHaveBeenCalledWith(
        expect.stringContaining('task-2'),
        expect.objectContaining({ state: 'cancelled' })
      );
    });

    it('should set error to null after successful cancellation', async () => {
      const task1 = createMockTask({ id: 'task-1' });
      const STABLE_TASKS = [task1];

      vi.mocked(api.patch).mockResolvedValue({
        ok: true,
      } as Response);

      const { result } = renderHook(() => useTaskCancellation(STABLE_TASKS));

      await act(async () => {
        await result.current.cancelTasks(['task-1']);
      });

      expect(result.current.error).toBeNull();
      expect(result.current.failedTasks).toEqual([]);
    });
  });

  describe('cancelTasks - loading state', () => {
    it('should set isCancelling to true during cancellation', async () => {
      const task1 = createMockTask({ id: 'task-1' });
      const STABLE_TASKS = [task1];

      let resolveRequest: (value: Response) => void;
      const pendingPromise = new Promise<Response>((resolve) => {
        resolveRequest = resolve;
      });
      vi.mocked(api.patch).mockReturnValue(pendingPromise);

      const { result } = renderHook(() => useTaskCancellation(STABLE_TASKS));

      // Start cancellation without awaiting
      let cancelPromise: Promise<void>;
      act(() => {
        cancelPromise = result.current.cancelTasks(['task-1']);
      });

      // Should be cancelling
      expect(result.current.isCancelling).toBe(true);

      // Resolve the request
      await act(async () => {
        resolveRequest!({ ok: true } as Response);
        await cancelPromise!;
      });

      // Should no longer be cancelling
      expect(result.current.isCancelling).toBe(false);
    });

    it('should set isCancelling to false after cancellation completes', async () => {
      const task1 = createMockTask({ id: 'task-1' });
      const STABLE_TASKS = [task1];

      vi.mocked(api.patch).mockResolvedValue({
        ok: true,
      } as Response);

      const { result } = renderHook(() => useTaskCancellation(STABLE_TASKS));

      await act(async () => {
        await result.current.cancelTasks(['task-1']);
      });

      expect(result.current.isCancelling).toBe(false);
    });
  });

  describe('cancelTasks - failure handling', () => {
    it('should set error message with count when all tasks fail', async () => {
      const task1 = createMockTask({ id: 'task-1', name: 'Task One' });
      const task2 = createMockTask({ id: 'task-2', name: 'Task Two' });
      const STABLE_TASKS = [task1, task2];

      vi.mocked(api.patch).mockResolvedValue({
        ok: false,
        text: () => Promise.resolve('Internal Server Error'),
        statusText: 'Internal Server Error',
      } as Response);

      const { result } = renderHook(() => useTaskCancellation(STABLE_TASKS));

      await act(async () => {
        await result.current.cancelTasks(['task-1', 'task-2']);
      });

      expect(result.current.error).toContain('2');
      expect(result.current.isCancelling).toBe(false);
    });

    it('should populate failedTasks array with task details on failure', async () => {
      const task1 = createMockTask({ id: 'task-1', name: 'Task One' });
      const STABLE_TASKS = [task1];

      vi.mocked(api.patch).mockResolvedValue({
        ok: false,
        text: () => Promise.resolve('Server Error'),
        statusText: 'Internal Server Error',
      } as Response);

      const { result } = renderHook(() => useTaskCancellation(STABLE_TASKS));

      await act(async () => {
        await result.current.cancelTasks(['task-1']);
      });

      expect(result.current.failedTasks).toHaveLength(1);
      expect(result.current.failedTasks[0]).toEqual(
        expect.objectContaining({
          id: 'task-1',
          name: 'Task One',
        })
      );
      expect(result.current.failedTasks[0].error).toBeTruthy();
    });

    it('should track only failed tasks when some succeed and some fail (partial failure)', async () => {
      const task1 = createMockTask({ id: 'task-1', name: 'Success Task' });
      const task2 = createMockTask({ id: 'task-2', name: 'Fail Task' });
      const task3 = createMockTask({ id: 'task-3', name: 'Another Success' });
      const STABLE_TASKS = [task1, task2, task3];

      vi.mocked(api.patch)
        .mockResolvedValueOnce({ ok: true } as Response)
        .mockResolvedValueOnce({
          ok: false,
          text: () => Promise.resolve('Timeout'),
          statusText: 'Gateway Timeout',
        } as Response)
        .mockResolvedValueOnce({ ok: true } as Response);

      const { result } = renderHook(() => useTaskCancellation(STABLE_TASKS));

      await act(async () => {
        await result.current.cancelTasks(['task-1', 'task-2', 'task-3']);
      });

      expect(result.current.failedTasks).toHaveLength(1);
      expect(result.current.failedTasks[0].id).toBe('task-2');
      expect(result.current.failedTasks[0].name).toBe('Fail Task');
      expect(result.current.error).toContain('1');
    });

    it('should use task name from tasks array for error messages, not "Unknown Task"', async () => {
      const task1 = createMockTask({ id: 'task-1', name: 'My Named Task' });
      const STABLE_TASKS = [task1];

      vi.mocked(api.patch).mockResolvedValue({
        ok: false,
        text: () => Promise.resolve('Error'),
        statusText: 'Error',
      } as Response);

      const { result } = renderHook(() => useTaskCancellation(STABLE_TASKS));

      await act(async () => {
        await result.current.cancelTasks(['task-1']);
      });

      expect(result.current.failedTasks[0].name).toBe('My Named Task');
      expect(result.current.failedTasks[0].name).not.toBe('Unknown Task');
    });

    it('should handle network errors (rejected promises)', async () => {
      const task1 = createMockTask({ id: 'task-1', name: 'Network Fail Task' });
      const STABLE_TASKS = [task1];

      vi.mocked(api.patch).mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useTaskCancellation(STABLE_TASKS));

      await act(async () => {
        await result.current.cancelTasks(['task-1']);
      });

      expect(result.current.failedTasks).toHaveLength(1);
      expect(result.current.failedTasks[0].id).toBe('task-1');
      expect(result.current.error).toBeTruthy();
      expect(result.current.isCancelling).toBe(false);
    });

    it('should set isCancelling to false even when all tasks fail', async () => {
      const task1 = createMockTask({ id: 'task-1' });
      const STABLE_TASKS = [task1];

      vi.mocked(api.patch).mockRejectedValue(new Error('Error'));

      const { result } = renderHook(() => useTaskCancellation(STABLE_TASKS));

      await act(async () => {
        await result.current.cancelTasks(['task-1']);
      });

      expect(result.current.isCancelling).toBe(false);
    });
  });

  describe('clearError', () => {
    it('should reset error to null', async () => {
      const task1 = createMockTask({ id: 'task-1', name: 'Task' });
      const STABLE_TASKS = [task1];

      vi.mocked(api.patch).mockResolvedValue({
        ok: false,
        text: () => Promise.resolve('Error'),
        statusText: 'Error',
      } as Response);

      const { result } = renderHook(() => useTaskCancellation(STABLE_TASKS));

      // Trigger an error
      await act(async () => {
        await result.current.cancelTasks(['task-1']);
      });

      expect(result.current.error).toBeTruthy();

      // Clear the error
      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });

    it('should reset failedTasks to empty array', async () => {
      const task1 = createMockTask({ id: 'task-1', name: 'Task' });
      const STABLE_TASKS = [task1];

      vi.mocked(api.patch).mockResolvedValue({
        ok: false,
        text: () => Promise.resolve('Error'),
        statusText: 'Error',
      } as Response);

      const { result } = renderHook(() => useTaskCancellation(STABLE_TASKS));

      // Trigger an error
      await act(async () => {
        await result.current.cancelTasks(['task-1']);
      });

      expect(result.current.failedTasks.length).toBeGreaterThan(0);

      // Clear the error
      act(() => {
        result.current.clearError();
      });

      expect(result.current.failedTasks).toEqual([]);
    });
  });

  describe('edge cases', () => {
    it('should handle cancelling with empty task IDs array', async () => {
      const { result } = renderHook(() => useTaskCancellation(STABLE_EMPTY_TASKS));

      await act(async () => {
        await result.current.cancelTasks([]);
      });

      expect(api.patch).not.toHaveBeenCalled();
      expect(result.current.isCancelling).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should handle cancelling a task ID that is not in the tasks array', async () => {
      const task1 = createMockTask({ id: 'task-1', name: 'Known Task' });
      const STABLE_TASKS = [task1];

      vi.mocked(api.patch).mockResolvedValue({
        ok: false,
        text: () => Promise.resolve('Not found'),
        statusText: 'Not Found',
      } as Response);

      const { result } = renderHook(() => useTaskCancellation(STABLE_TASKS));

      await act(async () => {
        await result.current.cancelTasks(['task-unknown']);
      });

      // Should still attempt the request
      expect(api.patch).toHaveBeenCalledTimes(1);
      // Failed task should have a fallback name (not crash)
      expect(result.current.failedTasks).toHaveLength(1);
    });

    it('should handle task with undefined name gracefully', async () => {
      const task1 = createMockTask({ id: 'task-1', name: undefined });
      const STABLE_TASKS = [task1];

      vi.mocked(api.patch).mockResolvedValue({
        ok: false,
        text: () => Promise.resolve('Error'),
        statusText: 'Error',
      } as Response);

      const { result } = renderHook(() => useTaskCancellation(STABLE_TASKS));

      await act(async () => {
        await result.current.cancelTasks(['task-1']);
      });

      // Should not crash and failedTasks should have an entry
      expect(result.current.failedTasks).toHaveLength(1);
      expect(result.current.failedTasks[0].name).toBeTruthy();
    });
  });
});
