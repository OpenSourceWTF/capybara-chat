import type { SessionStatus, SpecStatus, TaskStatus } from '@capybara-chat/types';
import type { BadgeProps } from '../components/ui/Badge';

type BadgeStyle = Pick<BadgeProps, 'variant' | 'intent'>;

/**
 * Get badge style for session status
 */
export function getSessionStatusVariant(status: SessionStatus): BadgeStyle {
  switch (status) {
    case 'PENDING': return { variant: 'soft', intent: 'neutral' };
    case 'RUNNING': return { variant: 'solid', intent: 'primary' };
    case 'PAUSED': return { variant: 'outline', intent: 'warning' };
    case 'WAITING_HUMAN': return { variant: 'solid', intent: 'warning' };
    case 'WAITING_FOR_PR': return { variant: 'outline', intent: 'info' };
    case 'COMPLETE': return { variant: 'soft', intent: 'success' };
    case 'FAILED': return { variant: 'solid', intent: 'danger' };
    default: return { variant: 'soft', intent: 'secondary' };
  }
}

/**
 * Get badge style for spec status
 */
export function getSpecStatusVariant(status: SpecStatus): BadgeStyle {
  switch (status) {
    case 'DRAFT': return { variant: 'outline', intent: 'neutral' };
    case 'READY': return { variant: 'solid', intent: 'success' };
    case 'IN_PROGRESS': return { variant: 'soft', intent: 'primary' };
    case 'BLOCKED': return { variant: 'solid', intent: 'danger' };
    case 'COMPLETE': return { variant: 'soft', intent: 'success' };
    case 'ARCHIVED': return { variant: 'ghost', intent: 'neutral' };
    default: return { variant: 'soft', intent: 'secondary' };
  }
}

/**
 * Get badge style for task status
 */
export function getTaskStatusVariant(status: TaskStatus): BadgeStyle {
  switch (status) {
    case 'PENDING': return { variant: 'soft', intent: 'neutral' };
    case 'IN_PROGRESS': return { variant: 'soft', intent: 'primary' };
    case 'COMPLETE': return { variant: 'soft', intent: 'success' };
    case 'SKIPPED': return { variant: 'outline', intent: 'warning' };
    default: return { variant: 'soft', intent: 'secondary' };
  }
}

/**
 * Get badge style for priority
 */
export function getPriorityVariant(priority: string): BadgeStyle {
  switch (priority) {
    case 'critical': return { variant: 'solid', intent: 'danger' };
    case 'high': return { variant: 'soft', intent: 'warning' };
    case 'medium': return { variant: 'soft', intent: 'info' };
    default: return { variant: 'ghost', intent: 'neutral' };
  }
}
