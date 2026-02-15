/**
 * MessageList - Memoized message rendering for chat timelines
 *
 * Extracted from GeneralConversation to:
 * 1. Prevent re-renders of the entire message list on input changes
 * 2. Enable proper React.memo optimization
 * 3. Separate concerns between message display and chat orchestration
 *
 * UI Refresh: Added message grouping for consecutive same-role messages,
 * improved date separators, and refined visual density.
 */

import React, { RefObject, useState, useMemo, memo } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button, Markdown } from '../ui';
import { formatTime, formatDate, tailwindClassToColor } from '../../lib/utils';
import { highlightText } from './ChatSearchBar';
import { ToolCallEvent } from './ToolCallEvent';
import { ToolCallGroup } from './ToolCallGroup';
import { SubagentEvent } from './SubagentEvent';
import type { TimelineItem, UIChatMessage, SessionEvent, ToolUseItem, EmbeddedToolUse, ThinkingItem } from '../../hooks/useSessionMessages';

// Get event display text
function getEventText(event: SessionEvent): string {
  switch (event.type) {
    case 'opened':
      return 'Session started';
    case 'closed':
      return 'Session ended';
    case 'resumed':
      return 'Session resumed';
    case 'agent_assigned':
      return `Agent assigned${event.metadata?.agentName ? `: ${event.metadata.agentName}` : ''}`;
    case 'context_injected': {
      const entityType = (event.metadata?.entityType as string) || 'entity';
      const label = entityType.charAt(0).toUpperCase() + entityType.slice(1);
      return `${label} Editing`;
    }
    case 'error':
      return `Error: ${event.metadata?.message || 'Unknown error'}`;
    // 189-session-failure-ui: CLI lifecycle events
    case 'cli_halted': {
      const reason = event.metadata?.reason as string;
      const reasonText = reason === 'timeout' ? 'timed out' : reason === 'process_exit' ? 'process exited' : 'encountered an error';
      return `CLI ${reasonText} - send a message to resume`;
    }
    case 'cli_resuming':
      return 'Resuming CLI session...';
    case 'cli_context_reset':
      return 'CLI resume failed - starting fresh session';
    default:
      return event.type;
  }
}

// Check if we need a date separator
function needsDateSeparator(current: TimelineItem, prev: TimelineItem | undefined): boolean {
  if (!prev) return true;
  const currentDate = new Date(current.createdAt).toDateString();
  const prevDate = new Date(prev.createdAt).toDateString();
  return currentDate !== prevDate;
}

/**
 * Check if this message continues from the previous one (same role, close in time)
 * Used for message grouping - continuation messages hide their timestamp/role header.
 */
function isContinuation(current: TimelineItem, prev: TimelineItem | undefined): boolean {
  if (!prev) return false;
  if (current.itemType !== 'message' || prev.itemType !== 'message') return false;
  if (current.role !== prev.role) return false;
  // Within 2 minutes = continuation
  const gap = Math.abs(new Date(current.createdAt).getTime() - new Date(prev.createdAt).getTime());
  return gap < 120_000;
}

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

interface MessageListProps {
  timeline: TimelineItem[];
  messageRefs: RefObject<Map<string, HTMLDivElement>>;
  searchOpen: boolean;
  searchQuery: string;
  activeMatchMessageId: string | null;
  isThinking: boolean;
  thinkingPhrase: string;
  needsResend: boolean;
  onResend: () => void;
  messagesEndRef: RefObject<HTMLDivElement>;
  colors?: { userColor: string; assistantColor: string; systemColor: string };
  /** Whether the session is actively processing (140-thinking-ui-fix) */
  isSessionProcessing?: boolean;
  /** 143-system-prompt-display: System prompt/context injection to display at start of chat */
  systemPrompt?: string | null;
  /** 143-system-prompt-display: Agent name for display */
  agentName?: string | null;
}

/**
 * Memoized message list component
 * Only re-renders when timeline or search state changes
 */
