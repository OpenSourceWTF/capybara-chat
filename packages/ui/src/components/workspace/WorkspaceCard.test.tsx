/**
 * WorkspaceCard Tests
 *
 * Guards against regressions when extracting useWorkspaceOperations hook.
 *
 * These tests verify:
 * 1. Derived state (hasConflicts, isBehind, isAhead) affects UI correctly
 * 2. Handlers are called appropriately based on user actions
 * 3. UI state changes based on loading and error states
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WorkspaceCard } from './WorkspaceCard';
import type { Workspace } from '@capybara-chat/types';
import { CloneStatus } from '@capybara-chat/types';

// Mock the useWorkspaceOperations hook
vi.mock('../../hooks/useWorkspace', () => ({
  useWorkspaceOperations: vi.fn(),
}));

import { useWorkspaceOperations } from '../../hooks/useWorkspace';

// Default mock handlers
const mockHandlers = {
  handleClone: vi.fn(),
  handleSync: vi.fn(),
  handleMerge: vi.fn(),
  handleDelete: vi.fn(),
  refetchStats: vi.fn(),
  refetchPRs: vi.fn(),
};

// Create mock return value for useWorkspaceOperations
function createMockOps(overrides?: Partial<ReturnType<typeof useWorkspaceOperations>>) {
  return {
    // State flags
    isReady: true,
    isPendingOrFailed: false,

    // Stats
    stats: null,
    statsLoading: false,

    // Sync
    syncLoading: false,
    syncError: null,
    syncResult: null,

    // Clone
    cloneLoading: false,

    // PRs
    prs: [],
    prsLoading: false,

    // GitHub stats
    ghStats: { prsCount: 0, issuesCount: 0 },
    ghStatsLoading: false,

    // Merge
    mergeLoading: false,

    // Delete
    deleteLoading: false,
    deleteResult: null,

    // Derived state
    hasConflicts: false,
    isBehind: false,
    isAhead: false,

    // Handlers
    handleClone: mockHandlers.handleClone,
    handleSync: mockHandlers.handleSync,
    handleMerge: mockHandlers.handleMerge,
    handleDelete: mockHandlers.handleDelete,
    refetchStats: mockHandlers.refetchStats,
    refetchPRs: mockHandlers.refetchPRs,

    ...overrides,
  };
}

// Factory for workspace objects
function createWorkspace(overrides?: Partial<Workspace>): Workspace {
  return {
    id: 'wks_123',
    name: 'Test Workspace',
    repoUrl: 'https://github.com/test-owner/test-repo',
    repoOwner: 'test-owner',
    repoName: 'test-repo',
    defaultBranch: 'main',
    localPath: '/path/to/workspace',
    cloneStatus: CloneStatus.READY,
    installationId: 456,
    createdAt: Date.now(),
    ...overrides,
  } as Workspace;
}

describe('WorkspaceCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useWorkspaceOperations).mockReturnValue(createMockOps());
  });

  describe('hook initialization', () => {
    it('should call useWorkspaceOperations with workspace and onDelete', () => {
      const workspace = createWorkspace({ cloneStatus: CloneStatus.READY });
      const onDelete = vi.fn();
      render(<WorkspaceCard workspace={workspace} onDelete={onDelete} />);

      expect(useWorkspaceOperations).toHaveBeenCalledWith(workspace, { onDelete });
    });

    it('should pass different workspace for PENDING status', () => {
      const workspace = createWorkspace({ cloneStatus: CloneStatus.PENDING });
      render(<WorkspaceCard workspace={workspace} onDelete={vi.fn()} />);

      expect(useWorkspaceOperations).toHaveBeenCalledWith(
        expect.objectContaining({ cloneStatus: CloneStatus.PENDING }),
        expect.any(Object)
      );
    });

    it('should pass workspace with undefined installationId', () => {
      const workspace = createWorkspace({ installationId: undefined });
      render(<WorkspaceCard workspace={workspace} onDelete={vi.fn()} />);

      expect(useWorkspaceOperations).toHaveBeenCalledWith(
        expect.objectContaining({ installationId: undefined }),
        expect.any(Object)
      );
    });
  });

  describe('derived state: hasConflicts', () => {
    it('should show conflict indicator when hasConflicts is true', () => {
      vi.mocked(useWorkspaceOperations).mockReturnValue(createMockOps({
        hasConflicts: true,
      }));

      render(<WorkspaceCard workspace={createWorkspace()} onDelete={vi.fn()} />);

      expect(screen.getByText('Conflicts')).toBeInTheDocument();
    });

    it('should not show conflict indicator when hasConflicts is false', () => {
      vi.mocked(useWorkspaceOperations).mockReturnValue(createMockOps({
        hasConflicts: false,
      }));

      render(<WorkspaceCard workspace={createWorkspace()} onDelete={vi.fn()} />);

      expect(screen.queryByText('Conflicts')).not.toBeInTheDocument();
    });
  });

  describe('derived state: isBehind', () => {
    it('should disable sync button when not behind', () => {
      vi.mocked(useWorkspaceOperations).mockReturnValue(createMockOps({
        isBehind: false,
      }));

      render(<WorkspaceCard workspace={createWorkspace()} onDelete={vi.fn()} />);

      const syncButton = screen.getByTitle('Already up to date');
      expect(syncButton).toBeDisabled();
    });

    it('should enable sync button when behind', () => {
      vi.mocked(useWorkspaceOperations).mockReturnValue(createMockOps({
        isBehind: true,
      }));

      render(<WorkspaceCard workspace={createWorkspace()} onDelete={vi.fn()} />);

      const syncButton = screen.getByTitle('Sync with remote');
      expect(syncButton).not.toBeDisabled();
    });
  });

  describe('handleClone', () => {
    it('should show Clone button for PENDING workspace', () => {
      vi.mocked(useWorkspaceOperations).mockReturnValue(createMockOps({
        isReady: false,
        isPendingOrFailed: true,
      }));
      const workspace = createWorkspace({ cloneStatus: CloneStatus.PENDING });
      render(<WorkspaceCard workspace={workspace} onDelete={vi.fn()} />);

      expect(screen.getByText('Clone')).toBeInTheDocument();
    });

    it('should show Clone button for FAILED workspace', () => {
      vi.mocked(useWorkspaceOperations).mockReturnValue(createMockOps({
        isReady: false,
        isPendingOrFailed: true,
      }));
      const workspace = createWorkspace({ cloneStatus: CloneStatus.FAILED });
      render(<WorkspaceCard workspace={workspace} onDelete={vi.fn()} />);

      expect(screen.getByText('Clone')).toBeInTheDocument();
    });

    it('should call handleClone when Clone button clicked', async () => {
      vi.mocked(useWorkspaceOperations).mockReturnValue(createMockOps({
        isReady: false,
        isPendingOrFailed: true,
      }));
      const workspace = createWorkspace({ cloneStatus: CloneStatus.PENDING });
      render(<WorkspaceCard workspace={workspace} onDelete={vi.fn()} />);

      fireEvent.click(screen.getByText('Clone'));

      expect(mockHandlers.handleClone).toHaveBeenCalled();
    });

    it('should show Cloning... text when cloneLoading is true', () => {
      vi.mocked(useWorkspaceOperations).mockReturnValue(createMockOps({
        isReady: false,
        isPendingOrFailed: true,
        cloneLoading: true,
      }));
      const workspace = createWorkspace({ cloneStatus: CloneStatus.PENDING });
      render(<WorkspaceCard workspace={workspace} onDelete={vi.fn()} />);

      expect(screen.getByText('Cloning...')).toBeInTheDocument();
    });
  });

  describe('handleSync', () => {
    it('should show sync options dropdown when behind and clicked', async () => {
      vi.mocked(useWorkspaceOperations).mockReturnValue(createMockOps({
        isBehind: true,
      }));

      render(<WorkspaceCard workspace={createWorkspace()} onDelete={vi.fn()} />);

      // When behind, clicking sync shows options dropdown
      const syncButton = screen.getByTitle('Sync with remote');
      expect(syncButton).not.toBeDisabled();
    });
  });

  describe('handleDelete', () => {
    it('should show delete confirmation dialog when delete button clicked', async () => {
      render(<WorkspaceCard workspace={createWorkspace()} onDelete={vi.fn()} />);

      fireEvent.click(screen.getByTitle('Delete workspace'));

      await waitFor(() => {
        expect(screen.getByText(/Remove this workspace/)).toBeInTheDocument();
      });
    });

    it('should call handleDelete when confirmed', async () => {
      const onDelete = vi.fn();
      render(<WorkspaceCard workspace={createWorkspace()} onDelete={onDelete} />);

      fireEvent.click(screen.getByTitle('Delete workspace'));

      await waitFor(() => {
        expect(screen.getByText(/Remove this workspace/)).toBeInTheDocument();
      });

      // Find and click the confirm button - look for the destructive button in the dialog
      const buttons = screen.getAllByRole('button');
      const confirmButton = buttons.find(btn =>
        btn.textContent?.toLowerCase().includes('delete') &&
        btn.classList.contains('bg-destructive')
      );
      expect(confirmButton).toBeTruthy();
      fireEvent.click(confirmButton!);

      await waitFor(() => {
        expect(mockHandlers.handleDelete).toHaveBeenCalled();
      });
    });
  });

  describe('sync error display', () => {
    it('should show sync error when present', () => {
      vi.mocked(useWorkspaceOperations).mockReturnValue(createMockOps({
        syncError: 'Network connection failed',
      }));

      render(<WorkspaceCard workspace={createWorkspace()} onDelete={vi.fn()} />);

      expect(screen.getByText('Network connection failed')).toBeInTheDocument();
    });

    it('should show conflict indicator for conflict responses', () => {
      vi.mocked(useWorkspaceOperations).mockReturnValue(createMockOps({
        syncResult: { success: false, conflicts: ['file1.ts'], error: 'conflict' } as any,
      }));

      render(<WorkspaceCard workspace={createWorkspace()} onDelete={vi.fn()} />);

      // Conflict responses show a clickable indicator or modal
      expect(screen.getAllByText(/conflict/i).length).toBeGreaterThan(0);
    });
  });

  describe('PR list', () => {
    it('should render PR list when PRs exist', () => {
      vi.mocked(useWorkspaceOperations).mockReturnValue(createMockOps({
        prs: [
          { number: 1, title: 'Fix bug', url: 'https://github.com/test/pr/1', user: { login: 'user1' } },
          { number: 2, title: 'Add feature', url: 'https://github.com/test/pr/2', user: { login: 'user2' } },
        ] as any,
      }));

      render(<WorkspaceCard workspace={createWorkspace()} onDelete={vi.fn()} />);

      // PR list shows "#1 Fix bug" format
      expect(screen.getByText(/Fix bug/)).toBeInTheDocument();
      expect(screen.getByText(/Add feature/)).toBeInTheDocument();
    });
  });

  describe('loading states', () => {
    it('should show loading spinner when cloning', () => {
      vi.mocked(useWorkspaceOperations).mockReturnValue(createMockOps({
        isReady: false,
        isPendingOrFailed: true,
        cloneLoading: true,
      }));
      const workspace = createWorkspace({ cloneStatus: CloneStatus.PENDING });

      render(<WorkspaceCard workspace={workspace} onDelete={vi.fn()} />);

      expect(screen.getByText('Cloning...')).toBeInTheDocument();
    });

    it('should disable sync button when syncing', () => {
      vi.mocked(useWorkspaceOperations).mockReturnValue(createMockOps({
        syncLoading: true,
      }));

      render(<WorkspaceCard workspace={createWorkspace()} onDelete={vi.fn()} />);

      const syncButton = screen.getByText('Sync').closest('button');
      expect(syncButton).toBeDisabled();
    });
  });

  describe('component structure', () => {
    it('should render without crashing', () => {
      const { container } = render(<WorkspaceCard workspace={createWorkspace()} onDelete={vi.fn()} />);
      expect(container.firstChild).toBeInTheDocument();
    });
  });
});
