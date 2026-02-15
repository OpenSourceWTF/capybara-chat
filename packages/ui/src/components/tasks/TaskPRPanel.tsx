/**
 * TaskPRPanel Component
 *
 * Displays PR status and actions for a worker task.
 * Supports sync, merge, close, and create operations.
 */

import { useState } from 'react';
import { useTaskPR, type PRStatus } from '../../hooks/useTaskPR';
import { cn } from '../../lib/utils';
import type { PRChecksStatus, PRReviewDecision, PRMergeableState } from '@capybara-chat/types';

interface TaskPRPanelProps {
  taskId: string;
  /** Show compact view */
  compact?: boolean;
  /** Auto-poll for updates */
  autoPoll?: boolean;
  /** Poll interval in ms */
  pollInterval?: number;
  /** Callback when PR is merged */
  onMerged?: () => void;
  /** Callback when PR is closed */
  onClosed?: () => void;
}

// Status indicator styles
const CHECKS_STYLES: Record<PRChecksStatus, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-warning text-warning-foreground' },
  success: { label: 'Passed', className: 'bg-success text-success-foreground' },
  failure: { label: 'Failed', className: 'bg-destructive text-destructive-foreground' },
  neutral: { label: 'Neutral', className: 'bg-muted text-muted-foreground' },
  none: { label: 'None', className: 'bg-muted text-muted-foreground' },
};

const REVIEW_STYLES: Record<PRReviewDecision, { label: string; className: string }> = {
  approved: { label: 'Approved', className: 'bg-success text-success-foreground' },
  changes_requested: { label: 'Changes Requested', className: 'bg-warning text-warning-foreground' },
  review_required: { label: 'Review Required', className: 'bg-muted text-muted-foreground' },
  none: { label: 'No Reviews', className: 'bg-muted text-muted-foreground' },
};

const MERGEABLE_STYLES: Record<PRMergeableState, { label: string; className: string }> = {
  clean: { label: 'Clean', className: 'text-success' },
  dirty: { label: 'Conflicts', className: 'text-destructive' },
  blocked: { label: 'Blocked', className: 'text-warning' },
  behind: { label: 'Behind', className: 'text-warning' },
  unstable: { label: 'Unstable', className: 'text-warning' },
  unknown: { label: 'Unknown', className: 'text-muted-foreground' },
};

function StatusBadge({ label, className }: { label: string; className: string }) {
  return (
    <span className={cn('px-2 py-0.5 text-xs font-semibold', className)}>
      {label}
    </span>
  );
}

function PRStatusDisplay({ prStatus }: { prStatus: PRStatus }) {
  const checksStyle = CHECKS_STYLES[prStatus.prChecksStatus || 'none'];
  const reviewStyle = REVIEW_STYLES[prStatus.prReviewDecision || 'none'];
  const mergeableStyle = prStatus.prMergeableState ? MERGEABLE_STYLES[prStatus.prMergeableState] : null;

  return (
    <div className="space-y-3">
      {/* PR State */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">State</span>
        <span className={cn(
          'px-2 py-0.5 text-xs font-semibold uppercase',
          prStatus.prState === 'open' ? 'bg-success text-success-foreground' :
          prStatus.prState === 'merged' ? 'bg-purple-600 text-white' :
          'bg-muted text-muted-foreground'
        )}>
          {prStatus.prState}
        </span>
      </div>

      {/* Checks Status */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">CI Checks</span>
        <StatusBadge {...checksStyle} />
      </div>

      {/* Review Status */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Reviews</span>
        <StatusBadge {...reviewStyle} />
      </div>

      {/* Mergeable Status */}
      {mergeableStyle && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Mergeable</span>
          <span className={cn('text-sm font-medium', mergeableStyle.className)}>
            {prStatus.prMergeable ? '✓ ' : '✗ '}{mergeableStyle.label}
          </span>
        </div>
      )}

      {/* File Stats */}
      {(prStatus.prChangedFiles !== undefined) && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Changes</span>
          <span className="font-mono">
            {prStatus.prChangedFiles} files{' '}
            <span className="text-success">+{prStatus.prAdditions || 0}</span>{' '}
            <span className="text-destructive">-{prStatus.prDeletions || 0}</span>
          </span>
        </div>
      )}

      {/* Last Synced */}
      {prStatus.prLastSyncedAt && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Last synced</span>
          <span>{new Date(prStatus.prLastSyncedAt).toLocaleTimeString()}</span>
        </div>
      )}
    </div>
  );
}

