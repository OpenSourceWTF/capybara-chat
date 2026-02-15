/**
 * SpecTasksSection - Shows tasks executing a spec
 *
 * Displays worker tasks associated with a spec, with clickable links
 * to navigate to task detail view.
 *
 * Design: Terminal aesthetic per STYLE_GUIDE.md
 */

import { useFetchList } from '../../hooks/useFetchList';
import type { WorkerTask } from '@capybara-chat/types';
import { API_PATHS, SERVER_DEFAULTS } from '@capybara-chat/types';
import { Badge } from '../ui';
import { cn, formatCost } from '../../lib/utils';
import { formatLibraryTimestamp, formatFullTimestamp } from '../../lib/date-formatting';
import {
  AlertCircle,
  Loader2,
  GitPullRequest,
  ExternalLink,
  DollarSign,
} from 'lucide-react';
import { TASK_STATE_CONFIG } from '../../lib/task-state-config';

interface SpecTasksSectionProps {
  specId: string;
  serverUrl?: string;
  onTaskSelect?: (task: WorkerTask) => void;
}

export function SpecTasksSection({
  specId,
  serverUrl = SERVER_DEFAULTS.SERVER_URL,
  onTaskSelect,
}: SpecTasksSectionProps) {
  const { items: tasks, loading, error, refetch } = useFetchList<WorkerTask>({
    url: specId ? `${serverUrl}${API_PATHS.TASKS}?specId=${specId}&limit=10` : '',
    dataKey: 'tasks',
  });

  if (loading && tasks.length === 0) {
    return (
      <div className="py-6 text-center text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin mx-auto mb-2 text-progress" />
        <span className="text-2xs font-mono uppercase tracking-wider">Loading tasks...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-6 text-center text-destructive/70">
        <AlertCircle className="w-4 h-4 mx-auto mb-2" />
        <p className="text-2xs font-mono mb-2">Failed to load tasks</p>
        <button
          onClick={refetch}
          className="text-2xs font-mono text-primary hover:underline uppercase tracking-wide"
        >
          [RETRY]
        </button>
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="py-6 text-center border border-dashed border-border text-muted-foreground">
        <p className="text-xs font-mono">No tasks yet</p>
        <p className="text-2xs font-mono mt-1 opacity-60">Create a task to start executing this spec</p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {tasks.map((task) => {
        const stateConfig = TASK_STATE_CONFIG[task.state];
        const StateIcon = stateConfig.icon;
        const isActive = ['running', 'assigned'].includes(task.state);

        return (
          <div
            key={task.id}
            className={cn(
              'p-2.5 border border-border border-l-2 bg-card/50 hover:bg-card hover:border-border/80 transition-all',
              stateConfig.borderColor,
              onTaskSelect && 'cursor-pointer'
            )}
            onClick={() => onTaskSelect?.(task)}
            role={onTaskSelect ? 'button' : undefined}
            tabIndex={onTaskSelect ? 0 : undefined}
            onKeyDown={(e) => {
              if (onTaskSelect && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                onTaskSelect(task);
              }
            }}
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <StateIcon
                  className={cn(
                    'w-3.5 h-3.5',
                    task.state === 'complete' && 'text-success',
                    task.state === 'failed' && 'text-destructive',
                    isActive && 'text-progress animate-spin',
                    task.state === 'paused' && 'text-warning',
                    task.state === 'waiting_for_pr' && 'text-primary',
                    ['queued', 'cancelled'].includes(task.state) && 'text-muted-foreground'
                  )}
                />
                <span className="font-mono text-2xs text-primary font-semibold tracking-wide">
                  TASK-{task.id.substring(0, 8)}
                </span>
              </div>
              <Badge variant="solid" intent={stateConfig.intent} size="sm" className="font-mono text-2xs tracking-wide">
                {stateConfig.bracketLabel}
              </Badge>
            </div>

            <div className="flex items-center justify-between text-2xs text-muted-foreground font-mono">
              <div className="flex items-center gap-1.5">
                {task.name && (
                  <span className="text-foreground/70 truncate max-w-[120px]">
                    {task.name}
                  </span>
                )}
                {task.iteration > 0 && (
                  <span className="text-muted-foreground/60">iter:{task.iteration}</span>
                )}
                {task.attempt > 1 && (
                  <span className="text-muted-foreground/60">{task.attempt}/{task.maxAttempts}</span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                {formatCost(task.sessionTotalCost) && (
                  <span className="flex items-center gap-0.5">
                    <DollarSign className="w-2.5 h-2.5" />
                    {formatCost(task.sessionTotalCost, { showDollarSign: false })}
                  </span>
                )}
                <span
                  className="uppercase tracking-wider"
                  title={task.startedAt ? formatFullTimestamp(task.startedAt) : undefined}
                >
                  {task.startedAt ? formatLibraryTimestamp(task.startedAt) : '--'}
                </span>
              </div>
            </div>

            {/* PR link if available */}
            {task.prUrl && (
              <div className="mt-1.5 pt-1.5 border-t border-border/40">
                <a
                  href={task.prUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-2xs text-primary hover:underline font-mono flex items-center gap-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <GitPullRequest className="w-3 h-3" />
                  PR #{task.prNumber}
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>
            )}

            {/* Error preview */}
            {task.error && (
              <div className="mt-1.5 pt-1.5 border-t border-border/40">
                <p className="text-2xs text-destructive/70 font-mono truncate">
                  {task.error.substring(0, 80)}
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default SpecTasksSection;
