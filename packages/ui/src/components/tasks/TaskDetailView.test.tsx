/**
 * Tests for TaskDetailView
 *
 * Covers:
 * - Duration timer for active tasks
 * - State-based rendering
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TaskDetailView } from './TaskDetailView';
import type { WorkerTask } from '@capybara-chat/types';

// Mock hooks
vi.mock('../../context/ServerContext', () => ({
  useServer: () => ({ serverUrl: 'http://localhost:2279' }),
}));

vi.mock('../../context/SocketContext', () => ({
  useSocket: () => ({
    on: vi.fn(),
    off: vi.fn(),
  }),
}));

vi.mock('../../hooks/useFetch', () => ({
  useFetch: vi.fn(),
}));

vi.mock('../../lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

const createTask = (overrides: Partial<WorkerTask> = {}): WorkerTask => ({
  id: 'task-123',
  name: 'Test Task',
  specId: 'spec-456',
  workspaceId: 'ws-789',
  techniqueId: 'tech-001',
  variables: {},
  state: 'queued',
  attempt: 1,
  maxAttempts: 3,
  iteration: 0,
  queuedAt: Date.now() - 60000,
  createdBy: null,
  ...overrides,
});

describe('TaskDetailView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('state rendering', () => {
    it('should render loading state', async () => {
      const { useFetch } = await import('../../hooks/useFetch');
      vi.mocked(useFetch).mockReturnValue({
        data: null,
        loading: true,
        error: null,
        refetch: vi.fn(),
      });

      render(<TaskDetailView taskId="task-123" />);

      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });

    it('should render error state when task not found', async () => {
      const { useFetch } = await import('../../hooks/useFetch');
      vi.mocked(useFetch).mockReturnValue({
        data: null,
        loading: false,
        error: 'Not found',
        refetch: vi.fn(),
      });

      render(<TaskDetailView taskId="task-123" />);

      expect(screen.getByText('TASK_NOT_FOUND')).toBeInTheDocument();
    });

    it('should render TASK_DETAIL type label in header', async () => {
      const { useFetch } = await import('../../hooks/useFetch');
      vi.mocked(useFetch).mockReturnValue({
        data: createTask({ state: 'queued' }),
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<TaskDetailView taskId="task-123" />);

      expect(screen.getByText('TASK_DETAIL')).toBeInTheDocument();
    });

    it('should render task name', async () => {
      const { useFetch } = await import('../../hooks/useFetch');
      vi.mocked(useFetch).mockReturnValue({
        data: createTask({ name: 'My Special Task' }),
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<TaskDetailView taskId="task-123" />);

      expect(screen.getByText('My Special Task')).toBeInTheDocument();
    });

    it('should render status badge based on task state', async () => {
      const { useFetch } = await import('../../hooks/useFetch');
      vi.mocked(useFetch).mockReturnValue({
        data: createTask({ state: 'running' }),
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<TaskDetailView taskId="task-123" />);

      expect(screen.getByText('RUNNING')).toBeInTheDocument();
    });
  });

  describe('duration display', () => {
    it('should show duration for running tasks', async () => {
      const { useFetch } = await import('../../hooks/useFetch');
      const startTime = Date.now() - 180000; // 3 minutes ago

      vi.mocked(useFetch).mockReturnValue({
        data: createTask({
          state: 'running',
          startedAt: startTime,
        }),
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<TaskDetailView taskId="task-123" />);

      // Should display duration (3m)
      expect(screen.getByText('3m')).toBeInTheDocument();
    });

    it('should show duration for assigned tasks', async () => {
      const { useFetch } = await import('../../hooks/useFetch');
      const startTime = Date.now() - 120000; // 2 minutes ago

      vi.mocked(useFetch).mockReturnValue({
        data: createTask({
          state: 'assigned',
          startedAt: startTime,
        }),
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<TaskDetailView taskId="task-123" />);

      expect(screen.getByText('2m')).toBeInTheDocument();
    });

    it('should show final duration for completed tasks (startedAt to completedAt)', async () => {
      const { useFetch } = await import('../../hooks/useFetch');
      const startTime = Date.now() - 300000; // 5 minutes ago
      const completedTime = Date.now() - 60000; // completed 1 minute ago (4 min duration)

      vi.mocked(useFetch).mockReturnValue({
        data: createTask({
          state: 'complete',
          startedAt: startTime,
          completedAt: completedTime,
        }),
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<TaskDetailView taskId="task-123" />);

      // Duration should be 4m (startedAt to completedAt)
      expect(screen.getByText('4m')).toBeInTheDocument();
    });

    it('should show -- for tasks without startedAt', async () => {
      const { useFetch } = await import('../../hooks/useFetch');

      vi.mocked(useFetch).mockReturnValue({
        data: createTask({
          state: 'queued',
          startedAt: undefined,
        }),
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<TaskDetailView taskId="task-123" />);

      // Multiple "--" elements exist (Started, Duration), use getAllByText
      const dashElements = screen.getAllByText('--');
      expect(dashElements.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('duration timer (unit test)', () => {
    it('should set up interval for running tasks', async () => {
      const setIntervalSpy = vi.spyOn(global, 'setInterval');
      const { useFetch } = await import('../../hooks/useFetch');

      vi.mocked(useFetch).mockReturnValue({
        data: createTask({
          state: 'running',
          startedAt: Date.now() - 60000,
        }),
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<TaskDetailView taskId="task-123" />);

      // Timer should be set up
      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 1000);

      setIntervalSpy.mockRestore();
    });

    it('should set up interval for assigned tasks', async () => {
      const setIntervalSpy = vi.spyOn(global, 'setInterval');
      const { useFetch } = await import('../../hooks/useFetch');

      vi.mocked(useFetch).mockReturnValue({
        data: createTask({
          state: 'assigned',
          startedAt: Date.now() - 60000,
        }),
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<TaskDetailView taskId="task-123" />);

      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 1000);

      setIntervalSpy.mockRestore();
    });

    it('should NOT set up interval for complete tasks', async () => {
      const setIntervalSpy = vi.spyOn(global, 'setInterval');
      const { useFetch } = await import('../../hooks/useFetch');

      vi.mocked(useFetch).mockReturnValue({
        data: createTask({
          state: 'complete',
          startedAt: Date.now() - 120000,
          completedAt: Date.now() - 60000,
        }),
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<TaskDetailView taskId="task-123" />);

      // Should not call setInterval for complete tasks
      expect(setIntervalSpy).not.toHaveBeenCalled();

      setIntervalSpy.mockRestore();
    });

    it('should clean up interval on unmount', async () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
      const { useFetch } = await import('../../hooks/useFetch');

      vi.mocked(useFetch).mockReturnValue({
        data: createTask({
          state: 'running',
          startedAt: Date.now() - 60000,
        }),
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      const { unmount } = render(<TaskDetailView taskId="task-123" />);

      unmount();

      // Cleanup should have been called
      expect(clearIntervalSpy).toHaveBeenCalled();

      clearIntervalSpy.mockRestore();
    });
  });

  describe('session callbacks', () => {
    it('should render Open in Chat Pane button when task has sessionId', async () => {
      const { useFetch } = await import('../../hooks/useFetch');
      const mockOpenInPane = vi.fn();

      vi.mocked(useFetch).mockReturnValue({
        data: createTask({
          state: 'running',
          sessionId: 'session-456',
        }),
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(
        <TaskDetailView
          taskId="task-123"
          onOpenSessionInPane={mockOpenInPane}
        />
      );

      // Should render the Open in Chat Pane button
      expect(screen.getByText('Open in Chat Pane')).toBeInTheDocument();
    });

    it('should NOT render session buttons when task has no sessionId', async () => {
      const { useFetch } = await import('../../hooks/useFetch');

      vi.mocked(useFetch).mockReturnValue({
        data: createTask({
          state: 'queued',
          sessionId: undefined,
        }),
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<TaskDetailView taskId="task-123" />);

      // Should not render session buttons
      expect(screen.queryByText('Open in Chat Pane')).not.toBeInTheDocument();
      expect(screen.queryByText('Full Timeline')).not.toBeInTheDocument();
    });
  });
});
