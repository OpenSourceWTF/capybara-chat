/**
 * SyncDropdown - Dropdown menu for sync strategy selection
 * 
 * Styled to match the WAAAH modal aesthetic with proper theming.
 */

import { GitMerge, GitBranch, RotateCcw } from 'lucide-react';
import type { SyncStrategy } from '../../hooks/useWorkspace';
import { cn } from '../../lib/utils';

interface SyncDropdownProps {
  show: boolean;
  hasConflicts: boolean;
  onSync: (strategy: SyncStrategy) => void;
  onResetClick?: () => void;
}

interface SyncOption {
  strategy: SyncStrategy;
  label: string;
  icon: React.ReactNode;
  description: string;
}

const syncOptions: SyncOption[] = [
  {
    strategy: 'merge',
    label: 'Merge',
    icon: <GitMerge className="w-4 h-4" />,
    description: 'Create a merge commit',
  },
  {
    strategy: 'rebase',
    label: 'Rebase',
    icon: <GitBranch className="w-4 h-4" />,
    description: 'Replay commits on top',
  },
];

export function SyncDropdown({ show, hasConflicts, onSync, onResetClick }: SyncDropdownProps) {
  if (!show) return null;

  return (
    <div className="sync-dropdown absolute right-0 top-full mt-2 z-50">
      {/* Dropdown container with GitHub modal styling */}
      <div className="bg-card border border-border shadow-lg overflow-hidden min-w-[200px] animate-in fade-in slide-in-from-top-2 duration-150">
        {/* Header */}
        <div className="px-3 py-2 border-b border-border bg-muted/50">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Sync Strategy
          </span>
        </div>

        {/* Options */}
        <div className="p-1">
          {syncOptions.map((option) => (
            <button
              key={option.strategy}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 text-left',
                'transition-all duration-150',
                'hover:bg-muted group'
              )}
              onClick={() => onSync(option.strategy)}
            >
              <div className="flex-shrink-0 p-1.5 bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                {option.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-foreground">
                  {option.label}
                </div>
                <div className="text-xs text-muted-foreground">
                  {option.description}
                </div>
              </div>
            </button>
          ))}

          {/* Conflict reset option */}
          {hasConflicts && (
            <>
              <div className="my-1 mx-2 border-t border-border" />
              <button
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 text-left',
                  'transition-all duration-150',
                  'hover:bg-destructive/10 group'
                )}
                onClick={onResetClick}
              >
                <div className="flex-shrink-0 p-1.5 bg-destructive/10 text-destructive group-hover:bg-destructive group-hover:text-destructive-foreground transition-colors">
                  <RotateCcw className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-destructive">
                    Reset
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Discard local changes
                  </div>
                </div>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
