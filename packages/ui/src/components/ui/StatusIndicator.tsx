/**
 * StatusIndicator - Refined connection status display
 * 
 * Design: Elegant dot with subtle glow effect
 * Matches the session card indicators for visual consistency
 */

import { HTMLAttributes } from 'react';

export type StatusType = 'online' | 'offline' | 'connecting' | 'processing' | 'unread' | 'error';
export type StatusSize = 'xs' | 'sm' | 'md';

export interface StatusIndicatorProps extends HTMLAttributes<HTMLDivElement> {
  status: StatusType;
  label?: string;
  showLabel?: boolean;
  size?: StatusSize;
}

// Semantic status colors with glow effects
const statusStyles: Record<StatusType, { bg: string; glow: string }> = {
  online: {
    bg: 'bg-emerald-500',
    glow: 'shadow-emerald-500/50',
  },
  offline: {
    bg: 'bg-zinc-400',
    glow: '', // No glow for inactive state
  },
  connecting: {
    bg: 'bg-amber-500',
    glow: 'shadow-amber-500/40',
  },
  processing: {
    bg: 'bg-primary',
    glow: 'shadow-primary/40',
  },
  unread: {
    bg: 'bg-primary',
    glow: 'shadow-primary/40',
  },
  error: {
    bg: 'bg-red-500',
    glow: 'shadow-red-500/50',
  },
};

// Size variants
const sizeClasses: Record<StatusSize, { dot: string; text: string; shadow: string }> = {
  xs: { dot: 'w-1.5 h-1.5', text: 'text-3xs', shadow: 'shadow-[0_0_4px]' },
  sm: { dot: 'w-2 h-2', text: 'text-3xs', shadow: 'shadow-[0_0_6px]' },
  md: { dot: 'w-2.5 h-2.5', text: 'text-2xs', shadow: 'shadow-[0_0_8px]' },
};

export function StatusIndicator({
  status,
  label,
  showLabel = true,
  size = 'sm',
  className = '',
  ...props
}: StatusIndicatorProps) {
  const style = statusStyles[status];
  const sizes = sizeClasses[size];

  // Glow effect for active states
  const glowClass = style.glow ? `${sizes.shadow} ${style.glow}` : '';

  return (
    <div
      className={`flex items-center gap-1 ${className}`}
      role="status"
      aria-label={`${label || status}: ${status}`}
      {...props}
    >
      <div
        className={`
          ${sizes.dot}
          ${style.bg}
          ${glowClass}
          transition-all duration-200
        `}
      />
      {showLabel && label && (
        <span className={`${sizes.text} font-mono text-muted-foreground uppercase tracking-tight`}>
          {label}
        </span>
      )}
    </div>
  );
}
