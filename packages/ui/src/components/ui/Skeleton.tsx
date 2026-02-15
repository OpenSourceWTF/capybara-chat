/**
 * Skeleton - Loading placeholder components with shimmer animation
 * Provides visual feedback during data loading states
 */

import { cn } from '../../lib/utils';

interface SkeletonProps {
  className?: string;
}

/**
 * Base skeleton with shimmer animation
 */
export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'skeleton-shimmer bg-muted',
        className
      )}
    />
  );
}

/**
 * Circular skeleton for avatars
 */
export function SkeletonCircle({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'skeleton-shimmer bg-muted',
        className
      )}
    />
  );
}

/**
 * Text line skeleton
 */
export function SkeletonText({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'skeleton-shimmer h-4 bg-muted',
        className
      )}
    />
  );
}

/**
 * Session card skeleton - matches SessionCard layout
 */
export function SessionCardSkeleton() {
  return (
    <div className="session-card-skeleton">
      <div className="flex items-start gap-3 p-3">
        {/* Avatar */}
        <SkeletonCircle className="w-9 h-9 flex-shrink-0" />

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-2">
          {/* Title */}
          <SkeletonText className="w-3/4 h-4" />
          {/* Preview */}
          <SkeletonText className="w-full h-3" />
          <SkeletonText className="w-2/3 h-3" />
        </div>

        {/* Time */}
        <Skeleton className="w-12 h-3 flex-shrink-0" />
      </div>
    </div>
  );
}

/**
 * Chat message skeleton - matches message bubble layout
 */
export function ChatMessageSkeleton({ isUser = false }: { isUser?: boolean }) {
  return (
    <div className={cn(
      'chat-message-skeleton flex gap-3 p-4',
      isUser ? 'flex-row-reverse' : ''
    )}>
      {/* Avatar */}
      <SkeletonCircle className="w-8 h-8 flex-shrink-0" />

      {/* Message bubble */}
      <div className={cn(
        'flex-1 max-w-[80%] space-y-2 p-4',
        isUser ? 'bg-primary/10' : 'bg-muted'
      )}>
        <SkeletonText className="w-full" />
        <SkeletonText className="w-5/6" />
        <SkeletonText className="w-2/3" />
      </div>
    </div>
  );
}

/**
 * List skeleton for generic lists
 */
export function ListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3">
          <SkeletonCircle className="w-10 h-10" />
          <div className="flex-1 space-y-2">
            <SkeletonText className="w-3/4" />
            <SkeletonText className="w-1/2 h-3" />
          </div>
        </div>
      ))}
    </div>
  );
}
