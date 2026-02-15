/**
 * KanbanCard - Draggable task card for the Kanban board
 *
 * Design: Terminal aesthetic with zero radius, monospace, warm colors
 * Follows Cozy Terminal style guide strictly
 */

import { memo, DragEvent } from 'react';
import { motion } from 'framer-motion';
import { ExternalLink, Clock, AlertCircle, Loader2, DollarSign } from 'lucide-react';
import type { WorkerTask } from '@capybara-chat/types';
import { Badge } from '../ui';
import { cn } from '../../lib/utils';

interface KanbanCardProps {
  task: WorkerTask;
  onDragStart: (e: DragEvent<HTMLDivElement>, task: WorkerTask) => void;
  onDragEnd: (e: DragEvent<HTMLDivElement>) => void;
  onClick?: (task: WorkerTask) => void;
  isDragging?: boolean;
}

// State-based color coding following Cozy Terminal style guide
// Running/assigned uses progress (violet) for distinction
const STATE_COLORS: Record<string, string> = {
  queued: 'border-l-2 border-l-muted-foreground/30',
  assigned: 'border-l-2 border-l-progress bg-progress/5',
  running: 'border-l-2 border-l-progress bg-progress/5',
  paused: 'border-l-2 border-l-warning bg-warning/5',
  complete: 'border-l-2 border-l-success bg-success/5',
  failed: 'border-l-2 border-l-destructive bg-destructive/5',
  cancelled: 'border-l-2 border-l-muted-foreground bg-muted/30',
};

export const KanbanCard = memo(function KanbanCard({
  task,
  onDragStart,
  onDragEnd,
  onClick,
  isDragging,
}: KanbanCardProps) {
  const formatDuration = (): string => {
    if (!task.startedAt) return '--';
    const endTime = task.completedAt || Date.now();
    const durationMs = endTime - task.startedAt;
    const minutes = Math.floor(durationMs / 60000);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  };

  const formatCost = (): string | null => {
    if (task.sessionTotalCost === undefined || task.sessionTotalCost === null) return null;
    // Format cost with appropriate precision
    if (task.sessionTotalCost < 0.01) return '<$0.01';
    if (task.sessionTotalCost < 1) return `$${task.sessionTotalCost.toFixed(2)}`;
    return `$${task.sessionTotalCost.toFixed(2)}`;
  };

  const isActive = ['running', 'assigned'].includes(task.state);

  return (
    <motion.div
      layout
      layoutId={task.id}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{
        layout: { type: 'spring', stiffness: 300, damping: 30 },
        opacity: { duration: 0.2 },
        scale: { duration: 0.2 },
      }}
    >
      <div
        draggable
        onDragStart={(e) => onDragStart(e, task)}
        onDragEnd={onDragEnd}
        onClick={() => onClick?.(task)}
        className={cn(
          // Base: Zero radius, terminal aesthetic
          "group p-3 border border-border bg-card cursor-grab active:cursor-grabbing",
          "hover:shadow-md hover:-translate-y-0.5 transition-all duration-150",
          "font-mono text-sm select-none",
          // State-based color coding (left border + subtle background tint)
          STATE_COLORS[task.state] || STATE_COLORS.queued,
          // Dragging state
          isDragging && "opacity-50 border-primary border-dashed shadow-lg",
          // Click feedback
          onClick && "cursor-pointer"
        )}
      >
      {/* Header: Task name + iteration */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-xs font-bold text-foreground truncate flex-1">
          {task.name || `Task ${task.id.substring(0, 8)}`}
        </span>
        {task.iteration > 0 && (
          <span className="text-2xs text-muted-foreground">
            iter:{task.iteration}
          </span>
        )}
      </div>

      {/* Sub-type badge for stopped tasks (failed vs cancelled) */}
      {(task.state === 'failed' || task.state === 'cancelled') && (
        <Badge
          variant="soft"
          intent={task.state === 'failed' ? 'danger' : 'neutral'}
          size="sm"
          className="mb-2"
        >
          {task.state.toUpperCase()}
        </Badge>
      )}

      {/* Phase badge if present */}
      {task.currentPhase && (
        <Badge variant="soft" intent="primary" size="sm" className="mb-2">
          {task.currentPhase}
        </Badge>
      )}

      {/* Metadata row */}
      <div className="flex items-center gap-2 text-2xs text-muted-foreground mb-2">
        <span>spec:{task.specId.substring(0, 6)}</span>
        <span className="opacity-30">|</span>
        <span>ws:{task.workspaceId.substring(0, 6)}</span>
      </div>

      {/* Duration and cost for active/completed tasks */}
      {(task.startedAt || formatCost()) && (
        <div className="flex items-center gap-2 text-2xs text-muted-foreground">
          {task.startedAt && (
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>{formatDuration()}</span>
            </div>
          )}
          {formatCost() && (
            <div className="flex items-center gap-0.5">
              <DollarSign className="w-3 h-3" />
              <span>{formatCost()?.replace('$', '')}</span>
            </div>
          )}
        </div>
      )}

      {/* Progress message for all tasks with messages (133-task-card-enhancements) */}
      {/* Priority: lastProgressMessage (real-time status) > lastMessage (final response fallback) */}
      {(task.lastProgressMessage || task.lastMessage) && (
        <div className="flex items-center gap-1.5 text-2xs text-muted-foreground mt-2 pt-2 border-t border-border/50">
          {isActive ? (
            <Loader2 className="w-3 h-3 animate-spin text-progress flex-shrink-0" />
          ) : (
            <span className="w-3 h-3 flex items-center justify-center text-[8px] flex-shrink-0">▸</span>
          )}
          <span className="truncate">{task.lastProgressMessage || task.lastMessage}</span>
        </div>
      )}

      {/* Error display */}
      {task.error && (
        <div className="flex items-start gap-1.5 text-destructive text-2xs bg-destructive/5 p-2 border border-destructive/20 mt-2">
          <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
          <span className="line-clamp-2">{task.error}</span>
        </div>
      )}

      {/* PR link if present */}
      {task.prUrl && (
        <a
          href={task.prUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-2xs text-primary hover:underline mt-2"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink className="w-3 h-3" />
          PR #{task.prNumber}
        </a>
      )}
      </div>
    </motion.div>
  );
});
