/**
 * Tests for useCancellableTasks hook
 *
 * TDD tests - written BEFORE implementation.
 *
 * Covers:
 * - Fetching tasks with cancellable states on mount
 * - Loading state management
 * - Socket event handling for task state changes
 * - Reconnection behavior
 * - Refetch functionality
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { WorkerTask } from '@capybara-chat/types';

// ===== Mock Setup =====

// Mock the api module
vi.mock('../lib/api', () => ({
  api: {
    get: vi.fn(),
  },
  fetchJson: vi.fn(),
}));

// Track socket event handlers
const socketHandlers = new Map<string, Set<(...args: unknown[]) => void>>();

const mockSocket = {
  on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
    if (!socketHandlers.has(event)) {
      socketHandlers.set(event, new Set());
    }
    socketHandlers.get(event)!.add(handler);
  }),
  off: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
    socketHandlers.get(event)?.delete(handler);
  }),
  connected: true,
};

vi.mock('../context/SocketContext', () => ({
  useSocket: vi.fn(() => ({ socket: mockSocket })),
}));

import { api } from '../lib/api';

// Import the hook under test (does not exist yet - TDD)
import { useCancellableTasks } from './useCancellableTasks';

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

// Helper to simulate a socket event
function emitSocketEvent(event: string, data: unknown) {
  const handlers = socketHandlers.get(event);
  if (handlers) {
    handlers.forEach((handler) => handler(data));
  }
}

describe('useCancellableTasks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    socketHandlers.clear();
    mockSocket.connected = true;
  });

  describe('initial fetch', () => {
    it('should fetch tasks with state=running,assigned,paused on mount', async () => {
      const mockTasks = [
        createMockTask({ id: 'task-1', state: 'running' }),
        createMockTask({ id: 'task-2', state: 'assigned' }),
      ];

      vi.mocked(api.get).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ tasks: mockTasks }),
      } as Response);

      const { result } = renderHook(() => useCancellableTasks());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should have called API with cancellable states filter
      expect(api.get).toHaveBeenCalledWith(
        expect.stringContaining('state=running')
      );
      expect(api.get).toHaveBeenCalledWith(
        expect.stringContaining('assigned')
      );
      expect(api.get).toHaveBeenCalledWith(
        expect.stringContaining('paused')
      );
    });

    it('should set isLoading to true initially', () => {
      vi.mocked(api.get).mockReturnValue(new Promise(() => {})); // Never resolves

      const { result } = renderHook(() => useCancellableTasks());

      expect(result.current.isLoading).toBe(true);
    });

    it('should set isLoading to false after fetch completes', async () => {
      vi.mocked(api.get).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ tasks: [] }),
      } as Response);

      const { result } = renderHook(() => useCancellableTasks());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('should return fetched tasks', async () => {
      const mockTasks = [
        createMockTask({ id: 'task-1', state: 'running', name: 'Running Task' }),
        createMockTask({ id: 'task-2', state: 'paused', name: 'Paused Task' }),
      ];

      vi.mocked(api.get).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ tasks: mockTasks }),
      } as Response);

      const { result } = renderHook(() => useCancellableTasks());

      await waitFor(() => {
        expect(result.current.tasks).toHaveLength(2);
      });

      expect(result.current.tasks[0].id).toBe('task-1');
      expect(result.current.tasks[1].id).toBe('task-2');
    });

    it('should return empty tasks array when API returns no tasks', async () => {
      vi.mocked(api.get).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ tasks: [] }),
      } as Response);

      const { result } = renderHook(() => useCancellableTasks());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.tasks).toEqual([]);
    });
  });

  describe('socket event: TASK_UPDATED (state change)', () => {
    it('should remove a task when its state changes to a non-cancellable state (complete)', async () => {
      const task1 = createMockTask({ id: 'task-1', state: 'running' });
      const task2 = createMockTask({ id: 'task-2', state: 'running' });

      vi.mocked(api.get).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ tasks: [task1, task2] }),
      } as Response);

      const { result } = renderHook(() => useCancellableTasks());

      await waitFor(() => {
        expect(result.current.tasks).toHaveLength(2);
      });

      // Simulate task completing via TASK_UPDATED socket event
      act(() => {
        emitSocketEvent('task:updated', { taskId: 'task-1', state: 'complete' });
      });

      await waitFor(() => {
        expect(result.current.tasks).toHaveLength(1);
      });

      expect(result.current.tasks[0].id).toBe('task-2');
    });

    it('should remove a task when its state changes to cancelled', async () => {
      const task1 = createMockTask({ id: 'task-1', state: 'running' });

      vi.mocked(api.get).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ tasks: [task1] }),
      } as Response);

      const { result } = renderHook(() => useCancellableTasks());

      await waitFor(() => {
        expect(result.current.tasks).toHaveLength(1);
      });

      act(() => {
        emitSocketEvent('task:cancelled', { taskId: 'task-1' });
      });

      await waitFor(() => {
        expect(result.current.tasks).toHaveLength(0);
      });
    });

    it('should remove a task when its state changes to failed', async () => {
      const task1 = createMockTask({ id: 'task-1', state: 'running' });

      vi.mocked(api.get).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ tasks: [task1] }),
      } as Response);

      const { result } = renderHook(() => useCancellableTasks());

      await waitFor(() => {
        expect(result.current.tasks).toHaveLength(1);
      });

      act(() => {
        emitSocketEvent('task:updated', { taskId: 'task-1', state: 'failed' });
      });

      await waitFor(() => {
        expect(result.current.tasks).toHaveLength(0);
      });
    });

    it('should NOT remove a task when the event is for a task not in the list', async () => {
      const task1 = createMockTask({ id: 'task-1', state: 'running' });

      vi.mocked(api.get).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ tasks: [task1] }),
      } as Response);

      const { result } = renderHook(() => useCancellableTasks());

      await waitFor(() => {
        expect(result.current.tasks).toHaveLength(1);
      });

      act(() => {
        emitSocketEvent('task:updated', { taskId: 'task-other', state: 'complete' });
      });

      // Task list should remain unchanged
      expect(result.current.tasks).toHaveLength(1);
      expect(result.current.tasks[0].id).toBe('task-1');
    });

    it('should NOT remove a task when TASK_UPDATED has a cancellable state', async () => {
      const task1 = createMockTask({ id: 'task-1', state: 'running' });

      vi.mocked(api.get).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ tasks: [task1] }),
      } as Response);

      const { result } = renderHook(() => useCancellableTasks());

      await waitFor(() => {
        expect(result.current.tasks).toHaveLength(1);
      });

      act(() => {
        emitSocketEvent('task:updated', { taskId: 'task-1', state: 'running' });
      });

      // Task should remain since 'running' is a cancellable state
      expect(result.current.tasks).toHaveLength(1);
      expect(result.current.tasks[0].id).toBe('task-1');
    });
  });

  describe('socket reconnection', () => {
    it('should refetch tasks on socket connect event (reconnection)', async () => {
      const initialTasks = [createMockTask({ id: 'task-1', state: 'running' })];
      const updatedTasks = [
        createMockTask({ id: 'task-1', state: 'running' }),
        createMockTask({ id: 'task-3', state: 'assigned' }),
      ];

      vi.mocked(api.get)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ tasks: initialTasks }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ tasks: updatedTasks }),
        } as Response);

      const { result } = renderHook(() => useCancellableTasks());

      await waitFor(() => {
        expect(result.current.tasks).toHaveLength(1);
      });

      // Simulate reconnection
      act(() => {
        emitSocketEvent('connect', undefined);
      });

      await waitFor(() => {
        expect(api.get).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('refetch', () => {
    it('should provide a refetch function that triggers a new API call', async () => {
      const mockTasks = [createMockTask({ id: 'task-1', state: 'running' })];

      vi.mocked(api.get).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ tasks: mockTasks }),
      } as Response);

      const { result } = renderHook(() => useCancellableTasks());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(api.get).toHaveBeenCalledTimes(1);

      // Call refetch
      await act(async () => {
        await result.current.refetch();
      });

      expect(api.get).toHaveBeenCalledTimes(2);
    });
  });

  describe('cleanup', () => {
    it('should unregister socket event handlers on unmount', async () => {
      vi.mocked(api.get).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ tasks: [] }),
      } as Response);

      const { unmount } = renderHook(() => useCancellableTasks());

      await waitFor(() => {
        expect(mockSocket.on).toHaveBeenCalled();
      });

      unmount();

      // Socket off should have been called for each registered event
      expect(mockSocket.off).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle API errors gracefully and return empty tasks', async () => {
      vi.mocked(api.get).mockResolvedValue({
        ok: false,
        text: () => Promise.resolve('Server Error'),
        statusText: 'Internal Server Error',
      } as Response);

      const { result } = renderHook(() => useCancellableTasks());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.tasks).toEqual([]);
    });

    it('should handle network errors gracefully', async () => {
      vi.mocked(api.get).mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useCancellableTasks());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.tasks).toEqual([]);
    });
  });
});
