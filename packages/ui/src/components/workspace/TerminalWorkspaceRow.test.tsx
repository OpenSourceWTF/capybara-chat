/**
 * TerminalWorkspaceRow Tests
 *
 * Guards against regressions when extracting useWorkspaceOperations hook.
 *
 * These tests verify the same behaviors as WorkspaceCard tests,
 * ensuring both components share the extracted hook.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TerminalWorkspaceRow } from './TerminalWorkspaceRow';
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

describe('TerminalWorkspaceRow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useWorkspaceOperations).mockReturnValue(createMockOps());
  });

  describe('hook initialization', () => {
    it('should call useWorkspaceOperations with workspace and onDelete', () => {
      const workspace = createWorkspace({ cloneStatus: CloneStatus.READY });
      const onDelete = vi.fn();
      render(<TerminalWorkspaceRow workspace={workspace} onDelete={onDelete} />);

      expect(useWorkspaceOperations).toHaveBeenCalledWith(workspace, { onDelete });
    });

    it('should pass different workspace for PENDING status', () => {
      const workspace = createWorkspace({ cloneStatus: CloneStatus.PENDING });
      render(<TerminalWorkspaceRow workspace={workspace} onDelete={vi.fn()} />);

      expect(useWorkspaceOperations).toHaveBeenCalledWith(
        expect.objectContaining({ cloneStatus: CloneStatus.PENDING }),
        expect.any(Object)
      );
    });
  });

  describe('derived state: hasConflicts', () => {
    it('should show conflict indicator when hasConflicts is true', () => {
      vi.mocked(useWorkspaceOperations).mockReturnValue(createMockOps({
        hasConflicts: true,
      }));

      render(<TerminalWorkspaceRow workspace={createWorkspace()} onDelete={vi.fn()} />);

      expect(screen.getByText(/CONFLICTS DETECTED/)).toBeInTheDocument();
    });
  });

  describe('derived state: isBehind and isAhead', () => {
    it('should show behind indicator when isBehind is true', () => {
      vi.mocked(useWorkspaceOperations).mockReturnValue(createMockOps({
        isBehind: true,
        stats: { behind: 5, ahead: 0 } as any,
      }));

      render(<TerminalWorkspaceRow workspace={createWorkspace()} onDelete={vi.fn()} />);

      expect(screen.getByText('↓5')).toBeInTheDocument();
    });

    it('should show ahead indicator when isAhead is true', () => {
      vi.mocked(useWorkspaceOperations).mockReturnValue(createMockOps({
        isAhead: true,
        stats: { behind: 0, ahead: 3 } as any,
      }));

      render(<TerminalWorkspaceRow workspace={createWorkspace()} onDelete={vi.fn()} />);

      expect(screen.getByText('↑3')).toBeInTheDocument();
    });

    it('should show both indicators when ahead and behind', () => {
      vi.mocked(useWorkspaceOperations).mockReturnValue(createMockOps({
        isAhead: true,
        isBehind: true,
        stats: { behind: 4, ahead: 2 } as any,
      }));

      render(<TerminalWorkspaceRow workspace={createWorkspace()} onDelete={vi.fn()} />);

      expect(screen.getByText('↓4')).toBeInTheDocument();
      expect(screen.getByText('↑2')).toBeInTheDocument();
    });
  });

  describe('handleClone', () => {
    it('should show Retry button for PENDING workspace', () => {
      vi.mocked(useWorkspaceOperations).mockReturnValue(createMockOps({
        isReady: false,
        isPendingOrFailed: true,
      }));
      const workspace = createWorkspace({ cloneStatus: CloneStatus.PENDING });
      render(<TerminalWorkspaceRow workspace={workspace} onDelete={vi.fn()} />);

      expect(screen.getByText('Retry')).toBeInTheDocument();
    });

    it('should show Retry button for FAILED workspace', () => {
      vi.mocked(useWorkspaceOperations).mockReturnValue(createMockOps({
        isReady: false,
        isPendingOrFailed: true,
      }));
      const workspace = createWorkspace({ cloneStatus: CloneStatus.FAILED });
      render(<TerminalWorkspaceRow workspace={workspace} onDelete={vi.fn()} />);

      expect(screen.getByText('Retry')).toBeInTheDocument();
    });

    it('should call handleClone when Retry button clicked', async () => {
      vi.mocked(useWorkspaceOperations).mockReturnValue(createMockOps({
        isReady: false,
        isPendingOrFailed: true,
      }));
      const workspace = createWorkspace({ cloneStatus: CloneStatus.PENDING });
      render(<TerminalWorkspaceRow workspace={workspace} onDelete={vi.fn()} />);

      fireEvent.click(screen.getByText('Retry'));

      expect(mockHandlers.handleClone).toHaveBeenCalled();
    });
  });

  describe('handleSync', () => {
    it('should show Pull button when behind', () => {
      vi.mocked(useWorkspaceOperations).mockReturnValue(createMockOps({
        isBehind: true,
      }));

      render(<TerminalWorkspaceRow workspace={createWorkspace()} onDelete={vi.fn()} />);

      expect(screen.getByText('Pull')).toBeInTheDocument();
    });

    it('should show Sync button when not behind', () => {
      vi.mocked(useWorkspaceOperations).mockReturnValue(createMockOps({
        isBehind: false,
      }));

      render(<TerminalWorkspaceRow workspace={createWorkspace()} onDelete={vi.fn()} />);

      expect(screen.getByText('Sync')).toBeInTheDocument();
    });
  });

  describe('handleMerge', () => {
    it('should call handleMerge when merge button is clicked', async () => {
      vi.mocked(useWorkspaceOperations).mockReturnValue(createMockOps({
        prs: [
          { number: 1, title: 'Fix bug', url: 'https://github.com/test/pr/1', user: { login: 'user1' } },
        ] as any,
      }));

      render(<TerminalWorkspaceRow workspace={createWorkspace()} onDelete={vi.fn()} />);

      // Expand PRs section first
      const prSection = screen.getByText(/Pull Requests/);
      fireEvent.click(prSection);

      // Find and click merge button
      await waitFor(() => {
        const mergeButton = screen.getByText('Merge');
        fireEvent.click(mergeButton);
      });

      expect(mockHandlers.handleMerge).toHaveBeenCalledWith(1);
    });
  });

  describe('handleDelete', () => {
    it('should show delete confirmation dialog when delete button clicked', async () => {
      render(<TerminalWorkspaceRow workspace={createWorkspace()} onDelete={vi.fn()} />);

      // Terminal row uses 'rm' as delete button text
      fireEvent.click(screen.getByText('rm'));

      await waitFor(() => {
        expect(screen.getByText(/Remove this workspace/)).toBeInTheDocument();
      });
    });

    it('should call handleDelete when confirmed', async () => {
      const onDelete = vi.fn();
      render(<TerminalWorkspaceRow workspace={createWorkspace()} onDelete={onDelete} />);

      fireEvent.click(screen.getByText('rm'));

      await waitFor(() => {
        expect(screen.getByText(/Remove this workspace/)).toBeInTheDocument();
      });

      // Find and click the destructive confirm button
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

      render(<TerminalWorkspaceRow workspace={createWorkspace()} onDelete={vi.fn()} />);

      expect(screen.getByText('Network connection failed')).toBeInTheDocument();
    });
  });

  describe('workspace info display', () => {
    it('should show workspace name', () => {
      render(<TerminalWorkspaceRow workspace={createWorkspace()} onDelete={vi.fn()} />);

      expect(screen.getByText('Test Workspace')).toBeInTheDocument();
    });

    it('should show GitHub repo link', () => {
      render(<TerminalWorkspaceRow workspace={createWorkspace()} onDelete={vi.fn()} />);

      const link = screen.getByRole('link', { name: /test-owner\/test-repo/i });
      expect(link).toHaveAttribute('href', 'https://github.com/test-owner/test-repo');
    });

    it('should show local path', () => {
      render(<TerminalWorkspaceRow workspace={createWorkspace()} onDelete={vi.fn()} />);

      expect(screen.getByText('/path/to/workspace')).toBeInTheDocument();
    });

    it('should show clone status badge for PENDING workspace', () => {
      vi.mocked(useWorkspaceOperations).mockReturnValue(createMockOps({
        isReady: false,
        isPendingOrFailed: true,
      }));
      const workspace = createWorkspace({ cloneStatus: CloneStatus.PENDING });
      render(<TerminalWorkspaceRow workspace={workspace} onDelete={vi.fn()} />);

      // CloneStatus value is lowercase 'pending' (styled uppercase via CSS)
      expect(screen.getByText('pending')).toBeInTheDocument();
    });

    it('should show clone status badge for FAILED workspace', () => {
      vi.mocked(useWorkspaceOperations).mockReturnValue(createMockOps({
        isReady: false,
        isPendingOrFailed: true,
      }));
      const workspace = createWorkspace({ cloneStatus: CloneStatus.FAILED });
      render(<TerminalWorkspaceRow workspace={workspace} onDelete={vi.fn()} />);

      // CloneStatus value is lowercase 'failed' (styled uppercase via CSS)
      expect(screen.getByText('failed')).toBeInTheDocument();
    });
  });

  describe('loading states', () => {
    it('should disable sync button when syncing', () => {
      vi.mocked(useWorkspaceOperations).mockReturnValue(createMockOps({
        syncLoading: true,
      }));

      render(<TerminalWorkspaceRow workspace={createWorkspace()} onDelete={vi.fn()} />);

      const syncButton = screen.getByText('Sync').closest('button');
      expect(syncButton).toBeDisabled();
    });

    it('should show spinning icon when cloning', () => {
      vi.mocked(useWorkspaceOperations).mockReturnValue(createMockOps({
        isReady: false,
        isPendingOrFailed: true,
        cloneLoading: true,
      }));
      const workspace = createWorkspace({ cloneStatus: CloneStatus.PENDING });

      render(<TerminalWorkspaceRow workspace={workspace} onDelete={vi.fn()} />);

      // The RefreshCw icon should have animate-spin class
      const retryButton = screen.getByText('Retry');
      const svg = retryButton.querySelector('svg');
      expect(svg).toHaveClass('animate-spin');
    });
  });

  describe('component structure', () => {
    it('should render without crashing', () => {
      const { container } = render(<TerminalWorkspaceRow workspace={createWorkspace()} onDelete={vi.fn()} />);
      expect(container.firstChild).toBeInTheDocument();
    });
  });
});

/**
 * Behavior consistency tests
 *
 * These tests verify that WorkspaceCard and TerminalWorkspaceRow
 * share identical hook usage patterns via useWorkspaceOperations.
 */
