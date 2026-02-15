/**
 * Unified Task State Configuration
 *
 * Single source of truth for task state → visual mapping.
 * Previously duplicated across 5 components (TasksLibrary, TaskDetailView,
 * TaskModalHeader, SpecTasksSection, SpecWorkflowBar).
 *
 * Each consumer picks the fields it needs:
 * - icon: Lucide icon component
 * - label: UPPERCASE state label (use .toLowerCase() if needed)
 * - bracketLabel: terminal bracket notation like [QUEUED]
 * - variant/intent: Badge styling
 * - message: human-readable description
 * - borderColor: Tailwind left-border class for state-colored strips
 */

import type { ComponentType } from 'react';
import {
  Clock,
  PlayCircle,
  CheckCircle,
  XCircle,
  PauseCircle,
  AlertCircle,
  Loader2,
  GitPullRequest,
} from 'lucide-react';
import type { WorkerTaskState } from '@capybara-chat/types';
import type { BadgeProps } from '../components/ui/Badge';

export interface TaskStateConfig {
  /** Lucide icon component */
  icon: ComponentType<{ className?: string }>;
  /** UPPERCASE label for badges (e.g., "QUEUED", "RUNNING") */
  label: string;
  /** Terminal bracket notation (e.g., "[QUEUED]", "[RUNNING]") */
  bracketLabel: string;
  /** Badge variant */
  variant: NonNullable<BadgeProps['variant']>;
  /** Badge intent/color */
  intent: NonNullable<BadgeProps['intent']>;
  /** Human-readable status message */
  message: string;
  /** Tailwind left-border color class for state strips */
  borderColor: string;
}

export const TASK_STATE_CONFIG: Record<WorkerTaskState, TaskStateConfig> = {
  queued: {
    icon: Clock,
    label: 'QUEUED',
    bracketLabel: '[QUEUED]',
    variant: 'soft',
    intent: 'secondary',
    message: 'Task is queued, waiting for executor...',
    borderColor: 'border-l-muted-foreground/50',
  },
  assigned: {
    icon: PlayCircle,
    label: 'ASSIGNED',
    bracketLabel: '[ASSIGNED]',
    variant: 'solid',
    intent: 'progress',
    message: 'Task assigned to executor, starting...',
    borderColor: 'border-l-progress',
  },
  running: {
    icon: Loader2,
    label: 'RUNNING',
    bracketLabel: '[RUNNING]',
    variant: 'solid',
    intent: 'progress',
    message: 'Task is running...',
    borderColor: 'border-l-progress',
  },
  paused: {
    icon: PauseCircle,
    label: 'PAUSED',
    bracketLabel: '[PAUSED]',
    variant: 'outline',
    intent: 'warning',
    message: 'Task paused, waiting for input...',
    borderColor: 'border-l-warning',
  },
  waiting_for_pr: {
    icon: GitPullRequest,
    label: 'AWAITING PR',
    bracketLabel: '[PR REVIEW]',
    variant: 'solid',
    intent: 'info',
    message: 'Agent complete, awaiting PR review/merge...',
    borderColor: 'border-l-primary',
  },
  complete: {
    icon: CheckCircle,
    label: 'COMPLETE',
    bracketLabel: '[COMPLETE]',
    variant: 'solid',
    intent: 'success',
    message: 'Task completed successfully',
    borderColor: 'border-l-success',
  },
  failed: {
    icon: XCircle,
    label: 'FAILED',
    bracketLabel: '[FAILED]',
    variant: 'solid',
    intent: 'danger',
    message: 'Task failed',
    borderColor: 'border-l-destructive',
  },
  cancelled: {
    icon: AlertCircle,
    label: 'CANCELLED',
    bracketLabel: '[CANCELLED]',
    variant: 'outline',
    intent: 'secondary',
    message: 'Task was cancelled',
    borderColor: 'border-l-muted-foreground/50',
  },
};
