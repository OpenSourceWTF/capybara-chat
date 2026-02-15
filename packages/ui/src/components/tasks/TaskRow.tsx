/**
 * TaskRow - Selectable task row for the stop modal
 *
 * Displays task name, state badge, and elapsed time.
 * Supports checkbox-style selection with keyboard accessibility.
 */

import React from 'react';
import { Square, CheckSquare } from 'lucide-react';
import type { WorkerTask } from '@capybara-chat/types';
import { cn } from '../../lib/utils';

interface TaskRowProps {
  task: WorkerTask;
  isSelected: boolean;
  onToggle: (taskId: string) => void;
  className?: string;
}

const phaseBadgeStyles: Record<string, string> = {
  running: 'bg-violet-500/20 text-violet-700',
  assigned: 'bg-blue-500/20 text-blue-700',
  paused: 'bg-yellow-500/20 text-yellow-700',
};

const phaseBadgeLabels: Record<string, string> = {
  running: '[RUNNING]',
  assigned: '[ASSIGNED]',
  paused: '[PAUSED]',
};

export const TaskRow = React.memo(function TaskRow({ task, isSelected, onToggle, className }: TaskRowProps) {
  const referenceTime = task.startedAt || task.queuedAt || Date.now();
  const elapsedMs = Date.now() - referenceTime;
  const minutes = Math.floor(elapsedMs / 60000);
  const seconds = Math.floor((elapsedMs % 60000) / 1000);
  const elapsed = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  const displayName = task.name || 'Unnamed Task';

  return (
    <div
      role="checkbox"
      aria-checked={isSelected}
      aria-label={`Select task: ${displayName}`}
      tabIndex={0}
      className={cn(
        'h-[60px] px-3 py-2 flex items-start gap-2 border-b border-border last:border-none cursor-pointer',
        'hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
        isSelected && 'bg-muted/30',
        className
      )}
      onClick={() => onToggle(task.id)}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          onToggle(task.id);
        }
      }}
    >
      <div className="w-4 h-4 mt-1 flex-shrink-0">
        {isSelected ? (
          <CheckSquare className="w-4 h-4 text-destructive" />
        ) : (
          <Square className="w-4 h-4 text-muted-foreground" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-foreground font-mono truncate">
          {displayName}
        </div>
        <div className="flex items-center gap-2 mt-1">
          {task.state && phaseBadgeStyles[task.state] && (
            <span className={cn('text-2xs px-1.5 py-0.5 rounded-none uppercase font-mono', phaseBadgeStyles[task.state])}>
              {phaseBadgeLabels[task.state]}
            </span>
          )}
          <span className="text-muted-foreground">&bull;</span>
          <span className="text-2xs text-muted-foreground font-mono">{elapsed}</span>
        </div>
      </div>
    </div>
  );
});