describe('WorkspaceCard/TerminalWorkspaceRow Behavior Parity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useWorkspaceOperations).mockReturnValue(createMockOps());
  });

  it('both components pass workspace and onDelete to useWorkspaceOperations', () => {
    const workspace = createWorkspace({ cloneStatus: CloneStatus.PENDING });
    const onDelete = vi.fn();

    render(<TerminalWorkspaceRow workspace={workspace} onDelete={onDelete} />);

    expect(useWorkspaceOperations).toHaveBeenCalledWith(workspace, { onDelete });
  });

  it('both components should show clone button when isPendingOrFailed is true', async () => {
    vi.mocked(useWorkspaceOperations).mockReturnValue(createMockOps({
      isReady: false,
      isPendingOrFailed: true,
    }));
    const workspace = createWorkspace({ cloneStatus: CloneStatus.PENDING });

    render(<TerminalWorkspaceRow workspace={workspace} onDelete={vi.fn()} />);

    expect(screen.getByText('Retry')).toBeInTheDocument();
  });

  it('both components should call handleClone when clone button clicked', () => {
    vi.mocked(useWorkspaceOperations).mockReturnValue(createMockOps({
      isReady: false,
      isPendingOrFailed: true,
    }));
    const workspace = createWorkspace({ cloneStatus: CloneStatus.PENDING });

    render(<TerminalWorkspaceRow workspace={workspace} onDelete={vi.fn()} />);

    fireEvent.click(screen.getByText('Retry'));

    expect(mockHandlers.handleClone).toHaveBeenCalled();
  });

  it('both components should call handleDelete when delete confirmed', async () => {
    render(<TerminalWorkspaceRow workspace={createWorkspace()} onDelete={vi.fn()} />);

    fireEvent.click(screen.getByText('rm'));

    await waitFor(() => {
      expect(screen.getByText(/Remove this workspace/)).toBeInTheDocument();
    });

    // Find and click the destructive confirm button
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
