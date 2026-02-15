/**
 * SessionActivityPanel - Unified view of session activity
 *
 * Displays:
 * - Memories: Agent observations, decisions, context
 * - Created: Entities created during this session (specs, docs, prompts, etc.)
 * - Graph: Visual timeline of session activity (future)
 *
 * Following "Cozy Terminal" design: monospace, warm colors, zero radius
 */

import { useState, useMemo } from 'react';
import { Brain, Layers, GitBranch, FileText, BookOpen, Workflow, Bot, Search, X, User, MessageSquare, Wrench, AlertCircle, CheckCircle, Loader2, Zap, Activity } from 'lucide-react';
import { MemoryTimeline } from './MemoryTimeline';
import { SessionPipelineLogs } from './SessionPipelineLogs';
import { SessionPipelineStatus } from './SessionPipelineStatus';
import { useSessionPipelineEvents } from '../../hooks/useSessionPipelineEvents';
import { formatTime, formatDate } from '../../lib/utils';
import { Input } from '../ui';
import type { Document } from '@capybara-chat/types';
import type { SessionCreatedEntity, SessionEntityCounts } from '../../hooks/useSessionCreatedEntities';
import type { TimelineItem, UIChatMessage, ToolUseItem, SessionEvent, EmbeddedToolUse } from '../../hooks/useSessionMessages';

type TabId = 'memories' | 'created' | 'graph' | 'pipeline';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ElementType;
  badge?: number;
}

export interface SessionActivityPanelProps {
  /** Session ID for pipeline events */
  sessionId: string;

  /** Session memories */
  memories: Document[];
  memoriesLoading?: boolean;
  memoriesError?: string | null;
  memoryCount?: number;
  memorySearchQuery?: string;
  onMemorySearchChange?: (query: string) => void;

  /** Session created entities */
  entities: SessionCreatedEntity[];
  entitiesLoading?: boolean;
  entitiesError?: string | null;
  entityCounts?: SessionEntityCounts;

  /** Session timeline (messages, tool uses, events) */
  timeline?: TimelineItem[];
  timelineLoading?: boolean;

  /** Called when user clicks an entity to navigate */
  onEntityClick?: (entity: SessionCreatedEntity) => void;
  onMemoryClick?: (memory: Document) => void;
}

/**
 * SessionActivityPanel - Tabbed view of session memories and created entities
 */
