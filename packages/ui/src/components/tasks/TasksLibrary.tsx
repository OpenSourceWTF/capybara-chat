/**
 * TasksLibrary - Browse and manage worker tasks
 *
 * Uses TerminalLibraryLayout for consistent terminal aesthetic
 * with state filters in the collapsible sidebar.
 * Clicking a task navigates to the full TaskDetailView.
 */

import { useCallback } from 'react';
import { ExternalLink, DollarSign, Loader2, AlertCircle } from 'lucide-react';
import { WorkerTaskState } from '@capybara-chat/types';
import type { WorkerTask } from '@capybara-chat/types';
import { Badge, TerminalRow } from '../ui';
import { TerminalLibraryLayout, FilterOption } from '../library';
import { useTasks } from '../../hooks/useTasks';
import { formatDate, formatCost } from '../../lib/utils';
import { TASK_STATE_CONFIG } from '../../lib/task-state-config';

interface TasksLibraryProps {
  onNewTask?: () => void;
  onSelectTask?: (task: WorkerTask) => void;
}

export function TasksLibrary({
  onNewTask,
  onSelectTask,
}: TasksLibraryProps) {
  // Fetch tasks
  const { tasks, isLoading } = useTasks({
    autoRefresh: true,
    refreshInterval: 5000,
  });

  // Handle task selection - navigate to full detail view
  const handleTaskClick = useCallback((task: WorkerTask) => {
    onSelectTask?.(task);
  }, [onSelectTask]);

  // Extract filter options from task states
  const getFilterOptions = useCallback((tasks: WorkerTask[]): FilterOption[] => {
    const stateCounts = new Map<string, number>();
    tasks.forEach(task => {
      stateCounts.set(task.state, (stateCounts.get(task.state) || 0) + 1);
    });

    // Define order for states
    const stateOrder: WorkerTaskState[] = ['running', 'assigned', 'queued', 'paused', 'complete', 'failed'];

    return stateOrder
      .filter(state => stateCounts.has(state))
      .map(state => ({
        value: state,
        label: TASK_STATE_CONFIG[state]?.label.toLowerCase() || state,
        count: stateCounts.get(state) || 0
      }));
  }, []);

  // Filter function
  const filterFn = useCallback((task: WorkerTask, query: string, activeFilters: Set<string>): boolean => {
    const lowerQuery = query.toLowerCase();

    const matchesQuery = !query ||
      task.name?.toLowerCase().includes(lowerQuery) ||
      task.specId.toLowerCase().includes(lowerQuery) ||
      task.id.toLowerCase().includes(lowerQuery);

    const matchesFilters = activeFilters.size === 0 ||
      activeFilters.has(task.state);

    return Boolean(matchesQuery && matchesFilters);
  }, []);

  const formatDuration = (task: WorkerTask): string => {
    if (!task.startedAt) return '--';
    const endTime = task.completedAt || Date.now();
    const durationMs = endTime - task.startedAt;
    const minutes = Math.floor(durationMs / 60000);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  };

  return (
    <>
      <TerminalLibraryLayout<WorkerTask>
        items={tasks}
        loading={isLoading && tasks.length === 0}
        commandPrefix="ps aux | grep"
        searchPlaceholder="task_filter..."
        getFilterOptions={getFilterOptions}
        filterFn={filterFn}
        sidebarTitle="STATE"
        newButtonLabel="spawn"
        onNewClick={onNewTask}
        loadingMessage="Loading tasks..."
        emptyMessage="No tasks found."
        emptyActionLabel="Create a task to run a spec implementation"
        renderItem={(task) => {
          const stateConfig = TASK_STATE_CONFIG[task.state] || TASK_STATE_CONFIG.queued;
          const StateIcon = stateConfig.icon;
          const isActive = ['running', 'assigned'].includes(task.state);

          return (
            <TerminalRow
              key={task.id}
              onClick={() => handleTaskClick(task)}
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              title={
                <span className="flex items-center gap-2">
                  <StateIcon className={isActive ? 'w-4 h-4 animate-pulse' : 'w-4 h-4'} />
                  <span className="font-bold">{task.name || 'Unnamed Task'}</span>
                  <Badge variant={stateConfig.variant} intent={stateConfig.intent} size="sm">
                    {stateConfig.label}
                  </Badge>
                  {task.iteration > 0 && (
                    <span className="text-xs text-muted-foreground">iter:{task.iteration}</span>
                  )}
                  {task.currentPhase && (
                    <Badge variant="soft" intent="primary" size="sm">
                      {task.currentPhase}
                    </Badge>
                  )}
                </span>
              }
              date={formatDate(task.queuedAt)}
              meta={
                <span className="text-muted-foreground/70">
                  spec:{task.specId.substring(0, 8)}
                  <span className="mx-1 opacity-50">|</span>
                  ws:{task.workspaceId.substring(0, 8)}
                  {task.startedAt && (
                    <>
                      <span className="mx-1 opacity-50">|</span>
                      ⏱{formatDuration(task)}
                    </>
                  )}
                  {formatCost(task.sessionTotalCost) && (
                    <>
                      <span className="mx-1 opacity-50">|</span>
                      <span className="inline-flex items-center gap-0.5">
                        <DollarSign className="w-3 h-3" />
                        {formatCost(task.sessionTotalCost, { showDollarSign: false })}
                      </span>
                    </>
                  )}
                </span>
              }
              actions={
                task.prUrl && (
                  <a
                    href={task.prUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-primary hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink className="w-3 h-3" />
                    PR #{task.prNumber}
                  </a>
                )
              }
            >
              {/* Progress message for active tasks */}
              {task.lastProgressMessage && isActive && (
                <div className="flex items-center gap-2 text-sm mt-1">
                  <Loader2 className="w-3 h-3 animate-spin text-progress" />
                  <span className="truncate text-progress-muted">{task.lastProgressMessage}</span>
                </div>
              )}
              {/* Error preview */}
              {task.error && (
                <div className="flex items-start gap-1.5 text-destructive text-sm bg-destructive/5 p-2 border border-destructive/10 mt-1">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span className="truncate">{task.error}</span>
                </div>
              )}
            </TerminalRow>
          );
        }}
      />
    </>
  );
}

export default TasksLibrary;
