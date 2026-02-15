/**
 * MemoryTimeline - Display agent memories in a timeline format
 *
 * Following the "Cozy Terminal" design:
 * - IRC-style log format with colored left rails
 * - Bracketed tags [MEMORY]
 * - Monospace throughout
 * - Expandable content previews
 * - Grouped by date with separators
 */

import React, { useState, useMemo } from 'react';
import { ChevronRight, ChevronDown, Brain, Tag, Search, X } from 'lucide-react';
import { formatTime, formatDate } from '../../lib/utils';
import { Markdown, Input } from '../ui';
import type { Document } from '@capybara-chat/types';

// Memory tag colors for visual differentiation
const TAG_COLORS: Record<string, string> = {
  decision: 'text-amber-600 dark:text-amber-400',
  observation: 'text-sky-600 dark:text-sky-400',
  discovery: 'text-emerald-600 dark:text-emerald-400',
  context: 'text-purple-600 dark:text-purple-400',
  error: 'text-red-600 dark:text-red-400',
  default: 'text-muted-foreground',
};

// Get color for a tag
function getTagColor(tag: string): string {
  const lowerTag = tag.toLowerCase();
  return TAG_COLORS[lowerTag] || TAG_COLORS.default;
}

// Get primary tag (first tag that has a color)
function getPrimaryTag(tags: string[]): { tag: string; color: string } | null {
  for (const tag of tags) {
    const color = TAG_COLORS[tag.toLowerCase()];
    if (color) {
      return { tag, color };
    }
  }
  return tags.length > 0 ? { tag: tags[0], color: TAG_COLORS.default } : null;
}

// Check if we need a date separator
function needsDateSeparator(current: Document, prev: Document | undefined): boolean {
  if (!prev) return true;
  const currentDate = new Date(current.createdAt).toDateString();
  const prevDate = new Date(prev.createdAt).toDateString();
  return currentDate !== prevDate;
}

export interface MemoryTimelineProps {
  /** List of memories (ordered by createdAt DESC) */
  memories: Document[];
  /** Loading state */
  loading?: boolean;
  /** Error message */
  error?: string | null;
  /** Whether to show search bar */
  showSearch?: boolean;
  /** Search query (controlled) */
  searchQuery?: string;
  /** Search query change handler */
  onSearchChange?: (query: string) => void;
  /** Callback when a memory is clicked */
  onMemoryClick?: (memory: Document) => void;
  /** Empty state message */
  emptyMessage?: string;
}

/**
 * Memory timeline component - displays session memories in IRC-style log format
 */
