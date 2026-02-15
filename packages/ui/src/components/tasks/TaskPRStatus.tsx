/**
 * TaskPRStatus - PR status display for task modal
 *
 * Design: Terminal-style PR status card showing checks, reviews, and merge state
 * Only shown when task has an associated PR
 */

import { memo } from 'react';
import {
  GitPullRequest,
  ExternalLink,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  GitMerge,
  MessageSquare,
  FileDiff,
  Plus,
  Minus,
} from 'lucide-react';
import type { WorkerTask } from '@capybara-chat/types';
import { Badge } from '../ui';
import { cn } from '../../lib/utils';

interface TaskPRStatusProps {
  task: WorkerTask;
}

export const TaskPRStatus = memo(function TaskPRStatus({ task }: TaskPRStatusProps) {
  if (!task.prUrl || !task.prNumber) return null;

  // PR state badge config
  const getPRStateBadge = () => {
    if (task.prState === 'merged') {
      return { icon: GitMerge, label: 'MERGED', intent: 'success' as const };
    }
    if (task.prState === 'closed') {
      return { icon: XCircle, label: 'CLOSED', intent: 'secondary' as const };
    }
    return { icon: GitPullRequest, label: 'OPEN', intent: 'info' as const };
  };

  // Checks status config
  const getChecksConfig = () => {
    switch (task.prChecksStatus) {
      case 'success':
        return { icon: CheckCircle, label: 'Checks pass', color: 'text-success' };
      case 'failure':
        return { icon: XCircle, label: 'Checks failing', color: 'text-destructive' };
      case 'pending':
        return { icon: Clock, label: 'Checks pending', color: 'text-warning' };
      default:
        return { icon: AlertCircle, label: 'No checks', color: 'text-muted-foreground' };
    }
  };

  // Review decision config
  const getReviewConfig = () => {
    switch (task.prReviewDecision) {
      case 'approved':
        return { icon: CheckCircle, label: 'Approved', color: 'text-success' };
      case 'changes_requested':
        return { icon: MessageSquare, label: 'Changes requested', color: 'text-warning' };
      case 'review_required':
        return { icon: Clock, label: 'Review required', color: 'text-info' };
      default:
        return null;
    }
  };

  // Merge state config
  const getMergeConfig = () => {
    if (task.prState === 'merged') return null;
    if (task.prMergeable === true && task.prMergeableState === 'clean') {
      return { label: 'Ready to merge', color: 'text-success' };
    }
    if (task.prMergeableState === 'dirty') {
      return { label: 'Conflicts', color: 'text-destructive' };
    }
    if (task.prMergeableState === 'behind') {
      return { label: 'Behind base', color: 'text-warning' };
    }
    if (task.prMergeableState === 'blocked') {
      return { label: 'Blocked', color: 'text-destructive' };
    }
    return null;
  };

  const prStateBadge = getPRStateBadge();
  const checksConfig = getChecksConfig();
  const reviewConfig = getReviewConfig();
  const mergeConfig = getMergeConfig();
  const PRStateIcon = prStateBadge.icon;
  const ChecksIcon = checksConfig.icon;

  return (
    <div className={cn(
      "border",
      task.prState === 'merged' && "border-success/30 bg-success/5",
      task.prState === 'closed' && "border-muted-foreground/30 bg-muted/10",
      task.prState === 'open' && "border-info/30 bg-info/5",
    )}>
      {/* PR Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
        <div className="flex items-center gap-2">
          <PRStateIcon className={cn(
            "w-4 h-4",
            task.prState === 'merged' && "text-success",
            task.prState === 'closed' && "text-muted-foreground",
            task.prState === 'open' && "text-info",
          )} />
          <span className="font-bold text-sm">PR #{task.prNumber}</span>
          <Badge variant="soft" intent={prStateBadge.intent} size="sm">
            [{prStateBadge.label}]
          </Badge>
        </div>
        <a
          href={task.prUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-primary hover:underline"
        >
          View on GitHub
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {/* PR Status grid */}
      <div className="px-3 py-2 flex items-center gap-4 text-xs">
        {/* Checks status */}
        <div className={cn("flex items-center gap-1", checksConfig.color)}>
          <ChecksIcon className="w-3.5 h-3.5" />
          <span>{checksConfig.label}</span>
        </div>

        {/* Review status */}
        {reviewConfig && (
          <div className={cn("flex items-center gap-1", reviewConfig.color)}>
            <reviewConfig.icon className="w-3.5 h-3.5" />
            <span>{reviewConfig.label}</span>
          </div>
        )}

        {/* Merge status */}
        {mergeConfig && (
          <div className={cn("flex items-center gap-1", mergeConfig.color)}>
            <span>• {mergeConfig.label}</span>
          </div>
        )}
      </div>

      {/* File changes stats */}
      {(task.prChangedFiles || task.prAdditions || task.prDeletions) && (
        <div className="px-3 py-2 border-t border-border/50 flex items-center gap-4 text-2xs text-muted-foreground">
          {task.prChangedFiles !== undefined && (
            <div className="flex items-center gap-1">
              <FileDiff className="w-3 h-3" />
              <span>{task.prChangedFiles} files</span>
            </div>
          )}
          {task.prAdditions !== undefined && (
            <div className="flex items-center gap-1 text-success">
              <Plus className="w-3 h-3" />
              <span>{task.prAdditions}</span>
            </div>
          )}
          {task.prDeletions !== undefined && (
            <div className="flex items-center gap-1 text-destructive">
              <Minus className="w-3 h-3" />
              <span>{task.prDeletions}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
});
