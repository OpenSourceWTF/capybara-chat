import { Badge } from '../ui/Badge';
import { CloneStatus } from '@capybara-chat/types';
import { Loader2, XCircle, CheckCircle2, Circle } from 'lucide-react';

interface CloneStatusBadgeProps {
  status: string | undefined;
  error?: string | null;
}

export function CloneStatusBadge({ status, error }: CloneStatusBadgeProps) {
  switch (status) {
    case CloneStatus.PENDING:
      return (
        <Badge variant="soft" intent="neutral" className="gap-1">
          <Circle className="w-3 h-3" />
          Pending
        </Badge>
      );
    case CloneStatus.CLONING:
      return (
        <Badge variant="soft" intent="progress" className="gap-1">
          <Loader2 className="w-3 h-3 animate-spin" />
          Cloning
        </Badge>
      );
    case CloneStatus.FAILED:
      return (
        <Badge variant="solid" intent="danger" className="gap-1" title={error || 'Clone failed'}>
          <XCircle className="w-3 h-3" />
          Failed
        </Badge>
      );
    case CloneStatus.READY:
      return (
        <Badge variant="soft" intent="success" className="gap-1">
          <CheckCircle2 className="w-3 h-3" />
          Ready
        </Badge>
      );
    default:
      return null;
  }
}