export function SessionActivityPanel({
  sessionId,
  memories,
  memoriesLoading = false,
  memoriesError = null,
  memoryCount = 0,
  memorySearchQuery = '',
  onMemorySearchChange,
  entities,
  entitiesLoading = false,
  entitiesError = null,
  entityCounts,
  timeline = [],
  timelineLoading = false,
  onEntityClick,
  onMemoryClick,
}: SessionActivityPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>('graph');

  // Listen to pipeline events for real-time updates (Phase 4)
  const { logs, stages, pipelineStatus } = useSessionPipelineEvents(sessionId);

  const tabs: Tab[] = useMemo(() => [
    { id: 'graph', label: 'GRAPH', icon: GitBranch },
    { id: 'memories', label: 'MEMORIES', icon: Brain, badge: memoryCount },
    { id: 'created', label: 'CREATED', icon: Layers, badge: entities.length },
    { id: 'pipeline', label: 'PIPELINE', icon: Activity, badge: logs.length > 0 ? logs.length : undefined },
  ], [memoryCount, entities.length, logs.length]);

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex border-b border-border bg-muted/30">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              flex items-center gap-1.5 px-3 py-2 text-2xs font-mono uppercase tracking-widest
              transition-colors border-b-2 -mb-px
              ${activeTab === tab.id
                ? 'text-primary border-primary bg-background'
                : 'text-muted-foreground border-transparent hover:text-foreground hover:bg-muted/50'
              }
            `}
          >
            <tab.icon className="w-3 h-3" />
            <span>{tab.label}</span>
            {tab.badge !== undefined && tab.badge > 0 && (
              <span className={`
                text-2xs px-1 min-w-[1.25rem] text-center
                ${activeTab === tab.id ? 'text-primary' : 'text-muted-foreground'}
              `}>
                [{tab.badge}]
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === 'memories' && (
          <MemoryTimeline
            memories={memories}
            loading={memoriesLoading}
            error={memoriesError}
            showSearch={true}
            searchQuery={memorySearchQuery}
            onSearchChange={onMemorySearchChange}
            onMemoryClick={onMemoryClick}
            emptyMessage="No memories yet. Agents save context using memory_create."
          />
        )}

        {activeTab === 'created' && (
          <CreatedEntitiesView
            entities={entities}
            loading={entitiesLoading}
            error={entitiesError}
            counts={entityCounts}
            onEntityClick={onEntityClick}
          />
        )}

        {activeTab === 'graph' && (
          <SessionGraphView
            memories={memories}
            entities={entities}
            timeline={timeline}
            loading={timelineLoading}
          />
        )}

        {activeTab === 'pipeline' && (
          <div className="h-full grid grid-cols-2 divide-x divide-border">
            {/* Pipeline Status - Left side */}
            <div className="h-full overflow-hidden">
              <SessionPipelineStatus
                stages={stages}
                pipelineStatus={pipelineStatus}
              />
            </div>

            {/* Pipeline Logs - Right side */}
            <div className="h-full overflow-hidden">
              <SessionPipelineLogs logs={logs} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Icon for entity type
 */
function getEntityIcon(type: SessionCreatedEntity['entityType']): React.ElementType {
  switch (type) {
    case 'spec': return FileText;
    case 'document': return BookOpen;
    case 'prompt': return FileText;
    case 'pipeline': return Workflow;
    case 'agent_definition': return Bot;
    default: return FileText;
  }
}

/**
 * Color class for entity type
 */
function getEntityColor(type: SessionCreatedEntity['entityType']): string {
  switch (type) {
    case 'spec': return 'text-amber-600 dark:text-amber-400';
    case 'document': return 'text-sky-600 dark:text-sky-400';
    case 'prompt': return 'text-emerald-600 dark:text-emerald-400';
    case 'pipeline': return 'text-purple-600 dark:text-purple-400';
    case 'agent_definition': return 'text-rose-600 dark:text-rose-400';
    default: return 'text-muted-foreground';
  }
}

/**
 * Label for entity type
 */
function getEntityLabel(type: SessionCreatedEntity['entityType']): string {
  switch (type) {
    case 'spec': return 'SPEC';
    case 'document': return 'DOC';
    case 'prompt': return 'PROMPT';
    case 'pipeline': return 'PIPELINE';
    case 'agent_definition': return 'AGENT';
    default: return 'ITEM';
  }
}

/**
 * Check if we need a date separator
 */
function needsDateSeparator(current: SessionCreatedEntity, prev: SessionCreatedEntity | undefined): boolean {
  if (!prev) return true;
  const currentDate = new Date(current.createdAt).toDateString();
  const prevDate = new Date(prev.createdAt).toDateString();
  return currentDate !== prevDate;
}

interface CreatedEntitiesViewProps {
  entities: SessionCreatedEntity[];
  loading?: boolean;
  error?: string | null;
  counts?: SessionEntityCounts;
  onEntityClick?: (entity: SessionCreatedEntity) => void;
}

/**
 * Created entities list view
 */
function CreatedEntitiesView({
  entities,
  loading = false,
  error = null,
  counts,
  onEntityClick,
}: CreatedEntitiesViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<SessionCreatedEntity['entityType'] | 'all'>('all');

  // Filter entities by search and type
  const filteredEntities = useMemo(() => {
    return entities.filter((entity) => {
      const matchesSearch = !searchQuery.trim() ||
        entity.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = filterType === 'all' || entity.entityType === filterType;
      return matchesSearch && matchesType;
    });
  }, [entities, searchQuery, filterType]);

  // Loading state
  if (loading && entities.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <div className="flex items-center gap-2 font-mono text-sm">
          <span className="animate-pulse">[...]</span>
          <span>Loading entities...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="font-mono text-sm text-destructive">
          [ERROR] {error}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header with search and type filter */}
      <div className="flex items-center gap-2 p-2 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2 text-2xs font-mono text-muted-foreground uppercase tracking-widest">
          <Layers className="w-3 h-3" />
          <span>SESSION_OUTPUT</span>
          <span className="text-primary">[{filteredEntities.length}]</span>
        </div>
        <div className="flex-1" />

        {/* Type filter buttons */}
        <div className="flex items-center gap-0.5 text-2xs font-mono">
          {(['all', 'spec', 'document', 'prompt', 'pipeline', 'agent_definition'] as const).map((type) => {
            const count = type === 'all' ? entities.length : entities.filter(e => e.entityType === type).length;
            if (type !== 'all' && count === 0) return null;

            return (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`
                  px-1.5 py-0.5 uppercase transition-colors
                  ${filterType === type
                    ? 'text-primary bg-primary/10'
                    : 'text-muted-foreground hover:text-foreground'
                  }
                `}
              >
                {type === 'all' ? 'ALL' : getEntityLabel(type)}
                {count > 0 && <span className="ml-0.5 opacity-60">{count}</span>}
              </button>
            );
          })}
        </div>

        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
          <Input
            variant="terminal"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search..."
            className="h-6 pl-7 pr-7 w-28 text-xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Entities list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        {filteredEntities.length === 0 ? (
          <EmptyCreatedState
            message={searchQuery || filterType !== 'all'
              ? 'No entities match your filter.'
              : 'No entities created in this session yet.'
            }
          />
        ) : (
          filteredEntities.map((entity, index) => {
            const prev = index > 0 ? filteredEntities[index - 1] : undefined;
            const showDateSeparator = needsDateSeparator(entity, prev);

            return (
              <div key={`${entity.entityType}-${entity.id}`}>
                {showDateSeparator && <DateSeparator date={entity.createdAt} />}
                <CreatedEntityItem entity={entity} onClick={() => onEntityClick?.(entity)} />
              </div>
            );
          })
        )}
      </div>

      {/* Summary footer */}
      {counts && entities.length > 0 && (
        <div className="flex items-center gap-3 px-3 py-2 border-t border-border bg-muted/30 text-2xs font-mono text-muted-foreground">
          {counts.specs > 0 && <span><span className="text-amber-600">{counts.specs}</span> specs</span>}
          {counts.documents > 0 && <span><span className="text-sky-600">{counts.documents}</span> docs</span>}
          {counts.prompts > 0 && <span><span className="text-emerald-600">{counts.prompts}</span> prompts</span>}
          {counts.pipelines > 0 && <span><span className="text-purple-600">{counts.pipelines}</span> pipelines</span>}
          {counts.agentDefinitions > 0 && <span><span className="text-rose-600">{counts.agentDefinitions}</span> agents</span>}
        </div>
      )}
    </div>
  );
}

/**
 * Individual created entity item
 */
interface CreatedEntityItemProps {
  entity: SessionCreatedEntity;
  onClick?: () => void;
}

function CreatedEntityItem({ entity, onClick }: CreatedEntityItemProps) {
  const Icon = getEntityIcon(entity.entityType);
  const colorClass = getEntityColor(entity.entityType);
  const label = getEntityLabel(entity.entityType);

  return (
    <button
      onClick={onClick}
      className={`
        w-full flex items-start gap-2 font-mono border-l-[3px] pl-2 py-1.5
        hover:bg-muted/30 transition-colors text-left
        animate-in fade-in slide-in-from-left-1 duration-150
      `}
      style={{ borderLeftColor: getBorderColor(colorClass) }}
    >
      {/* Timestamp */}
      <span className="text-2xs text-muted-foreground/60 select-none flex-shrink-0 mt-0.5">
        {formatTime(entity.createdAt)}
      </span>

      {/* Icon */}
      <Icon className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${colorClass}`} />

      {/* Type badge */}
      <span className={`text-xs font-bold uppercase tracking-wider flex-shrink-0 ${colorClass}`}>
        [{label}]
      </span>

      {/* Name */}
      <span className="text-sm text-foreground flex-1 truncate hover:underline">
        {entity.name}
      </span>

      {/* Status badge */}
      {entity.status && (
        <span className="text-2xs text-muted-foreground/60 flex-shrink-0">
          {entity.status}
        </span>
      )}
    </button>
  );
}

