/**
 * DeleteActionButton - Reusable delete confirmation UI
 *
 * Provides a consistent delete pattern:
 * 1. Click trash icon → shows confirm/cancel buttons
 * 2. Click confirm → executes delete
 * 3. Click cancel → resets to icon state
 *
 * This eliminates ~30 lines of duplicated JSX across library components.
 */

import { Trash2 } from 'lucide-react';
import { Button } from './Button';

interface BaseEntity {
  id: string;
}

export interface DeleteActionButtonProps<T extends BaseEntity> {
  /** The item this button is for */
  item: T;
  /** Currently targeted item for deletion (null if none) */
  deleteTarget: T | null;
  /** Called when user clicks the trash icon */
  onDeleteClick: (item: T) => void;
  /** Called when user confirms deletion */
  onConfirm: () => void;
  /** Called when user cancels deletion */
  onCancel: () => void;
  /** Whether delete is in progress */
  isDeleting?: boolean;
  /** Accessible label for the delete button */
  deleteLabel?: string;
}

/**
 * Delete action button with confirm/cancel state
 */
export function DeleteActionButton<T extends BaseEntity>({
  item,
  deleteTarget,
  onDeleteClick,
  onConfirm,
  onCancel,
  isDeleting = false,
  deleteLabel = 'Delete',
}: DeleteActionButtonProps<T>) {
  const isTargeted = deleteTarget?.id === item.id;

  if (isTargeted) {
    return (
      <div className="flex items-center h-6">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onConfirm();
          }}
          className="h-6 px-1.5 text-2xs font-mono text-destructive hover:bg-destructive/10 disabled:opacity-50"
          disabled={isDeleting}
        >
          {isDeleting ? '...' : 'delete'}
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onCancel();
          }}
          className="h-6 px-1.5 text-2xs font-mono text-muted-foreground hover:bg-muted/50 disabled:opacity-50"
          disabled={isDeleting}
        >
          cancel
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center h-6">
      <Button
        variant="ghost"
        size="icon"
        onClick={(e) => {
          e.stopPropagation();
          onDeleteClick(item);
        }}
        className="h-6 w-6 text-muted-foreground hover:text-destructive"
        title={deleteLabel}
      >
        <Trash2 className="w-3 h-3" />
      </Button>
    </div>
  );
}
