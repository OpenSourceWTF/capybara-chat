/**
 * useModal - Hook for managing modal open/close state
 *
 * Provides a clean API for modal state management with optional data passing.
 *
 * @example
 * // Simple modal
 * const addModal = useModal();
 * <button onClick={addModal.open}>Add</button>
 * {addModal.isOpen && <AddModal onClose={addModal.close} />}
 *
 * @example
 * // Modal with data
 * const editModal = useModal<{ id: string }>();
 * <button onClick={() => editModal.openWith({ id: '123' })}>Edit</button>
 * {editModal.isOpen && <EditModal item={editModal.data} onClose={editModal.close} />}
 */

import { useState, useCallback } from 'react';

export interface UseModalReturn<T = undefined> {
  /** Whether the modal is currently open */
  isOpen: boolean;
  /** Data passed to the modal (if using openWith) */
  data: T | null;
  /** Open the modal without data */
  open: () => void;
  /** Open the modal with data */
  openWith: (data: T) => void;
  /** Close the modal and clear data */
  close: () => void;
  /** Toggle the modal state */
  toggle: () => void;
}

/**
 * Hook for managing modal open/close state
 *
 * @param initialOpen - Whether the modal starts open (default: false)
 */
export function useModal<T = undefined>(initialOpen = false): UseModalReturn<T> {
  const [isOpen, setIsOpen] = useState(initialOpen);
  const [data, setData] = useState<T | null>(null);

  const open = useCallback(() => {
    setIsOpen(true);
  }, []);

  const openWith = useCallback((newData: T) => {
    setData(newData);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setData(null);
  }, []);

  const toggle = useCallback(() => {
    setIsOpen((prev) => {
      if (prev) setData(null); // Clear data when closing via toggle
      return !prev;
    });
  }, []);

  return { isOpen, data, open, openWith, close, toggle };
}
