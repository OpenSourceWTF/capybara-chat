/**
 * BreadcrumbBar - Terminal-style breadcrumb navigation
 *
 * Design: "Cozy Terminal" aesthetic
 * - Format: `> ITEM / ITEM / [ CURRENT ]`
 * - ">" prefix at start
 * - "/" separators between items (aria-hidden)
 * - Current item wrapped in brackets and has aria-current="page"
 * - Monospace font, zero radius
 */

import { cn } from '../../lib/utils';

export interface BreadcrumbItem {
  label: string;
  href?: string;
  onClick?: () => void;
}

export interface BreadcrumbBarProps {
  items: BreadcrumbItem[];
  className?: string;
}

/**
 * Determines if an item is the current (non-clickable) item.
 * An item is current if it has no href and no onClick handler.
 */
function isCurrent(item: BreadcrumbItem): boolean {
  return !item.href && !item.onClick;
}

export function BreadcrumbBar({ items, className }: BreadcrumbBarProps) {
  return (
    <nav
      aria-label="Breadcrumb"
      className={cn(
        'font-mono text-sm flex items-center gap-2',
        className
      )}
    >
      {/* Terminal-style prompt prefix */}
      <span className="text-muted-foreground" aria-hidden="true">
        {'>'}
      </span>

      <ol className="flex items-center gap-2 list-none m-0 p-0">
        {items.map((item, index) => {
          const isCurrentItem = isCurrent(item);

          return (
            <li key={index} className="flex items-center gap-2">
              {/* Separator (not before first item) */}
              {index > 0 && (
                <span className="text-muted-foreground" aria-hidden="true">
                  /
                </span>
              )}

              {/* Item content */}
              {isCurrentItem ? (
                // Current item: non-clickable span with brackets
                <span
                  aria-current="page"
                  className="text-foreground font-bold uppercase tracking-wider truncate max-w-[300px]"
                >
                  <span aria-hidden="true">[</span>
                  {' '}{item.label}{' '}
                  <span aria-hidden="true">]</span>
                </span>
              ) : item.href ? (
                // Link item
                <a
                  href={item.href}
                  onClick={item.onClick}
                  className="text-muted-foreground hover:text-foreground font-bold uppercase tracking-wider transition-colors truncate max-w-[300px]"
                >
                  {item.label}
                </a>
              ) : (
                // Button item (onClick but no href)
                <button
                  type="button"
                  onClick={item.onClick}
                  className="text-muted-foreground hover:text-foreground font-bold uppercase tracking-wider transition-colors truncate max-w-[300px] bg-transparent border-none p-0 cursor-pointer"
                >
                  {item.label}
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

BreadcrumbBar.displayName = 'BreadcrumbBar';
