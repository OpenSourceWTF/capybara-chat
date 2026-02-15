/**
 * Tests for StopButton component
 *
 * TDD tests - written BEFORE implementation.
 *
 * Covers:
 * - Conditional rendering (empty tasks = null)
 * - Single task: direct cancel action
 * - Multiple tasks: opens modal instead
 * - Loading/cancelling state
 * - Accessibility attributes
 * - Visual elements (badge, spinner)
 * - Cozy Terminal styling (rounded-none)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { WorkerTask } from '@capybara-chat/types';

// Import the component under test (does not exist yet - TDD)
import { StopButton } from './StopButton';

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
const stableOnCancel = vi.fn().mockResolvedValue(undefined);

describe('StopButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stableOnCancel.mockResolvedValue(undefined);
  });

  describe('conditional rendering', () => {
    it('should return null when cancellableTasks is empty', () => {
      const { container } = render(
        <StopButton
          cancellableTasks={STABLE_EMPTY_TASKS}
          onCancel={stableOnCancel}
          isCancelling={false}
        />
      );

      expect(container.innerHTML).toBe('');
    });

    it('should render stop button when cancellable tasks exist', () => {
      const task = createMockTask({ id: 'task-1' });

      render(
        <StopButton
          cancellableTasks={[task]}
          onCancel={stableOnCancel}
          isCancelling={false}
        />
      );

      expect(screen.getByTestId('stop-button')).toBeInTheDocument();
    });
  });

  describe('single task behavior', () => {
    it('should call onCancel with [task.id] immediately when clicking with a single task', () => {
      const task = createMockTask({ id: 'task-single' });

      render(
        <StopButton
          cancellableTasks={[task]}
          onCancel={stableOnCancel}
          isCancelling={false}
        />
      );

      fireEvent.click(screen.getByTestId('stop-button'));

      expect(stableOnCancel).toHaveBeenCalledWith(['task-single']);
    });

    it('should have correct aria-label for single task', () => {
      const task = createMockTask({ id: 'task-1' });

      render(
        <StopButton
          cancellableTasks={[task]}
          onCancel={stableOnCancel}
          isCancelling={false}
        />
      );

      const button = screen.getByTestId('stop-button');
      expect(button).toHaveAttribute('aria-label', 'Stop 1 running task');
    });
  });

  describe('multiple tasks behavior', () => {
    it('should NOT call onCancel directly when clicking with multiple tasks (opens modal instead)', () => {
      const task1 = createMockTask({ id: 'task-1' });
      const task2 = createMockTask({ id: 'task-2' });

      render(
        <StopButton
          cancellableTasks={[task1, task2]}
          onCancel={stableOnCancel}
          isCancelling={false}
        />
      );

      fireEvent.click(screen.getByTestId('stop-button'));

      // Should NOT call onCancel directly - should open modal instead
      expect(stableOnCancel).not.toHaveBeenCalled();
    });

    it('should have correct aria-label for multiple tasks', () => {
      const tasks = [
        createMockTask({ id: 'task-1' }),
        createMockTask({ id: 'task-2' }),
        createMockTask({ id: 'task-3' }),
      ];

      render(
        <StopButton
          cancellableTasks={tasks}
          onCancel={stableOnCancel}
          isCancelling={false}
        />
      );

      const button = screen.getByTestId('stop-button');
      expect(button).toHaveAttribute('aria-label', 'Stop 3 running tasks');
    });

    it('should show badge with task count for multiple tasks', () => {
      const tasks = [
        createMockTask({ id: 'task-1' }),
        createMockTask({ id: 'task-2' }),
        createMockTask({ id: 'task-3' }),
      ];

      render(
        <StopButton
          cancellableTasks={tasks}
          onCancel={stableOnCancel}
          isCancelling={false}
        />
      );

      expect(screen.getByText('[3]')).toBeInTheDocument();
    });
  });

  describe('loading state', () => {
    it('should show "STOPPING..." text when isCancelling is true', () => {
      const task = createMockTask({ id: 'task-1' });

      render(
        <StopButton
          cancellableTasks={[task]}
          onCancel={stableOnCancel}
          isCancelling={true}
        />
      );

      expect(screen.getByText(/STOPPING/i)).toBeInTheDocument();
    });

    it('should disable button when isCancelling is true', () => {
      const task = createMockTask({ id: 'task-1' });

      render(
        <StopButton
          cancellableTasks={[task]}
          onCancel={stableOnCancel}
          isCancelling={true}
        />
      );

      const button = screen.getByTestId('stop-button');
      expect(button).toBeDisabled();
    });

    it('should not call onCancel when clicking a disabled (cancelling) button', () => {
      const task = createMockTask({ id: 'task-1' });

      render(
        <StopButton
          cancellableTasks={[task]}
          onCancel={stableOnCancel}
          isCancelling={true}
        />
      );

      fireEvent.click(screen.getByTestId('stop-button'));

      expect(stableOnCancel).not.toHaveBeenCalled();
    });
  });

  describe('styling', () => {
    it('should have rounded-none class (Cozy Terminal style)', () => {
      const task = createMockTask({ id: 'task-1' });

      render(
        <StopButton
          cancellableTasks={[task]}
          onCancel={stableOnCancel}
          isCancelling={false}
        />
      );

      const button = screen.getByTestId('stop-button');
      expect(button.className).toContain('rounded-none');
    });

    it('should have data-testid="stop-button"', () => {
      const task = createMockTask({ id: 'task-1' });

      render(
        <StopButton
          cancellableTasks={[task]}
          onCancel={stableOnCancel}
          isCancelling={false}
        />
      );

      expect(screen.getByTestId('stop-button')).toBeInTheDocument();
    });

    it('should apply optional className prop', () => {
      const task = createMockTask({ id: 'task-1' });

      render(
        <StopButton
          cancellableTasks={[task]}
          onCancel={stableOnCancel}
          isCancelling={false}
          className="custom-class"
        />
      );

      const button = screen.getByTestId('stop-button');
      expect(button.className).toContain('custom-class');
    });
  });

  describe('edge cases', () => {
    it('should handle task without a name', () => {
      const task = createMockTask({ id: 'task-1', name: undefined });

      render(
        <StopButton
          cancellableTasks={[task]}
          onCancel={stableOnCancel}
          isCancelling={false}
        />
      );

      // Should render without crashing
      expect(screen.getByTestId('stop-button')).toBeInTheDocument();
    });

    it('should not render badge for single task', () => {
      const task = createMockTask({ id: 'task-1' });

      render(
        <StopButton
          cancellableTasks={[task]}
          onCancel={stableOnCancel}
          isCancelling={false}
        />
      );

      expect(screen.queryByText('[1]')).not.toBeInTheDocument();
    });
  });
});
