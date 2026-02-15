/**
 * PageHeader - Unified header component for all views
 * 
 * Provides consistent treatment for:
 * - Back navigation
 * - Title and subtitle
 * - Action buttons
 * - Optional badge/status
 */

import { ArrowLeft } from 'lucide-react';
import { Button } from './Button';
import { cn } from '../../lib/utils';

interface PageHeaderProps {
  /** Back button configuration */
  backButton?: {
    label: string;
    onClick: () => void;
  };
  /** Page title */
  title: string;
  /** Optional subtitle */
  subtitle?: string;
  /** Badge or status element next to title */
  badge?: React.ReactNode;
  /** Action buttons (right side) */
  actions?: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
}

export function PageHeader({
  backButton,
  title,
  subtitle,
  badge,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn('space-y-3', className)}>
      {backButton && (
        <Button
          variant="ghost"
          size="sm"
          onClick={backButton.onClick}
          className="h-7 px-2 -ml-2"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          <span className="text-xs">Back</span>
        </Button>
      )}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight truncate">
              {title}
            </h1>
            {badge}
          </div>
          {subtitle && (
            <p className="text-muted-foreground text-sm">{subtitle}</p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>
        )}
      </div>
    </div>
  );
}
