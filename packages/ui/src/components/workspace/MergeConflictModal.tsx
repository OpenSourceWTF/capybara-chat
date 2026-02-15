/**
 * MergeConflictModal - Display merge conflict details with resolution options
 *
 * Shows when a sync operation fails due to merge conflicts. Displays:
 * - Error message and suggestion
 * - List of conflicting files (scrollable)
 * - Action buttons: Reset to Remote (destructive) or Cancel (manual resolution)
 *
 * Follows the terminal-modal pattern with warning variant styling.
 */

import { GitMerge, FileWarning, RotateCcw, X } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface MergeConflictResult {
  success: false;
  error: string;
  conflicts: string[];
  suggestion?: string;
}

export interface MergeConflictModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** The conflict result from the sync operation */
  result: MergeConflictResult | null;
  /** Called when user clicks "Reset to Remote" */
  onReset: () => void;
  /** Called when user dismisses the modal */
  onClose: () => void;
  /** Whether reset action is in progress */
  isResetting?: boolean;
  /** Workspace name for context */
  workspaceName?: string;
}

export function MergeConflictModal({
  open,
  result,
  onReset,
  onClose,
  isResetting = false,
  workspaceName,
}: MergeConflictModalProps) {
  if (!open || !result) return null;

  const conflicts = result.conflicts || [];
  const hasConflicts = conflicts.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog - Terminal Modal style */}
      <div className="terminal-modal relative w-[520px] max-h-[80vh] flex flex-col overflow-hidden animate-slide-in-bottom">
        {/* Header */}
        <div className="terminal-modal-header">
          <div className="terminal-modal-header-bg" />

          <div className="terminal-modal-header-content">
            <div className="p-2.5 bg-background border border-border relative z-10 bg-warning/20">
              <GitMerge className="w-5 h-5 text-warning" />
            </div>
            <div className="flex-1 min-w-0 relative z-10">
              <h2 className="text-base font-bold uppercase tracking-wider text-foreground">
                Merge Conflict
              </h2>
              {workspaceName && (
                <p className="text-xs text-muted-foreground mt-0.5 truncate font-mono">
                  {workspaceName}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors relative z-10"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="terminal-modal-body flex-1 overflow-hidden flex flex-col">
          {/* Error message */}
          <div className="text-sm text-foreground/90 font-mono leading-relaxed mb-4">
            {result.error}
          </div>

          {/* Conflicts list */}
          {hasConflicts && (
            <div className="flex-1 min-h-0 flex flex-col">
              <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider mb-2">
                <FileWarning className="w-3.5 h-3.5 text-warning" />
                <span>Conflicting Files ({conflicts.length})</span>
              </div>
              <div className="flex-1 overflow-y-auto bg-muted/30 border border-border p-3 space-y-1.5 max-h-[240px]">
                {conflicts.map((file, i) => (
                  <div
                    key={i}
                    className={cn(
                      'flex items-center gap-2 px-2.5 py-1.5',
                      'bg-card border border-border-subtle',
                      'text-xs font-mono text-foreground/80',
                      'animate-slide-in-bottom'
                    )}
                    style={{ animationDelay: `${i * 30}ms` }}
                  >
                    <span className="w-1.5 h-1.5 bg-warning rounded-full shrink-0" />
                    <span className="truncate">{file}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Suggestion */}
          {result.suggestion && (
            <div className="mt-4 p-3 bg-muted/50 border border-border text-xs text-muted-foreground font-mono">
              <span className="text-primary font-semibold">Tip:</span>{' '}
              {result.suggestion}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-border bg-muted/30">
          <div className="text-xs text-muted-foreground font-mono">
            Resolve manually in your editor
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className={cn(
                'px-4 py-2 text-xs font-bold uppercase tracking-wider border transition-all flex items-center gap-1.5 rounded-none',
                'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
            >
              Cancel
            </button>
            <button
              onClick={onReset}
              disabled={isResetting}
              className={cn(
                'px-4 py-2 text-xs font-bold uppercase tracking-wider border transition-all flex items-center gap-1.5 rounded-none',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'bg-destructive text-destructive-foreground border-destructive hover:bg-destructive/90'
              )}
            >
              <RotateCcw className={cn('w-3.5 h-3.5', isResetting && 'animate-spin')} />
              {isResetting ? 'Resetting...' : 'Reset to Remote'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
