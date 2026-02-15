/**
 * Button - shadcn-style button component
 * Based on shadcn/ui patterns with Tailwind CSS variants
 */

import { ButtonHTMLAttributes, forwardRef } from 'react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

const buttonVariants = {
  // Enhanced base: added active state feedback and improved focus styling
  base: 'inline-flex items-center justify-center gap-2 whitespace-nowrap font-mono font-medium transition-all duration-100 focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-[-2px] disabled:pointer-events-none disabled:opacity-50 rounded-none uppercase tracking-wider active:scale-[0.97] active:transition-none',
  variants: {
    default: 'bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary/80',
    destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90 active:bg-destructive/80',
    outline: 'border border-border bg-background hover:bg-muted hover:text-foreground hover:border-primary/50 active:bg-muted/80',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80 active:bg-secondary/70',
    ghost: 'hover:bg-muted hover:text-foreground active:bg-muted/80',
    link: 'text-primary underline-offset-4 hover:underline active:scale-100',
  },
  sizes: {
    default: 'h-9 px-4 py-2 text-xs',
    sm: 'h-8 px-3 text-2xs',
    lg: 'h-10 px-8 text-sm',
    icon: 'h-9 w-9',
  },
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'default', size = 'default', ...props }, ref) => {
    const classes = [
      buttonVariants.base,
      buttonVariants.variants[variant],
      buttonVariants.sizes[size],
      className,
    ].join(' ');

    return <button className={classes} ref={ref} {...props} />;
  }
);

Button.displayName = 'Button';
