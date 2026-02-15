/**
 * withLockable HOC - Higher-Order Component for lockable form fields
 *
 * Provides consistent lock state, AI typing indicator, and error display
 * across input, textarea, and select components.
 *
 * This eliminates ~80% duplication across lockable-input, lockable-textarea, and lockable-select.
 */

import type { ReactNode } from 'react';
import { Lock } from 'lucide-react';
import { cn } from '../../lib/utils';

/**
 * Base props that all lockable components share
 */
export interface LockableBaseProps {
  /** Whether the field is locked */
  locked?: boolean;
  /** Who/what locked the field */
  lockedBy?: string;
  /** Label for the field */
  label?: string;
  /** Error message */
  error?: string;
  /** Whether AI is currently typing in this field */
  aiTyping?: boolean;
  /** Whether AI just filled this field (triggers fade-out highlight) */
  aiFilled?: boolean;
}

/**
 * Props for the FieldWrapper component
 */
interface FieldWrapperProps extends LockableBaseProps {
  children: ReactNode;
}

/**
 * Reusable field wrapper with label and error display
 */
export function FieldWrapper({ label, locked, lockedBy, error, children }: FieldWrapperProps) {
  return (
    <div className="space-y-1.5">
      {label && (
        <div className="flex items-center justify-between">
          <label className="text-2xs font-bold uppercase tracking-wider font-mono text-foreground">{label}</label>
          {locked && (
            <div className="flex items-center gap-1 text-2xs text-muted-foreground font-mono">
              <Lock className="w-3 h-3" aria-hidden="true" />
              <span>{lockedBy ? `Locked by ${lockedBy}` : 'Locked'}</span>
            </div>
          )}
        </div>
      )}
      {children}
      {error && (
        <p className="text-2xs text-destructive font-mono" role="alert" id={`${label?.toLowerCase().replace(/\s+/g, '-')}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * AI typing indicator component - warm, friendly animation
 */
export function AiTypingIndicator({ position = 'center' }: { position?: 'center' | 'top' }) {
  const positionClass = position === 'center'
    ? 'top-1/2 -translate-y-1/2'
    : 'top-3';

  return (
    <div className={cn('absolute right-3 flex items-center gap-1', positionClass)}>
      <span className="text-2xs font-medium text-ai-editing mr-1 font-mono">AI</span>
      <div className="flex gap-0.5">
        <div className="ai-typing-dot" aria-hidden="true" />
        <div className="ai-typing-dot" aria-hidden="true" />
        <div className="ai-typing-dot" aria-hidden="true" />
      </div>
    </div>
  );
}

/**
 * Lock icon overlay component - warm amber when AI has locked a field
 */
export function LockIconOverlay({ position = 'center' }: { position?: 'center' | 'top' }) {
  const positionClass = position === 'center'
    ? 'top-1/2 -translate-y-1/2'
    : 'top-3';

  return (
    <div className={cn('absolute right-3 text-ai-locked drop-shadow-sm', positionClass)} aria-hidden="true">
      <Lock className="w-4 h-4" />
    </div>
  );
}

/**
 * Get CSS classes for lockable field styling
 * Uses CSS custom properties for AI collaboration states
 */
export function getLockableClasses(locked?: boolean, aiTyping?: boolean, error?: boolean, aiFilled?: boolean): string {
  return cn(
    locked && 'field-ai-locked',
    aiTyping && !locked && 'field-ai-editing',
    aiFilled && !locked && !aiTyping && 'field-ai-filled',
    error && 'border-destructive'
  );
}

/**
 * NOTE: The withLockable HOC pattern has complex TypeScript requirements.
 * Instead of using an HOC, prefer using the shared utilities directly in
 * lockable components:
 *
 * - FieldWrapper: Handles label and error display
 * - LockIconOverlay: Lock icon with positioning
 * - AiTypingIndicator: Animated typing indicator
 * - getLockableClasses: CSS classes for lock states
 * - useLockableField: Hook for lockable logic
 *
 * See lockable-input.tsx, lockable-textarea.tsx, and lockable-select.tsx
 * for examples of how to use these utilities.
 */

/**
 * Hook for lockable field logic (alternative to HOC pattern)
 */
export function useLockableField(props: LockableBaseProps & { disabled?: boolean }) {
  const { locked, lockedBy, label, error, aiTyping, aiFilled, disabled } = props;

  const isDisabled = disabled || locked;
  const lockableClasses = getLockableClasses(locked, aiTyping, !!error, aiFilled);

  const ariaProps = {
    'aria-invalid': !!error,
    'aria-describedby': error && label ? `${label.toLowerCase().replace(/\s+/g, '-')}-error` : undefined,
  };

  return {
    isDisabled,
    lockableClasses,
    ariaProps,
    showLockIcon: locked,
    showAiTyping: aiTyping && !locked,
    wrapperProps: { label, locked, lockedBy, error },
  };
}
