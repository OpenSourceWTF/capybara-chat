/**
 * KanbanBoard - Kanban-style view of worker tasks
 *
 * Design: Terminal aesthetic with zero radius, warm colors
 * Columns for each task state with drag-and-drop support
 *
 * States organized left-to-right by workflow:
 *   QUEUED → ASSIGNED → RUNNING → PAUSED → COMPLETE/FAILED
 *
 * 134-kanban-reorder: Added within-column reordering and infinite scroll (50 per column)
 */

import { useState, useCallback, useMemo, DragEvent } from 'react';
import { AnimatePresence } from 'framer-motion';
import {
  Clock,
  PauseCircle,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { WorkerTaskState } from '@capybara-chat/types';
import type { WorkerTask } from '@capybara-chat/types';
import { KanbanColumn } from './KanbanColumn';
import { KanbanCard } from './KanbanCard';
import { Button } from '../ui';
import type { BadgeProps } from '../ui/Badge';

interface KanbanBoardProps {
  tasks: WorkerTask[];
  isLoading: boolean;
  onRefetch: () => void;
  onTaskSelect?: (task: WorkerTask) => void;
  onTaskStateChange?: (taskId: string, newState: WorkerTaskState) => void;
  /** 134-kanban-reorder: Callback to update task position within column */
  onTaskPositionChange?: (taskId: string, position: number) => void;
}

// Column configuration
interface ColumnConfig {
  state: WorkerTaskState;
  title: string;
  intent: BadgeProps['intent'];
  icon: React.ReactNode;
}

// Columns configuration:
// - 'assigned' tasks merge into 'running' column
// - 'cancelled' tasks merge into 'failed' column (displayed as "Stopped")
// - 147-waiting-for-pr: 'paused' and 'waiting_for_pr' merge into 'paused' column (displayed as "Waiting")
//   This is the "human intervention" column - tasks that need human attention
const COLUMNS: ColumnConfig[] = [
  { state: 'queued', title: 'Queued', intent: 'secondary', icon: <Clock className="w-4 h-4" /> },
  { state: 'running', title: 'Running', intent: 'progress', icon: <Loader2 className="w-4 h-4 animate-spin text-progress" /> },
  { state: 'paused', title: 'Waiting', intent: 'warning', icon: <PauseCircle className="w-4 h-4" /> },  // Human intervention column
  { state: 'complete', title: 'Complete', intent: 'success', icon: <CheckCircle className="w-4 h-4" /> },
  { state: 'failed', title: 'Stopped', intent: 'danger', icon: <XCircle className="w-4 h-4" /> },
];

// 134-kanban-reorder: Constants for infinite scroll and position calculation
const DISPLAY_LIMIT = 50;
const POSITION_GAP = 1000;

/**
 * Calculate new position for a task being inserted at a specific index.
 * Uses gap-based ordering with integers (0, 1000, 2000...).
 */
function calculatePosition(
  tasks: WorkerTask[],
  insertIndex: number,
  excludeId: string
): number {
  const filtered = tasks.filter(t => t.id !== excludeId);

  if (insertIndex === 0) {
    // Insert at beginning
    const firstPos = filtered[0]?.position ?? POSITION_GAP;
    return firstPos - POSITION_GAP;
  }
  if (insertIndex >= filtered.length) {
    // Insert at end
    const lastPos = filtered[filtered.length - 1]?.position ?? 0;
    return lastPos + POSITION_GAP;
  }
  // Insert between two cards
  const prevPos = filtered[insertIndex - 1]?.position ?? (insertIndex - 1) * POSITION_GAP;
  const nextPos = filtered[insertIndex]?.position ?? insertIndex * POSITION_GAP;
  return Math.floor((prevPos + nextPos) / 2);
}

/**
 * Sort tasks by position (if set) or queuedAt (fallback).
 * Tasks with position are sorted by position ascending.
 * Tasks without position use queuedAt descending (newest first).
 */
function sortTasksForDisplay(tasks: WorkerTask[]): WorkerTask[] {
  return [...tasks].sort((a, b) => {
    // Both have positions - sort by position ascending
    if (a.position !== undefined && b.position !== undefined) {
      return a.position - b.position;
    }
    // Only a has position - a comes first
    if (a.position !== undefined) return -1;
    // Only b has position - b comes first
    if (b.position !== undefined) return 1;
    // Neither has position - sort by queuedAt descending (newest first)
    return (b.queuedAt || 0) - (a.queuedAt || 0);
  });
}

export function KanbanBoard({
  tasks,
  isLoading,
  onRefetch,
  onTaskSelect,
  onTaskStateChange,
  onTaskPositionChange,
}: KanbanBoardProps) {
  const [draggedTask, setDraggedTask] = useState<WorkerTask | null>(null);
  const [dropTarget, setDropTarget] = useState<WorkerTaskState | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  // 134-kanban-reorder: Infinite scroll - track visible count per column
  // 147-waiting-for-pr: Added waiting_for_pr state
  const [visibleCounts, setVisibleCounts] = useState<Record<WorkerTaskState, number>>({
    queued: DISPLAY_LIMIT,
    assigned: DISPLAY_LIMIT,
    running: DISPLAY_LIMIT,
    paused: DISPLAY_LIMIT,
    waiting_for_pr: DISPLAY_LIMIT,
    complete: DISPLAY_LIMIT,
    failed: DISPLAY_LIMIT,
    cancelled: DISPLAY_LIMIT,
  });

  // Load more items for a column
  const loadMore = useCallback((state: WorkerTaskState) => {
    setVisibleCounts(prev => ({
      ...prev,
      [state]: prev[state] + DISPLAY_LIMIT,
    }));
  }, []);

  // Group tasks by state with column merging:
  // - 'assigned' → 'running' column
  // - 'cancelled' → 'failed' column (displayed as "Stopped")
  // - 147-waiting-for-pr: 'waiting_for_pr' → 'paused' column (displayed as "Waiting")
  //   The "Waiting" column is the human intervention column
  const tasksByState = useMemo(() => {
    const grouped: Record<WorkerTaskState, WorkerTask[]> = {
      queued: [],
      assigned: [], // Not displayed as separate column, merged into 'running'
      running: [],
      paused: [], // Human intervention column: includes both paused and waiting_for_pr
      waiting_for_pr: [], // Not displayed as separate column, merged into 'paused' (Waiting)
      complete: [],
      failed: [], // Also contains cancelled tasks (displayed as "Stopped")
      cancelled: [], // Not displayed as separate column, merged into 'failed'
    };

    tasks.forEach((task) => {
      // Merge assigned tasks into the running column for display
      if (task.state === 'assigned') {
        grouped.running.push(task);
      // Merge cancelled tasks into the failed/stopped column for display
      } else if (task.state === 'cancelled') {
        grouped.failed.push(task);
      // 147-waiting-for-pr: Merge waiting_for_pr into paused/Waiting column (human intervention)
      } else if (task.state === 'waiting_for_pr') {
        grouped.paused.push(task);
      } else if (grouped[task.state]) {
        grouped[task.state].push(task);
      }
    });

    // Sort each group by position/queuedAt
    Object.keys(grouped).forEach(state => {
      grouped[state as WorkerTaskState] = sortTasksForDisplay(grouped[state as WorkerTaskState]);
    });

    return grouped;
  }, [tasks]);

  // Drag handlers
  const handleDragStart = useCallback((e: DragEvent<HTMLDivElement>, task: WorkerTask) => {
    setDraggedTask(task);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', task.id);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggedTask(null);
    setDropTarget(null);
    setDropIndex(null);
  }, []);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  // 134-kanban-reorder: Enhanced drop handler supporting same-column reorder
  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>, state: WorkerTaskState) => {
      e.preventDefault();
      if (!draggedTask) return;

      // Map visual column state back to actual task state for comparison
      // (assigned appears in running column, cancelled appears in failed column,
      //  waiting_for_pr appears in paused/Waiting column)
      const actualState = draggedTask.state;
      const targetColumnStates = state === 'running'
        ? ['running', 'assigned']
        : state === 'failed'
          ? ['failed', 'cancelled']
        : state === 'paused'
          ? ['paused', 'waiting_for_pr']  // 147-waiting-for-pr: Human intervention column
          : [state];

      const isSameColumn = targetColumnStates.includes(actualState);

      if (isSameColumn && onTaskPositionChange && dropIndex !== null) {
        // Same-column reorder - calculate and update position
        const columnTasks = tasksByState[state];
        const newPosition = calculatePosition(columnTasks, dropIndex, draggedTask.id);
        onTaskPositionChange(draggedTask.id, newPosition);
      } else if (!isSameColumn && onTaskStateChange) {
        // Cross-column move - change state
        onTaskStateChange(draggedTask.id, state);
      }

      setDraggedTask(null);
      setDropTarget(null);
      setDropIndex(null);
    },
    [draggedTask, onTaskStateChange, onTaskPositionChange, dropIndex, tasksByState]
  );

  const handleColumnDragEnter = useCallback((state: WorkerTaskState) => {
    setDropTarget(state);
  }, []);

  // Track drop position within column based on mouse position
  const handleCardDragOver = useCallback((e: DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    // If mouse is in top half, insert before; bottom half, insert after
    const insertIndex = e.clientY < midY ? index : index + 1;
    setDropIndex(insertIndex);
  }, []);

  // Task selection handler - navigate to task detail view
  const handleTaskClick = useCallback((task: WorkerTask) => {
    onTaskSelect?.(task);
  }, [onTaskSelect]);

  // Count active columns (with tasks)
  const activeColumnCount = COLUMNS.filter(col => tasksByState[col.state].length > 0).length;

  return (
    <div className="flex flex-col h-full font-mono">
      {/* Board Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/10">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            TASK_BOARD
          </span>
          <span className="text-2xs text-muted-foreground">
            [{tasks.length} total]
          </span>
        </div>
        <Button
          onClick={onRefetch}
          variant="ghost"
          size="sm"
          disabled={isLoading}
          className="text-xs h-7"
        >
          <RefreshCw className={`w-3 h-3 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
          REFRESH
        </Button>
      </div>

      {/* Kanban Columns */}
      {isLoading && tasks.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-6 h-6 animate-spin text-progress mx-auto mb-2" />
            <span className="text-xs text-progress-muted uppercase tracking-wider">Loading tasks...</span>
          </div>
        </div>
      ) : tasks.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-muted-foreground p-8 border border-dashed border-border">
            <AlertCircle className="w-8 h-8 mx-auto mb-3 opacity-50" />
            <p className="text-sm font-bold mb-1">NO_TASKS_FOUND</p>
            <p className="text-2xs opacity-70">
              Create a worker task to see it on the board
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-x-auto p-4">
          <div className="flex gap-3 h-full min-h-[400px]">
            {COLUMNS.map((column) => {
              const allColumnTasks = tasksByState[column.state];
              const visibleCount = visibleCounts[column.state];
              const visibleTasks = allColumnTasks.slice(0, visibleCount);
              const hasMore = allColumnTasks.length > visibleCount;

              // Show column if it has tasks OR if we have few active columns (show structure)
              const showColumn = allColumnTasks.length > 0 || activeColumnCount < 4;

              if (!showColumn) return null;

              return (
                <KanbanColumn
                  key={column.state}
                  state={column.state}
                  title={column.title}
                  count={allColumnTasks.length}
                  intent={column.intent}
                  icon={column.icon}
                  onDragOver={(e) => {
                    handleDragOver(e);
                    handleColumnDragEnter(column.state);
                  }}
                  onDrop={handleDrop}
                  isDropTarget={dropTarget === column.state}
                  onLoadMore={() => loadMore(column.state)}
                  hasMore={hasMore}
                >
                  {visibleTasks.length === 0 ? (
                    <div className="text-2xs text-muted-foreground/50 text-center py-4 border border-dashed border-border/50">
                      -- empty --
                    </div>
                  ) : (
                    <AnimatePresence mode="popLayout">
                      {visibleTasks.map((task, index) => (
                        <div
                          key={task.id}
                          onDragOver={(e) => handleCardDragOver(e, index)}
                          className={
                            dropTarget === column.state && dropIndex === index && draggedTask?.id !== task.id
                              ? 'border-t-2 border-primary'
                              : ''
                          }
                        >
                          <KanbanCard
                            task={task}
                            onDragStart={handleDragStart}
                            onDragEnd={handleDragEnd}
                            onClick={handleTaskClick}
                            isDragging={draggedTask?.id === task.id}
                          />
                        </div>
                      ))}
                      {/* Drop indicator at the end */}
                      {dropTarget === column.state && dropIndex === visibleTasks.length && draggedTask && (
                        <div className="h-1 bg-primary rounded" />
                      )}
                    </AnimatePresence>
                  )}
                </KanbanColumn>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}

export default KanbanBoard;
