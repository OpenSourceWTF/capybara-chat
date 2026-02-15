/**
 * SessionActivityBar - Shows current agent activity (tool use, subagent, etc.)
 *
 * Displays a subtle indicator when the agent is:
 * - Starting/resuming a session
 * - Using a tool
 * - Delegating to a subagent
 * - Showing progress (if available)
 *
 * Uses debouncing to prevent flicker on rapid tool calls.
 */

import { useState, useEffect } from 'react';
import { Loader2, Wrench, Users, Play, RotateCcw } from 'lucide-react';
import type { SessionActivityData, SessionProgressData } from '../../hooks/useSessionSocketEvents';
import { ProgressSpinner } from '../ui/ProgressSpinner';

export interface SessionActivityBarProps {
  activity: SessionActivityData['activity'] | null;
  progress: SessionProgressData | null;
  /** Debounce delay in ms before showing activity (prevents flicker) */
  debounceMs?: number;
}

/**
 * Get the icon for an activity type
 */
function getActivityIcon(type: SessionActivityData['activity']['type']) {
  switch (type) {
    case 'starting':
      return <Play className="w-3 h-3" />;
    case 'resuming':
      return <RotateCcw className="w-3 h-3" />;
    case 'subagent':
      return <Users className="w-3 h-3" />;
    case 'tool_start':
    case 'tool_end':
      return <Wrench className="w-3 h-3" />;
    default:
      return <Loader2 className="w-3 h-3 animate-spin text-progress" />;
  }
}

/**
 * Get human-readable label for an activity
 */
function getActivityLabel(activity: SessionActivityData['activity']): string {
  switch (activity.type) {
    case 'starting':
      return 'Starting session...';
    case 'resuming':
      return 'Resuming session...';
    case 'subagent':
      return activity.subagentName
        ? `Delegating to ${activity.subagentName}...`
        : 'Delegating to subagent...';
    case 'tool_start':
      return activity.toolName
        ? `Using ${activity.toolName}...`
        : 'Using tool...';
    case 'tool_end':
      return 'Tool complete';
    case 'thinking':
      return 'Thinking...';
    default:
      return 'Working...';
  }
}

export function SessionActivityBar({
  activity,
  progress,
  debounceMs = 200,
}: SessionActivityBarProps) {
  const [visible, setVisible] = useState(false);
  const [displayedActivity, setDisplayedActivity] = useState(activity);

  // Debounce activity display to prevent flicker
  useEffect(() => {
    if (activity && activity.status === 'running') {
      const timer = setTimeout(() => {
        setVisible(true);
        setDisplayedActivity(activity);
      }, debounceMs);
      return () => clearTimeout(timer);
    } else {
      setVisible(false);
      // Keep displaying the last activity briefly for visual continuity
      const hideTimer = setTimeout(() => {
        setDisplayedActivity(null);
      }, 100);
      return () => clearTimeout(hideTimer);
    }
  }, [activity, debounceMs]);

  if (!visible || !displayedActivity) {
    return null;
  }

  // Show activity-based progress if we have progress data
  if (progress && progress.message) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 text-xs bg-muted/50 animate-in fade-in duration-200">
        <ProgressSpinner size="xs" />
        <span className="font-mono flex-1 text-progress-muted">{progress.message}</span>
        {progress.phase && (
          <span className="px-1.5 py-0.5 text-2xs font-semibold uppercase bg-progress/20 text-progress">
            {progress.phase}
          </span>
        )}
      </div>
    );
  }

  // Show activity indicator
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 text-xs bg-muted/50 animate-in fade-in duration-200">
      <span className="text-progress">
        {getActivityIcon(displayedActivity.type)}
      </span>
      <span className="font-mono text-progress-muted">{getActivityLabel(displayedActivity)}</span>
    </div>
  );
}
