/**
 * Workspace Hooks Index
 *
 * Re-exports all workspace hooks from individual files.
 * Import from this index for cleaner imports:
 *
 * @example
 * import { useWorkspaceStats, useWorkspaceSync } from '../hooks/workspace';
 */

// Stats
export { useWorkspaceStats, type UseWorkspaceStatsOptions, type WorkspaceStatsState } from './useWorkspaceStats';

// Sync
export { useWorkspaceSync, type SyncStrategy, type SyncResult } from './useWorkspaceSync';

// Clone
export { useWorkspaceClone, type CloneResult } from './useWorkspaceClone';

// PRs
export { useWorkspacePRs, type WorkspacePR, type UseWorkspacePRsOptions } from './useWorkspacePRs';

// GitHub Stats
export { useWorkspaceGitHubStats, type UseWorkspaceGitHubStatsOptions, type GitHubStats } from './useWorkspaceGitHubStats';

// Create PR
export { useCreatePR, type CreatePRInput, type CreatePRResult } from './useCreatePR';

// Merge PR
export { useMergePR, type MergePRInput, type MergePRResult } from './useMergePR';

// Delete
export { useDeleteWorkspace, type DeleteWorkspaceOptions, type DeleteWorkspaceResult } from './useDeleteWorkspace';

// Operations (compound hook)
export { useWorkspaceOperations, type UseWorkspaceOperationsOptions, type WorkspaceOperations } from './useWorkspaceOperations';
