/**
 * SpecWorkflowBar - Lifecycle status strip for SpecView
 *
 * Shows the most recent task's state with contextual actions:
 * - No tasks: [▶ RUN TASK] button
 * - Queued/Assigned: status + attempt info
 * - Running: animated spinner + phase + [VIEW →]
 * - Waiting for PR: PR link + [REVIEW →]
 * - Complete: checkmark + PR link + [▶ NEW TASK]
 * - Failed: error preview + [↻ RETRY]
 *
 * Terminal aesthetic: monospace, bracket labels, state-colored left border.
 */

import type { WorkerTask, WorkerTaskState } from '@capybara-chat/types';
import { API_PATHS, SERVER_DEFAULTS } from '@capybara-chat/types';
import { useFetchList } from '../../hooks/useFetchList';
import {
  Clock,
  Loader2,
  CheckCircle,
  XCircle,
  GitPullRequest,
  ExternalLink,
  Play,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { TASK_STATE_CONFIG } from '../../lib/task-state-config';

interface SpecWorkflowBarProps {
  specId: string;
  workspaceId?: string;
  serverUrl?: string;
  onTaskSelect?: (task: WorkerTask) => void;
  onCreateTask: () => void;
}

export function SpecWorkflowBar({
  specId,
  workspaceId,
  serverUrl = SERVER_DEFAULTS.SERVER_URL,
  onTaskSelect,
  onCreateTask,
}: SpecWorkflowBarProps) {
  // Lightweight fetch — only the most recent task
  const { items: tasks } = useFetchList<WorkerTask>({
    url: specId ? `${serverUrl}${API_PATHS.TASKS}?specId=${specId}&limit=1` : '',
    dataKey: 'tasks',
  });

  const latestTask = tasks[0];

  // No tasks — prompt to create one
  if (!latestTask) {
    if (!workspaceId) return null;
    return (
      <div className="flex items-center gap-3 px-4 py-3 border border-dashed border-border bg-card/20 mb-6">
        <span className="text-xs text-muted-foreground font-mono uppercase tracking-wider flex-1">
          No tasks executed
        </span>
        <button
          onClick={onCreateTask}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-bold uppercase tracking-wide bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Play className="w-3 h-3" />
          RUN TASK
        </button>
      </div>
    );
  }

  const { state } = latestTask;
  const borderColor = TASK_STATE_CONFIG[state as WorkerTaskState]?.borderColor || 'border-l-muted-foreground/50';

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-3 border border-border border-l-2 bg-card/30 mb-6',
        borderColor,
      )}
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <StatusDisplay task={latestTask} />
      </div>
      <ActionButton
        task={latestTask}
        workspaceId={workspaceId}
        onTaskSelect={onTaskSelect}
        onCreateTask={onCreateTask}
      />
    </div>
  );
}

/** State-specific status display (icon + label + details) */
function StatusDisplay({ task }: { task: WorkerTask }) {
  const { state } = task;

  switch (state) {
    case 'queued':
    case 'assigned':
      return (
        <>
          <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
            [{state === 'queued' ? '◈ QUEUED' : '◈ ASSIGNED'}]
          </span>
          <span className="text-2xs text-muted-foreground/60 font-mono">
            attempt {task.attempt}/{task.maxAttempts}
          </span>
        </>
      );

    case 'running':
      return (
        <>
          <Loader2 className="w-4 h-4 text-progress animate-spin flex-shrink-0" />
          <span className="text-xs font-mono uppercase tracking-wider text-progress font-bold">
            [◉ RUNNING]
          </span>
          {task.currentPhaseId && (
            <span className="text-2xs text-muted-foreground/70 font-mono">
              phase:{task.currentPhaseId}
            </span>
          )}
          <span className="text-2xs text-muted-foreground/50 font-mono">
            iter:{task.iteration}
          </span>
        </>
      );

    case 'paused':
      return (
        <>
          <Clock className="w-4 h-4 text-warning flex-shrink-0" />
          <span className="text-xs font-mono uppercase tracking-wider text-warning">
            [⏸ PAUSED]
          </span>
        </>
      );

    case 'waiting_for_pr':
      return (
        <>
          <GitPullRequest className="w-4 h-4 text-primary flex-shrink-0" />
          {task.prUrl ? (
            <a
              href={task.prUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-mono text-primary hover:underline flex items-center gap-1"
            >
              [PR #{task.prNumber}]
              <ExternalLink className="w-3 h-3" />
            </a>
          ) : (
            <span className="text-xs font-mono uppercase tracking-wider text-primary">
              [AWAITING PR]
            </span>
          )}
        </>
      );

    case 'complete':
      return (
        <>
          <CheckCircle className="w-4 h-4 text-success flex-shrink-0" />
          <span className="text-xs font-mono uppercase tracking-wider text-success font-bold">
            [✓ COMPLETE]
          </span>
          {task.prUrl && (
            <a
              href={task.prUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-mono text-primary hover:underline flex items-center gap-1"
            >
              PR #{task.prNumber}
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </>
      );

    case 'failed':
      return (
        <>
          <XCircle className="w-4 h-4 text-destructive flex-shrink-0" />
          <span className="text-xs font-mono uppercase tracking-wider text-destructive font-bold">
            [✖ FAILED]
          </span>
          {task.error && (
            <span className="text-2xs text-destructive/70 font-mono truncate max-w-[250px]" title={task.error}>
              {task.error.substring(0, 80)}
            </span>
          )}
        </>
      );

    default:
      return (
        <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
          [{state.toUpperCase()}]
        </span>
      );
  }
}

/** State-specific action button */
function ActionButton({
  task,
  workspaceId,
  onTaskSelect,
  onCreateTask,
}: {
  task: WorkerTask;
  workspaceId?: string;
  onTaskSelect?: (task: WorkerTask) => void;
  onCreateTask: () => void;
}) {
  const btnBase = 'px-3 py-1 text-xs font-mono uppercase tracking-wide transition-colors flex-shrink-0';

  switch (task.state) {
    case 'queued':
    case 'assigned':
    case 'running':
      return onTaskSelect ? (
        <button
          onClick={() => onTaskSelect(task)}
          className={cn(btnBase, 'text-primary border border-primary/30 hover:bg-primary/10')}
        >
          VIEW →
        </button>
      ) : null;

    case 'waiting_for_pr':
      return task.prUrl ? (
        <a
          href={task.prUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(btnBase, 'text-primary border border-primary/30 hover:bg-primary/10')}
        >
          REVIEW →
        </a>
      ) : null;

    case 'failed':
      return workspaceId ? (
        <button
          onClick={onCreateTask}
          className={cn(btnBase, 'text-warning border border-warning/30 hover:bg-warning/10')}
        >
          ↻ RETRY
        </button>
      ) : null;

    case 'complete':
      return workspaceId ? (
        <button
          onClick={onCreateTask}
          className={cn(btnBase, 'text-muted-foreground border border-border hover:bg-card')}
        >
          ▶ NEW TASK
        </button>
      ) : null;

    default:
      return null;
  }
}

export default SpecWorkflowBar;