export function TaskPRPanel({
  taskId,
  compact = false,
  autoPoll = true,
  pollInterval = 60000,
  onMerged,
  onClosed,
}: TaskPRPanelProps) {
  const {
    prStatus,
    hasPR,
    isLoading,
    isSyncing,
    error,
    canMerge,
    canClose,
    isReadyToMerge,
    syncPRStatus,
    createPR,
    mergePR,
    closePR,
  } = useTaskPR(taskId, { autoPoll, pollInterval });

  const [showConfirm, setShowConfirm] = useState<'merge' | 'close' | null>(null);

  const handleMerge = async () => {
    const success = await mergePR({ mergeMethod: 'squash' });
    if (success) {
      setShowConfirm(null);
      onMerged?.();
    }
  };

  const handleClose = async () => {
    const success = await closePR({ reason: 'Closed via Capybara UI' });
    if (success) {
      setShowConfirm(null);
      onClosed?.();
    }
  };

  const handleCreatePR = async () => {
    await createPR();
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="p-4 bg-card border border-border text-center text-muted-foreground">
        Loading PR status...
      </div>
    );
  }

  // No PR yet
  if (!hasPR) {
    return (
      <div className="p-4 bg-card border border-border">
        <div className="text-center text-muted-foreground mb-3">
          No PR created yet
        </div>
        <button
          onClick={handleCreatePR}
          disabled={isSyncing}
          className="w-full px-4 py-2 bg-primary text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
        >
          {isSyncing ? 'Creating...' : 'Create PR'}
        </button>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="p-4 bg-card border border-border">
        <div className="text-destructive text-sm mb-2">{error}</div>
        <button
          onClick={() => syncPRStatus(true)}
          className="px-3 py-1.5 bg-primary text-primary-foreground text-sm hover:bg-primary-hover"
        >
          Retry
        </button>
      </div>
    );
  }

  // Compact view - just link
  if (compact && prStatus) {
    return (
      <div className="flex items-center justify-between p-2 bg-card border border-border">
        <a
          href={prStatus.prUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-primary hover:underline"
        >
          PR #{prStatus.prNumber}
        </a>
        <StatusBadge {...CHECKS_STYLES[prStatus.prChecksStatus || 'none']} />
      </div>
    );
  }

  // Full view
  return (
    <div className="bg-card border border-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-muted border-b border-border">
        <a
          href={prStatus!.prUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-semibold text-primary hover:underline"
        >
          PR #{prStatus!.prNumber}
        </a>
        <button
          onClick={() => syncPRStatus(true)}
          disabled={isSyncing}
          className="px-2 py-1 text-xs bg-transparent border border-border text-muted-foreground hover:bg-muted disabled:opacity-50"
        >
          {isSyncing ? '...' : '↻ Sync'}
        </button>
      </div>

      {/* Status */}
      <div className="p-4">
        <PRStatusDisplay prStatus={prStatus!} />
      </div>

      {/* Actions */}
      {prStatus!.prState === 'open' && (
        <div className="px-4 py-3 border-t border-border bg-muted">
          {showConfirm === 'merge' ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Merge this PR?</p>
              <div className="flex gap-2">
                <button
                  onClick={handleMerge}
                  disabled={isSyncing}
                  className="flex-1 px-3 py-1.5 bg-success text-success-foreground text-sm hover:opacity-90 disabled:opacity-50"
                >
                  {isSyncing ? 'Merging...' : 'Confirm Merge'}
                </button>
                <button
                  onClick={() => setShowConfirm(null)}
                  className="px-3 py-1.5 bg-muted border border-border text-sm hover:bg-card"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : showConfirm === 'close' ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Close without merging?</p>
              <div className="flex gap-2">
                <button
                  onClick={handleClose}
                  disabled={isSyncing}
                  className="flex-1 px-3 py-1.5 bg-destructive text-destructive-foreground text-sm hover:opacity-90 disabled:opacity-50"
                >
                  {isSyncing ? 'Closing...' : 'Confirm Close'}
                </button>
                <button
                  onClick={() => setShowConfirm(null)}
                  className="px-3 py-1.5 bg-muted border border-border text-sm hover:bg-card"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => setShowConfirm('merge')}
                disabled={!canMerge || isSyncing}
                className={cn(
                  'flex-1 px-3 py-1.5 text-sm disabled:opacity-50',
                  isReadyToMerge
                    ? 'bg-success text-success-foreground hover:opacity-90'
                    : 'bg-muted border border-border text-muted-foreground hover:bg-card'
                )}
              >
                {isReadyToMerge ? 'Merge PR' : 'Merge...'}
              </button>
              <button
                onClick={() => setShowConfirm('close')}
                disabled={!canClose || isSyncing}
                className="px-3 py-1.5 bg-muted border border-border text-sm text-muted-foreground hover:bg-card disabled:opacity-50"
              >
                Close
              </button>
            </div>
          )}
        </div>
      )}

      {/* Merged/Closed indicator */}
      {prStatus!.prState === 'merged' && (
        <div className="px-4 py-3 border-t border-border bg-purple-900/20 text-center">
          <span className="text-sm text-purple-400 font-medium">PR Merged</span>
        </div>
      )}
      {prStatus!.prState === 'closed' && (
        <div className="px-4 py-3 border-t border-border bg-muted text-center">
          <span className="text-sm text-muted-foreground font-medium">PR Closed</span>
        </div>
      )}
    </div>
  );
}

export default TaskPRPanel;
