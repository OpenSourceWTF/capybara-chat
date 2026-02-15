/**
 * TaskMetadata - Metadata grid for task modal
 *
 * Design: Terminal-style 2-column grid showing task configuration
 * Collapsible section for clean initial view
 */

import { memo, useState } from 'react';
import { ChevronDown, ChevronUp, GitBranch, Package, Database, Wrench, Settings, ExternalLink, DollarSign } from 'lucide-react';
import type { WorkerTask } from '@capybara-chat/types';
import { cn, formatCost } from '../../lib/utils';

interface TaskMetadataProps {
  task: WorkerTask;
  specName?: string;
  workspaceName?: string;
  techniqueName?: string;
  /** Callback to navigate to spec view */
  onViewSpec?: (specId: string) => void;
}

interface MetadataRowProps {
  icon: React.ReactNode;
  label: string;
  value: string | React.ReactNode;
  mono?: boolean;
  link?: string;
  onClick?: () => void;
}

const MetadataRow = memo(function MetadataRow({ icon, label, value, mono = true, link, onClick }: MetadataRowProps) {
  const valueContent = (
    <span className={cn("text-foreground", mono && "font-mono")}>
      {value}
    </span>
  );

  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="text-muted-foreground flex-shrink-0">{icon}</span>
      <span className="text-xs text-muted-foreground uppercase tracking-wider w-24 flex-shrink-0 font-bold">
        {label}
      </span>
      {link ? (
        <a
          href={link}
          className="text-sm text-primary hover:underline flex items-center gap-1"
          target="_blank"
          rel="noopener noreferrer"
        >
          {valueContent}
          <ExternalLink className="w-4 h-4" />
        </a>
      ) : onClick ? (
        <button
          onClick={onClick}
          className="text-sm text-primary hover:underline flex items-center gap-1 text-left"
        >
          {valueContent}
        </button>
      ) : (
        <span className="text-sm truncate">{valueContent}</span>
      )}
    </div>
  );
});

export const TaskMetadata = memo(function TaskMetadata({
  task,
  specName,
  workspaceName,
  techniqueName,
  onViewSpec,
}: TaskMetadataProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-b border-border">
      {/* Toggle header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/10 transition-colors text-left"
      >
        <Settings className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex-1">
          Task Details
        </span>
        {expanded ? (
          <ChevronUp className="w-5 h-5 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-5 h-5 text-muted-foreground" />
        )}
      </button>

      {/* Expanded metadata */}
      {expanded && (
        <div className="px-4 pb-4 space-y-2">
          {/* Primary metadata */}
          <div className="grid grid-cols-2 gap-x-6">
            <MetadataRow
              icon={<Package className="w-4 h-4" />}
              label="Spec"
              value={specName || task.specId.substring(0, 8)}
              onClick={onViewSpec ? () => onViewSpec(task.specId) : undefined}
            />
            <MetadataRow
              icon={<Database className="w-4 h-4" />}
              label="Workspace"
              value={workspaceName || task.workspaceId.substring(0, 8)}
            />
            <MetadataRow
              icon={<Wrench className="w-4 h-4" />}
              label="Technique"
              value={techniqueName || task.techniqueId}
            />
            {task.branchName && (
              <MetadataRow
                icon={<GitBranch className="w-4 h-4" />}
                label="Branch"
                value={task.branchName}
              />
            )}
            {formatCost(task.sessionTotalCost) && (
              <MetadataRow
                icon={<DollarSign className="w-4 h-4" />}
                label="Cost"
                value={formatCost(task.sessionTotalCost) || '--'}
              />
            )}
          </div>

          {/* Model overrides if present */}
          {task.modelOverride && (
            <div className="pt-3 mt-3 border-t border-border/50">
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2 font-bold">
                Model Override
              </div>
              <span className="text-sm font-mono bg-muted/30 px-2 py-1 border border-border">
                {task.modelOverride}
              </span>
            </div>
          )}

          {/* Paths if present */}
          {(task.worktreePath || task.artifactPath) && (
            <div className="pt-3 mt-3 border-t border-border/50 space-y-2">
              <div className="text-xs text-muted-foreground uppercase tracking-wider font-bold">
                Paths
              </div>
              {task.worktreePath && (
                <div className="text-xs font-mono text-muted-foreground truncate">
                  <span className="text-foreground">worktree:</span> {task.worktreePath}
                </div>
              )}
              {task.artifactPath && (
                <div className="text-xs font-mono text-muted-foreground truncate">
                  <span className="text-foreground">artifacts:</span> {task.artifactPath}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
});
