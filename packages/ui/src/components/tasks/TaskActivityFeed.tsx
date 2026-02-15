/**
 * TaskActivityFeed - Vertical timeline for task modal
 *
 * Design: Proper vertical timeline with turn-based grouping
 * - Each "turn" is a group of consecutive tool calls
 * - Shows summary count with expandable details
 * - Vertical line connecting events
 */

import { memo, useState, useMemo } from 'react';
import {
  Terminal,
  FileText,
  Search,
  Edit3,
  FolderOpen,
  ChevronDown,
  ChevronRight,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  MessageSquare,
  Wrench,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import type { TimelineItem, ToolUseItem, EmbeddedToolUse, UIChatMessage } from '../../hooks/useSessionMessages';

interface TaskActivityFeedProps {
  timeline: TimelineItem[];
  isLoading?: boolean;
  isActive?: boolean;
  liveProgress?: string | null;
}

// Tool icon mapping - using consistent sizes
const TOOL_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  bash: Terminal,
  read: FileText,
  write: Edit3,
  edit: Edit3,
  glob: FolderOpen,
  grep: Search,
  task: Clock,
  todowrite: Wrench,
};

// Format timestamp
const formatTime = (timestamp: number | string): string => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
};

// Extract tool name from full name (e.g., "mcp__server__bash" -> "bash")
const extractToolName = (fullName: string): string => {
  const parts = fullName.toLowerCase().split('__');
  return parts[parts.length - 1] || fullName;
};

// Convert EmbeddedToolUse to ToolUseItem format for rendering (131-tool-embedding)
function embeddedToolToItem(tool: EmbeddedToolUse, sessionId: string): ToolUseItem {
  return {
    itemType: 'tool_use',
    id: tool.id,
    sessionId,
    toolName: tool.toolName,
    input: tool.input,
    output: tool.output,
    error: tool.error,
    parentToolUseId: tool.parentToolUseId,
    elapsedMs: tool.elapsedMs,
    status: tool.status,
    timestamp: tool.timestamp,
    createdAt: tool.timestamp,
  };
}

// Group timeline into "turns" - each turn is a message followed by its tools
interface Turn {
  id: string;
  timestamp: number;
  type: 'message' | 'tools';
  message?: TimelineItem;
  tools: ToolUseItem[];
  hasErrors: boolean;
  isComplete: boolean;
}

function groupIntoTurns(timeline: TimelineItem[]): Turn[] {
  const turns: Turn[] = [];
  let currentTurn: Turn | null = null;

  for (const item of timeline) {
    if (item.itemType === 'message') {
      // Start a new turn with this message
      if (currentTurn) {
        turns.push(currentTurn);
      }
      currentTurn = {
        id: item.id,
        timestamp: new Date(item.createdAt || Date.now()).getTime(),
        type: 'message',
        message: item,
        tools: [],
        hasErrors: false,
        isComplete: true,
      };

      // Include embedded tools from the message (131-tool-embedding)
      const msg = item as UIChatMessage & { itemType: 'message' };
      if (msg.toolUses && msg.toolUses.length > 0) {
        for (const tool of msg.toolUses) {
          const toolItem = embeddedToolToItem(tool, msg.sessionId);
          currentTurn.tools.push(toolItem);
          if (tool.error) currentTurn.hasErrors = true;
          if (tool.status === 'running') currentTurn.isComplete = false;
        }
      }
    } else if (item.itemType === 'tool_use') {
      // Legacy: Add separate tool_use item to current turn or create new tools-only turn
      if (!currentTurn) {
        currentTurn = {
          id: `tools-${Date.now()}`,
          timestamp: item.timestamp,
          type: 'tools',
          tools: [],
          hasErrors: false,
          isComplete: true,
        };
      }
      currentTurn.tools.push(item);
      if (item.error) currentTurn.hasErrors = true;
      if (item.status === 'running') currentTurn.isComplete = false;
    }
  }

  if (currentTurn) {
    turns.push(currentTurn);
  }

  return turns;
}

