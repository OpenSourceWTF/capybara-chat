/**
 * TaskStats - Quick stats strip for task modal
 *
 * Design: Horizontal bar showing key timing and progress metrics
 * Terminal aesthetic with monospace numbers
 */

import { memo } from 'react';
import { Clock, Timer, Repeat, Zap, DollarSign } from 'lucide-react';
import type { WorkerTask } from '@capybara-chat/types';
import { formatCost } from '../../lib/utils';

interface TaskStatsProps {
  task: WorkerTask;
  livePhase?: string | null;
}

export const TaskStats = memo(function TaskStats({ task, livePhase }: TaskStatsProps) {
  // Calculate duration
  const formatDuration = (): string => {
    if (!task.startedAt) return '--';
    const endTime = task.completedAt || Date.now();
    const durationMs = endTime - task.startedAt;
    const seconds = Math.floor(durationMs / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSec = seconds % 60;
    if (minutes < 60) return `${minutes}m ${remainingSec}s`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  };

  // Format date for display
  const formatTime = (timestamp?: number): string => {
    if (!timestamp) return '--';
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  const formatDateShort = (timestamp?: number): string => {
    if (!timestamp) return '--';
    const date = new Date(timestamp);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${month}-${day}`;
  };

  const currentPhase = livePhase || task.currentPhase;

  return (
    <div className="flex-shrink-0 border-b border-border px-4 py-2 bg-muted/10">
      <div className="flex items-center gap-6 text-2xs">
        {/* Started */}
        <div className="flex items-center gap-1.5">
          <Clock className="w-3 h-3 text-muted-foreground" />
          <span className="text-muted-foreground">Started:</span>
          <span className="font-bold font-mono">
            {formatDateShort(task.startedAt)} {formatTime(task.startedAt)}
          </span>
        </div>

        {/* Duration */}
        <div className="flex items-center gap-1.5">
          <Timer className="w-3 h-3 text-muted-foreground" />
          <span className="text-muted-foreground">Duration:</span>
          <span className="font-bold font-mono text-primary">{formatDuration()}</span>
        </div>

        {/* Iteration */}
        {task.iteration > 0 && (
          <div className="flex items-center gap-1.5">
            <Repeat className="w-3 h-3 text-muted-foreground" />
            <span className="text-muted-foreground">Iteration:</span>
            <span className="font-bold font-mono">{task.iteration}</span>
          </div>
        )}

        {/* Current phase */}
        {currentPhase && (
          <div className="flex items-center gap-1.5">
            <Zap className="w-3 h-3 text-muted-foreground" />
            <span className="text-muted-foreground">Phase:</span>
            <span className="font-bold font-mono uppercase">{currentPhase}</span>
          </div>
        )}

        {/* Cost */}
        {formatCost(task.sessionTotalCost) && (
          <div className="flex items-center gap-1.5">
            <DollarSign className="w-3 h-3 text-muted-foreground" />
            <span className="text-muted-foreground">Cost:</span>
            <span className="font-bold font-mono">{formatCost(task.sessionTotalCost)}</span>
          </div>
        )}
      </div>
    </div>
  );
});
