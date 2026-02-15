/**
 * Tests for TaskStopModal component
 *
 * TDD tests - written BEFORE implementation.
 *
 * Covers:
 * - Open/close visibility
 * - Task count header
 * - STOP ALL button behavior
 * - STOP SELECTED button behavior
 * - Task selection and deselection
 * - Error banner display
 * - Retry failed tasks
 * - Keyboard interaction (Escape)
 * - Accessibility (role, aria-modal)
 * - Backdrop click to close
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { WorkerTask } from '@capybara-chat/types';

// Import the component under test (does not exist yet - TDD)
import { TaskStopModal } from './TaskStopModal';

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

// STABLE references
const stableOnClose = vi.fn();
const stableOnCancel = vi.fn().mockResolvedValue(undefined);
const STABLE_EMPTY_FAILED: Array<{ id: string; name: string; error: string }> = [];

describe('TaskStopModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stableOnCancel.mockResolvedValue(undefined);
  });

  describe('visibility', () => {
    it('should not render modal content when isOpen is false', () => {
      const task = createMockTask({ id: 'task-1' });

      render(
        <TaskStopModal
          tasks={[task]}
          isOpen={false}
          onClose={stableOnClose}
          onCancel={stableOnCancel}
          isCancelling={false}
          error={null}
          failedTasks={STABLE_EMPTY_FAILED}
        />
      );

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should render modal with task count header when isOpen is true', () => {
      const tasks = [
        createMockTask({ id: 'task-1' }),
        createMockTask({ id: 'task-2' }),
        createMockTask({ id: 'task-3' }),
      ];

      render(
        <TaskStopModal
          tasks={tasks}
          isOpen={true}
          onClose={stableOnClose}
          onCancel={stableOnCancel}
          isCancelling={false}
          error={null}
          failedTasks={STABLE_EMPTY_FAILED}
        />
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText(/STOP TASKS \(3\)/)).toBeInTheDocument();
    });
  });

  describe('STOP ALL button', () => {
    it('should render a STOP ALL button', () => {
      const task = createMockTask({ id: 'task-1' });

      render(
        <TaskStopModal
          tasks={[task]}
          isOpen={true}
          onClose={stableOnClose}
          onCancel={stableOnCancel}
          isCancelling={false}
          error={null}
          failedTasks={STABLE_EMPTY_FAILED}
        />
      );

      expect(screen.getByText(/STOP ALL/)).toBeInTheDocument();
    });

    it('should call onCancel with all task IDs when STOP ALL is clicked', () => {
      const task1 = createMockTask({ id: 'task-a' });
      const task2 = createMockTask({ id: 'task-b' });
      const task3 = createMockTask({ id: 'task-c' });

      render(
        <TaskStopModal
          tasks={[task1, task2, task3]}
          isOpen={true}
          onClose={stableOnClose}
          onCancel={stableOnCancel}
          isCancelling={false}
          error={null}
          failedTasks={STABLE_EMPTY_FAILED}
        />
      );

      fireEvent.click(screen.getByText(/STOP ALL/));

      expect(stableOnCancel).toHaveBeenCalledWith(['task-a', 'task-b', 'task-c']);
    });
  });

  describe('STOP SELECTED button', () => {
    it('should show "STOP SELECTED (0)" button that is disabled when nothing selected', () => {
      const task1 = createMockTask({ id: 'task-1' });
      const task2 = createMockTask({ id: 'task-2' });

      render(
        <TaskStopModal
          tasks={[task1, task2]}
          isOpen={true}
          onClose={stableOnClose}
          onCancel={stableOnCancel}
          isCancelling={false}
          error={null}
          failedTasks={STABLE_EMPTY_FAILED}
        />
      );

      const stopSelectedBtn = screen.getByText(/STOP SELECTED \(0\)/);
      expect(stopSelectedBtn).toBeInTheDocument();
      expect(stopSelectedBtn.closest('button')).toBeDisabled();
    });

    it('should enable "STOP SELECTED (1)" after selecting a task', () => {
      const task1 = createMockTask({ id: 'task-1', name: 'First Task' });
      const task2 = createMockTask({ id: 'task-2', name: 'Second Task' });

      render(
        <TaskStopModal
          tasks={[task1, task2]}
          isOpen={true}
          onClose={stableOnClose}
          onCancel={stableOnCancel}
          isCancelling={false}
          error={null}
          failedTasks={STABLE_EMPTY_FAILED}
        />
      );

      // Click the first task row to select it
      fireEvent.click(screen.getByText('First Task'));

      const stopSelectedBtn = screen.getByText(/STOP SELECTED \(1\)/);
      expect(stopSelectedBtn.closest('button')).not.toBeDisabled();
    });

    it('should call onCancel with only selected task IDs when STOP SELECTED is clicked', () => {
      const task1 = createMockTask({ id: 'task-sel-1', name: 'Selected Task' });
      const task2 = createMockTask({ id: 'task-sel-2', name: 'Unselected Task' });

      render(
        <TaskStopModal
          tasks={[task1, task2]}
          isOpen={true}
          onClose={stableOnClose}
          onCancel={stableOnCancel}
          isCancelling={false}
          error={null}
          failedTasks={STABLE_EMPTY_FAILED}
        />
      );

      // Select only the first task
      fireEvent.click(screen.getByText('Selected Task'));

      // Click STOP SELECTED
      fireEvent.click(screen.getByText(/STOP SELECTED \(1\)/));

      expect(stableOnCancel).toHaveBeenCalledWith(['task-sel-1']);
    });
  });

  describe('task selection', () => {
    it('should select a task when clicking its row', () => {
      const task1 = createMockTask({ id: 'task-1', name: 'Clickable Task' });

      render(
        <TaskStopModal
          tasks={[task1]}
          isOpen={true}
          onClose={stableOnClose}
          onCancel={stableOnCancel}
          isCancelling={false}
          error={null}
          failedTasks={STABLE_EMPTY_FAILED}
        />
      );

      fireEvent.click(screen.getByText('Clickable Task'));

      // Should update the selected count
      expect(screen.getByText(/STOP SELECTED \(1\)/)).toBeInTheDocument();
    });

    it('should deselect a task when clicking an already-selected task', () => {
      const task1 = createMockTask({ id: 'task-1', name: 'Toggle Task' });
      const task2 = createMockTask({ id: 'task-2', name: 'Other Task' });

      render(
        <TaskStopModal
          tasks={[task1, task2]}
          isOpen={true}
          onClose={stableOnClose}
          onCancel={stableOnCancel}
          isCancelling={false}
          error={null}
          failedTasks={STABLE_EMPTY_FAILED}
        />
      );

      // Select the task
      fireEvent.click(screen.getByText('Toggle Task'));
      expect(screen.getByText(/STOP SELECTED \(1\)/)).toBeInTheDocument();

      // Click again to deselect
      fireEvent.click(screen.getByText('Toggle Task'));
      expect(screen.getByText(/STOP SELECTED \(0\)/)).toBeInTheDocument();
    });

    it('should allow selecting multiple tasks', () => {
      const task1 = createMockTask({ id: 'task-1', name: 'Task Alpha' });
      const task2 = createMockTask({ id: 'task-2', name: 'Task Beta' });
      const task3 = createMockTask({ id: 'task-3', name: 'Task Gamma' });

      render(
        <TaskStopModal
          tasks={[task1, task2, task3]}
          isOpen={true}
          onClose={stableOnClose}
          onCancel={stableOnCancel}
          isCancelling={false}
          error={null}
          failedTasks={STABLE_EMPTY_FAILED}
        />
      );

      fireEvent.click(screen.getByText('Task Alpha'));
      fireEvent.click(screen.getByText('Task Gamma'));

      expect(screen.getByText(/STOP SELECTED \(2\)/)).toBeInTheDocument();
    });
  });

  describe('error display', () => {
    it('should show error banner when error is set', () => {
      const task = createMockTask({ id: 'task-1' });

      render(
        <TaskStopModal
          tasks={[task]}
          isOpen={true}
          onClose={stableOnClose}
          onCancel={stableOnCancel}
          isCancelling={false}
          error="Failed to cancel 2 tasks"
          failedTasks={STABLE_EMPTY_FAILED}
        />
      );

      expect(screen.getByText(/Failed to cancel 2 tasks/)).toBeInTheDocument();
    });

    it('should not show error banner when error is null', () => {
      const task = createMockTask({ id: 'task-1' });

      render(
        <TaskStopModal
          tasks={[task]}
          isOpen={true}
          onClose={stableOnClose}
          onCancel={stableOnCancel}
          isCancelling={false}
          error={null}
          failedTasks={STABLE_EMPTY_FAILED}
        />
      );

      // No error text should be in the document
      expect(screen.queryByText(/Failed to cancel/)).not.toBeInTheDocument();
    });
  });

  describe('retry failed tasks', () => {
    it('should show "RETRY FAILED" button when failedTasks is populated', () => {
      const task = createMockTask({ id: 'task-fail-1', name: 'Failed Task' });
      const failedTasks = [
        { id: 'task-fail-1', name: 'Failed Task', error: 'Server Error' },
      ];

      render(
        <TaskStopModal
          tasks={[task]}
          isOpen={true}
          onClose={stableOnClose}
          onCancel={stableOnCancel}
          isCancelling={false}
          error="Failed to cancel 1 task"
          failedTasks={failedTasks}
        />
      );

      expect(screen.getByText(/RETRY FAILED/)).toBeInTheDocument();
    });

    it('should not show "RETRY FAILED" when failedTasks is empty', () => {
      const task = createMockTask({ id: 'task-1' });

      render(
        <TaskStopModal
          tasks={[task]}
          isOpen={true}
          onClose={stableOnClose}
          onCancel={stableOnCancel}
          isCancelling={false}
          error={null}
          failedTasks={STABLE_EMPTY_FAILED}
        />
      );

      expect(screen.queryByText(/RETRY FAILED/)).not.toBeInTheDocument();
    });

    it('should call onCancel with failed task IDs when RETRY FAILED is clicked', () => {
      const task1 = createMockTask({ id: 'task-fail-1', name: 'Failed Task 1' });
      const task2 = createMockTask({ id: 'task-fail-2', name: 'Failed Task 2' });
      const failedTasks = [
        { id: 'task-fail-1', name: 'Failed Task 1', error: 'Error 1' },
        { id: 'task-fail-2', name: 'Failed Task 2', error: 'Error 2' },
      ];

      render(
        <TaskStopModal
          tasks={[task1, task2]}
          isOpen={true}
          onClose={stableOnClose}
          onCancel={stableOnCancel}
          isCancelling={false}
          error="Failed to cancel 2 tasks"
          failedTasks={failedTasks}
        />
      );

      fireEvent.click(screen.getByText(/RETRY FAILED/));

      expect(stableOnCancel).toHaveBeenCalledWith(['task-fail-1', 'task-fail-2']);
    });
  });

  describe('keyboard interaction', () => {
    it('should call onClose when Escape key is pressed', () => {
      const task = createMockTask({ id: 'task-1' });

      render(
        <TaskStopModal
          tasks={[task]}
          isOpen={true}
          onClose={stableOnClose}
          onCancel={stableOnCancel}
          isCancelling={false}
          error={null}
          failedTasks={STABLE_EMPTY_FAILED}
        />
      );

      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

      expect(stableOnClose).toHaveBeenCalled();
    });
  });

  describe('accessibility', () => {
    it('should have role="dialog"', () => {
      const task = createMockTask({ id: 'task-1' });

      render(
        <TaskStopModal
          tasks={[task]}
          isOpen={true}
          onClose={stableOnClose}
          onCancel={stableOnCancel}
          isCancelling={false}
          error={null}
          failedTasks={STABLE_EMPTY_FAILED}
        />
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('should have aria-modal="true"', () => {
      const task = createMockTask({ id: 'task-1' });

      render(
        <TaskStopModal
          tasks={[task]}
          isOpen={true}
          onClose={stableOnClose}
          onCancel={stableOnCancel}
          isCancelling={false}
          error={null}
          failedTasks={STABLE_EMPTY_FAILED}
        />
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
    });
  });

  describe('backdrop click', () => {
    it('should call onClose when backdrop is clicked', () => {
      const task = createMockTask({ id: 'task-1' });

      render(
        <TaskStopModal
          tasks={[task]}
          isOpen={true}
          onClose={stableOnClose}
          onCancel={stableOnCancel}
          isCancelling={false}
          error={null}
          failedTasks={STABLE_EMPTY_FAILED}
        />
      );

      // Click the backdrop (the overlay behind the modal)
      // The dialog itself should not close when content is clicked
      const dialog = screen.getByRole('dialog');
      // Click outside the dialog content area - typically the backdrop element
      // We look for the backdrop element which wraps the dialog
      const backdrop = dialog.parentElement;
      if (backdrop && backdrop !== dialog) {
        fireEvent.click(backdrop);
        expect(stableOnClose).toHaveBeenCalled();
      }
    });
  });

  describe('cancelling state', () => {
    it('should disable STOP ALL button when isCancelling is true', () => {
      const task = createMockTask({ id: 'task-1' });

      render(
        <TaskStopModal
          tasks={[task]}
          isOpen={true}
          onClose={stableOnClose}
          onCancel={stableOnCancel}
          isCancelling={true}
          error={null}
          failedTasks={STABLE_EMPTY_FAILED}
        />
      );

      const stopAllBtn = screen.getByText(/STOP ALL/).closest('button');
      expect(stopAllBtn).toBeDisabled();
    });

    it('should disable STOP SELECTED button when isCancelling is true', () => {
      const task1 = createMockTask({ id: 'task-1', name: 'Task' });

      render(
        <TaskStopModal
          tasks={[task1]}
          isOpen={true}
          onClose={stableOnClose}
          onCancel={stableOnCancel}
          isCancelling={true}
          error={null}
          failedTasks={STABLE_EMPTY_FAILED}
        />
      );

      // Select a task first
      fireEvent.click(screen.getByText('Task'));

      const stopSelectedBtn = screen.getByText(/STOP SELECTED/).closest('button');
      expect(stopSelectedBtn).toBeDisabled();
    });
  });

  describe('edge cases', () => {
    it('should handle empty tasks array gracefully', () => {
      render(
        <TaskStopModal
          tasks={[]}
          isOpen={true}
          onClose={stableOnClose}
          onCancel={stableOnCancel}
          isCancelling={false}
          error={null}
          failedTasks={STABLE_EMPTY_FAILED}
        />
      );

      // Should render without crashing
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText(/STOP TASKS \(0\)/)).toBeInTheDocument();
    });

    it('should update header count dynamically based on tasks prop', () => {
      const task1 = createMockTask({ id: 'task-1' });
      const task2 = createMockTask({ id: 'task-2' });

      const { rerender } = render(
        <TaskStopModal
          tasks={[task1]}
          isOpen={true}
          onClose={stableOnClose}
          onCancel={stableOnCancel}
          isCancelling={false}
          error={null}
          failedTasks={STABLE_EMPTY_FAILED}
        />
      );

      expect(screen.getByText(/STOP TASKS \(1\)/)).toBeInTheDocument();

      rerender(
        <TaskStopModal
          tasks={[task1, task2]}
          isOpen={true}
          onClose={stableOnClose}
          onCancel={stableOnCancel}
          isCancelling={false}
          error={null}
          failedTasks={STABLE_EMPTY_FAILED}
        />
      );

      expect(screen.getByText(/STOP TASKS \(2\)/)).toBeInTheDocument();
    });
  });
});
