/**
 * KanbanColumn - Column container for a task state
 *
 * Design: Terminal aesthetic with zero radius, uppercase headers
 * Supports drag-and-drop with visual feedback
 * 134-kanban-reorder: Added infinite scroll support
 */

import { memo, DragEvent, ReactNode, useRef, useEffect } from 'react';
import { WorkerTaskState } from '@capybara-chat/types';
import { Badge } from '../ui';
import { cn } from '../../lib/utils';
import type { BadgeProps } from '../ui/Badge';

interface KanbanColumnProps {
  state: WorkerTaskState;
  title: string;
  count: number;
  intent: BadgeProps['intent'];
  icon: ReactNode;
  children: ReactNode;
  onDragOver: (e: DragEvent<HTMLDivElement>) => void;
  onDrop: (e: DragEvent<HTMLDivElement>, state: WorkerTaskState) => void;
  isDropTarget?: boolean;
  /** 134-kanban-reorder: Callback when user scrolls near bottom */
  onLoadMore?: () => void;
  /** 134-kanban-reorder: Whether there are more items to load */
  hasMore?: boolean;
}

export const KanbanColumn = memo(function KanbanColumn({
  state,
  title,
  count,
  intent,
  icon,
  children,
  onDragOver,
  onDrop,
  isDropTarget,
  onLoadMore,
  hasMore,
}: KanbanColumnProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Infinite scroll detection
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || !onLoadMore || !hasMore) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      // Load more when within 100px of bottom
      if (scrollHeight - scrollTop - clientHeight < 100) {
        onLoadMore();
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [onLoadMore, hasMore]);

  return (
    <div
      className={cn(
        // Base: Zero radius, terminal aesthetic
        "flex flex-col min-w-[220px] max-w-[280px] flex-1",
        "border border-border bg-muted/20",
        // Drop target feedback
        isDropTarget && "border-primary/50 bg-primary/5"
      )}
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, state)}
    >
      {/* Column Header */}
      <div className="flex items-center gap-2 p-3 border-b border-border bg-muted/30">
        <span className="text-muted-foreground">{icon}</span>
        <span className="text-xs font-bold uppercase tracking-wider text-foreground">
          {title}
        </span>
        <Badge variant="soft" intent={intent} size="sm" className="ml-auto">
          {count}
        </Badge>
      </div>

      {/* Column Content with scroll detection */}
      <div
        ref={scrollContainerRef}
        className="flex-1 p-2 space-y-2 overflow-y-auto min-h-[200px]"
      >
        {children}
        {/* Infinite scroll indicator */}
        {hasMore && (
          <div className="py-2 text-center text-2xs text-muted-foreground/50">
            ↓ scroll for more ↓
          </div>
        )}
      </div>
    </div>
  );
});
