/**
 * TaskPanel Component
 *
 * Displays worker tasks with real-time status updates.
 */

import { useTasks } from '../../hooks/useTasks';
import { useTechniques } from '../../hooks/useTechniques';
import { cn } from '../../lib/utils';
import type { WorkerTask, WorkerTaskState } from '@capybara-chat/types';

interface TaskPanelProps {
  workspaceId?: string;
  specId?: string;
}

// 147-waiting-for-pr: Added waiting_for_pr state
const STATE_LABELS: Record<WorkerTaskState, string> = {
  queued: 'Queued',
  assigned: 'Assigned',
  running: 'Running',
  paused: 'Paused',
  waiting_for_pr: 'Awaiting PR',
  complete: 'Complete',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

// 147-waiting-for-pr: Added waiting_for_pr state
const STATE_STYLES: Record<WorkerTaskState, string> = {
  queued: 'bg-muted-foreground',
  assigned: 'bg-blue-500',
  running: 'bg-blue-600',
  paused: 'bg-warning',
  waiting_for_pr: 'bg-info',
  complete: 'bg-success',
  failed: 'bg-destructive',
  cancelled: 'bg-muted-foreground',
};

function TaskCard({ task, techniqueName }: { task: WorkerTask; techniqueName?: string }) {
  const stateLabel = STATE_LABELS[task.state] || task.state;
  const stateStyle = STATE_STYLES[task.state] || 'bg-muted-foreground';

  return (
    <div className="border border-border bg-card overflow-hidden">
      <div className="flex justify-between items-center px-3 py-2 bg-muted border-b border-border">
        <span className="font-medium text-sm capitalize">{techniqueName || 'Unknown'}</span>
        <span className={cn('px-2 py-0.5 text-xs font-semibold uppercase text-white', stateStyle)}>
          {stateLabel}
        </span>
      </div>
      <div className="p-3 text-sm text-muted-foreground space-y-1">
        <div>Spec: {task.specId.substring(0, 8)}...</div>
        {task.currentPhaseId && <div>Phase: {task.currentPhaseId}</div>}
        {task.iteration > 0 && <div>Iteration: {task.iteration}</div>}
        {task.error && <div className="text-destructive text-xs">{task.error}</div>}
      </div>
      {task.prUrl && (
        <div className="px-3 py-2 border-t border-border">
          <a
            href={task.prUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary hover:underline"
          >
            PR #{task.prNumber}
          </a>
        </div>
      )}
    </div>
  );
}

export function TaskPanel({ workspaceId, specId }: TaskPanelProps) {
  const { tasks, isLoading, error, refetch } = useTasks({
    workspaceId,
    specId,
    autoRefresh: true,
    refreshInterval: 5000,
  });
  const { techniques } = useTechniques();

  if (isLoading && tasks.length === 0) {
    return (
      <div className="flex flex-col gap-3 p-4 bg-card text-center text-muted-foreground py-8">
        Loading tasks...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col gap-3 p-4 bg-card text-center text-muted-foreground py-8">
        <p>Error loading tasks: {error}</p>
        <button
          onClick={refetch}
          className="px-3 py-1.5 bg-primary text-primary-foreground text-sm hover:bg-primary-hover"
        >
          Retry
        </button>
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col gap-3 p-4 bg-card text-center text-muted-foreground py-8">
        <p>No tasks found</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-4 bg-card">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Worker Tasks</h3>
        <button
          onClick={refetch}
          className="px-2 py-1 bg-transparent border border-border text-muted-foreground hover:bg-muted hover:border-muted-foreground transition-colors"
        >
          ↻
        </button>
      </div>
      <div className="flex flex-col gap-2">
        {tasks.map((task) => {
          const technique = techniques.find(t => t.id === task.techniqueId);
          return (
            <TaskCard
              key={task.id}
              task={task}
              techniqueName={technique?.name || task.techniqueId}
            />
          );
        })}
      </div>
    </div>
  );
}

export default TaskPanel;