/**
 * Date separator between entity groups
 */
function DateSeparator({ date }: { date: number }) {
  return (
    <div className="flex items-center justify-center my-4 first:mt-0">
      <div className="h-px bg-border flex-1" />
      <span className="px-3 text-2xs font-mono text-muted-foreground/70 uppercase tracking-wider">
        {formatDate(date)}
      </span>
      <div className="h-px bg-border flex-1" />
    </div>
  );
}

/**
 * Empty state for created entities
 */
function EmptyCreatedState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-12 h-12 rounded-none border border-dashed border-border flex items-center justify-center mb-4">
        <Layers className="w-6 h-6 text-muted-foreground/50" />
      </div>
      <p className="font-mono text-sm text-muted-foreground">{message}</p>
      <p className="font-mono text-xs text-muted-foreground/50 mt-2">
        Specs, docs, prompts, and more will appear here
      </p>
    </div>
  );
}

/**
 * Session graph view - visual timeline of ALL session activity
 * Shows messages, tool uses, events, memories, and created entities
 */
interface SessionGraphViewProps {
  memories: Document[];
  entities: SessionCreatedEntity[];
  timeline?: TimelineItem[];
  loading?: boolean;
}

/**
 * Unified graph item type for rendering
 */
type GraphItem =
  | { type: 'message'; data: UIChatMessage & { itemType: 'message' } }
  | { type: 'tool_use'; data: ToolUseItem }
  | { type: 'event'; data: SessionEvent & { itemType: 'event' } }
  | { type: 'memory'; data: { id: string; name: string; createdAt: number; tags: string[] } }
  | { type: 'entity'; data: { id: string; name: string; createdAt: number; entityType: SessionCreatedEntity['entityType'] } };

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

