/**
 * Surface - Unified content container
 * 
 * Replaces inconsistent card/paper/box treatments across views.
 * Provides consistent visual treatment for content areas.
 */

import { cn } from '../../lib/utils';

type SurfaceVariant = 'raised' | 'inset' | 'outline' | 'ghost';
type SurfacePadding = 'none' | 'sm' | 'md' | 'lg';

interface SurfaceProps {
  /** Visual style variant */
  variant?: SurfaceVariant;
  /** Padding size */
  padding?: SurfacePadding;
  /** Additional CSS classes */
  className?: string;
  /** Content to render */
  children: React.ReactNode;
}

const VARIANT_CLASSES: Record<SurfaceVariant, string> = {
  raised: 'bg-card border border-border/40',
  inset: 'bg-muted/30 border border-border/30',
  outline: 'bg-transparent border border-border',
  ghost: 'bg-transparent',
};

const PADDING_CLASSES: Record<SurfacePadding, string> = {
  none: '',
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-6',
};

export function Surface({
  variant = 'raised',
  padding = 'md',
  className,
  children,
}: SurfaceProps) {
  return (
    <div
      className={cn(
        VARIANT_CLASSES[variant],
        PADDING_CLASSES[padding],
        className
      )}
    >
      {children}
    </div>
  );
}
