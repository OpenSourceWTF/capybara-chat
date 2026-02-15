/**
 * TaskStopModal - Modal for selecting and stopping running tasks
 *
 * Displays a list of cancellable tasks with:
 * - STOP ALL button for bulk cancellation
 * - Individual task selection with STOP SELECTED
 * - Error display with RETRY FAILED option
 * - Keyboard support (Escape to close)
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { OctagonX, X } from 'lucide-react';
import type { WorkerTask } from '@capybara-chat/types';
import { TaskRow } from './TaskRow';

interface TaskStopModalProps {
  tasks: WorkerTask[];
  isOpen: boolean;
  onClose: () => void;
  onCancel: (taskIds: string[]) => Promise<void>;
  isCancelling: boolean;
  error: string | null;
  failedTasks: Array<{ id: string; name: string; error: string }>;
}

export function TaskStopModal({ tasks, isOpen, onClose, onCancel, isCancelling, error, failedTasks }: TaskStopModalProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const modalRef = useRef<HTMLDivElement>(null);

  // Reset selection when tasks change - remove selections for tasks no longer in list
  useEffect(() => {
    setSelectedIds(prev => {
      const validIds = new Set(tasks.map(t => t.id));
      const filtered = new Set([...prev].filter(id => validIds.has(id)));
      return filtered.size === prev.size ? prev : filtered;
    });
  }, [tasks]);

  // Auto-close when no tasks left
  useEffect(() => {
    if (isOpen && tasks.length === 0 && !isCancelling) {
      const timer = setTimeout(onClose, 500);
      return () => clearTimeout(timer);
    }
  }, [isOpen, tasks.length, isCancelling, onClose]);

  const handleToggle = useCallback((taskId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  }, []);

  const handleStopAll = useCallback(() => {
    onCancel(tasks.map(t => t.id));
  }, [tasks, onCancel]);

  const handleStopSelected = useCallback(() => {
    onCancel([...selectedIds]);
  }, [selectedIds, onCancel]);

  const handleRetryFailed = useCallback(() => {
    onCancel(failedTasks.map(t => t.id));
  }, [failedTasks, onCancel]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  if (!isOpen) return null;

  const selectedCount = selectedIds.size;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      onClick={onClose}
    >
      {/* Modal */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="stop-modal-header"
        className="relative w-[400px] max-h-[500px] bg-card border border-border rounded-none shadow-lg font-mono flex flex-col"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        tabIndex={-1}
      >
        {/* Header */}
        <div
          id="stop-modal-header"
          className="h-12 px-4 flex items-center bg-muted/50 border-b border-border flex-shrink-0"
        >
          <span className="text-sm font-bold uppercase tracking-wider">
            STOP TASKS ({tasks.length})
          </span>
          <button
            className="ml-auto text-muted-foreground hover:text-foreground"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="bg-destructive/10 border-l-4 border-destructive px-4 py-3 flex-shrink-0">
            <p className="font-bold text-destructive text-[14px]">
              {error}
            </p>
            {failedTasks.length > 0 && (
              <ul className="mt-2 text-[14px] text-muted-foreground">
                {failedTasks.map(t => (
                  <li key={t.id}>&bull; {t.name}: {t.error}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Stop All Button */}
        <div className="px-4 pt-4 flex-shrink-0">
          <button
            className="h-10 w-full bg-destructive hover:bg-destructive/90 text-destructive-foreground text-xs uppercase tracking-wider font-mono flex items-center justify-center gap-2 rounded-none disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleStopAll}
            disabled={isCancelling}
          >
            <OctagonX className="w-4 h-4" />
            STOP ALL
          </button>
        </div>

        {/* Task List */}
        <div className="p-4 pt-2 overflow-y-auto flex-1 min-h-0 max-h-[300px]">
          {tasks.map(task => (
            <TaskRow
              key={task.id}
              task={task}
              isSelected={selectedIds.has(task.id)}
              onToggle={handleToggle}
            />
          ))}
        </div>

        {/* Footer */}
        <div className="h-14 px-4 py-2 bg-muted/30 border-t border-border flex justify-between gap-3 items-center flex-shrink-0">
          <button
            className="px-4 py-2 bg-muted hover:bg-muted/80 text-foreground text-xs uppercase tracking-wider font-mono rounded-none"
            onClick={onClose}
          >
            CANCEL
          </button>

          {failedTasks.length > 0 ? (
            <button
              className="px-4 py-2 bg-destructive hover:bg-destructive/90 text-destructive-foreground text-xs uppercase tracking-wider font-mono rounded-none disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleRetryFailed}
              disabled={isCancelling}
            >
              RETRY FAILED
            </button>
          ) : (
            <button
              className="px-4 py-2 bg-destructive hover:bg-destructive/90 text-destructive-foreground text-xs uppercase tracking-wider font-mono rounded-none disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleStopSelected}
              disabled={selectedCount === 0 || isCancelling}
            >
              STOP SELECTED ({selectedCount})
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
