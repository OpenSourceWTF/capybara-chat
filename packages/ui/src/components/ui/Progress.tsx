/**
 * Progress - shadcn-style progress bar component
 * Based on shadcn/ui patterns with Tailwind CSS
 */

import { HTMLAttributes, forwardRef } from 'react';

export interface ProgressProps extends HTMLAttributes<HTMLDivElement> {
  value?: number;
  max?: number;
}

export const Progress = forwardRef<HTMLDivElement, ProgressProps>(
  ({ value = 0, max = 100, className = '', ...props }, ref) => {
    const percentage = Math.min(100, Math.max(0, (value / max) * 100));

    // Terminal-style ASCII progress bar
    const totalBlocks = 20;
    const filledBlocks = Math.round((percentage / 100) * totalBlocks);
    const emptyBlocks = totalBlocks - filledBlocks;

    return (
      <div
        ref={ref}
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        className={`font-mono text-sm ${className}`}
        {...props}
      >
        <span className="text-muted-foreground">[</span>
        <span className="text-primary">{'█'.repeat(filledBlocks)}</span>
        <span className="text-muted-foreground/40">{'░'.repeat(emptyBlocks)}</span>
        <span className="text-muted-foreground">]</span>
      </div>
    );
  }
);

Progress.displayName = 'Progress';
