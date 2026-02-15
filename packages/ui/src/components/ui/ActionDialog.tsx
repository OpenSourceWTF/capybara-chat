/**
 * ActionDialog - Unified confirmation dialog component
 *
 * Consolidates ConfirmDeleteDialog, ConfirmDialog, and UnsavedChangesDialog
 * into a single flexible component with GitHub modal styling.
 *
 * @example Delete confirmation
 * ```tsx
 * <ActionDialog
 *   open={showDelete}
 *   variant="destructive"
 *   icon={<Trash2 />}
 *   title="Delete document"
 *   subtitle={doc.name}
 *   description="Are you sure? This action cannot be undone."
 *   confirmText="Delete"
 *   onConfirm={handleDelete}
 *   onCancel={() => setShowDelete(false)}
 * />
 * ```
 *
 * @example Unsaved changes (3-button)
 * ```tsx
 * <ActionDialog
 *   open={showUnsaved}
 *   variant="warning"
 *   icon={<AlertTriangle />}
 *   title="Unsaved Changes"
 *   description="You have unsaved changes. What would you like to do?"
 *   actions={[
 *     { label: 'Cancel', onClick: onCancel, variant: 'ghost' },
 *     { label: 'Discard', onClick: onDiscard, variant: 'destructive' },
 *     { label: 'Save', onClick: onSave, variant: 'primary', icon: <Save /> },
 *   ]}
 * />
 * ```
 */

import { ReactNode } from 'react';
import { cn } from '../../lib/utils';

type ActionVariant = 'destructive' | 'warning' | 'primary';

interface ActionButton {
  label: string;
  onClick: () => void;
  variant?: 'ghost' | 'destructive' | 'primary' | 'warning';
  icon?: ReactNode;
  loading?: boolean;
  disabled?: boolean;
}

export interface ActionDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Visual variant - affects icon background and primary button color */
  variant?: ActionVariant;
  /** Icon to display in header */
  icon: ReactNode;
  /** Dialog title */
  title: string;
  /** Optional subtitle (e.g., entity name) */
  subtitle?: string;
  /** Description text */
  description: ReactNode;
  /** Called when user confirms (simple 2-button mode) */
  onConfirm?: () => void;
  /** Called when user cancels */
  onCancel: () => void;
  /** Confirm button text (default based on variant) */
  confirmText?: string;
  /** Whether confirm action is in progress */
  isLoading?: boolean;
  /** Custom actions for multi-button mode (overrides onConfirm/confirmText) */
  actions?: ActionButton[];
}

const variantStyles: Record<ActionVariant, { iconBg: string; buttonBg: string; buttonHover: string }> = {
  destructive: {
    iconBg: 'bg-destructive/20',
    buttonBg: 'bg-destructive text-destructive-foreground',
    buttonHover: 'hover:bg-destructive/90',
  },
  warning: {
    iconBg: 'bg-warning/20',
    buttonBg: 'bg-warning text-black',
    buttonHover: 'hover:bg-warning/90',
  },
  primary: {
    iconBg: 'bg-primary/20',
    buttonBg: 'bg-primary text-primary-foreground',
    buttonHover: 'hover:bg-primary/90',
  },
};

const defaultConfirmText: Record<ActionVariant, string> = {
  destructive: 'Delete',
  warning: 'Confirm',
  primary: 'Confirm',
};

