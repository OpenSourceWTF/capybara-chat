/**
 * ToolCallGroup - Collapsed view for multiple tool calls (174-collapsed-tool-cards)
 *
 * When an agent/subagent makes many tool calls, showing each one individually
 * creates visual noise. This component groups them into a single collapsed card:
 *
 * Collapsed: Shows count + last tool name/preview
 * Expanded:  Shows all individual ToolCallEvent cards
 *
 * Follows STYLE_GUIDE.md:
 * - Zero radius (rounded-none)
 * - Monospace font
 * - Warm orange palette
 * - IRC-style log format
 */

import { useState, memo, useMemo } from 'react';
import { ChevronRight, CheckCircle2, AlertCircle, Layers } from 'lucide-react';
import { ProgressSpinner } from '../ui/ProgressSpinner';
import { cn, formatTime, tailwindClassToColor } from '../../lib/utils';
import { ToolCallEvent } from './ToolCallEvent';
import type { ToolUseItem } from '../../hooks/useSessionMessages';

export interface ToolCallGroupProps {
  /** All tool call items in this group (must have length >= 2) */
  items: ToolUseItem[];
  /** Whether tools are nested inside a subagent */
  isNested?: boolean;
  /** Chat color preferences */
  colors?: { systemColor?: string };
}

/**
 * Get a short display name for a tool (strips common prefixes for readability)
 */
function getShortToolName(toolName: string): string {
  // MCP tools have long names like "mcp__capybara-huddle__prompt_get"
  // Show the last segment for brevity in the summary
  if (toolName.startsWith('mcp__')) {
    const parts = toolName.split('__');
    return parts[parts.length - 1]?.toUpperCase() || toolName;
  }
  return toolName;
}

/**
 * Compute aggregate status from a list of tools
 */
function getGroupStatus(items: ToolUseItem[]): 'running' | 'complete' | 'error' {
  if (items.some(i => i.status === 'error')) return 'error';
  if (items.some(i => i.status === 'running')) return 'running';
  return 'complete';
}

/**
 * ToolCallGroup component - Collapsible group of tool calls
 *
 * Design: Matches ToolCallEvent "Colored Rail" style but with a summary header.
 * Shows the last tool's info in the collapsed state since it's the most recent/relevant.
 */
export const ToolCallGroup = memo(function ToolCallGroup({
  items,
  isNested = false,
  colors,
}: ToolCallGroupProps) {
  const [expanded, setExpanded] = useState(false);

  const groupStatus = useMemo(() => getGroupStatus(items), [items]);
  const lastTool = items[items.length - 1];
  const completedCount = items.filter(i => i.status === 'complete').length;
  const errorCount = items.filter(i => i.status === 'error').length;

  const isRunning = groupStatus === 'running';
  const isError = groupStatus === 'error';

  // System color for tools
  const systemTextColor = colors?.systemColor || 'text-amber-600 dark:text-amber-400';
  const borderColor = isError
    ? '#dc2626'
    : tailwindClassToColor(systemTextColor);

  // Build summary text
  const summaryParts: string[] = [];
  if (completedCount > 0) summaryParts.push(`${completedCount} done`);
  if (errorCount > 0) summaryParts.push(`${errorCount} failed`);
  const runningCount = items.filter(i => i.status === 'running').length;
  if (runningCount > 0) summaryParts.push(`${runningCount} running`);

  return (
    <div
      className={cn(
        'font-mono border-l-[3px] pl-2 py-1.5 transition-colors hover:bg-muted/30',
        'animate-in fade-in slide-in-from-left-2 duration-200',
        isNested && 'ml-4',
      )}
      style={{ borderLeftColor: borderColor }}
    >
      {/* Collapsed summary header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left"
      >
        {/* Top line: timestamp + count + status */}
        <div className="flex items-center gap-3 mb-0.5">
          <span className="text-2xs text-muted-foreground/60 select-none">
            {formatTime(lastTool.timestamp)}
          </span>

          <Layers className={cn('w-3 h-3', isError ? 'text-destructive' : systemTextColor)} />

          <span
            className={cn(
              'text-xs font-bold uppercase tracking-wider',
              isError ? 'text-destructive' : systemTextColor,
            )}
          >
            {items.length} tool calls
          </span>

          {/* Status indicator */}
          {isRunning && <ProgressSpinner size="xs" />}
          {!isRunning && !isError && (
            <CheckCircle2 className="w-3 h-3 text-success" />
          )}
          {isError && (
            <AlertCircle className="w-3 h-3 text-destructive" />
          )}

          {/* Summary counts */}
          {summaryParts.length > 0 && (
            <span className="text-2xs text-muted-foreground/50">
              ({summaryParts.join(', ')})
            </span>
          )}
        </div>

        {/* Bottom line: last tool preview */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <ChevronRight className={cn(
            'w-3 h-3 text-muted-foreground/50 transition-transform duration-150 flex-shrink-0',
            expanded && 'rotate-90'
          )} />
          <span className={cn('text-2xs font-bold uppercase', systemTextColor)}>
            {getShortToolName(lastTool.toolName)}
          </span>
          <span className="truncate text-muted-foreground/70">
            {getInputPreviewShort(lastTool)}
          </span>
        </div>
      </button>

      {/* Expanded: show all tool calls */}
      {expanded && (
        <div className="mt-2 space-y-1 animate-in fade-in slide-in-from-top-1 duration-150">
          {items.map(tool => (
            <ToolCallEvent
              key={tool.id}
              item={tool}
              isNested
              colors={colors}
            />
          ))}
        </div>
      )}
    </div>
  );
});

/**
 * Short input preview for the summary line
 */
function getInputPreviewShort(item: ToolUseItem): string {
  if (!item.input || typeof item.input !== 'object') return '';

  const data = item.input as Record<string, unknown>;

  // Try common fields
  if (data.file_path) return String(data.file_path).split('/').pop() || '';
  if (data.pattern) return `"${truncate(String(data.pattern), 40)}"`;
  if (data.command) return `$ ${truncate(String(data.command), 40)}`;
  if (data.query) return `"${truncate(String(data.query), 40)}"`;
  if (data.url) return truncate(String(data.url), 40);
  if (data.prompt) return truncate(String(data.prompt), 40);

  // MCP tools often have descriptive first key
  const keys = Object.keys(data);
  if (keys.length > 0) {
    const firstVal = data[keys[0]];
    if (typeof firstVal === 'string') return truncate(firstVal, 40);
  }

  return '';
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + '...';
}

export default ToolCallGroup;
