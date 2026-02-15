/**
 * StatusBanner - Displays status messages for blocked/reset states
 *
 * Consolidates BlockedBanner and ContextResetBanner into a single component
 * with variant support for different message types.
 */

import { AlertTriangle, Info, XCircle, X } from 'lucide-react';
import { cn } from '../../lib/utils';

export type BannerVariant = 'warning' | 'info' | 'error';

export interface StatusBannerProps {
  variant: BannerVariant;
  message: string;
  detail?: string;
  onDismiss?: () => void;
  className?: string;
}

const variantStyles: Record<BannerVariant, {
  bg: string;
  border: string;
  text: string;
  icon: React.ReactNode;
}> = {
  warning: {
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/20',
    text: 'text-yellow-600 dark:text-yellow-400',
    icon: <AlertTriangle className="w-4 h-4" />,
  },
  info: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    text: 'text-blue-600 dark:text-blue-400',
    icon: <Info className="w-4 h-4" />,
  },
  error: {
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    text: 'text-red-600 dark:text-red-400',
    icon: <XCircle className="w-4 h-4" />,
  },
};

export function StatusBanner({
  variant,
  message,
  detail,
  onDismiss,
  className,
}: StatusBannerProps) {
  const styles = variantStyles[variant];

  return (
    <div
      className={cn(
        'flex items-start gap-2 px-3 py-2 border animate-in fade-in slide-in-from-top-1 duration-200',
        styles.bg,
        styles.border,
        className
      )}
    >
      <span className={cn('mt-0.5 flex-shrink-0', styles.text)}>
        {styles.icon}
      </span>
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-medium', styles.text)}>{message}</p>
        {detail && (
          <p className="text-xs text-muted-foreground mt-0.5 font-mono">
            {detail}
          </p>
        )}
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className={cn(
            'flex-shrink-0 p-0.5 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors',
            styles.text
          )}
          aria-label="Dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
