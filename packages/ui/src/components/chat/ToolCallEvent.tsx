/**
 * ToolCallEvent - Inline tool call display for chat timeline (Task 084)
 *
 * Displays tool invocations with:
 * - Bracketed tag header [TOOL:Name]
 * - Elapsed time badge
 * - Expandable input preview
 * - Output/error display
 *
 * Follows STYLE_GUIDE.md:
 * - Zero radius (rounded-none)
 * - Monospace font
 * - Warm orange palette
 * - IRC-style log format
 */

import { useState, memo } from 'react';
import { ChevronRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import { ProgressSpinner } from '../ui/ProgressSpinner';
import { cn, formatTime, tailwindClassToColor } from '../../lib/utils';
import type { ToolUseItem } from '../../hooks/useSessionMessages';

export interface ToolCallEventProps {
  item: ToolUseItem;
  /** Whether this tool is nested inside a subagent (adds indentation) */
  isNested?: boolean;
  /** Chat color preferences */
  colors?: { systemColor?: string };
}

/**
 * Get smart preview for tool input based on tool type
 */
function getInputPreview(input: unknown, toolName: string): string {
  // Handle undefined/null explicitly - JSON.stringify(undefined) returns undefined, not a string
  if (input === undefined) return '(no input)';
  if (input === null) return 'null';
  if (typeof input !== 'object') {
    return JSON.stringify(input).slice(0, 80);
  }

  const data = input as Record<string, unknown>;

  switch (toolName) {
    case 'Read':
      return `file: "${data.file_path}"`;
    case 'Grep':
      return `pattern: "${data.pattern}"${data.path ? ` in ${data.path}` : ''}`;
    case 'Glob':
      return `pattern: "${data.pattern}"`;
    case 'Bash':
      return `$ ${truncate(String(data.command || ''), 60)}`;
    case 'Edit':
      return `file: "${data.file_path}"`;
    case 'Write':
      return `file: "${data.file_path}"`;
    case 'Task':
      return `prompt: "${truncate(String(data.prompt || ''), 60)}"`;
    case 'WebFetch':
      return `url: "${truncate(String(data.url || ''), 60)}"`;
    case 'WebSearch':
      return `query: "${truncate(String(data.query || ''), 60)}"`;
    default:
      return truncate(JSON.stringify(input), 80);
  }
}

/**
 * Truncate string with ellipsis
 */
function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + '...';
}

/**
 * Get output summary for display
 */
function getOutputSummary(output: unknown, _toolName: string): string {
  if (!output) return '';

  if (typeof output === 'string') {
    const lines = output.split('\n').length;
    if (lines > 1) {
      return `${lines} lines`;
    }
    return truncate(output, 60);
  }

  if (Array.isArray(output)) {
    return `${output.length} items`;
  }

  if (typeof output === 'object') {
    const keys = Object.keys(output as object);
    return `{${keys.slice(0, 3).join(', ')}${keys.length > 3 ? '...' : ''}}`;
  }

  return String(output).slice(0, 60);
}

/**
 * ToolCallEvent component - Displays a single tool invocation
 *
 * Design: Colored Rail style matching message blocks
 * - Uses system color for tool calls (from preferences)
 * - Consistent header layout with timestamp + tool name
 */
