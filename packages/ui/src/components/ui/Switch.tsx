/**
 * Switch - Terminal-style toggle switch component
 * Uses ASCII-style [ON ] / [OFF] display for cozy terminal aesthetic
 */

import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

export interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, checked = false, onCheckedChange, disabled, id, ...props }, ref) => {
    return (
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        id={id}
        className={cn(
          'peer inline-flex shrink-0 cursor-pointer items-center border border-border shadow-sm transition-colors font-mono text-xs',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          'disabled:cursor-not-allowed disabled:opacity-50',
          checked ? 'bg-primary text-primary-foreground' : 'bg-input text-foreground',
          className
        )}
        onClick={() => onCheckedChange?.(!checked)}
      >
        <span className="px-1.5 py-0.5 select-none">
          {checked ? '[ON ]' : '[OFF]'}
        </span>
        <input
          ref={ref}
          type="checkbox"
          checked={checked}
          onChange={(e) => onCheckedChange?.(e.target.checked)}
          disabled={disabled}
          className="sr-only"
          {...props}
        />
      </button>
    );
  }
);

Switch.displayName = 'Switch';
