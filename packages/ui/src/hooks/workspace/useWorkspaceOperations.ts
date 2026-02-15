/**
 * useWorkspaceOperations - Compound hook for workspace operations
 *
 * Encapsulates all workspace-related hooks and handlers used by
 * WorkspaceCard and TerminalWorkspaceRow components.
 *
 * This consolidates ~80 LOC of duplicated hook setup and handlers
 * into a single reusable hook.
 *
 * @example
 * const ops = useWorkspaceOperations(workspace);
 * // ops.stats, ops.handleClone, ops.hasConflicts, etc.
 */

import { useCallback } from 'react';
import type { Workspace } from '@capybara-chat/types';
import { CloneStatus } from '@capybara-chat/types';

import { useWorkspaceStats } from './useWorkspaceStats';
import { useWorkspaceSync, type SyncStrategy, type SyncResult } from './useWorkspaceSync';
import { useWorkspaceClone } from './useWorkspaceClone';
import { useWorkspacePRs, type WorkspacePR } from './useWorkspacePRs';
import { useWorkspaceGitHubStats, type GitHubStats } from './useWorkspaceGitHubStats';
import { useMergePR } from './useMergePR';
import { useDeleteWorkspace, type DeleteWorkspaceResult } from './useDeleteWorkspace';

export interface UseWorkspaceOperationsOptions {
  /**
   * Callback when workspace is deleted successfully
   */
  onDelete?: () => void;
}

export interface WorkspaceOperations {
  // Status flags
  isReady: boolean;
  isPendingOrFailed: boolean;

  // Stats
  stats: ReturnType<typeof useWorkspaceStats>['stats'];
  statsLoading: boolean;
  refetchStats: () => void;

  // Sync
  syncLoading: boolean;
  syncError: string | null;
  syncResult: SyncResult | null;

  // Clone
  cloneLoading: boolean;

  // PRs
  prs: WorkspacePR[];
  prsLoading: boolean;
  refetchPRs: () => void;

  // GitHub Stats
  ghStats: GitHubStats;
  ghStatsLoading: boolean;

  // Merge
  mergeLoading: boolean;

  // Delete
  deleteLoading: boolean;
  deleteResult: DeleteWorkspaceResult | null;

  // Derived state
  hasConflicts: boolean;
  isBehind: boolean;
  isAhead: boolean;

  // Handlers
  handleClone: () => Promise<void>;
  handleSync: (strategy?: SyncStrategy) => Promise<SyncResult | null>;
  handleMerge: (prNumber: number) => Promise<void>;
  handleDelete: () => Promise<void>;
}

/**
 * Compound hook that provides all workspace operations
 *
 * @param workspace - The workspace to operate on
 * @param options - Optional configuration
 * @returns All workspace state and handlers
 */
export function useWorkspaceOperations(
  workspace: Workspace,
  options: UseWorkspaceOperationsOptions = {}
): WorkspaceOperations {
  const { onDelete } = options;

  // --- Status flags ---
  const isReady = workspace.cloneStatus === CloneStatus.READY;
  const isPendingOrFailed =
    workspace.cloneStatus === CloneStatus.PENDING ||
    workspace.cloneStatus === CloneStatus.FAILED;

  // --- Core hooks ---
  const { stats, loading: statsLoading, refetch: refetchStats } = useWorkspaceStats(
    workspace.id,
    { skip: !isReady }
  );

  const { sync, loading: syncLoading, error: syncError, result: syncResult } = useWorkspaceSync(
    workspace.id
  );

  const { clone, loading: cloneLoading } = useWorkspaceClone(workspace.id);

  const { prs, refetch: refetchPRs, loading: prsLoading } = useWorkspacePRs(workspace.id, {
    skip: !workspace.installationId,
  });

  const { stats: ghStats, loading: ghStatsLoading } = useWorkspaceGitHubStats(workspace.id, {
    skip: !workspace.installationId,
  });

  const { mergePR, loading: mergeLoading } = useMergePR(workspace.id);

  const { deleteWorkspace, loading: deleteLoading, result: deleteResult } = useDeleteWorkspace();

  // --- Derived state ---
  const hasConflicts = stats?.hasConflicts ?? false;
  const isBehind = (stats?.behind ?? 0) > 0;
  const isAhead = (stats?.ahead ?? 0) > 0;

  // --- Handlers ---
  const handleClone = useCallback(async () => {
    const result = await clone();
    if (result) {
      refetchStats();
    }
  }, [clone, refetchStats]);

  const handleSync = useCallback(
    async (strategy: SyncStrategy = 'merge'): Promise<SyncResult | null> => {
      const result = await sync(strategy);
      if (result?.success) {
        refetchStats();
      }
      return result;
    },
    [sync, refetchStats]
  );

  const handleMerge = useCallback(
    async (prNumber: number) => {
      const result = await mergePR({ prNumber });
      if (result?.success) {
        refetchPRs();
        refetchStats();
      }
    },
    [mergePR, refetchPRs, refetchStats]
  );

  const handleDelete = useCallback(async () => {
    const result = await deleteWorkspace(workspace.id, { pushUnpushedBranches: true });
    if (result?.deleted) {
      onDelete?.();
    }
  }, [deleteWorkspace, workspace.id, onDelete]);

  return {
    // Status flags
    isReady,
    isPendingOrFailed,

    // Stats
    stats,
    statsLoading,
    refetchStats,

    // Sync
    syncLoading,
    syncError,
    syncResult,

    // Clone
    cloneLoading,

    // PRs
    prs,
    prsLoading,
    refetchPRs,

    // GitHub Stats
    ghStats,
    ghStatsLoading,

    // Merge
    mergeLoading,

    // Delete
    deleteLoading,
    deleteResult,

    // Derived state
    hasConflicts,
    isBehind,
    isAhead,

    // Handlers
    handleClone,
    handleSync,
    handleMerge,
    handleDelete,
  };
}