export const ToolCallEvent = memo(function ToolCallEvent({
  item,
  isNested = false,
  colors,
}: ToolCallEventProps) {
  const [inputExpanded, setInputExpanded] = useState(false);
  const [outputExpanded, setOutputExpanded] = useState(false);

  const isRunning = item.status === 'running';
  const isError = item.status === 'error';
  const isComplete = item.status === 'complete';

  const inputPreview = getInputPreview(item.input, item.toolName);
  const outputSummary = item.output ? getOutputSummary(item.output, item.toolName) : null;

  // System color for tools (136-timeout-spinner-issues: changed from emerald to amber
  // to match STYLE_GUIDE.md warm palette)
  const systemTextColor = colors?.systemColor || 'text-amber-600 dark:text-amber-400';

  // Border color based on status
  const borderColor = isError
    ? '#dc2626' // red-600
    : tailwindClassToColor(systemTextColor);

  return (
    <div
      className={cn(
        'font-mono border-l-[3px] pl-2 py-1.5 transition-colors hover:bg-muted/30',
        'animate-in fade-in slide-in-from-left-2 duration-200',
        isNested && 'ml-4',
      )}
      style={{ borderLeftColor: borderColor }}
    >
      {/* Header: Timestamp + Tool Name + Status */}
      <div className="flex items-center gap-3 mb-1">
        <span className="text-2xs text-muted-foreground/60 select-none">
          {formatTime(item.timestamp)}
        </span>
        <span
          className={cn(
            'text-xs font-bold uppercase tracking-wider',
            isError ? 'text-destructive' : systemTextColor,
          )}
        >
          TOOL:{item.toolName}
        </span>

        {/* Status indicator */}
        {isRunning && <ProgressSpinner size="xs" />}
        {isComplete && item.elapsedMs !== undefined && (
          <span className="text-2xs text-muted-foreground/60">
            {item.elapsedMs}ms
          </span>
        )}
        {isError && (
          <AlertCircle className="w-3 h-3 text-destructive" />
        )}
      </div>

      {/* Input preview (expandable) */}
      <button
        onClick={() => setInputExpanded(!inputExpanded)}
        className="w-full text-left text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2"
      >
        <ChevronRight className={cn(
          'w-3 h-3 text-muted-foreground/50 transition-transform duration-150',
          inputExpanded && 'rotate-90'
        )} />
        <span className="truncate">{inputPreview}</span>
      </button>

      {/* Expanded input JSON */}
      {inputExpanded && (
        <pre className="mt-2 p-2 bg-muted/50 text-2xs overflow-auto max-h-[200px] whitespace-pre-wrap border-l border-border animate-in fade-in slide-in-from-top-1 duration-150">
          {JSON.stringify(item.input, null, 2)}
        </pre>
      )}

      {/* Output summary (when complete) - 146: Made expandable to see full output */}
      {isComplete && outputSummary && (
        <>
          <button
            onClick={() => setOutputExpanded(!outputExpanded)}
            className="mt-1 w-full text-left flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronRight className={cn(
              'w-3 h-3 text-muted-foreground/50 transition-transform duration-150',
              outputExpanded && 'rotate-90'
            )} />
            <CheckCircle2 className="w-3 h-3 text-success" />
            <span>{outputSummary}</span>
          </button>
          {outputExpanded && item.output && (
            <pre className="mt-2 p-2 bg-muted/50 text-2xs overflow-auto max-h-[400px] whitespace-pre-wrap border-l border-border animate-in fade-in slide-in-from-top-1 duration-150">
              {typeof item.output === 'string' ? item.output : JSON.stringify(item.output, null, 2)}
            </pre>
          )}
        </>
      )}

      {/* Error message - 146: Made expandable for full error output */}
      {isError && item.error && (
        <>
          <button
            onClick={() => setOutputExpanded(!outputExpanded)}
            className="mt-1 w-full text-left flex items-center gap-2 text-xs text-destructive hover:text-destructive/80 transition-colors"
          >
            <ChevronRight className={cn(
              'w-3 h-3 text-destructive/50 transition-transform duration-150',
              outputExpanded && 'rotate-90'
            )} />
            <span className="truncate">{truncate(item.error, 80)}</span>
          </button>
          {outputExpanded && (
            <pre className="mt-2 p-2 bg-destructive/10 text-2xs overflow-auto max-h-[400px] whitespace-pre-wrap border-l border-destructive animate-in fade-in slide-in-from-top-1 duration-150 text-destructive">
              {item.error}
              {item.output != null && (
                '\n\n--- Output ---\n\n' + String(typeof item.output === 'string' ? item.output : JSON.stringify(item.output, null, 2))
              )}
            </pre>
          )}
        </>
      )}
    </div>
  );
});

export default ToolCallEvent;