export function ActionDialog({
  open,
  variant = 'primary',
  icon,
  title,
  subtitle,
  description,
  onConfirm,
  onCancel,
  confirmText,
  isLoading = false,
  actions,
}: ActionDialogProps) {
  if (!open) return null;

  const styles = variantStyles[variant];
  const finalConfirmText = confirmText ?? defaultConfirmText[variant];

  // Build actions array - either custom or default 2-button
  const resolvedActions: ActionButton[] = actions ?? [
    { label: 'Cancel', onClick: onCancel, variant: 'ghost' },
    {
      label: finalConfirmText,
      onClick: onConfirm!,
      variant: variant === 'destructive' ? 'destructive' : variant === 'warning' ? 'warning' : 'primary',
      loading: isLoading,
      disabled: isLoading,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Dialog - Terminal Modal style */}
      <div className="terminal-modal relative w-[420px] overflow-hidden">
        {/* Header */}
        <div className="terminal-modal-header">
          <div className="terminal-modal-header-bg" />

          <div className="terminal-modal-header-content">
            <div className={cn('p-2.5 bg-background border border-border relative z-10', styles.iconBg)}>
              <div className={cn(
                'w-5 h-5',
                variant === 'destructive' && 'text-destructive',
                variant === 'warning' && 'text-warning',
                variant === 'primary' && 'text-primary'
              )}>
                {icon}
              </div>
            </div>
            <div className="flex-1 min-w-0 relative z-10">
              <h2 className="text-base font-bold uppercase tracking-wider text-foreground">
                {title}
              </h2>
              {subtitle && (
                <p className="text-xs text-muted-foreground mt-0.5 truncate font-mono">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="terminal-modal-body">
          <div className="text-sm text-foreground/90 font-mono leading-relaxed">
            {description}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border bg-muted/30">
          {resolvedActions.map((action) => (
            <button
              key={action.label}
              onClick={action.onClick}
              disabled={action.disabled || action.loading}
              className={cn(
                'px-4 py-2 text-xs font-bold uppercase tracking-wider border transition-all flex items-center gap-1.5 rounded-none',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                action.variant === 'ghost' && 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted',
                action.variant === 'destructive' && 'bg-destructive text-destructive-foreground border-destructive hover:bg-destructive/90',
                action.variant === 'warning' && 'bg-warning text-black border-warning hover:bg-warning/90',
                action.variant === 'primary' && 'bg-primary text-primary-foreground border-primary hover:bg-primary/90',
              )}
            >
              {action.icon && <span className="w-3.5 h-3.5">{action.icon}</span>}
              {action.loading ? '...' : action.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// CONVENIENCE WRAPPERS - For backward compatibility and common use cases
// ============================================================================

import { Trash2, AlertTriangle, Save, X } from 'lucide-react';

export interface ConfirmDeleteDialogProps {
  open: boolean;
  entityType?: string;
  entityName?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting?: boolean;
  title?: string;
  description?: string;
}

/**
 * Delete Confirmation Dialog - Wrapper around ActionDialog
 */
export function ConfirmDeleteDialog({
  open,
  entityType = 'item',
  entityName,
  onConfirm,
  onCancel,
  isDeleting = false,
  title,
  description,
}: ConfirmDeleteDialogProps) {
  const defaultTitle = title ?? `Delete ${entityType}`;
  const defaultDescription = description ?? (
    entityName
      ? `Are you sure you want to delete "${entityName}"? This action cannot be undone.`
      : `Are you sure you want to delete this ${entityType}? This action cannot be undone.`
  );

  return (
    <ActionDialog
      open={open}
      variant="destructive"
      icon={<Trash2 className="w-5 h-5" />}
      title={defaultTitle}
      subtitle={entityName}
      description={defaultDescription}
      confirmText="Delete"
      onConfirm={onConfirm}
      onCancel={onCancel}
      isLoading={isDeleting}
    />
  );
}

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
  confirmText?: string;
  destructive?: boolean;
  icon?: React.ReactNode;
}

/**
 * Generic Confirmation Dialog - Wrapper around ActionDialog
 */
export function ConfirmDialog({
  open,
  title,
  description,
  onConfirm,
  onCancel,
  isLoading = false,
  confirmText = 'Confirm',
  destructive = false,
  icon,
}: ConfirmDialogProps) {
  return (
    <ActionDialog
      open={open}
      variant={destructive ? 'destructive' : 'warning'}
      icon={icon ?? <AlertTriangle className="w-5 h-5" />}
      title={title}
      description={description}
      confirmText={confirmText}
      onConfirm={onConfirm}
      onCancel={onCancel}
      isLoading={isLoading}
    />
  );
}

export interface UnsavedChangesDialogProps {
  open: boolean;
  entityType?: string;
  changedFieldCount?: number;
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
  isSaving?: boolean;
}

/**
 * Unsaved Changes Dialog - Wrapper around ActionDialog with 3 buttons
 */
export function UnsavedChangesDialog({
  open,
  entityType = 'form',
  changedFieldCount,
  onSave,
  onDiscard,
  onCancel,
  isSaving = false,
}: UnsavedChangesDialogProps) {
  const descriptionText = changedFieldCount !== undefined
    ? <>You have <span className="text-warning font-medium">{changedFieldCount} unsaved change{changedFieldCount !== 1 ? 's' : ''}</span>. What would you like to do?</>
    : <>Your changes to this {entityType} haven't been saved yet. What would you like to do?</>;

  return (
    <ActionDialog
      open={open}
      variant="warning"
      icon={<AlertTriangle className="w-5 h-5" />}
      title="Unsaved Changes"
      subtitle={`Changes to ${entityType}`}
      description={descriptionText}
      onCancel={onCancel}
      actions={[
        { label: 'Cancel', onClick: onCancel, variant: 'ghost' },
        { label: 'Discard', onClick: onDiscard, variant: 'destructive', icon: <X className="w-3.5 h-3.5" /> },
        { label: 'Save Changes', onClick: onSave, variant: 'warning', icon: <Save className="w-3.5 h-3.5" />, loading: isSaving, disabled: isSaving },
      ]}
    />
  );
}