// Single tool display (when expanded)
const ToolItem = memo(function ToolItem({ tool }: { tool: ToolUseItem }) {
  const [expanded, setExpanded] = useState(false);
  const toolName = extractToolName(tool.toolName || 'unknown');
  const Icon = TOOL_ICONS[toolName] || Wrench;
  const hasError = !!tool.error;
  const isRunning = tool.status === 'running';

  return (
    <div className="ml-6 border-l-2 border-border pl-4 py-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full text-left hover:bg-muted/30 -ml-2 px-2 py-1 transition-colors"
      >
        {/* Status indicator */}
        {isRunning ? (
          <Loader2 className="w-4 h-4 animate-spin text-progress flex-shrink-0" />
        ) : hasError ? (
          <XCircle className="w-4 h-4 text-destructive flex-shrink-0" />
        ) : (
          <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
        )}

        {/* Tool icon and name */}
        <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        <span className="text-xs font-mono uppercase">{toolName}</span>

        {/* Duration */}
        {tool.elapsedMs && (
          <span className="text-2xs text-muted-foreground ml-auto">
            {tool.elapsedMs > 1000 ? `${(tool.elapsedMs / 1000).toFixed(1)}s` : `${tool.elapsedMs}ms`}
          </span>
        )}

        {/* Expand icon */}
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="mt-2 space-y-2 text-xs">
          {/* Input */}
          {tool.input != null && (
            <div>
              <div className="text-2xs text-muted-foreground uppercase mb-1">Input</div>
              <pre className="font-mono bg-muted/30 p-2 overflow-x-auto max-h-[120px] overflow-y-auto border border-border">
                {typeof tool.input === 'string'
                  ? (tool.input as string).substring(0, 500)
                  : JSON.stringify(tool.input, null, 2).substring(0, 500)}
              </pre>
            </div>
          )}

          {/* Output */}
          {tool.output != null && (
            <div>
              <div className="text-2xs text-muted-foreground uppercase mb-1">Output</div>
              <pre className="font-mono bg-success/5 border border-success/20 p-2 overflow-x-auto max-h-[150px] overflow-y-auto text-success/80">
                {typeof tool.output === 'string'
                  ? (tool.output as string).substring(0, 1000)
                  : JSON.stringify(tool.output, null, 2).substring(0, 1000)}
              </pre>
            </div>
          )}

          {/* Error */}
          {tool.error && (
            <div>
              <div className="text-2xs text-destructive uppercase mb-1">Error</div>
              <pre className="font-mono bg-destructive/5 border border-destructive/20 p-2 overflow-x-auto max-h-[100px] overflow-y-auto text-destructive">
                {tool.error}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

// Turn component
const TurnItem = memo(function TurnItem({
  turn,
  isLast,
}: {
  turn: Turn;
  isLast: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const toolCount = turn.tools.length;
  const errorCount = turn.tools.filter(t => t.error).length;
  const runningCount = turn.tools.filter(t => t.status === 'running').length;

  // Count tools by type
  const toolCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const tool of turn.tools) {
      const name = extractToolName(tool.toolName || 'unknown');
      counts[name] = (counts[name] || 0) + 1;
    }
    return counts;
  }, [turn.tools]);

  const toolSummary = Object.entries(toolCounts)
    .map(([name, count]) => `${count} ${name}`)
    .join(', ');

  return (
    <div className="relative">
      {/* Timeline connector line */}
      {!isLast && (
        <div className="absolute left-[11px] top-8 bottom-0 w-0.5 bg-border" />
      )}

      {/* Turn content */}
      <div className="flex gap-4">
        {/* Timeline dot */}
        <div className="flex-shrink-0 relative z-10">
          <div
            className={cn(
              "w-6 h-6 rounded-full border-2 flex items-center justify-center bg-background",
              turn.hasErrors
                ? "border-destructive"
                : turn.isComplete
                ? "border-success"
                : "border-info"
            )}
          >
            {runningCount > 0 ? (
              <Loader2 className="w-3 h-3 animate-spin text-progress" />
            ) : turn.hasErrors ? (
              <XCircle className="w-3 h-3 text-destructive" />
            ) : turn.message ? (
              <MessageSquare className="w-3 h-3 text-success" />
            ) : (
              <Wrench className="w-3 h-3 text-success" />
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 pb-6">
          {/* Timestamp */}
          <div className="text-2xs text-muted-foreground mb-1">
            {formatTime(turn.timestamp)}
          </div>

          {/* Message content if present */}
          {turn.message && turn.message.itemType === 'message' && (
            <div className="text-sm mb-2 text-foreground">
              {turn.message.content?.substring(0, 200)}
              {turn.message.content && turn.message.content.length > 200 && '...'}
            </div>
          )}

          {/* Tools summary */}
          {toolCount > 0 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className={cn(
                "flex items-center gap-2 px-3 py-2 border w-full text-left transition-colors",
                turn.hasErrors
                  ? "border-destructive/30 bg-destructive/5 hover:bg-destructive/10"
                  : "border-border bg-muted/20 hover:bg-muted/40"
              )}
            >
              {/* Icon */}
              <Wrench className="w-4 h-4 text-muted-foreground flex-shrink-0" />

              {/* Count and summary */}
              <div className="flex-1 min-w-0">
                <span className="text-xs font-bold">
                  {toolCount} tool{toolCount !== 1 ? 's' : ''}
                </span>
                {errorCount > 0 && (
                  <span className="text-xs text-destructive ml-2">
                    ({errorCount} failed)
                  </span>
                )}
                <div className="text-2xs text-muted-foreground truncate">
                  {toolSummary}
                </div>
              </div>

              {/* Expand icon */}
              {expanded ? (
                <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              ) : (
                <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              )}
            </button>
          )}

          {/* Expanded tool list */}
          {expanded && turn.tools.map((tool) => (
            <ToolItem key={tool.id} tool={tool} />
          ))}
        </div>
      </div>
    </div>
  );
});

export const TaskActivityFeed = memo(function TaskActivityFeed({
  timeline,
  isLoading,
  isActive,
  liveProgress,
}: TaskActivityFeedProps) {
  const turns = useMemo(() => groupIntoTurns(timeline), [timeline]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-5 h-5 animate-spin text-progress mr-3" />
        <span className="text-sm text-progress-muted">Loading activity...</span>
      </div>
    );
  }

  if (turns.length === 0 && !isActive) {
    return (
      <div className="flex items-center justify-center p-8 text-muted-foreground">
        <Terminal className="w-5 h-5 mr-3 opacity-50" />
        <span className="text-sm">No activity yet</span>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {turns.map((turn, index) => (
        <TurnItem
          key={turn.id}
          turn={turn}
          isLast={index === turns.length - 1 && !isActive}
        />
      ))}

      {/* Live progress indicator */}
      {isActive && (
        <div className="relative">
          {/* Timeline connector */}
          <div className="absolute left-[11px] top-0 h-4 w-0.5 bg-border" />

          <div className="flex gap-4">
            {/* Animated dot */}
            <div className="flex-shrink-0 relative z-10">
              <div className="w-6 h-6 border-2 border-progress bg-background flex items-center justify-center">
                <Loader2 className="w-3 h-3 animate-spin text-progress" />
              </div>
            </div>

            {/* Progress message */}
            <div className="flex-1 pt-1">
              <div className="text-2xs text-muted-foreground mb-1">
                {formatTime(Date.now())}
              </div>
              <div className="text-sm text-progress">
                {liveProgress || 'Working...'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
