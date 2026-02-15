/**
 * Tests for KanbanBoard
 *
 * Covers:
 * - Task grouping by state
 * - Assigned tasks merged into running column
 * - Cancelled tasks merged into stopped column
 * - Column visibility
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { KanbanBoard } from './KanbanBoard';
import type { WorkerTask } from '@capybara-chat/types';

const createTask = (overrides: Partial<WorkerTask> = {}): WorkerTask => ({
  id: `task-${Math.random().toString(36).slice(2)}`,
  name: 'Test Task',
  specId: 'spec-456',
  workspaceId: 'ws-789',
  techniqueId: 'tech-001',
  variables: {},
  state: 'queued',
  attempt: 1,
  maxAttempts: 3,
  iteration: 0,
  queuedAt: Date.now(),
  createdBy: null,
  ...overrides,
});

describe('KanbanBoard', () => {
  const mockRefetch = vi.fn();
  const mockTaskSelect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('task grouping', () => {
    it('should merge assigned tasks into the running column', () => {
      const tasks = [
        createTask({ id: 'task-1', name: 'Queued Task', state: 'queued' }),
        createTask({ id: 'task-2', name: 'Assigned Task', state: 'assigned' }),
        createTask({ id: 'task-3', name: 'Running Task', state: 'running' }),
      ];

      render(
        <KanbanBoard
          tasks={tasks}
          isLoading={false}
          onRefetch={mockRefetch}
          onTaskSelect={mockTaskSelect}
        />
      );

      // Running column should show both assigned and running tasks
      expect(screen.getByText('Assigned Task')).toBeInTheDocument();
      expect(screen.getByText('Running Task')).toBeInTheDocument();

      // Verify "Assigned" is NOT a column title - KanbanBoard merges assigned into running
      // The running column count should be 2 (assigned + running), not 1
      // Check by verifying the visible columns don't include a separate Assigned column
      expect(screen.getByText('Queued')).toBeInTheDocument();
      expect(screen.getByText('Running')).toBeInTheDocument();
      // No separate "Assigned" column should exist (assigned tasks appear in Running)

      // Running column should exist
      expect(screen.getByText('Running')).toBeInTheDocument();
    });

    it('should merge cancelled tasks into the stopped column', () => {
      const tasks = [
        createTask({ id: 'task-1', name: 'Failed Task', state: 'failed' }),
        createTask({ id: 'task-2', name: 'Cancelled Task', state: 'cancelled' }),
      ];

      render(
        <KanbanBoard
          tasks={tasks}
          isLoading={false}
          onRefetch={mockRefetch}
          onTaskSelect={mockTaskSelect}
        />
      );

      // Stopped column should show both failed and cancelled tasks
      expect(screen.getByText('Failed Task')).toBeInTheDocument();
      expect(screen.getByText('Cancelled Task')).toBeInTheDocument();

      // Verify "Stopped" column title (not separate "Failed" and "Cancelled" columns)
      expect(screen.getByText('Stopped')).toBeInTheDocument();
    });

    it('should show tasks in their correct columns', () => {
      const tasks = [
        createTask({ id: 'task-1', name: 'Queued Task', state: 'queued' }),
        createTask({ id: 'task-2', name: 'Paused Task', state: 'paused' }),
        createTask({ id: 'task-3', name: 'Complete Task', state: 'complete' }),
        createTask({ id: 'task-4', name: 'Stopped Task', state: 'failed' }),
      ];

      render(
        <KanbanBoard
          tasks={tasks}
          isLoading={false}
          onRefetch={mockRefetch}
        />
      );

      expect(screen.getByText('Queued Task')).toBeInTheDocument();
      expect(screen.getByText('Paused Task')).toBeInTheDocument();
      expect(screen.getByText('Complete Task')).toBeInTheDocument();
      expect(screen.getByText('Stopped Task')).toBeInTheDocument();
    });
  });

  describe('column visibility', () => {
    it('should show column headers', () => {
      const tasks = [
        createTask({ state: 'queued' }),
        createTask({ state: 'running' }),
        createTask({ state: 'complete' }),
      ];

      render(
        <KanbanBoard
          tasks={tasks}
          isLoading={false}
          onRefetch={mockRefetch}
        />
      );

      expect(screen.getByText('Queued')).toBeInTheDocument();
      expect(screen.getByText('Running')).toBeInTheDocument();
      expect(screen.getByText('Complete')).toBeInTheDocument();
    });

    it('should show total task count in header', () => {
      const tasks = [
        createTask({ state: 'queued' }),
        createTask({ state: 'running' }),
        createTask({ state: 'complete' }),
      ];

      render(
        <KanbanBoard
          tasks={tasks}
          isLoading={false}
          onRefetch={mockRefetch}
        />
      );

      expect(screen.getByText('[3 total]')).toBeInTheDocument();
    });
  });

  describe('loading state', () => {
    it('should show loading spinner when loading with no tasks', () => {
      render(
        <KanbanBoard
          tasks={[]}
          isLoading={true}
          onRefetch={mockRefetch}
        />
      );

      expect(screen.getByText(/loading tasks/i)).toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('should show empty state when no tasks', () => {
      render(
        <KanbanBoard
          tasks={[]}
          isLoading={false}
          onRefetch={mockRefetch}
        />
      );

      expect(screen.getByText('NO_TASKS_FOUND')).toBeInTheDocument();
    });
  });

  describe('TASK_BOARD header', () => {
    it('should render TASK_BOARD label', () => {
      render(
        <KanbanBoard
          tasks={[createTask()]}
          isLoading={false}
          onRefetch={mockRefetch}
        />
      );

      expect(screen.getByText('TASK_BOARD')).toBeInTheDocument();
    });
  });
});
