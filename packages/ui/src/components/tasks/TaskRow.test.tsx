/**
 * Tests for TaskRow component
 *
 * TDD tests - written BEFORE implementation.
 *
 * Covers:
 * - Task name rendering
 * - State-based phase badge display
 * - Elapsed time formatting
 * - Click handler (onToggle)
 * - Selection state visual indicator
 * - Accessibility attributes (role, aria-checked)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { WorkerTask } from '@capybara-chat/types';

// Import the component under test (does not exist yet - TDD)
import { TaskRow } from './TaskRow';

// ===== Test Fixtures =====

const createMockTask = (overrides: Partial<WorkerTask> = {}): WorkerTask => ({
  id: 'task-row-test',
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

const stableOnToggle = vi.fn();

describe('TaskRow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('task name rendering', () => {
    it('should render the task name', () => {
      const task = createMockTask({ name: 'Deploy to staging' });

      render(
        <TaskRow
          task={task}
          isSelected={false}
          onToggle={stableOnToggle}
        />
      );

      expect(screen.getByText('Deploy to staging')).toBeInTheDocument();
    });

    it('should handle task with undefined name gracefully', () => {
      const task = createMockTask({ name: undefined });

      render(
        <TaskRow
          task={task}
          isSelected={false}
          onToggle={stableOnToggle}
        />
      );

      // Should render without crashing - might show ID or fallback text
      expect(screen.getByRole('checkbox')).toBeInTheDocument();
    });
  });

  describe('phase badge', () => {
    it('should show [RUNNING] badge for running state', () => {
      const task = createMockTask({ state: 'running' });

      render(
        <TaskRow
          task={task}
          isSelected={false}
          onToggle={stableOnToggle}
        />
      );

      expect(screen.getByText(/RUNNING/)).toBeInTheDocument();
    });

    it('should show [ASSIGNED] badge for assigned state', () => {
      const task = createMockTask({ state: 'assigned' });

      render(
        <TaskRow
          task={task}
          isSelected={false}
          onToggle={stableOnToggle}
        />
      );

      expect(screen.getByText(/ASSIGNED/)).toBeInTheDocument();
    });

    it('should show [PAUSED] badge for paused state', () => {
      const task = createMockTask({ state: 'paused' });

      render(
        <TaskRow
          task={task}
          isSelected={false}
          onToggle={stableOnToggle}
        />
      );

      expect(screen.getByText(/PAUSED/)).toBeInTheDocument();
    });
  });

  describe('elapsed time display', () => {
    it('should show elapsed time in MM:SS format for running task', () => {
      // Task started 125 seconds ago (2m 5s = "02:05")
      const task = createMockTask({
        state: 'running',
        startedAt: Date.now() - 125000,
      });

      render(
        <TaskRow
          task={task}
          isSelected={false}
          onToggle={stableOnToggle}
        />
      );

      // Should show time in MM:SS format
      expect(screen.getByText(/\d{1,2}:\d{2}/)).toBeInTheDocument();
    });

    it('should show elapsed time based on queuedAt if startedAt is not set', () => {
      const task = createMockTask({
        state: 'assigned',
        startedAt: undefined,
        queuedAt: Date.now() - 90000, // 1m 30s ago
      });

      render(
        <TaskRow
          task={task}
          isSelected={false}
          onToggle={stableOnToggle}
        />
      );

      // Should still show some time value
      expect(screen.getByText(/\d{1,2}:\d{2}/)).toBeInTheDocument();
    });
  });

  describe('click handler', () => {
    it('should call onToggle with task ID when row is clicked', () => {
      const task = createMockTask({ id: 'task-click-test' });

      render(
        <TaskRow
          task={task}
          isSelected={false}
          onToggle={stableOnToggle}
        />
      );

      fireEvent.click(screen.getByRole('checkbox'));

      expect(stableOnToggle).toHaveBeenCalledWith('task-click-test');
      expect(stableOnToggle).toHaveBeenCalledTimes(1);
    });

    it('should call onToggle when clicking the row even if already selected', () => {
      const task = createMockTask({ id: 'task-toggle' });

      render(
        <TaskRow
          task={task}
          isSelected={true}
          onToggle={stableOnToggle}
        />
      );

      fireEvent.click(screen.getByRole('checkbox'));

      expect(stableOnToggle).toHaveBeenCalledWith('task-toggle');
    });
  });

  describe('selection state', () => {
    it('should show checked visual indicator when isSelected is true', () => {
      const task = createMockTask({ id: 'task-selected' });

      render(
        <TaskRow
          task={task}
          isSelected={true}
          onToggle={stableOnToggle}
        />
      );

      const row = screen.getByRole('checkbox');
      expect(row).toHaveAttribute('aria-checked', 'true');
    });

    it('should show unchecked visual indicator when isSelected is false', () => {
      const task = createMockTask({ id: 'task-unselected' });

      render(
        <TaskRow
          task={task}
          isSelected={false}
          onToggle={stableOnToggle}
        />
      );

      const row = screen.getByRole('checkbox');
      expect(row).toHaveAttribute('aria-checked', 'false');
    });
  });

  describe('accessibility', () => {
    it('should have role="checkbox"', () => {
      const task = createMockTask();

      render(
        <TaskRow
          task={task}
          isSelected={false}
          onToggle={stableOnToggle}
        />
      );

      expect(screen.getByRole('checkbox')).toBeInTheDocument();
    });

    it('should have correct aria-checked attribute matching isSelected', () => {
      const task = createMockTask();

      const { rerender } = render(
        <TaskRow
          task={task}
          isSelected={false}
          onToggle={stableOnToggle}
        />
      );

      expect(screen.getByRole('checkbox')).toHaveAttribute('aria-checked', 'false');

      rerender(
        <TaskRow
          task={task}
          isSelected={true}
          onToggle={stableOnToggle}
        />
      );

      expect(screen.getByRole('checkbox')).toHaveAttribute('aria-checked', 'true');
    });
  });

  describe('styling', () => {
    it('should apply optional className prop', () => {
      const task = createMockTask();

      render(
        <TaskRow
          task={task}
          isSelected={false}
          onToggle={stableOnToggle}
          className="custom-row-class"
        />
      );

      const row = screen.getByRole('checkbox');
      expect(row.className).toContain('custom-row-class');
    });
  });
});