export const MessageList = React.memo(function MessageList({
  timeline,
  messageRefs,
  searchOpen,
  searchQuery,
  activeMatchMessageId,
  isThinking,
  thinkingPhrase,
  needsResend,
  onResend,
  messagesEndRef,
  colors,
  isSessionProcessing,
  systemPrompt,
  agentName,
}: MessageListProps) {
  // Pre-compute child tools map for subagent rendering (Task 084)
  // Maps parentToolUseId -> array of child ToolUseItems
  // Includes both legacy separate tool_use items AND embedded tools from messages (131-tool-embedding)
  const childToolsMap = useMemo(() => {
    const map = new Map<string, ToolUseItem[]>();
    for (const item of timeline) {
      // Legacy separate tool_use items with parent
      if (item.itemType === 'tool_use' && item.parentToolUseId) {
        const existing = map.get(item.parentToolUseId) || [];
        existing.push(item);
        map.set(item.parentToolUseId, existing);
      }
      // Embedded tools in messages (131-tool-embedding)
      if (item.itemType === 'message' && item.toolUses) {
        for (const tool of item.toolUses) {
          if (tool.parentToolUseId) {
            const toolAsItem = embeddedToolToItem(tool, item.sessionId);
            const existing = map.get(tool.parentToolUseId) || [];
            existing.push(toolAsItem);
            map.set(tool.parentToolUseId, existing);
          }
        }
      }
    }
    return map;
  }, [timeline]);

  return (
    <div className="px-4 py-3">
      {/* 143-system-prompt-display: Show system prompt at start of chat */}
      {systemPrompt && (
        <SystemPromptEvent systemPrompt={systemPrompt} agentName={agentName} colors={colors} />
      )}

      {timeline.map((item, index) => {
        const prev = index > 0 ? timeline[index - 1] : undefined;
        const showDateSeparator = needsDateSeparator(item, prev);
        const continuation = !showDateSeparator && isContinuation(item, prev);

        // Skip tool_use items that have a parent (rendered inside SubagentEvent)
        if (item.itemType === 'tool_use' && item.parentToolUseId) {
          return null;
        }

        return (
          <div key={item.id} className="animate-in fade-in slide-in-from-bottom-1 duration-150">
            {/* Date separator */}
            {showDateSeparator && (
              <div className="date-separator">
                <span className="date-separator-label">
                  {formatDate(item.createdAt)}
                </span>
              </div>
            )}

            {/* Event */}
            {item.itemType === 'event' && (
              item.type === 'context_injected' ? (
                <ContextInjectedEvent event={item} colors={colors} />
              ) : (
                <div className="flex items-center justify-center my-4">
                  <div className="flex items-center gap-2 px-3 py-1 bg-muted/50 text-2xs font-mono text-muted-foreground border border-border/30">
                    <span className="text-muted-foreground/40">[</span>
                    <span>{getEventText(item)}</span>
                    <span className="text-muted-foreground/30">{formatTime(item.createdAt)}</span>
                    <span className="text-muted-foreground/40">]</span>
                  </div>
                </div>
              )
            )}

            {/* Thinking block - expandable reasoning content */}
            {item.itemType === 'thinking' && (
              <ThinkingBlock item={item} colors={colors} />
            )}

            {/* Message with embedded tools (131-tool-embedding) */}
            {item.itemType === 'message' && (
              <>
                <MessageBubble
                  message={item}
                  messageRefs={messageRefs}
                  searchOpen={searchOpen}
                  searchQuery={searchQuery}
                  isActiveMatch={activeMatchMessageId === item.id}
                  colors={colors}
                  isContinuation={continuation}
                />
                {/* Render embedded tools within the message (131-tool-embedding, 174-collapsed-tool-cards) */}
                {item.toolUses && item.toolUses.length > 0 && (
                  <EmbeddedToolsRenderer
                    toolUses={item.toolUses}
                    sessionId={item.sessionId}
                    childToolsMap={childToolsMap}
                    colors={colors}
                    isSessionProcessing={isSessionProcessing}
                  />
                )}
              </>
            )}

            {/* Legacy: Tool Use - Subagent (Task tool) - for backwards compat with old timeline data */}
            {item.itemType === 'tool_use' && item.toolName === 'Task' && (
              <SubagentEvent
                item={item}
                childTools={childToolsMap.get(item.id) || []}
                colors={colors}
                isSessionProcessing={isSessionProcessing}
              />
            )}

            {/* Legacy: Tool Use - Regular tool (not Task, not nested) - for backwards compat */}
            {item.itemType === 'tool_use' && item.toolName !== 'Task' && !item.parentToolUseId && (
              <ToolCallEvent item={item} colors={colors} />
            )}
          </div>
        );
      })}

      {/* Thinking/Processing indicator */}
      {isThinking && !needsResend && (
        <ThinkingIndicator phrase={thinkingPhrase} />
      )}

      {/* Resend option for failed/unprocessed messages */}
      {needsResend && (
        <div className="flex justify-end mt-4">
          <Button variant="destructive" size="sm" onClick={onResend}>
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Resend message</span>
          </Button>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
});

/**
 * EmbeddedToolsRenderer - Groups and renders tool calls within a message (174-collapsed-tool-cards)
 *
 * Splits embedded tools into Task (subagent) tools and regular tools.
 * Regular tools are grouped into a ToolCallGroup when there are 2+ of them.
 * Task tools are always rendered individually as SubagentEvent.
 *
 * This reduces visual noise when agents make many tool calls (e.g., 5 MCP reads).
 */
interface EmbeddedToolsRendererProps {
  toolUses: EmbeddedToolUse[];
  sessionId: string;
  childToolsMap: Map<string, ToolUseItem[]>;
  colors?: { userColor?: string; assistantColor?: string; systemColor?: string };
  isSessionProcessing?: boolean;
}

/**
 * A rendering segment: either a single Task tool or a group of consecutive regular tools.
 * This preserves the original tool ordering while grouping regular tools for collapse.
 */
type ToolSegment =
  | { type: 'task'; tool: EmbeddedToolUse }
  | { type: 'regular'; tools: ToolUseItem[] };

const EmbeddedToolsRenderer = memo(function EmbeddedToolsRenderer({
  toolUses,
  sessionId,
  childToolsMap,
  colors,
  isSessionProcessing,
}: EmbeddedToolsRendererProps) {
  // Group tools into segments preserving original order (174-collapsed-tool-cards)
  // Task tools are always individual segments; consecutive regular tools are grouped.
  // Example: [Read, Read, Task, Read, Write] -> [Group(Read,Read), Task, Group(Read,Write)]
  const segments = useMemo(() => {
    const result: ToolSegment[] = [];
    let currentRegular: ToolUseItem[] = [];

    const flushRegular = () => {
      if (currentRegular.length > 0) {
        result.push({ type: 'regular', tools: currentRegular });
        currentRegular = [];
      }
    };

    for (const tool of toolUses) {
      // Skip nested tools (rendered inside their parent SubagentEvent)
      if (tool.parentToolUseId) continue;

      if (tool.toolName === 'Task') {
        flushRegular();
        result.push({ type: 'task', tool });
      } else {
        currentRegular.push(embeddedToolToItem(tool, sessionId));
      }
    }
    flushRegular();

    return result;
  }, [toolUses, sessionId]);

  return (
    <div className="ml-2 mt-1 space-y-1">
      {segments.map((segment, i) => {
        if (segment.type === 'task') {
          const toolItem = embeddedToolToItem(segment.tool, sessionId);
          return (
            <SubagentEvent
              key={segment.tool.id}
              item={toolItem}
              childTools={childToolsMap.get(segment.tool.id) || []}
              colors={colors}
              isSessionProcessing={isSessionProcessing}
            />
          );
        }

        // Regular tools: single -> ToolCallEvent, 2+ -> ToolCallGroup
        const { tools } = segment;
        if (tools.length === 1) {
          return (
            <ToolCallEvent
              key={tools[0].id}
              item={tools[0]}
              colors={colors ? { systemColor: colors.systemColor } : undefined}
            />
          );
        }
        return (
          <ToolCallGroup
            key={`group-${i}`}
            items={tools}
            colors={colors ? { systemColor: colors.systemColor } : undefined}
          />
        );
      })}
    </div>
  );
});

/**
 * Individual message block - memoized for optimal re-rendering
 *
 * Design: "Colored Rail IRC" - Fuses IRC log format with modern visual hierarchy
 * - Left border colored by role for visual scanning
 * - Two-line layout: header (timestamp + role) and content
 * - Terminal aesthetic maintained: monospace, zero radius, warm palette
 *
 * UI Refresh: Added continuation grouping - consecutive same-role messages
 * collapse their header for better density and readability.
 */
interface MessageBubbleProps {
  message: UIChatMessage & { itemType: 'message' };
  messageRefs: RefObject<Map<string, HTMLDivElement>>;
  searchOpen: boolean;
  searchQuery: string;
  isActiveMatch: boolean;
  colors?: { userColor?: string; assistantColor?: string; systemColor?: string };
  /** Whether this message continues from the previous one (same role, close in time) */
  isContinuation?: boolean;
}

const MessageBubble = React.memo(function MessageBubble({
  message,
  messageRefs,
  searchOpen,
  searchQuery,
  isActiveMatch,
  colors,
  isContinuation = false,
}: MessageBubbleProps) {

  // Get text colors from preferences (with defaults)
  const userTextColor = colors?.userColor || 'text-orange-600 dark:text-orange-400';
  const assistantTextColor = colors?.assistantColor || 'text-sky-600 dark:text-sky-400';
  const systemTextColor = colors?.systemColor || 'text-emerald-600 dark:text-emerald-400';

  // Role styling configuration - use inline style for border color
  const roleConfig = {
    user: {
      label: 'USER',
      textColor: userTextColor,
      borderColor: tailwindClassToColor(userTextColor),
    },
    assistant: {
      label: 'CLAUDE',
      textColor: assistantTextColor,
      borderColor: tailwindClassToColor(assistantTextColor),
    },
    system: {
      label: 'SYSTEM',
      textColor: systemTextColor,
      borderColor: tailwindClassToColor(systemTextColor),
    },
  };

  const config = roleConfig[message.role] || roleConfig.system;

  return (
    <div
      ref={(el) => {
        if (el && messageRefs.current) messageRefs.current.set(message.id, el);
      }}
      className={`
        font-mono border-l-[3px] transition-colors group
        ${isContinuation ? 'pl-2 pt-0 pb-1' : 'pl-2 py-2'}
        hover:bg-muted/20
        ${isActiveMatch ? 'bg-yellow-500/15 hover:bg-yellow-500/20' : ''}
      `}
      style={{ borderLeftColor: isContinuation ? 'transparent' : config.borderColor }}
    >
      {/* Header: Timestamp + Role - hidden for continuations */}
      {!isContinuation && (
        <div className="flex items-center gap-3 mb-1">
          <span className="text-2xs text-muted-foreground/40 select-none tabular-nums">
            {formatTime(message.createdAt)}
          </span>
          <span className={`text-xs font-bold uppercase tracking-wider select-none ${config.textColor}`}>
            [{config.label}]
          </span>
          {/* Status badge for user messages */}
          {message.role === 'user' && message.status && message.status !== 'completed' && (
            <MessageStatusBadge status={message.status} />
          )}
        </div>
      )}

      {/* Continuation timestamp - shown on hover */}
      {isContinuation && (
        <span className="text-2xs text-muted-foreground/0 group-hover:text-muted-foreground/30 select-none tabular-nums transition-colors duration-200 absolute -left-0 ml-[-3px]"
          style={{ borderLeft: `3px solid ${config.borderColor}`, paddingLeft: '5px', opacity: 0 }}
        >
        </span>
      )}

      {/* Content */}
      <div className={`text-sm text-foreground leading-relaxed ${isContinuation ? 'pl-0' : ''}`}>
        {message.role === 'assistant' ? (
          <Markdown>{message.content}</Markdown>
        ) : (
          <span className="whitespace-pre-wrap break-words">
            {searchOpen && searchQuery
              ? highlightText(message.content, searchQuery, isActiveMatch)
              : message.content}
          </span>
        )}
      </div>
    </div>
  );
});

/**
 * Message status badge
 */
interface MessageStatusBadgeProps {
  status: string;
}

const MessageStatusBadge = React.memo(function MessageStatusBadge({ status }: MessageStatusBadgeProps) {
  const getStatusConfig = () => {
    switch (status) {
      case 'queued':
        return { classes: 'bg-progress/15 text-progress', text: 'QUEUED' };
      case 'processing':
        return { classes: 'bg-progress/15 text-progress', text: 'PROCESSING' };
      case 'failed':
        return { classes: 'bg-destructive/15 text-destructive', text: 'FAILED' };
      case 'sent':
        return { classes: 'bg-muted text-muted-foreground', text: 'SENT' };
      default:
        return { classes: 'bg-muted text-muted-foreground', text: '' };
    }
  };

  const config = getStatusConfig();
  if (!config.text) return null;

  return (
    <span className={`text-2xs font-mono font-bold px-1.5 py-0.5 uppercase tracking-wider ${config.classes}`}>
      [{config.text}]
    </span>
  );
});

/**
 * Context injected event - compact expandable indicator
 */
interface ContextInjectedEventProps {
  event: SessionEvent & { itemType: 'event' };
  colors?: { systemColor?: string };
}

// Format entity type for display (e.g., "prompt" -> "Prompt", "agentDefinition" -> "Agent Definition")
function formatEntityTypeLabel(entityType: string): string {
  // Handle camelCase like "agentDefinition" -> "Agent Definition"
  const spaced = entityType.replace(/([A-Z])/g, ' $1').trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

const ContextInjectedEvent = React.memo(function ContextInjectedEvent({ event, colors }: ContextInjectedEventProps) {
  const [expanded, setExpanded] = useState(false);
  const entityType = (event.metadata?.entityType as string) || 'entity';
  const entityId = event.metadata?.entityId as string | undefined;
  const contextPreview = event.metadata?.contextPreview as string | undefined;

  const entityLabel = formatEntityTypeLabel(entityType);
  const infoColor = colors?.systemColor || 'text-muted-foreground';


  return (
    <div className="flex justify-center my-3">
      <div className="max-w-md w-full">
        {/* Compact badge - clickable to expand */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center gap-2 px-3 py-2 border border-dashed border-border/50 hover:border-border hover:bg-muted/30 transition-colors text-left group"
        >
          <span className={`font-mono text-xs ${infoColor} transition-colors opacity-60 group-hover:opacity-100`}>
            [{expanded ? '-' : '+'}]
          </span>
          <span className={`font-mono text-xs font-bold ${infoColor} uppercase tracking-wider`}>
            [CONTEXT:{entityLabel.toUpperCase()}]
          </span>
          {entityId && (
            <span className="font-mono text-xs text-muted-foreground/40 transition-colors group-hover:text-foreground/60">
              {entityId.slice(0, 8)}
            </span>
          )}
          <div className="flex-1 border-b border-dashed border-border/20 mx-2" />
          <span className="font-mono text-2xs text-muted-foreground/30 flex-shrink-0">
            {formatTime(event.createdAt)}
          </span>
        </button>

        {/* Expanded context preview */}
        {expanded && (
          <div className="p-3 border-x border-b border-dashed border-border/50 text-xs bg-muted/20 animate-in fade-in slide-in-from-top-1 duration-150">
            <div className="flex items-center gap-2 mb-2 text-muted-foreground/50 font-mono text-2xs uppercase tracking-widest border-b border-border/20 pb-1">
              <span>&gt; SYSTEM_INJECTION_LOG</span>
            </div>
            {contextPreview ? (
              <pre className="whitespace-pre-wrap font-mono text-xs text-muted-foreground overflow-auto max-h-[300px] opacity-70">
                {contextPreview}
              </pre>
            ) : (
              <p className="font-mono text-muted-foreground/30 italic text-xs">
                // Full context payload hidden
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

/**
 * System prompt event - shows agent system prompt at start of chat (143-system-prompt-display)
 * Follows the ContextInjectedEvent pattern with configurable system color
 */
interface SystemPromptEventProps {
  systemPrompt: string;
  agentName?: string | null;
  colors?: { systemColor?: string };
}

const SystemPromptEvent = React.memo(function SystemPromptEvent({ systemPrompt, agentName, colors }: SystemPromptEventProps) {
  const [expanded, setExpanded] = useState(false);

  // Use configured system color (follows ContextInjectedEvent pattern)
  const promptColor = colors?.systemColor || 'text-emerald-600 dark:text-emerald-400';

  // Preview: first 100 chars or first line
  const previewText = useMemo(() => {
    const firstLine = systemPrompt.split('\n')[0];
    if (firstLine.length > 100) {
      return firstLine.slice(0, 100) + '...';
    }
    return firstLine + (systemPrompt.includes('\n') ? '...' : '');
  }, [systemPrompt]);

  return (
    <div className="flex justify-center my-3">
      <div className="max-w-md w-full">
        {/* Compact badge - clickable to expand */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center gap-2 px-3 py-2 border border-dashed border-border/50 hover:border-border hover:bg-muted/30 transition-colors text-left group"
        >
          <span className={`font-mono text-xs ${promptColor} transition-colors opacity-60 group-hover:opacity-100`}>
            [{expanded ? '-' : '+'}]
          </span>
          <span className={`font-mono text-xs font-bold ${promptColor} uppercase tracking-wider`}>
            [SYSTEM PROMPT]
          </span>
          {agentName && (
            <span className="font-mono text-xs text-muted-foreground/40 transition-colors group-hover:text-foreground/60">
              {agentName}
            </span>
          )}
          <div className="flex-1 border-b border-dashed border-border/20 mx-2" />
        </button>

        {/* Collapsed preview */}
        {!expanded && (
          <div className="px-3 py-1.5 border-x border-b border-dashed border-border/50 text-xs bg-muted/20">
            <p className="font-mono text-muted-foreground/40 text-xs truncate italic">
              {previewText}
            </p>
          </div>
        )}

        {/* Expanded full content */}
        {expanded && (
          <div className="p-3 border-x border-b border-dashed border-border/50 text-xs bg-muted/20 animate-in fade-in slide-in-from-top-1 duration-150">
            <div className={`flex items-center gap-2 mb-2 ${promptColor} font-mono text-2xs uppercase tracking-widest border-b border-border/20 pb-1 opacity-60`}>
              <span>&gt; AGENT_SYSTEM_PROMPT</span>
            </div>
            <pre className="whitespace-pre-wrap font-mono text-xs text-muted-foreground overflow-auto max-h-[400px] opacity-80">
              {systemPrompt}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
});

/**
 * Thinking indicator - terminal-style processing feedback
 */
interface ThinkingIndicatorProps {
  phrase: string;
}

const ThinkingIndicator = React.memo(function ThinkingIndicator({ phrase }: ThinkingIndicatorProps) {
  return (
    <div className="font-mono border-l-[3px] border-l-progress pl-2 py-2 animate-in fade-in slide-in-from-bottom-1 duration-150">
      {/* Header */}
      <div className="flex items-center gap-3 mb-1">
        <span className="text-2xs text-muted-foreground/40 select-none tabular-nums">
          {new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
        </span>
        <span className="text-xs font-bold uppercase tracking-wider text-progress">
          [CLAUDE]
        </span>
      </div>
      {/* Content with animated dots */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground/60">
        <span className="inline-flex gap-0.5">
          <span className="thinking-dot w-1 h-1 bg-progress" />
          <span className="thinking-dot w-1 h-1 bg-progress" />
          <span className="thinking-dot w-1 h-1 bg-progress" />
        </span>
        <span className="italic">{phrase}</span>
      </div>
    </div>
  );
});

/**
 * ThinkingBlock - Expandable display of Claude's extended thinking/reasoning content
 *
 * Follows the ContextInjectedEvent pattern: compact collapsed badge that expands
 * to show full thinking content. Uses --progress (teal) color scheme consistent
 * with the ThinkingIndicator and ActivityStatusBar thinking state.
 */
interface ThinkingBlockProps {
  item: ThinkingItem;
  colors?: { systemColor?: string };
}

const ThinkingBlock = React.memo(function ThinkingBlock({ item }: ThinkingBlockProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="flex justify-center my-3">
      <div className="max-w-md w-full">
        {/* Compact badge - clickable to expand */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center gap-2 px-3 py-2 border border-dashed border-progress/30 hover:border-progress/60 hover:bg-progress/5 transition-colors text-left group"
        >
          <span className="font-mono text-xs text-progress/60 transition-colors opacity-60 group-hover:opacity-100">
            [{expanded ? '-' : '+'}]
          </span>
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-progress">
            [THINKING]
          </span>
          <div className="flex-1 border-b border-dashed border-progress/20 mx-2" />
          <span className="font-mono text-2xs text-muted-foreground/30 flex-shrink-0">
            {formatTime(item.createdAt)}
          </span>
        </button>

        {/* Expanded thinking content */}
        {expanded && (
          <div className="p-3 border-x border-b border-dashed border-progress/30 text-xs bg-progress/5 animate-in fade-in slide-in-from-top-1 duration-150">
            <div className="flex items-center gap-2 mb-2 text-progress/50 font-mono text-2xs uppercase tracking-widest border-b border-progress/20 pb-1">
              <span>&gt; EXTENDED_THINKING</span>
            </div>
            <pre className="whitespace-pre-wrap font-mono text-xs text-muted-foreground overflow-auto max-h-[300px] opacity-70">
              {item.content}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
});
