/**
 * Label - shadcn-style label component
 * Based on shadcn/ui patterns with Tailwind CSS
 */

import { LabelHTMLAttributes, forwardRef } from 'react';

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> { }

export const Label = forwardRef<HTMLLabelElement, LabelProps>(
  ({ className = '', ...props }, ref) => {
    return (
      <label
        ref={ref}
        className={`text-2xs font-bold uppercase tracking-wider font-mono leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${className}`}
        {...props}
      />
    );
  }
);

Label.displayName = 'Label';
