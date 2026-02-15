/**
 * Tests for KanbanCard
 *
 * Covers:
 * - Sub-type badge for stopped tasks (failed vs cancelled)
 * - Duration and cost display
 * - Basic card rendering
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { KanbanCard } from './KanbanCard';
import type { WorkerTask } from '@capybara-chat/types';

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
  queuedAt: Date.now(),
  createdBy: null,
  ...overrides,
});

describe('KanbanCard', () => {
  const mockDragStart = vi.fn();
  const mockDragEnd = vi.fn();

  describe('basic rendering', () => {
    it('should render task name', () => {
      render(
        <KanbanCard
          task={createTask({ name: 'My Task' })}
          onDragStart={mockDragStart}
          onDragEnd={mockDragEnd}
        />
      );

      expect(screen.getByText('My Task')).toBeInTheDocument();
    });

    it('should render task ID prefix when no name', () => {
      render(
        <KanbanCard
          task={createTask({ name: '', id: 'task-abcdef123456' })}
          onDragStart={mockDragStart}
          onDragEnd={mockDragEnd}
        />
      );

      expect(screen.getByText('Task task-abc')).toBeInTheDocument();
    });

    it('should render iteration badge when iteration > 0', () => {
      render(
        <KanbanCard
          task={createTask({ iteration: 3 })}
          onDragStart={mockDragStart}
          onDragEnd={mockDragEnd}
        />
      );

      expect(screen.getByText('iter:3')).toBeInTheDocument();
    });

    it('should not render iteration badge when iteration is 0', () => {
      render(
        <KanbanCard
          task={createTask({ iteration: 0 })}
          onDragStart={mockDragStart}
          onDragEnd={mockDragEnd}
        />
      );

      expect(screen.queryByText(/iter:/)).not.toBeInTheDocument();
    });
  });

  describe('sub-type badge (GAP-005)', () => {
    it('should show FAILED badge for failed tasks', () => {
      render(
        <KanbanCard
          task={createTask({ state: 'failed' })}
          onDragStart={mockDragStart}
          onDragEnd={mockDragEnd}
        />
      );

      expect(screen.getByText('FAILED')).toBeInTheDocument();
    });

    it('should show CANCELLED badge for cancelled tasks', () => {
      render(
        <KanbanCard
          task={createTask({ state: 'cancelled' })}
          onDragStart={mockDragStart}
          onDragEnd={mockDragEnd}
        />
      );

      expect(screen.getByText('CANCELLED')).toBeInTheDocument();
    });

    it('should NOT show sub-type badge for running tasks', () => {
      render(
        <KanbanCard
          task={createTask({ state: 'running' })}
          onDragStart={mockDragStart}
          onDragEnd={mockDragEnd}
        />
      );

      expect(screen.queryByText('RUNNING')).not.toBeInTheDocument();
      expect(screen.queryByText('FAILED')).not.toBeInTheDocument();
      expect(screen.queryByText('CANCELLED')).not.toBeInTheDocument();
    });

    it('should NOT show sub-type badge for complete tasks', () => {
      render(
        <KanbanCard
          task={createTask({ state: 'complete' })}
          onDragStart={mockDragStart}
          onDragEnd={mockDragEnd}
        />
      );

      expect(screen.queryByText('COMPLETE')).not.toBeInTheDocument();
    });
  });

  describe('duration display', () => {
    it('should show duration when startedAt is set', () => {
      const startTime = Date.now() - 120000; // 2 minutes ago

      render(
        <KanbanCard
          task={createTask({
            state: 'running',
            startedAt: startTime,
          })}
          onDragStart={mockDragStart}
          onDragEnd={mockDragEnd}
        />
      );

      expect(screen.getByText('2m')).toBeInTheDocument();
    });

    it('should calculate final duration for completed tasks', () => {
      const startTime = Date.now() - 300000; // 5 minutes ago
      const completedTime = Date.now() - 60000; // completed 1 minute ago (4 min duration)

      render(
        <KanbanCard
          task={createTask({
            state: 'complete',
            startedAt: startTime,
            completedAt: completedTime,
          })}
          onDragStart={mockDragStart}
          onDragEnd={mockDragEnd}
        />
      );

      expect(screen.getByText('4m')).toBeInTheDocument();
    });

    it('should not show duration for queued tasks without startedAt', () => {
      render(
        <KanbanCard
          task={createTask({ state: 'queued' })}
          onDragStart={mockDragStart}
          onDragEnd={mockDragEnd}
        />
      );

      // No duration element (no Clock icon content)
      expect(screen.queryByText(/^\d+m$/)).not.toBeInTheDocument();
    });
  });

  describe('cost display', () => {
    it('should show cost when sessionTotalCost is set', () => {
      render(
        <KanbanCard
          task={createTask({
            sessionTotalCost: 0.25,
          })}
          onDragStart={mockDragStart}
          onDragEnd={mockDragEnd}
        />
      );

      // Cost shows as "0.25" (without $, as the icon provides the symbol)
      expect(screen.getByText('0.25')).toBeInTheDocument();
    });

    it('should show <$0.01 for very small costs', () => {
      render(
        <KanbanCard
          task={createTask({
            sessionTotalCost: 0.005,
          })}
          onDragStart={mockDragStart}
          onDragEnd={mockDragEnd}
        />
      );

      expect(screen.getByText('<0.01')).toBeInTheDocument();
    });

    it('should not show cost when sessionTotalCost is undefined', () => {
      render(
        <KanbanCard
          task={createTask({
            sessionTotalCost: undefined,
          })}
          onDragStart={mockDragStart}
          onDragEnd={mockDragEnd}
        />
      );

      // No cost display
      expect(screen.queryByText(/^\d+\.\d+$/)).not.toBeInTheDocument();
    });

    it('should show both duration and cost together', () => {
      render(
        <KanbanCard
          task={createTask({
            state: 'complete',
            startedAt: Date.now() - 180000, // 3 min
            completedAt: Date.now(),
            sessionTotalCost: 1.50,
          })}
          onDragStart={mockDragStart}
          onDragEnd={mockDragEnd}
        />
      );

      expect(screen.getByText('3m')).toBeInTheDocument();
      expect(screen.getByText('1.50')).toBeInTheDocument();
    });
  });

  describe('error display', () => {
    it('should show error message when task has error', () => {
      render(
        <KanbanCard
          task={createTask({
            state: 'failed',
            error: 'Something went wrong',
          })}
          onDragStart={mockDragStart}
          onDragEnd={mockDragEnd}
        />
      );

      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });

    it('should not show error section when no error', () => {
      render(
        <KanbanCard
          task={createTask({ error: undefined })}
          onDragStart={mockDragStart}
          onDragEnd={mockDragEnd}
        />
      );

      // No destructive background error section
      expect(screen.queryByText(/Something went wrong/)).not.toBeInTheDocument();
    });
  });

  describe('progress message', () => {
    it('should show progress message for running tasks', () => {
      render(
        <KanbanCard
          task={createTask({
            state: 'running',
            lastProgressMessage: 'Running pytest...',
          })}
          onDragStart={mockDragStart}
          onDragEnd={mockDragEnd}
        />
      );

      expect(screen.getByText('Running pytest...')).toBeInTheDocument();
    });

    it('should show progress message for assigned tasks', () => {
      render(
        <KanbanCard
          task={createTask({
            state: 'assigned',
            lastProgressMessage: 'Starting up...',
          })}
          onDragStart={mockDragStart}
          onDragEnd={mockDragEnd}
        />
      );

      expect(screen.getByText('Starting up...')).toBeInTheDocument();
    });

    it('should show progress message for complete tasks (133-task-card-enhancements)', () => {
      // Changed behavior: Now shows last progress message for ALL states
      // Previously only showed for active tasks
      render(
        <KanbanCard
          task={createTask({
            state: 'complete',
            lastProgressMessage: 'Done!',
          })}
          onDragStart={mockDragStart}
          onDragEnd={mockDragEnd}
        />
      );

      // Now shows the message (with static icon instead of spinner)
      expect(screen.getByText('Done!')).toBeInTheDocument();
    });

    it('should show lastMessage when lastProgressMessage is not set (133-task-card-enhancements)', () => {
      // Fallback behavior: show lastMessage when no progress message exists
      render(
        <KanbanCard
          task={createTask({
            state: 'complete',
            lastProgressMessage: undefined,
            lastMessage: 'Task completed successfully with all tests passing.',
          })}
          onDragStart={mockDragStart}
          onDragEnd={mockDragEnd}
        />
      );

      expect(screen.getByText('Task completed successfully with all tests passing.')).toBeInTheDocument();
    });

    it('should prefer lastProgressMessage over lastMessage (133-task-card-enhancements)', () => {
      // lastProgressMessage takes priority over lastMessage
      render(
        <KanbanCard
          task={createTask({
            state: 'complete',
            lastProgressMessage: 'Running final checks...',
            lastMessage: 'Task completed successfully.',
          })}
          onDragStart={mockDragStart}
          onDragEnd={mockDragEnd}
        />
      );

      expect(screen.getByText('Running final checks...')).toBeInTheDocument();
      expect(screen.queryByText('Task completed successfully.')).not.toBeInTheDocument();
    });
  });

  describe('PR link', () => {
    it('should show PR link when prUrl and prNumber are set', () => {
      render(
        <KanbanCard
          task={createTask({
            prUrl: 'https://github.com/org/repo/pull/42',
            prNumber: 42,
          })}
          onDragStart={mockDragStart}
          onDragEnd={mockDragEnd}
        />
      );

      const link = screen.getByText('PR #42');
      expect(link).toBeInTheDocument();
      expect(link.closest('a')).toHaveAttribute(
        'href',
        'https://github.com/org/repo/pull/42'
      );
    });
  });

  describe('phase badge', () => {
    it('should show phase badge when currentPhase is set', () => {
      render(
        <KanbanCard
          task={createTask({
            currentPhase: 'testing',
          })}
          onDragStart={mockDragStart}
          onDragEnd={mockDragEnd}
        />
      );

      expect(screen.getByText('testing')).toBeInTheDocument();
    });
  });
});
