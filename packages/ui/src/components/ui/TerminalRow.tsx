/**
 * TerminalRow - A clickable row component with terminal aesthetics
 * 
 * Features:
 * - Left border "cursor" indicator on hover
 * - Monospace typography throughout
 * - Integrated date display
 * - Action buttons that appear on hover
 */

import React from 'react';
import { cn } from '../../lib/utils';

interface TerminalRowProps {
  className?: string;
  /** Formatted date string */
  date?: string;
  /** Tooltip text for date (shown on hover) */
  dateTooltip?: string;
  /** Row title/name */
  title: React.ReactNode;
  /** Metadata to display below title */
  meta?: React.ReactNode;
  /** Main content */
  children?: React.ReactNode;
  /** Action buttons (shown on hover) */
  actions?: React.ReactNode;
  /** Click handler for the entire row */
  onClick?: () => void;
  /** Whether this row is currently active/selected */
  active?: boolean;
  /** Test ID for testing */
  'data-testid'?: string;
}

export function TerminalRow({
  className,
  date,
  dateTooltip,
  title,
  meta,
  children,
  actions,
  onClick,
  active = false,
  'data-testid': testId,
}: TerminalRowProps) {
  return (
    <div
      className={cn(
        'terminal-row',
        'group flex items-start gap-3 p-4 border-b border-border/40',
        onClick && 'cursor-pointer',
        active && 'active',
        className
      )}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      } : undefined}
      data-testid={testId}
    >
      {/* Main Content Block */}
      <div className="flex-1 min-w-0 space-y-1">
        {/* Title Row with Date */}
        <div className="flex items-baseline justify-between gap-4">
          <div className="flex items-baseline gap-3 min-w-0">
            <h3 className="text-sm font-bold text-foreground truncate">
              {title}
            </h3>
            {date && (
              <span
                className="terminal-date whitespace-nowrap"
                title={dateTooltip}
              >
                {date}
              </span>
            )}
          </div>
          {/* Actions - visible on hover */}
          <div
            className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 self-start"
            onClick={(e) => e.stopPropagation()}
          >
            {actions}
          </div>
        </div>

        {/* Metadata Row */}
        {meta && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground select-none">
            {meta}
          </div>
        )}

        {/* Content */}
        {children && (
          <div className="mt-2 text-xs text-foreground/80 font-mono whitespace-pre-wrap break-words">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