export function MemoryTimeline({
  memories,
  loading = false,
  error = null,
  showSearch = false,
  searchQuery = '',
  onSearchChange,
  onMemoryClick,
  emptyMessage = 'No memories saved in this session yet.',
}: MemoryTimelineProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Filter memories by search query (client-side for instant feedback)
  const filteredMemories = useMemo(() => {
    if (!searchQuery.trim()) return memories;
    const query = searchQuery.toLowerCase();
    return memories.filter(
      (m) =>
        m.name.toLowerCase().includes(query) ||
        m.content.toLowerCase().includes(query) ||
        m.tags.some((t) => t.toLowerCase().includes(query))
    );
  }, [memories, searchQuery]);

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Loading state
  if (loading && memories.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <div className="flex items-center gap-2 font-mono text-sm">
          <span className="animate-pulse">[...]</span>
          <span>Loading memories...</span>
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
      {/* Header with search */}
      {showSearch && (
        <div className="flex items-center gap-2 p-2 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2 text-2xs font-mono text-muted-foreground uppercase tracking-widest">
            <Brain className="w-3 h-3" />
            <span>SESSION_MEMORY</span>
            <span className="text-primary">[{filteredMemories.length}]</span>
          </div>
          <div className="flex-1" />
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
            <Input
              variant="terminal"
              value={searchQuery}
              onChange={(e) => onSearchChange?.(e.target.value)}
              placeholder="Search..."
              className="h-6 pl-7 pr-7 w-32 text-xs"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange?.('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        {filteredMemories.length === 0 ? (
          <EmptyState message={searchQuery ? 'No memories match your search.' : emptyMessage} />
        ) : (
          filteredMemories.map((memory, index) => {
            const prev = index > 0 ? filteredMemories[index - 1] : undefined;
            const showDateSeparator = needsDateSeparator(memory, prev);
            const isExpanded = expandedIds.has(memory.id);

            return (
              <React.Fragment key={memory.id}>
                {/* Date separator */}
                {showDateSeparator && (
                  <DateSeparator date={memory.createdAt} />
                )}

                {/* Memory entry */}
                <MemoryEntry
                  memory={memory}
                  isExpanded={isExpanded}
                  onToggle={() => toggleExpanded(memory.id)}
                  onClick={() => onMemoryClick?.(memory)}
                />
              </React.Fragment>
            );
          })
        )}
      </div>
    </div>
  );
}

/**
 * Date separator between memory groups
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
 * Individual memory entry with expandable content
 */
interface MemoryEntryProps {
  memory: Document;
  isExpanded: boolean;
  onToggle: () => void;
  onClick?: () => void;
}

const MemoryEntry = React.memo(function MemoryEntry({
  memory,
  isExpanded,
  onToggle,
  onClick,
}: MemoryEntryProps) {
  const primaryTag = getPrimaryTag(memory.tags);
  const borderColor = primaryTag?.color || 'text-primary';

  // Convert Tailwind text color to CSS for border
  const borderColorValue = getBorderColor(borderColor);

  // Truncate content for preview (first 2 lines or 150 chars)
  const contentPreview = useMemo(() => {
    const lines = memory.content.split('\n').slice(0, 2);
    const preview = lines.join(' ').slice(0, 150);
    return preview + (memory.content.length > 150 ? '...' : '');
  }, [memory.content]);

  return (
    <div
      className={`
        font-mono border-l-[3px] pl-2 py-1.5
        hover:bg-muted/30 transition-colors
        animate-in fade-in slide-in-from-left-1 duration-150
      `}
      style={{ borderLeftColor: borderColorValue }}
    >
      {/* Header row: timestamp, expand toggle, name, tags */}
      <button
        onClick={onToggle}
        className="flex items-start gap-2 w-full text-left group"
      >
        {/* Timestamp */}
        <span className="text-2xs text-muted-foreground/60 select-none flex-shrink-0 mt-0.5">
          {formatTime(memory.createdAt)}
        </span>

        {/* Expand chevron */}
        <span className="text-muted-foreground/50 group-hover:text-foreground flex-shrink-0 mt-0.5">
          {isExpanded ? (
            <ChevronDown className="w-3 h-3" />
          ) : (
            <ChevronRight className="w-3 h-3" />
          )}
        </span>

        {/* Type badge */}
        <span className={`text-xs font-bold uppercase tracking-wider flex-shrink-0 ${borderColor}`}>
          [MEMORY]
        </span>

        {/* Name */}
        <span
          className="text-sm text-foreground flex-1 truncate cursor-pointer hover:underline"
          onClick={(e) => {
            e.stopPropagation();
            onClick?.();
          }}
        >
          {memory.name}
        </span>
      </button>

      {/* Tags row (if has tags) */}
      {memory.tags.length > 0 && (
        <div className="flex items-center gap-1 ml-[4.5rem] mt-0.5">
          <Tag className="w-2.5 h-2.5 text-muted-foreground/50" />
          {memory.tags.map((tag) => (
            <span
              key={tag}
              className={`text-2xs font-mono ${getTagColor(tag)}`}
            >
              [{tag}]
            </span>
          ))}
        </div>
      )}

      {/* Content preview (always shown) or full content (when expanded) */}
      <div className="ml-[4.5rem] mt-1">
        {isExpanded ? (
          <div className="text-sm text-foreground/90 border-l border-dashed border-border/50 pl-2 animate-in fade-in slide-in-from-top-1 duration-150">
            <Markdown>{memory.content}</Markdown>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground/70 line-clamp-1">
            {contentPreview}
          </p>
        )}
      </div>
    </div>
  );
});

/**
 * Empty state component
 */
function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-12 h-12 rounded-none border border-dashed border-border flex items-center justify-center mb-4">
        <Brain className="w-6 h-6 text-muted-foreground/50" />
      </div>
      <p className="font-mono text-sm text-muted-foreground">{message}</p>
      <p className="font-mono text-xs text-muted-foreground/50 mt-2">
        Agents can save memories using <span className="text-primary">memory_create</span>
      </p>
    </div>
  );
}

/**
 * Convert Tailwind text color class to CSS color value
 * This is a simplified version - in production you might use a more robust solution
 */
function getBorderColor(textColorClass: string): string {
  // Map common Tailwind colors to hex values
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
    'text-red-600': '#dc2626',
    'text-red-400': '#f87171',
    'text-muted-foreground': 'hsl(30, 15%, 35%)',
  };

  // Handle dark mode variants
  const baseClass = textColorClass.split(' ')[0];
  return colorMap[baseClass] || colorMap['text-primary'];
}

export default MemoryTimeline;
