/**
 * UI Components Index
 * Re-exports all shadcn-style UI components
 */

export { Button, type ButtonProps } from './Button';
export { LoadingButton, type LoadingButtonProps } from './LoadingButton';
export { Input, type InputProps } from './Input';
export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, type CardProps } from './Card';
export { Badge, type BadgeProps } from './Badge';
export { StatusIndicator, type StatusIndicatorProps } from './StatusIndicator';
export { Select, type SelectProps } from './Select';
export { Textarea, type TextareaProps } from './Textarea';
export { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter, type DialogProps } from './Dialog';
export { Progress, type ProgressProps } from './Progress';
export { Label, type LabelProps } from './Label';
export { LoadingSpinner, type LoadingSpinnerProps } from './LoadingSpinner';
export { EmptyState, type EmptyStateProps } from './EmptyState';
export { Markdown, type MarkdownProps } from './Markdown';
export { Skeleton, SkeletonCircle, SkeletonText, SessionCardSkeleton, ChatMessageSkeleton, ListSkeleton } from './Skeleton';
export { LockableInput, type LockableInputProps } from './LockableInput';
export { LockableTextarea, type LockableTextareaProps } from './LockableTextarea';
export { MarkdownTextarea, type MarkdownTextareaProps } from './MarkdownTextarea';
export { LockableSelect, type LockableSelectProps, type SelectOption } from './LockableSelect';
export { ActionDialog, ConfirmDeleteDialog, ConfirmDialog, UnsavedChangesDialog, type ActionDialogProps, type ConfirmDeleteDialogProps, type ConfirmDialogProps, type UnsavedChangesDialogProps } from './ActionDialog';
export { TagList } from './TagList';
export { EditingContextBadge, type EditingContextBadgeProps } from './EditingContextBadge';
export { Switch, type SwitchProps } from './Switch';
export { FormField, type FormFieldProps } from './FormField';
export { TagInput, type TagInputProps } from './TagInput';
export { KeyValueEditor, type KeyValueEditorProps } from './KeyValueEditor';

// Layout Components (Styleguide-compliant)
export { PageContainer } from './PageContainer';
export { PageHeader } from './PageHeader';
export { Surface } from './Surface';
export { MetadataRow } from './MetadataRow';
export { ContentPreview } from './ContentPreview';

// Terminal Components (Cozy Terminal aesthetic)
export { TerminalTag } from './TerminalTag';
export { TerminalRow } from './TerminalRow';
export * from './TerminalSearchBar';


// Agent Manager Components
export { PromptPicker, type PromptPickerProps } from './PromptPicker';
export { MCPServerEditor, type MCPServerEditorProps } from './McpServerEditor';
export { SubagentEditor, type SubagentEditorProps } from './SubagentEditor';
export { PermissionView, type PermissionViewProps } from './PermissionView';
export { SearchableSelect } from './SearchableSelect';

// Avatar Components (ID-based generated faces)
export { Avatar, RobotFaceAvatar, ASCIIFaceAvatar } from './Avatar';

// Lazy loading utilities
export { ViewFallback, ModalFallback } from './LazyFallback';

// Copyable Elements
export { CopyableId, type CopyableIdProps } from './CopyableId';

// Action Components
export { DeleteActionButton, type DeleteActionButtonProps } from './DeleteActionButton';

// Navigation Components
export { BreadcrumbBar, type BreadcrumbBarProps, type BreadcrumbItem } from './BreadcrumbBar';
