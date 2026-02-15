/**
 * WorkspaceCard - Display a single workspace with stats, actions, and PRs
 * Features refined styling, skeleton loading, and smooth transitions
 *
 * Performance: Wrapped with React.memo to prevent re-renders when other workspaces change
 */

import React, { useState, useEffect } from 'react';
import type { Workspace } from '@capybara-chat/types';
import { Button, ConfirmDeleteDialog, ConfirmDialog } from '../ui';
import { RefreshCw, Trash2, AlertTriangle } from 'lucide-react';
import { formatDateTime, cn } from '../../lib/utils';
import { useWorkspaceOperations, type SyncStrategy } from '../../hooks/useWorkspace';
import { CloneStatusBadge } from './CloneStatusBadge';
import { BranchStatsBadges } from './BranchStatsBadges';
import { GitHubStatsBadges } from './GitHubStatsBadges';
import { SyncDropdown } from './SyncDropdown';
import { WorkspacePRList } from './WorkspacePRList';
import { MergeConflictModal, type MergeConflictResult } from './MergeConflictModal';

interface WorkspaceCardProps {
  workspace: Workspace;
  onDelete: () => void;
  index?: number;
}

export const WorkspaceCard = React.memo(
  function WorkspaceCard({ workspace, onDelete, index = 0 }: WorkspaceCardProps) {
    const [showSyncOptions, setShowSyncOptions] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showResetConfirm, setShowResetConfirm] = useState(false);
    const [showConflictModal, setShowConflictModal] = useState(false);

    // Use compound hook for all workspace operations
    const ops = useWorkspaceOperations(workspace, { onDelete });

    // Local handler wrappers that manage UI state
    const handleSync = async (strategy: SyncStrategy = 'merge') => {
      const result = await ops.handleSync(strategy);
      if (result?.success) {
        setShowSyncOptions(false);
      }
    };

    const handleResetSync = async () => {
      setShowResetConfirm(false);
      await handleSync('reset');
    };

    const handleConfirmDelete = async () => {
      await ops.handleDelete();
      setShowDeleteConfirm(false);
    };

    // Detect merge conflict response and auto-show modal
    // Check for conflicts array OR error message containing 'conflict'
    const isConflictError = ops.syncResult && !ops.syncResult.success &&
      (ops.syncResult.conflicts || ops.syncResult.error?.toLowerCase().includes('conflict'));

    useEffect(() => {
      if (isConflictError) {
        setShowConflictModal(true);
      }
    }, [isConflictError]);

    return (
      <div
        className={cn(
          'relative p-5 bg-card border border-border transition-all duration-200',
          'hover:border-border-subtle hover:shadow-md hover:-translate-y-px',
          'animate-slide-in-bottom'
        )}
        style={{ animationDelay: `${index * 60}ms` }}
      >
        {/* Delete Confirmation Dialog */}
        <ConfirmDeleteDialog
          open={showDeleteConfirm}
          entityType="workspace"
          entityName={workspace.name}
          onConfirm={handleConfirmDelete}
          onCancel={() => setShowDeleteConfirm(false)}
          isDeleting={ops.deleteLoading}
          description="Remove this workspace? Unpushed branches will be pushed to preserve work."
        />

        {/* Reset Confirmation Dialog */}
        <ConfirmDialog
          open={showResetConfirm}
          title="Discard Local Changes"
          description="This will discard all local changes. Are you sure?"
          onConfirm={handleResetSync}
          onCancel={() => setShowResetConfirm(false)}
          confirmText="Discard"
          destructive
          isLoading={ops.syncLoading}
        />

        {/* Merge Conflict Modal */}
        <MergeConflictModal
          open={showConflictModal}
          result={isConflictError ? (ops.syncResult as MergeConflictResult) : null}
          workspaceName={workspace.name}
          onReset={() => {
            setShowConflictModal(false);
            handleSync('reset');
          }}
          onClose={() => setShowConflictModal(false)}
          isResetting={ops.syncLoading}
        />

        {/* Header Row */}
        <div className="flex items-start gap-4">
          {/* Workspace Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 text-md font-semibold text-foreground mb-1">
              {workspace.name}
              <CloneStatusBadge status={workspace.cloneStatus} error={workspace.cloneError} />
              {ops.hasConflicts && (
                <span className="flex items-center gap-1 text-warning text-xs font-medium">
                  <AlertTriangle className="w-3 h-3" />
                  Conflicts
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-base text-muted-foreground">
              <a
                href={`https://github.com/${workspace.repoOwner}/${workspace.repoName}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-primary hover:underline transition-colors"
              >
                {workspace.repoOwner}/{workspace.repoName}
              </a>
              <span className="opacity-50">•</span>
              <a
                href={`https://github.com/${workspace.repoOwner}/${workspace.repoName}/tree/${workspace.defaultBranch}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-primary hover:underline transition-colors"
              >
                {workspace.defaultBranch}
              </a>
            </div>
          </div>

          {/* Stats Badges */}
          <BranchStatsBadges
            stats={ops.stats}
            loading={ops.statsLoading && ops.isReady}
            repoOwner={workspace.repoOwner}
            repoName={workspace.repoName}
          />

          <GitHubStatsBadges
            repoOwner={workspace.repoOwner}
            repoName={workspace.repoName}
            prsCount={ops.ghStats.prsCount}
            issuesCount={ops.ghStats.issuesCount}
            loading={ops.ghStatsLoading && !!workspace.installationId}
          />

          {/* Action Buttons */}
          <div className="flex items-center gap-1 shrink-0">
            {ops.isPendingOrFailed && (
              <Button
                variant="default"
                size="sm"
                onClick={ops.handleClone}
                disabled={ops.cloneLoading}
                title="Clone repository"
              >
                <RefreshCw className={cn('w-4 h-4 mr-1', ops.cloneLoading && 'animate-spin')} />
                {ops.cloneLoading ? 'Cloning...' : 'Clone'}
              </Button>
            )}

            {ops.isReady && (
              <div className="relative">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => ops.isBehind ? setShowSyncOptions(!showSyncOptions) : handleSync('merge')}
                  disabled={ops.syncLoading || !ops.isBehind}
                  title={ops.isBehind ? 'Sync with remote' : 'Already up to date'}
                >
                  <RefreshCw className={cn('w-4 h-4 mr-1', ops.syncLoading && 'animate-spin')} />
                  Sync
                </Button>
                <SyncDropdown
                  show={showSyncOptions && ops.isBehind}
                  hasConflicts={ops.hasConflicts}
                  onSync={handleSync}
                  onResetClick={() => setShowResetConfirm(true)}
                />
              </div>
            )}

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={ops.deleteLoading}
              className="text-destructive hover:bg-destructive/10"
              title="Delete workspace"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Sync Error (non-conflict errors only - conflicts shown in modal) */}
        {ops.syncError && !isConflictError && (
          <div className="mt-3 p-2.5 bg-destructive/10 border border-destructive/30 text-destructive text-base">
            {ops.syncError}
          </div>
        )}

        {/* Conflict indicator (clickable to re-open modal) */}
        {isConflictError && !showConflictModal && (
          <button
            onClick={() => setShowConflictModal(true)}
            className="mt-3 w-full p-2.5 bg-warning/10 border border-warning/30 text-warning text-base text-left hover:bg-warning/15 transition-colors flex items-center gap-2"
          >
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Merge conflict detected – {ops.syncResult?.conflicts?.length || 0} file(s)</span>
            <span className="ml-auto text-xs opacity-70">Click to view</span>
          </button>
        )}

        {/* Delete Blocked by Sessions */}
        {ops.deleteResult?.blockedBySessions && ops.deleteResult.blockedBySessions.length > 0 && (
          <div className="mt-3 p-2.5 bg-destructive/10 border border-destructive/30 rounded text-destructive text-base">
            Workspace has {ops.deleteResult.blockedBySessions.length} active session(s). End them first or force delete.
          </div>
        )}

        {/* PR List */}
        {ops.prs && ops.prs.length > 0 && (
          <div className="mt-3.5 pt-3.5 border-t border-border-subtle">
            <WorkspacePRList prs={ops.prs} onMerge={ops.handleMerge} mergeLoading={ops.mergeLoading} />
          </div>
        )}

        {/* Last Synced */}
        {workspace.lastSyncedAt && (
          <div className="mt-3 text-xs text-muted-foreground opacity-70">
            Last synced: {formatDateTime(workspace.lastSyncedAt)}
          </div>
        )}
      </div>
    );
  },
  // Custom comparison for optimal memoization
  (prev, next) =>
    prev.workspace.id === next.workspace.id &&
    prev.workspace.name === next.workspace.name &&
    prev.workspace.cloneStatus === next.workspace.cloneStatus &&
    prev.workspace.cloneError === next.workspace.cloneError &&
    prev.workspace.lastSyncedAt === next.workspace.lastSyncedAt &&
    prev.workspace.installationId === next.workspace.installationId &&
    prev.index === next.index
);