function SessionGraphView({ memories, entities, timeline = [], loading = false }: SessionGraphViewProps) {
  const [filter, setFilter] = useState<'all' | 'messages' | 'tools' | 'artifacts'>('all');

  // Combine all sources into a unified, sorted timeline
  const graphItems = useMemo((): GraphItem[] => {
    const items: GraphItem[] = [];

    // Add timeline items (messages, tool uses, events)
    for (const item of timeline) {
      if (item.itemType === 'message') {
        const msg = item as UIChatMessage & { itemType: 'message' };
        items.push({ type: 'message', data: msg });

        // Include embedded tools from the message (131-tool-embedding)
        if (msg.toolUses && msg.toolUses.length > 0) {
          for (const tool of msg.toolUses) {
            items.push({ type: 'tool_use', data: embeddedToolToItem(tool, msg.sessionId) });
          }
        }
      } else if (item.itemType === 'tool_use') {
        // Legacy: separate tool_use items
        items.push({ type: 'tool_use', data: item as ToolUseItem });
      } else if (item.itemType === 'event') {
        items.push({ type: 'event', data: item as SessionEvent & { itemType: 'event' } });
      }
    }

    // Add memories (if not already captured as events)
    for (const m of memories) {
      // Only add if not already in timeline within 2 seconds
      const exists = items.some(
        i => i.type === 'memory' && i.data.id === m.id ||
             (i.type === 'event' && Math.abs(i.data.createdAt - m.createdAt) < 2000)
      );
      if (!exists) {
        items.push({
          type: 'memory',
          data: { id: m.id, name: m.name, createdAt: m.createdAt, tags: m.tags || [] }
        });
      }
    }

    // Add created entities (if not already captured)
    for (const e of entities) {
      const exists = items.some(
        i => i.type === 'entity' && i.data.id === e.id
      );
      if (!exists) {
        items.push({
          type: 'entity',
          data: { id: e.id, name: e.name, createdAt: e.createdAt, entityType: e.entityType }
        });
      }
    }

    // Sort by createdAt
    return items.sort((a, b) => {
      const aTime = 'createdAt' in a.data ? a.data.createdAt : 0;
      const bTime = 'createdAt' in b.data ? b.data.createdAt : 0;
      return aTime - bTime;
    });
  }, [timeline, memories, entities]);

  // Apply filter
  const filteredItems = useMemo(() => {
    if (filter === 'all') return graphItems;
    if (filter === 'messages') return graphItems.filter(i => i.type === 'message');
    if (filter === 'tools') return graphItems.filter(i => i.type === 'tool_use');
    if (filter === 'artifacts') return graphItems.filter(i => i.type === 'memory' || i.type === 'entity');
    return graphItems;
  }, [graphItems, filter]);

  // Calculate stats
  const stats = useMemo(() => {
    const messages = graphItems.filter(i => i.type === 'message');
    const userMessages = messages.filter(i => (i.data as UIChatMessage).role === 'user').length;
    const assistantMessages = messages.filter(i => (i.data as UIChatMessage).role === 'assistant').length;
    const tools = graphItems.filter(i => i.type === 'tool_use').length;
    const artifacts = graphItems.filter(i => i.type === 'memory' || i.type === 'entity').length;
    return { userMessages, assistantMessages, tools, artifacts, total: graphItems.length };
  }, [graphItems]);

  if (loading && graphItems.length === 0) {
    return (
      <div className="flex items-center justify-center h-full py-12">
        <div className="flex items-center gap-2 font-mono text-sm">
          <Loader2 className="w-4 h-4 animate-spin text-progress" />
          <span className="text-progress-muted">Loading timeline...</span>
        </div>
      </div>
    );
  }

  if (graphItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-12 text-center">
        <div className="w-12 h-12 rounded-none border border-dashed border-border flex items-center justify-center mb-4">
          <GitBranch className="w-6 h-6 text-muted-foreground/50" />
        </div>
        <p className="font-mono text-sm text-muted-foreground">No activity yet</p>
        <p className="font-mono text-xs text-muted-foreground/50 mt-2">
          Messages, tool calls, and artifacts will appear here
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Stats bar */}
      <div className="flex-shrink-0 flex items-center gap-3 px-4 py-2 border-b border-border bg-muted/30 text-2xs font-mono">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <GitBranch className="w-3 h-3" />
          <span className="uppercase tracking-wider">FLOW</span>
        </div>
        <div className="flex items-center gap-3 text-muted-foreground/80">
          <span className="flex items-center gap-1">
            <User className="w-3 h-3 text-blue-500" />
            <span className="text-blue-600 dark:text-blue-400">{stats.userMessages}</span>
          </span>
          <span>→</span>
          <span className="flex items-center gap-1">
            <Wrench className="w-3 h-3 text-amber-500" />
            <span className="text-amber-600 dark:text-amber-400">{stats.tools}</span>
          </span>
          <span>→</span>
          <span className="flex items-center gap-1">
            <MessageSquare className="w-3 h-3 text-emerald-500" />
            <span className="text-emerald-600 dark:text-emerald-400">{stats.assistantMessages}</span>
          </span>
          <span className="mx-1 text-border">|</span>
          <span className="flex items-center gap-1">
            <Layers className="w-3 h-3 text-purple-500" />
            <span className="text-purple-600 dark:text-purple-400">{stats.artifacts}</span>
          </span>
        </div>
        <div className="flex-1" />
        {/* Filter buttons */}
        <div className="flex items-center gap-0.5">
          {(['all', 'messages', 'tools', 'artifacts'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-1.5 py-0.5 uppercase transition-colors ${
                filter === f
                  ? 'text-primary bg-primary/10'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="relative">
          {/* Central flow line */}
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gradient-to-b from-border via-primary/30 to-border" />

          {/* Timeline nodes */}
          <div className="space-y-2">
            {filteredItems.map((item, idx) => (
              <GraphNode key={`${item.type}-${'id' in item.data ? item.data.id : idx}`} item={item} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Individual graph node for each timeline item
 */
function GraphNode({ item }: { item: GraphItem }) {
  const config = getNodeConfig(item);

  return (
    <div className="flex items-start gap-3 relative group">
      {/* Node icon */}
      <div
        className={`
          w-8 h-8 rounded-none border-2 flex items-center justify-center
          bg-background z-10 flex-shrink-0 transition-colors
          ${config.colorClass} ${config.borderClass}
        `}
      >
        <config.Icon className="w-4 h-4" />
      </div>

      {/* Content */}
      <div className={`flex-1 min-w-0 pt-1 pb-2 ${config.bgClass}`}>
        {/* Header */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-2xs text-muted-foreground/60 font-mono">
            {formatTime('createdAt' in item.data ? item.data.createdAt : Date.now())}
          </span>
          <span className={`text-2xs font-bold uppercase ${config.labelColor}`}>
            [{config.label}]
          </span>
          {config.statusBadge}
        </div>

        {/* Main content */}
        <div className="mt-1">
          {config.content}
        </div>
      </div>
    </div>
  );
}

/**
 * Get display configuration for a graph item
 */
function getNodeConfig(item: GraphItem): {
  Icon: React.ElementType;
  label: string;
  colorClass: string;
  borderClass: string;
  bgClass: string;
  labelColor: string;
  statusBadge?: React.ReactNode;
  content: React.ReactNode;
} {
  switch (item.type) {
    case 'message': {
      const msg = item.data;
      const isUser = msg.role === 'user';
      return {
        Icon: isUser ? User : MessageSquare,
        label: isUser ? 'USER' : 'ASSISTANT',
        colorClass: isUser ? 'text-blue-600 dark:text-blue-400' : 'text-emerald-600 dark:text-emerald-400',
        borderClass: isUser ? 'border-blue-500/50' : 'border-emerald-500/50',
        bgClass: isUser ? 'bg-blue-500/5' : 'bg-emerald-500/5',
        labelColor: isUser ? 'text-blue-600 dark:text-blue-400' : 'text-emerald-600 dark:text-emerald-400',
        content: (
          <p className="text-sm font-mono text-foreground line-clamp-2">
            {msg.content.slice(0, 200)}{msg.content.length > 200 ? '...' : ''}
          </p>
        ),
      };
    }

    case 'tool_use': {
      const tool = item.data;
      const StatusIcon = tool.status === 'running' ? Loader2 : tool.status === 'error' ? AlertCircle : CheckCircle;
      const statusColor = tool.status === 'running' ? 'text-progress' : tool.status === 'error' ? 'text-red-500' : 'text-emerald-500';
      return {
        Icon: Wrench,
        label: tool.toolName || 'TOOL',
        colorClass: 'text-amber-600 dark:text-amber-400',
        borderClass: 'border-amber-500/50',
        bgClass: 'bg-amber-500/5',
        labelColor: 'text-amber-600 dark:text-amber-400',
        statusBadge: (
          <span className={`flex items-center gap-1 text-2xs ${statusColor}`}>
            <StatusIcon className={`w-3 h-3 ${tool.status === 'running' ? 'animate-spin text-progress' : ''}`} />
            {tool.status.toUpperCase()}
            {tool.elapsedMs && <span className="text-muted-foreground/60">{tool.elapsedMs}ms</span>}
          </span>
        ),
        content: tool.error ? (
          <p className="text-xs font-mono text-red-500">{tool.error}</p>
        ) : tool.output ? (
          <p className="text-xs font-mono text-muted-foreground line-clamp-1">
            {typeof tool.output === 'string' ? tool.output.slice(0, 100) : JSON.stringify(tool.output).slice(0, 100)}
          </p>
        ) : (
          <p className="text-xs font-mono text-muted-foreground/60 italic">
            {typeof tool.input === 'string' ? tool.input.slice(0, 80) : JSON.stringify(tool.input).slice(0, 80)}...
          </p>
        ),
      };
    }

    case 'event': {
      const evt = item.data;
      return {
        Icon: Zap,
        label: evt.type.replace(/_/g, ' '),
        colorClass: 'text-cyan-600 dark:text-cyan-400',
        borderClass: 'border-cyan-500/50',
        bgClass: 'bg-cyan-500/5',
        labelColor: 'text-cyan-600 dark:text-cyan-400',
        content: evt.metadata ? (
          <p className="text-xs font-mono text-muted-foreground">
            {JSON.stringify(evt.metadata).slice(0, 100)}
          </p>
        ) : null,
      };
    }

    case 'memory': {
      const mem = item.data;
      return {
        Icon: Brain,
        label: 'MEMORY',
        colorClass: 'text-primary',
        borderClass: 'border-primary/50',
        bgClass: 'bg-primary/5',
        labelColor: 'text-primary',
        content: (
          <div>
            <p className="text-sm font-mono text-foreground">{mem.name}</p>
            {mem.tags.length > 0 && (
              <div className="flex gap-1 mt-1">
                {mem.tags.slice(0, 3).map((tag) => (
                  <span key={tag} className="text-2xs font-mono text-muted-foreground/60">[{tag}]</span>
                ))}
              </div>
            )}
          </div>
        ),
      };
    }

    case 'entity': {
      const ent = item.data;
      const Icon = getEntityIcon(ent.entityType);
      const colorClass = getEntityColor(ent.entityType);
      return {
        Icon,
        label: getEntityLabel(ent.entityType),
        colorClass,
        borderClass: `border-current`,
        bgClass: '',
        labelColor: colorClass,
        content: (
          <p className="text-sm font-mono text-foreground">{ent.name}</p>
        ),
      };
    }
  }
}

/**
 * Convert Tailwind text color class to CSS color value
 */
function getBorderColor(textColorClass: string): string {
  const colorMap: Record<string, string> = {
    'text-primary': 'hsl(25, 80%, 45%)',
    'text-amber-600': '#d97706',
    'text-amber-400': '#fbbf24',
    'text-sky-600': '#0284c7',
    'text-sky-400': '#38bdf8',
    'text-emerald-600': '#059669',
    'text-emerald-400': '#34d399',
    'text-purple-600': '#9333ea',
    'text-purple-400': '#c084fc',
    'text-rose-600': '#e11d48',
    'text-rose-400': '#fb7185',
    'text-muted-foreground': 'hsl(30, 15%, 35%)',
  };

  const baseClass = textColorClass.split(' ')[0];
  return colorMap[baseClass] || colorMap['text-primary'];
}

export default SessionActivityPanel;
