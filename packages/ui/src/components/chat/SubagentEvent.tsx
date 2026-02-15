/**
 * SubagentEvent - Inline subagent (Task) display for chat timeline (Task 084)
 *
 * Displays Task tool invocations as containers with:
 * - Dashed border in primary color
 * - Subagent type from input (Explore, Plan, Bash, etc.)
 * - Nested child tool calls
 * - Completion summary
 *
 * Follows STYLE_GUIDE.md:
 * - Zero radius (rounded-none)
 * - Monospace font
 * - Dashed border for subagent containers
 * - Warm orange palette
 */

import { useState, memo } from 'react';
import { Users, ChevronRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { ProgressSpinner } from '../ui/ProgressSpinner';
import { cn, formatTime, tailwindClassToColor } from '../../lib/utils';
import { ToolCallEvent } from './ToolCallEvent';
import { ToolCallGroup } from './ToolCallGroup';
import type { ToolUseItem } from '../../hooks/useSessionMessages';

export interface SubagentEventProps {
  item: ToolUseItem;
  /** Child tools that belong to this subagent (parentToolUseId === item.id) */
  childTools: ToolUseItem[];
  /** Chat color preferences */
  colors?: { assistantColor?: string; systemColor?: string };
  /** Whether the session is actively processing (from processingSessions context) */
  isSessionProcessing?: boolean;
}

/**
 * Extract subagent type from Task input
 */
function getSubagentType(input: unknown): string {
  if (!input || typeof input !== 'object') return 'Agent';

  const data = input as Record<string, unknown>;

  // Check for subagent_type field (official field name)
  if (data.subagent_type && typeof data.subagent_type === 'string') {
    return capitalize(data.subagent_type);
  }

  // Check for type field (alternative)
  if (data.type && typeof data.type === 'string') {
    return capitalize(data.type);
  }

  // Check for description to infer type
  if (data.description && typeof data.description === 'string') {
    const desc = data.description.toLowerCase();
    if (desc.includes('explore')) return 'Explore';
    if (desc.includes('plan')) return 'Plan';
    if (desc.includes('bash') || desc.includes('command')) return 'Bash';
  }

  return 'Agent';
}

/**
 * Get prompt preview from Task input
 */
function getPromptPreview(input: unknown): string {
  if (!input || typeof input !== 'object') return '';

  const data = input as Record<string, unknown>;

  if (data.prompt && typeof data.prompt === 'string') {
    return truncate(data.prompt, 80);
  }

  if (data.description && typeof data.description === 'string') {
    return truncate(data.description, 80);
  }

  return '';
}

/**
 * Capitalize first letter
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Truncate string with ellipsis
 */
function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + '...';
}

/**
 * SubagentEvent component - Displays a Task subagent with nested tools
 *
 * Design: Colored Rail style with containment border
 * - Uses assistant color for subagent tasks (shade of agent color)
 * - Dashed outer border for visual containment of nested tools
 * - Consistent header layout with timestamp + task type
 */
export const SubagentEvent = memo(function SubagentEvent({
  item,
  childTools,
  colors,
  isSessionProcessing = true, // Default true for backwards compat
}: SubagentEventProps) {
  const [expanded, setExpanded] = useState(true); // Default expanded to show child tools

  // 140-thinking-ui-fix: Only show as running if BOTH:
  // 1. Tool status is 'running' AND
  // 2. Session is still processing (from processingSessions context)
  // This prevents stale spinners when session processing ends but tool_result never arrived
  const isRunning = item.status === 'running' && isSessionProcessing;
  const isError = item.status === 'error';
  const isComplete = item.status === 'complete';

  const subagentType = getSubagentType(item.input);
  const promptPreview = getPromptPreview(item.input);

  // Subagent uses assistant color (shade of agent color) - default to sky/blue
  const assistantTextColor = colors?.assistantColor || 'text-sky-600 dark:text-sky-400';
  const assistantBorderCss = tailwindClassToColor(assistantTextColor);

  // Border color based on status - running uses progress color (violet)
  const borderColor = isError
    ? '#dc2626' // red-600
    : isRunning
      ? 'hsl(270 75% 55%)' // progress color
      : assistantBorderCss;

  return (
    <div
      className={cn(
        'font-mono border-l-[3px] pl-2 py-1.5',
        // Dashed outline for containment (subagents contain nested tools)
        'border border-dashed border-border/40 ml-0',
      )}
      style={{ borderLeftColor: borderColor }}
    >
      {/* Header: Timestamp + Task Type + Status */}
      <div className="flex items-center gap-3 mb-1">
        <span className="text-2xs text-muted-foreground/60 select-none">
          {formatTime(item.timestamp)}
        </span>

        <Users className={cn('w-3 h-3', isError ? 'text-destructive' : assistantTextColor)} />

        <span
          className={cn(
            'text-xs font-bold uppercase tracking-wider',
            isError ? 'text-destructive' : assistantTextColor,
          )}
        >
          TASK:{subagentType}
        </span>

        {/* Status indicator */}
        {isRunning && <ProgressSpinner size="xs" label="running" />}
        {isComplete && item.elapsedMs !== undefined && (
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3 h-3 text-success" />
            <span className="text-2xs text-muted-foreground/60">
              {(item.elapsedMs / 1000).toFixed(1)}s
            </span>
          </div>
        )}
        {isError && (
          <div className="flex items-center gap-1.5">
            <AlertCircle className="w-3 h-3 text-destructive" />
          </div>
        )}
      </div>

      {/* Prompt preview (expandable) */}
      {promptPreview && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full text-left text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2 mb-2"
        >
          <ChevronRight className={cn(
            'w-3 h-3 text-muted-foreground/50 transition-transform duration-150',
            expanded && 'rotate-90'
          )} />
          <span className="truncate">{promptPreview}</span>
        </button>
      )}

      {/* Nested tool calls (174-collapsed-tool-cards: group when 2+) */}
      {expanded && childTools.length === 1 && (
        <div className="space-y-1 mt-2 ml-1 animate-in fade-in slide-in-from-top-1 duration-150">
          <ToolCallEvent item={childTools[0]} isNested colors={colors ? { systemColor: colors.systemColor } : undefined} />
        </div>
      )}
      {expanded && childTools.length >= 2 && (
        <div className="mt-2 ml-1 animate-in fade-in slide-in-from-top-1 duration-150">
          <ToolCallGroup items={childTools} isNested colors={colors ? { systemColor: colors.systemColor } : undefined} />
        </div>
      )}

      {/* Activity indicator when running (137-thinking-spinner-fix) */}
      {/* Always show when running, regardless of whether tools exist yet */}
      {expanded && isRunning && (
        <div className="mt-2">
          <ProgressSpinner
            size="sm"
            label={childTools.length === 0 ? 'Subagent working...' : 'Subagent still working...'}
          />
        </div>
      )}

      {/* Completion summary */}
      {isComplete && childTools.length > 0 && (
        <div className="mt-2 text-2xs text-muted-foreground/60">
          Completed with {childTools.length} tool call{childTools.length !== 1 ? 's' : ''}
        </div>
      )}

      {/* Error message */}
      {isError && item.error && (
        <div className="mt-2 text-xs text-destructive">
          {item.error}
        </div>
      )}
    </div>
  );
});

export default SubagentEvent;
