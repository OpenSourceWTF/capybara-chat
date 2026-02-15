/**
 * PageContainer - Unified page wrapper for consistent layout
 * 
 * Provides:
 * - Consistent padding and max-width
 * - Scrollable content area
 * - Vertical spacing rhythm
 */

import { cn } from '../../lib/utils';

interface PageContainerProps {
  /** Content to render */
  children: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
  /** Maximum width variant */
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  /** Padding size */
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const MAX_WIDTH_CLASSES = {
  sm: 'max-w-2xl',
  md: 'max-w-3xl',
  lg: 'max-w-4xl',
  xl: 'max-w-5xl',
  full: 'max-w-none',
} as const;

const PADDING_CLASSES = {
  none: '',
  sm: 'px-4 py-4',
  md: 'px-6 py-6',
  lg: 'px-8 py-8',
} as const;

export function PageContainer({
  children,
  className,
  maxWidth = 'xl',
  padding = 'md',
}: PageContainerProps) {
  return (
    <div className={cn('h-full overflow-y-auto bg-background', className)}>
      <div
        className={cn(
          'mx-auto space-y-6',
          MAX_WIDTH_CLASSES[maxWidth],
          PADDING_CLASSES[padding]
        )}
      >
        {children}
      </div>
    </div>
  );
}
