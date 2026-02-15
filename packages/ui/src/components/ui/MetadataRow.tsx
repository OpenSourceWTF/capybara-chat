/**
 * MetadataRow - Inline metadata display with subtle separators
 * 
 * Replaces heavy grid layouts with a clean horizontal flow.
 * Used for dates, status, and other metadata.
 */

import { cn } from '../../lib/utils';

interface MetadataItem {
  /** Label for the item (optional, shown in muted text) */
  label?: string;
  /** Value to display */
  value: React.ReactNode;
  /** Whether to use monospace font */
  mono?: boolean;
}

interface MetadataRowProps {
  /** Metadata items to display */
  items: MetadataItem[];
  /** Separator character */
  separator?: string;
  /** Additional CSS classes */
  className?: string;
}

export function MetadataRow({
  items,
  separator = '•',
  className,
}: MetadataRowProps) {
  const filteredItems = items.filter((item) => item.value !== null && item.value !== undefined);

  return (
    <div
      className={cn(
        'flex items-center gap-3 text-sm text-muted-foreground flex-wrap',
        className
      )}
    >
      {filteredItems.map((item, index) => (
        <span key={item.label ?? `item-${index}`} className="flex items-center gap-1.5">
          {index > 0 && (
            <span className="opacity-30 -ml-1.5 mr-1.5">{separator}</span>
          )}
          {item.label && (
            <span className="text-xs uppercase tracking-wide opacity-70">
              {item.label}:
            </span>
          )}
          <span className={cn(item.mono && 'font-mono text-xs')}>
            {item.value}
          </span>
        </span>
      ))}
    </div>
  );
}
