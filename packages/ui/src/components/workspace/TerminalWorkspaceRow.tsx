/**
 * TerminalWorkspaceRow - Adapter for Workspace logic in Terminal Layout
 * 
 * Re-implements the rich logic from WorkspaceCard (sync, stats, git ops)
 * but renders it using the TerminalRow aesthetic.
 */

import React, { useState } from 'react';
import type { Workspace } from '@capybara-chat/types';
import { CloneStatus } from '@capybara-chat/types';
import { Button, ConfirmDeleteDialog, ConfirmDialog } from '../ui';
import { RefreshCw, AlertTriangle, Github, GitPullRequest, AlertCircle } from 'lucide-react';
import { cn, formatDate } from '../../lib/utils';
import { useWorkspaceOperations, type SyncStrategy } from '../../hooks/useWorkspace';
import { SyncDropdown } from '../workspace/SyncDropdown';
import { TerminalRow } from '../ui';

interface TerminalWorkspaceRowProps {
  workspace: Workspace;
  onDelete: () => void;
}

export const TerminalWorkspaceRow = React.memo(
  function TerminalWorkspaceRow({ workspace, onDelete }: TerminalWorkspaceRowProps) {
    const [showSyncOptions, setShowSyncOptions] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showResetConfirm, setShowResetConfirm] = useState(false);
    const [showPRs, setShowPRs] = useState(false);

    // Use compound hook for all workspace operations
    const ops = useWorkspaceOperations(workspace, { onDelete });

    // --- Local handler wrappers that manage UI state ---
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

    // --- Derived from ops for convenience ---
    const prCount = ops.ghStats.prsCount ?? 0;
    const issueCount = ops.ghStats.issuesCount ?? 0;
    const repoLabel = workspace.repoOwner && workspace.repoName ? `${workspace.repoOwner}/${workspace.repoName}` : '';
    // Safely parse date or fallback
    const createdAtDate = workspace.createdAt ? new Date(workspace.createdAt) : new Date();

    return (
      <>
        {/* Dialogs */}
        <ConfirmDeleteDialog
          open={showDeleteConfirm}
          entityType="workspace"
          entityName={workspace.name}
          onConfirm={handleConfirmDelete}
          onCancel={() => setShowDeleteConfirm(false)}
          isDeleting={ops.deleteLoading}
          description="Remove this workspace? Unpushed branches will be pushed."
        />
        <ConfirmDialog
          open={showResetConfirm}
          title="Discard Local Changes"
          description="Discard all local changes?"
          onConfirm={handleResetSync}
          onCancel={() => setShowResetConfirm(false)}
          confirmText="Discard"
          destructive
          isLoading={ops.syncLoading}
        />

        <TerminalRow
          date={formatDate(createdAtDate.getTime())}
          title={
            <span className="flex items-center gap-2">
              <span className="text-primary/70">{'>'}</span> {workspace.name}

              {/* Clone Status / Stats Indicators */}
              {ops.isPendingOrFailed && (
                <span className={cn(
                  "text-2xs uppercase font-bold px-1.5 py-0.5 rounded ml-2",
                  workspace.cloneStatus === CloneStatus.FAILED ? "bg-destructive/20 text-destructive" : "bg-blue-500/20 text-blue-500"
                )}>
                  {workspace.cloneStatus}
                </span>
              )}

              {ops.isReady && !ops.statsLoading && (
                <div className="flex items-center gap-2 ml-3 text-2xs font-mono opacity-80">
                  {/* Commits Ahead/Behind */}
                  {(ops.isAhead || ops.isBehind) && (
                    <span className="flex gap-1 items-center bg-muted/50 px-1.5 py-0.5 rounded text-foreground/80">
                      {ops.isBehind && <span className="text-amber-500">↓{ops.stats?.behind}</span>}
                      {ops.isAhead && <span className="text-green-500">↑{ops.stats?.ahead}</span>}
                    </span>
                  )}

                  {/* Current Branch */}
                  <span className="text-muted-foreground">{ops.stats?.localBranch || workspace.defaultBranch}</span>
                </div>
              )}
            </span>
          }
          meta={
            <>
              {/* GitHub Repo Link */}
              {repoLabel ? (
                <a
                  href={`https://github.com/${repoLabel}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 hover:text-primary transition-colors cursor-pointer"
                >
                  <Github className="w-3 h-3" />
                  <span className="hidden sm:inline">{repoLabel}</span>
                </a>
              ) : (
                <span className="text-muted-foreground/60">[LOCAL]</span>
              )}

              {/* GitHub Stats */}
              {(issueCount > 0 || prCount > 0) && (
                <span className="flex gap-2 ml-2 opacity-70">
                  {issueCount > 0 && <span>{issueCount} issues</span>}
                  {prCount > 0 && <span className="cursor-pointer hover:text-primary" onClick={() => setShowPRs(!showPRs)}>{prCount} PRs</span>}
                </span>
              )}
            </>
          }
          actions={
            <div className="flex gap-1 items-center">
              {/* Sync Button */}
              {ops.isReady && (
                <div className="relative">
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "h-6 text-xs gap-1",
                      ops.isBehind ? "text-amber-500 animate-pulse hover:bg-amber-500/10" : "text-muted-foreground hover:text-primary"
                    )}
                    onClick={() => ops.isBehind ? setShowSyncOptions(!showSyncOptions) : handleSync('merge')}
                    disabled={ops.syncLoading}
                    title={ops.isBehind ? "Update available (Click for options)" : "Sync"}
                  >
                    <RefreshCw className={cn("w-3 h-3", ops.syncLoading && "animate-spin")} />
                    <span className="hidden sm:inline">{ops.isBehind ? 'Pull' : 'Sync'}</span>
                  </Button>

                  {/* Reuse existing SyncDropdown logic if needed, or simple custom one */}
                  <SyncDropdown
                    show={showSyncOptions && ops.isBehind}
                    hasConflicts={ops.hasConflicts}
                    onSync={handleSync}
                    onResetClick={() => setShowResetConfirm(true)}
                  />
                </div>
              )}

              {/* Clone Button (for pending/failed) */}
              {ops.isPendingOrFailed && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={ops.handleClone}
                  disabled={ops.cloneLoading}
                  className="h-6 text-xs text-blue-500 hover:text-blue-400"
                >
                  <RefreshCw className={cn("w-3 h-3 mr-1", ops.cloneLoading && "animate-spin")} />
                  Retry
                </Button>
              )}

              {/* Delete Button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowDeleteConfirm(true)}
                className="h-6 w-6 rounded-none hover:bg-destructive/20 text-destructive/70 hover:text-destructive"
                title="Delete Workspace relative"
              >
                <span className="font-mono text-2xs">rm</span>
              </Button>
            </div>
          }
        >
          {/* Expanded Content: Local Path & PRs */}
          <div className="pl-4 font-mono text-xs text-muted-foreground/90 border-l-2 border-border/20 py-1 space-y-2">

            {/* Path */}
            <div className="flex items-center gap-2 opacity-70">
              <span className="select-all">{workspace.localPath}</span>
              {ops.hasConflicts && (
                <span className="text-warning flex items-center gap-1 font-bold ml-2">
                  <AlertTriangle className="w-3 h-3" /> CONFLICTS DETECTED
                </span>
              )}
            </div>

            {/* Sync Error */}
            {ops.syncError && (
              <div className="text-destructive flex items-center gap-1 bg-destructive/10 p-1 rounded w-fit">
                <AlertCircle className="w-3 h-3" />
                {ops.syncError}
              </div>
            )}

            {/* PR List (Inline) */}
            {(showPRs || (ops.prs && ops.prs.length > 0)) && (
              <div className="mt-2 pt-2 border-t border-dashed border-border/30">
                <div
                  className="flex items-center gap-1 mb-2 hover:text-primary cursor-pointer w-fit"
                  onClick={() => setShowPRs(!showPRs)}
                >
                  <GitPullRequest className="w-3 h-3" />
                  <span className="font-bold">Pull Requests ({ops.prs.length})</span>
                  <span className="text-2xs opacity-50 ml-1">{showPRs ? '▼' : '▶'}</span>
                </div>

                {showPRs && (
                  <div className="space-y-1 pl-2">
                    {ops.prsLoading && <div className="italic opacity-50">Loading PRs...</div>}
                    {!ops.prsLoading && ops.prs.length === 0 && <div className="italic opacity-50">No open pull requests.</div>}
                    {ops.prs.map(pr => (
                      <div key={pr.number} className="flex items-center justify-between group hover:bg-muted/30 p-1 rounded">
                        <a href={pr.url} target="_blank" rel="noreferrer" className="flex-1 truncate hover:underline flex items-center gap-2">
                          <span className="text-blue-400">#{pr.number}</span>
                          <span className="truncate">{pr.title}</span>
                        </a>
                        <div className="flex items-center gap-2">
                          <span className="text-2xs opacity-50">{pr.user?.login || 'unknown'}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 text-2xs px-1.5 bg-muted/50 hover:bg-primary/20 hover:text-primary"
                            onClick={() => ops.handleMerge(pr.number)}
                            disabled={ops.mergeLoading}
                          >
                            Merge
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </TerminalRow>
      </>
    );
  }
);
