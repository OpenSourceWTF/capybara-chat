/**
 * Terminal Field Styles - Shared styling utilities for form fields
 *
 * Provides consistent styling across Input, Textarea, and Select components
 * with support for 'default' and 'terminal' variants.
 *
 * Variants:
 * - default: Full border box (legacy style)
 * - terminal: Border-bottom only, transparent bg, compact (Cozy Terminal aesthetic)
 */

import { cn } from './utils';

export type FieldVariant = 'default' | 'terminal';
export type FieldElement = 'input' | 'textarea' | 'select';

/**
 * Base classes shared by all field types
 */
const BASE_CLASSES = "w-full rounded-none text-sm font-mono transition-colors placeholder:text-muted-foreground/50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50";

/**
 * Variant-specific base styles
 */
const VARIANT_BASE = {
  default: "border border-border bg-background shadow-sm focus-visible:ring-1 focus-visible:ring-primary",
  terminal: "border-0 border-b border-border bg-transparent shadow-none focus:border-primary focus-visible:ring-0",
} as const;

/**
 * Element-specific sizing for each variant
 */
const VARIANT_SIZING = {
  default: {
    input: "h-10 px-3 py-2",
    textarea: "px-3 py-2",
    select: "h-10 px-3 py-2 pr-8",
  },
  terminal: {
    input: "h-8 px-2 py-1",
    textarea: "px-2 py-1 resize-none",
    select: "h-8 px-2 py-1 pr-7",
  },
} as const;

/**
 * Chevron positioning for Select component
 */
export const SELECT_CHEVRON_STYLES = {
  default: "top-3 right-2.5",
  terminal: "top-2 right-1.5",
} as const;

/**
 * Get combined field classes for a specific element and variant
 *
 * @param element - The field element type ('input', 'textarea', 'select')
 * @param variant - The style variant ('default' or 'terminal')
 * @param extraClasses - Additional element-specific classes (e.g., 'flex', 'min-h-[80px]')
 * @returns Combined className string
 *
 * @example
 * // Input with terminal variant
 * getFieldClasses('input', 'terminal')
 *
 * // Textarea with default variant and custom height
 * getFieldClasses('textarea', 'default', 'min-h-[120px]')
 */
export function getFieldClasses(
  element: FieldElement,
  variant: FieldVariant,
  extraClasses?: string
): string {
  return cn(
    BASE_CLASSES,
    VARIANT_BASE[variant],
    VARIANT_SIZING[variant][element],
    extraClasses
  );
}
