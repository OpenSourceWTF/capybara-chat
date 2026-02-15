/**
 * ContentPreview - Terminal-style content display
 * 
 * Used in both View and Edit modes for consistent content presentation.
 * Uses hard edges and CLI-style header for terminal aesthetic.
 */

import { cn } from '../../lib/utils';

interface ContentPreviewProps {
  /** Filename or label to display in header */
  filename?: string;
  /** Content to render */
  children: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
  /** Whether to show the header bar */
  showHeader?: boolean;
  /** Command prefix (cat for view, vim for edit) */
  commandPrefix?: 'cat' | 'vim' | 'markdown';
}

export function ContentPreview({
  filename,
  children,
  className,
  showHeader = true,
  commandPrefix = 'cat',
}: ContentPreviewProps) {
  return (
    <div
      className={cn(
        'bg-muted/10 border border-border overflow-hidden',
        className
      )}
    >
      {showHeader && (
        <div className="px-3 py-2 border-b border-border bg-muted/20 flex items-center gap-2">
          <span className="text-2xs font-mono text-muted-foreground/60 uppercase tracking-wider select-none">
            {commandPrefix}
          </span>
          {filename && (
            <span className="text-2xs font-mono text-foreground/70 tracking-wide">
              {filename}
            </span>
          )}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}
