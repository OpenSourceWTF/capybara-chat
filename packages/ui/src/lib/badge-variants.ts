import type { SessionStatus } from '@capybara-chat/types';
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
    case 'COMPLETE': return { variant: 'soft', intent: 'success' };
    case 'CANCELLED': return { variant: 'outline', intent: 'neutral' };
    case 'FAILED': return { variant: 'solid', intent: 'danger' };
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
