/**
 * TaskModalHeader - Header section for task modal
 *
 * Design: Terminal aesthetic with prominent status badge
 * Shows task name, ID, and quick actions
 */

import { memo, useState } from 'react';
import {
  RefreshCw,
  StopCircle,
  X,
  Copy,
  Check,
} from 'lucide-react';
import type { WorkerTask } from '@capybara-chat/types';
import { Badge, Button } from '../ui';
import { cn } from '../../lib/utils';
import { TASK_STATE_CONFIG } from '../../lib/task-state-config';

interface TaskModalHeaderProps {
  task: WorkerTask;
  onRefresh: () => void;
  onCancel: () => void;
  onClose: () => void;
  refreshing: boolean;
  cancelling: boolean;
}

export const TaskModalHeader = memo(function TaskModalHeader({
  task,
  onRefresh,
  onCancel,
  onClose,
  refreshing,
  cancelling,
}: TaskModalHeaderProps) {
  const stateConfig = TASK_STATE_CONFIG[task.state] || TASK_STATE_CONFIG.queued;
  const StateIcon = stateConfig.icon;
  const isTerminal = ['complete', 'failed', 'cancelled'].includes(task.state);
  const isRunning = task.state === 'running';
  const [copiedTaskId, setCopiedTaskId] = useState(false);

  return (
    <div className="flex-shrink-0 border-b border-border bg-muted/20">
      {/* Main header row */}
      <div className="flex items-start justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* Status icon */}
          <div className={cn(
            "flex-shrink-0 p-2.5 border border-border",
            task.state === 'failed' && "bg-destructive/10 border-destructive/30",
            task.state === 'complete' && "bg-success/10 border-success/30",
            (task.state === 'running' || task.state === 'assigned') && "bg-progress/10 border-progress/30",
            task.state === 'paused' && "bg-warning/10 border-warning/30",
          )}>
            <StateIcon className={cn(
              "w-6 h-6",
              isRunning && "animate-spin",
              task.state === 'failed' && "text-destructive",
              task.state === 'complete' && "text-success",
              (task.state === 'running' || task.state === 'assigned') && "text-progress",
              task.state === 'paused' && "text-warning",
            )} />
          </div>

          {/* Task info */}
          <div className="min-w-0 flex-1">
            <h2 className="font-bold text-base truncate">
              {task.name || `task/${task.id.substring(0, 8)}`}
            </h2>
            <div className="flex items-center gap-2 text-2xs text-muted-foreground mt-0.5">
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(task.id);
                  setCopiedTaskId(true);
                  setTimeout(() => setCopiedTaskId(false), 1500);
                }}
                className="inline-flex items-center gap-1 font-mono hover:text-foreground transition-colors"
                title="Copy full task ID"
              >
                id:{task.id.substring(0, 8)}
                {copiedTaskId ? <Check className="w-2.5 h-2.5 text-success" /> : <Copy className="w-2.5 h-2.5 opacity-50" />}
              </button>
              <span className="opacity-30">|</span>
              <span>attempt:{task.attempt}/{task.maxAttempts}</span>
            </div>
          </div>
        </div>

        {/* Status badge and actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <Badge
            variant={stateConfig.variant}
            intent={stateConfig.intent}
            size="default"
            className="font-bold"
          >
            [{stateConfig.label}]
          </Badge>

          <div className="flex items-center gap-1 ml-2 border-l border-border pl-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onRefresh}
              disabled={refreshing}
              className="h-7 w-7 p-0"
              title="Refresh task data"
              aria-label="Refresh task data"
            >
              <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} aria-hidden="true" />
            </Button>

            {!isTerminal && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onCancel}
                disabled={cancelling}
                className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                title="Cancel task"
                aria-label="Cancel task"
              >
                <StopCircle className="w-4 h-4" aria-hidden="true" />
              </Button>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-7 w-7 p-0"
              title="Close modal"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
});
