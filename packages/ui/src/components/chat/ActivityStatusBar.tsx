/**
 * ActivityStatusBar - Terminal-style activity indicator above the input
 *
 * Displays transient activity indicators with improved visual hierarchy:
 * - Thinking state with animated processing indicator
 * - Tool use activity with name and elapsed time
 * - Progress bar for long operations
 * - Blocked/halted state indicators with attention-grabbing styling
 *
 * UI Refresh: Uses new activity-bar CSS classes for consistent terminal styling.
 * More prominent and readable than the previous thin bar.
 */

import { useState, useEffect, useRef } from 'react';
import { Loader2, Wrench, Users, Play, RotateCcw, AlertTriangle, XCircle } from 'lucide-react';
import { ProgressSpinner } from '../ui/ProgressSpinner';
import { cn } from '../../lib/utils';
import type { SessionActivityData, SessionProgressData, SessionBlockedData, SessionHaltedData } from '../../hooks/useSessionSocketEvents';

export interface ActivityStatusBarProps {
  /** Whether Claude is thinking/processing (local state) */
  isThinking?: boolean;
  /** The thinking phrase to display */
  thinkingPhrase?: string;
  /** Activity state (tool use, subagent, etc.) */
  activity?: SessionActivityData['activity'] | null;
  /** Progress data for long-running operations */
  progress?: SessionProgressData | null;
  /** Blocked state (waiting on external) */
  blocked?: SessionBlockedData | null;
  /** Halted state (189: session timed out or errored, can be resumed) */
  halted?: SessionHaltedData | null;
  /** Whether the session is actively processing (140-thinking-ui-fix) */
  isSessionProcessing?: boolean;
  className?: string;
}

/**
 * Get icon for activity type
 */
function getActivityIcon(type: SessionActivityData['activity']['type']) {
  const iconClass = 'w-3 h-3';
  switch (type) {
    case 'starting':
      return <Play className={iconClass} />;
    case 'resuming':
      return <RotateCcw className={iconClass} />;
    case 'subagent':
      return <Users className={iconClass} />;
    case 'tool_start':
    case 'tool_end':
      return <Wrench className={iconClass} />;
    default:
      return <Loader2 className={cn(iconClass, 'animate-spin')} />;
  }
}

/**
 * Get label for activity
 */
function getActivityLabel(activity: SessionActivityData['activity']): string {
  switch (activity.type) {
    case 'starting':
      return 'Starting...';
    case 'resuming':
      return 'Resuming...';
    case 'subagent':
      return activity.subagentName ? `Subagent: ${activity.subagentName}` : 'Subagent...';
    case 'tool_start':
      return activity.toolName ? `${activity.toolName}` : 'Tool...';
    case 'tool_end':
      return 'Done';
    case 'thinking':
      return 'Thinking...';
    default:
      return 'Working...';
  }
}

/**
 * Format seconds into a human-readable elapsed time string
 * 185-subagent-activity-streaming: Shows live elapsed time for long-running activities
 */
function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return `${m}m ${s.toString().padStart(2, '0')}s`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return `${h}h ${rm.toString().padStart(2, '0')}m`;
}

/**
 * Hook for live elapsed timer that starts when activity begins
 * 185-subagent-activity-streaming
 */
function useElapsedTimer(isActive: boolean): number {
  const [elapsed, setElapsed] = useState(0);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (isActive) {
      if (!startTimeRef.current) {
        startTimeRef.current = Date.now();
      }
      const interval = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTimeRef.current!) / 1000));
      }, 1000);
      return () => clearInterval(interval);
    } else {
      startTimeRef.current = null;
      setElapsed(0);
    }
  }, [isActive]);

  return elapsed;
}

export function ActivityStatusBar({
  isThinking = false,
  thinkingPhrase = 'Thinking...',
  activity,
  progress,
  blocked,
  halted,
  isSessionProcessing = true, // Default true for backwards compat
  className,
}: ActivityStatusBarProps) {
  // 140-thinking-ui-fix: Only show activity/progress if session is actually processing
  // This prevents stale indicators when agent-bridge finishes but events weren't cleared
  const hasProgress = progress && progress.message && isSessionProcessing;
  const hasActivity = activity?.status === 'running' && !hasProgress && isSessionProcessing;
  const hasContent = isThinking || hasActivity || blocked || halted || hasProgress;

  // 185-subagent-activity-streaming: Live elapsed timer for running activities
  const elapsed = useElapsedTimer(!!hasActivity);

  // Don't render if nothing to show
  if (!hasContent) {
    return null;
  }

  return (
    <div className={cn('flex-shrink-0', className)}>
      {/* Activity-based progress (takes precedence when active) */}
      {hasProgress && (
        <div className="activity-bar">
          <div className="activity-bar-label text-progress">
            <ProgressSpinner size="xs" />
            [PROGRESS]
          </div>
          <div className="activity-bar-detail text-progress/70">{progress!.message}</div>
          {progress!.phase && (
            <span className="text-2xs px-1.5 py-0.5 bg-progress/15 text-progress uppercase font-bold">
              {progress!.phase}
            </span>
          )}
        </div>
      )}

      {/* Thinking indicator (local state - waiting for response) */}
      {isThinking && !hasProgress && !hasActivity && (
        <div className="activity-bar">
          <div className="activity-bar-label text-progress">
            <ProgressSpinner size="xs" />
            [THINKING]
          </div>
          <div className="activity-bar-detail text-progress/60 italic">{thinkingPhrase}</div>
        </div>
      )}

      {/* Activity indicator (socket-based tool use, subagent, etc.) */}
      {hasActivity && (
        <div className="activity-bar">
          <div className="activity-bar-label text-progress">
            <span className="text-progress">{getActivityIcon(activity!.type)}</span>
            [ACTIVITY]
          </div>
          <div className="activity-bar-detail text-progress/60">{getActivityLabel(activity!)}</div>
          {/* 185-subagent-activity-streaming: Live elapsed timer */}
          {elapsed > 0 && (
            <span className="activity-bar-timer">{formatElapsed(elapsed)}</span>
          )}
        </div>
      )}

      {/* Blocked indicator */}
      {blocked && (
        <div className="activity-bar border-t-warning/30">
          <div className="activity-bar-label text-warning">
            <AlertTriangle className="w-3 h-3" />
            [BLOCKED]
          </div>
          <div className="activity-bar-detail text-muted-foreground" title={blocked.reason}>
            {blocked.reason}
          </div>
        </div>
      )}

      {/* Halted indicator (189-session-failure-ui) */}
      {halted && (
        <div className="activity-bar border-t-destructive/30">
          <div className="activity-bar-label text-destructive">
            <XCircle className="w-3 h-3" />
            [HALTED]
          </div>
          <div className="activity-bar-detail text-muted-foreground" title={halted.errorMessage}>
            {halted.reason === 'timeout' ? 'Session timed out - ' : halted.reason === 'process_exit' ? 'CLI process exited - ' : 'CLI error - '}
            send a message to resume
          </div>
        </div>
      )}
    </div>
  );
}
