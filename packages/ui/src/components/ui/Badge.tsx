/**
 * Badge - Premium Cozy Badge Component
 * 
 * Design System:
 * - Variants: solid (high contrast), soft (cozy default), outline (subtle), ghost (minimal)
 * - Intents: primary, secondary, success, warning, danger, info, neutral
 * - Typography: Uppercase/tracking-wide for status (default), normal for content
 */

import { HTMLAttributes, forwardRef } from 'react';
import { cn } from '../../lib/utils';

export interface BadgeProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'solid' | 'soft' | 'outline' | 'ghost';
  intent?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'info' | 'progress' | 'neutral';
  size?: 'default' | 'sm' | 'lg';
  /**
   * If true, uses sentence case and larger font for content tags instead of status labels.
   */
  isTag?: boolean;
}

export const Badge = forwardRef<HTMLDivElement, BadgeProps>(
  ({ className = '', variant = 'soft', intent = 'neutral', size = 'default', isTag, ...props }, ref) => {

    const baseClasses = "inline-flex items-center font-mono transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-none";

    // Typography classes
    const typoClasses = isTag
      ? "font-medium tracking-normal normal-case"
      : "font-bold uppercase tracking-wider";

    // Size classes
    let sizeClasses = "";
    if (isTag) {
      sizeClasses = "text-xs px-2.5 py-0.5 h-auto"; // Tag sizing
    } else {
      switch (size) {
        case 'sm': sizeClasses = "h-4 px-1.5 text-3xs"; break;
        case 'lg': sizeClasses = "h-6 px-3 text-xs"; break;
        default: sizeClasses = "h-5 px-2 py-0.5 text-2xs"; break; // default
      }
    }

    // Color/Variant Logic
    let colorClasses = "";

    // Helper for intents
    const intents = {
      primary: {
        solid: "bg-primary text-white border-transparent shadow hover:bg-primary/90",
        soft: "bg-primary/10 text-primary border-primary/20",
        outline: "text-primary border-primary/30",
        ghost: "text-primary hover:bg-primary/10",
      },
      secondary: {
        solid: "bg-secondary text-secondary-foreground border-transparent hover:bg-secondary/80",
        soft: "bg-secondary/50 text-secondary-foreground border-secondary/50",
        outline: "text-secondary-foreground border-border",
        ghost: "text-secondary-foreground hover:bg-secondary/50",
      },
      success: {
        solid: "bg-emerald-600 dark:bg-emerald-500 text-white border-transparent shadow",
        soft: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-transparent",
        outline: "text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
        ghost: "text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10",
      },
      warning: {
        solid: "bg-amber-600 dark:bg-amber-500 text-white border-transparent shadow",
        soft: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-transparent",
        outline: "text-amber-700 dark:text-amber-400 border-amber-500/30",
        ghost: "text-amber-700 dark:text-amber-400 hover:bg-amber-500/10",
      },
      danger: {
        solid: "bg-red-600 dark:bg-red-500 text-white border-transparent shadow",
        soft: "bg-red-500/10 text-red-700 dark:text-red-400 border-transparent",
        outline: "text-red-700 dark:text-red-400 border-red-500/30",
        ghost: "text-red-700 dark:text-red-400 hover:bg-red-500/10",
      },
      info: {
        solid: "bg-blue-600 dark:bg-blue-500 text-white border-transparent shadow",
        soft: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-transparent",
        outline: "text-blue-700 dark:text-blue-400 border-blue-500/30",
        ghost: "text-blue-700 dark:text-blue-400 hover:bg-blue-500/10",
      },
      // Progress intent - distinct violet color for running/processing states
      progress: {
        solid: "bg-progress text-white border-transparent shadow",
        soft: "bg-progress/10 text-progress border-transparent",
        outline: "text-progress border-progress/30",
        ghost: "text-progress hover:bg-progress/10",
      },
      neutral: {
        solid: "bg-zinc-600 dark:bg-zinc-500 text-white border-transparent shadow",
        soft: "bg-zinc-500/10 text-zinc-700 dark:text-zinc-400 border-transparent",
        outline: "text-zinc-700 dark:text-zinc-400 border-zinc-500/30",
        ghost: "text-zinc-700 dark:text-zinc-400 hover:bg-zinc-500/10",
      },
    };

    // Apply variant styles based on intent
    const intentStyles = intents[intent] || intents.neutral;
    colorClasses = intentStyles[variant] || intentStyles.soft;

    // Additional shared border class if not ghost
    const borderClass = variant !== 'ghost' && variant !== 'solid' ? "border" : "";

    return (
      <div
        className={cn(baseClasses, borderClass, typoClasses, sizeClasses, colorClasses, className)}
        ref={ref}
        {...props}
      >
        <span className="opacity-50 mr-[1px]">[</span>
        {props.children}
        <span className="opacity-50 ml-[1px]">]</span>
      </div>
    );
  }
);

Badge.displayName = 'Badge';
