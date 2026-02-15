/**
 * StopButton - Button to stop running worker tasks
 *
 * For a single task, clicking cancels immediately.
 * For multiple tasks, clicking opens the TaskStopModal for selection.
 *
 * Hidden when no cancellable tasks exist.
 */

import { useState } from 'react';
import { StopCircle, Loader2 } from 'lucide-react';
import type { WorkerTask } from '@capybara-chat/types';
import { TaskStopModal } from './TaskStopModal';
import { cn } from '../../lib/utils';

interface StopButtonProps {
  cancellableTasks: WorkerTask[];
  onCancel: (taskIds: string[]) => Promise<void>;
  isCancelling: boolean;
  error?: string | null;
  failedTasks?: Array<{ id: string; name: string; error: string }>;
  className?: string;
}

export function StopButton({
  cancellableTasks,
  onCancel,
  isCancelling,
  error = null,
  failedTasks = [],
  className,
}: StopButtonProps) {
  const [modalOpen, setModalOpen] = useState(false);

  if (cancellableTasks.length === 0) return null;

  const isSingleTask = cancellableTasks.length === 1;

  const handleClick = () => {
    if (isCancelling) return;
    if (isSingleTask) {
      onCancel([cancellableTasks[0].id]);
    } else {
      setModalOpen(true);
    }
  };

  return (
    <>
      <button
        data-testid="stop-button"
        className={cn(
          'h-9 w-full bg-destructive text-destructive-foreground text-xs uppercase tracking-wider font-mono px-4 flex items-center gap-2 border-t border-border hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed rounded-none',
          'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          className
        )}
        onClick={handleClick}
        disabled={isCancelling}
        aria-label={`Stop ${cancellableTasks.length} running task${cancellableTasks.length === 1 ? '' : 's'}`}
        aria-busy={isCancelling}
      >
        {isCancelling ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            STOPPING...
          </>
        ) : (
          <>
            <StopCircle className="w-4 h-4" />
            STOP
            {!isSingleTask && (
              <span className="ml-auto bg-warning text-warning-foreground text-2xs px-1.5 py-0.5 uppercase rounded-none font-mono">
                [{cancellableTasks.length}]
              </span>
            )}
          </>
        )}
      </button>

      {!isSingleTask && (
        <TaskStopModal
          tasks={cancellableTasks}
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          onCancel={onCancel}
          isCancelling={isCancelling}
          error={error}
          failedTasks={failedTasks}
        />
      )}
    </>
  );
}
