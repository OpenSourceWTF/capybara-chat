/**
 * Dialog - shadcn-style dialog/modal components
 * Based on shadcn/ui patterns with Tailwind CSS
 *
 * Accessibility features:
 * - role="dialog" with aria-modal="true"
 * - Focus trap (Escape to close, clicks outside)
 * - aria-labelledby for title
 * - aria-describedby for description (optional)
 */

import { HTMLAttributes, forwardRef, useEffect, useRef, useCallback, useId } from 'react';
import { X } from 'lucide-react';
import { Button } from './Button';

export interface DialogProps extends HTMLAttributes<HTMLDivElement> {
  open?: boolean;
  onClose?: () => void;
  /** ARIA label for dialog (uses title if not provided) */
  'aria-label'?: string;
  /** ID of element that describes the dialog */
  'aria-describedby'?: string;
}

export const Dialog = forwardRef<HTMLDivElement, DialogProps>(
  ({ open = true, onClose, className = '', children, 'aria-label': ariaLabel, 'aria-describedby': ariaDescribedBy, ...props }, ref) => {
    const dialogRef = useRef<HTMLDivElement>(null);
    const titleId = useId();

    // Handle Escape key
    const handleKeyDown = useCallback(
      (e: KeyboardEvent) => {
        if (e.key === 'Escape' && onClose) {
          e.preventDefault();
          onClose();
        }
      },
      [onClose]
    );

    // Focus management and keyboard handling
    useEffect(() => {
      if (!open) return;

      // Add event listener
      document.addEventListener('keydown', handleKeyDown);

      // Focus the dialog content
      const focusableElements = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusableElements && focusableElements.length > 0) {
        focusableElements[0].focus();
      }

      // Prevent body scroll
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        document.body.style.overflow = originalOverflow;
      };
    }, [open, handleKeyDown]);

    if (!open) return null;

    return (
      <div
        ref={ref}
        className="fixed inset-0 z-50 flex items-center justify-center"
        {...props}
      >
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/50"
          onClick={onClose}
          aria-hidden="true"
        />
        {/* Dialog content */}
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={ariaLabel ? undefined : titleId}
          aria-label={ariaLabel}
          aria-describedby={ariaDescribedBy}
          className={`relative z-50 ${className}`}
        >
          {/* Pass titleId to children for aria-labelledby linking */}
          {typeof children === 'function'
            ? (children as (props: { titleId: string }) => React.ReactNode)({ titleId })
            : children}
        </div>
      </div>
    );
  }
);
Dialog.displayName = 'Dialog';

export interface DialogContentProps extends HTMLAttributes<HTMLDivElement> {
  onClose?: () => void;
}

export const DialogContent = forwardRef<HTMLDivElement, DialogContentProps>(
  ({ className = '', children, ...props }, ref) => (
    <div
      ref={ref}
      className={`terminal-modal w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden font-mono ${className}`}
      {...props}
    >
      {children}
    </div>
  )
);
DialogContent.displayName = 'DialogContent';

export interface DialogHeaderProps extends HTMLAttributes<HTMLDivElement> {
  onClose?: () => void;
}

export const DialogHeader = forwardRef<HTMLDivElement, DialogHeaderProps>(
  ({ className = '', children, onClose, ...props }, ref) => (
    <div
      ref={ref}
      className={`flex justify-between items-center px-6 py-4 border-b border-border ${className}`}
      {...props}
    >
      <div className="flex-1">{children}</div>
      {onClose && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          aria-label="Close dialog"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </Button>
      )}
    </div>
  )
);
DialogHeader.displayName = 'DialogHeader';

export interface DialogTitleProps extends HTMLAttributes<HTMLHeadingElement> {
  /** ID for aria-labelledby linking */
  id?: string;
}

export const DialogTitle = forwardRef<HTMLHeadingElement, DialogTitleProps>(
  ({ className = '', ...props }, ref) => (
    <h2
      ref={ref}
      className={`text-lg font-semibold ${className}`}
      {...props}
    />
  )
);
DialogTitle.displayName = 'DialogTitle';

export interface DialogBodyProps extends HTMLAttributes<HTMLDivElement> { }

export const DialogBody = forwardRef<HTMLDivElement, DialogBodyProps>(
  ({ className = '', ...props }, ref) => (
    <div
      ref={ref}
      className={`flex-1 overflow-y-auto p-6 ${className}`}
      {...props}
    />
  )
);
DialogBody.displayName = 'DialogBody';

export interface DialogFooterProps extends HTMLAttributes<HTMLDivElement> { }

export const DialogFooter = forwardRef<HTMLDivElement, DialogFooterProps>(
  ({ className = '', ...props }, ref) => (
    <div
      ref={ref}
      className={`flex justify-end gap-2 p-4 border-t border-border ${className}`}
      {...props}
    />
  )
);
DialogFooter.displayName = 'DialogFooter';
