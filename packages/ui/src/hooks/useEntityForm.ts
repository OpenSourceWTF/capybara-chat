/**
 * useEntityForm - Unified form hook for entity editing
 *
 * Single hook that provides:
 * - Schema-driven validation and transforms
 * - Undo/redo with debounced history
 * - Save/publish handlers
 *
 * This replaces the old 4-layer hook chain:
 *   useUnifiedEntityForm → useEntityFormWithSync → useEntityForm → useFormState
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import type { EntityStatus } from '@capybara-chat/types';
import type { EntitySchemaDefinition, ValidationResult } from '../schemas/define-schema';

/**
 * History entry for undo/redo
 */
interface HistoryEntry<T> {
  state: T;
  timestamp: number;
  source: 'user' | 'ai' | 'system';
}

/**
 * Hook options
 */
export interface UseEntityFormOptions<TEntity, TForm extends object> {
  /** Entity schema definition */
  schema: EntitySchemaDefinition<TEntity, TForm>;
  /** Entity ID (undefined for new entities) */
  entityId?: string;
  /** Session ID for MCP Forms sync */
  sessionId?: string;
  /** Initial entity data (for editing existing entities) */
  initialData?: TEntity | null;
  /** Called when entity is saved */
  onSave?: (data: Partial<TEntity>) => Promise<TEntity>;
  /** Maximum history entries to keep */
  maxHistory?: number;
  /** History commit delay in ms (groups rapid changes) */
  historyCommitDelay?: number;
}

/**
 * Hook return type
 */
export interface UseEntityFormReturn<TForm extends object> {
  /** Current form data */
  formData: TForm;
  /** Update a single field */
  setField: <K extends keyof TForm>(field: K, value: TForm[K]) => void;
  /** Validation errors by field name */
  errors: Record<string, string>;
  /** Validate form and return result */
  validate: () => ValidationResult;
  /** Save the entity with a specific status */
  saveWithStatus: (status: EntityStatus) => Promise<void>;
  /** Whether a save operation is in progress */
  isSaving: boolean;
  /** Whether form has unsaved changes */
  hasChanges: boolean;
  /** Undo last change */
  undo: () => void;
  /** Redo last undone change */
  redo: () => void;
  /** Whether undo is available */
  canUndo: boolean;
  /** Whether redo is available */
  canRedo: boolean;
  /** Reset to initial data */
  reset: () => void;
  /** Fields recently filled by AI (Map of fieldName → fillId for animation restart) */
  aiFilledFields: Map<string, number>;
}

/**
 * Deep equality check for objects
 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return false;
  if (typeof a !== 'object') return false;

  const keysA = Object.keys(a as object);
  const keysB = Object.keys(b as object);

  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!keysB.includes(key)) return false;
    if (!deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])) {
      return false;
    }
  }

  return true;
}

/**
 * Unified entity form hook
 */
export function useEntityForm<TEntity, TForm extends object>({
  schema,
  initialData,
  onSave,
  maxHistory = 50,
  historyCommitDelay = 1000,
}: UseEntityFormOptions<TEntity, TForm>): UseEntityFormReturn<TForm> {
  // Transform initial entity data to form data
  const initialFormData = useMemo(
    () => schema.toFormData(initialData ?? null),
    [schema, initialData]
  );

  // === FORM STATE (single source of truth) ===
  const [data, setDataInternal] = useState<TForm>(initialFormData);

  // === SAVE STATE ===
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // === HISTORY (undo/redo) ===
  const [history, setHistory] = useState<HistoryEntry<TForm>[]>([
    { state: initialFormData, timestamp: Date.now(), source: 'system' },
  ]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const historyCommitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCommittedStateRef = useRef<TForm>(initialFormData);
  const initialDataRef = useRef(initialFormData);

  // === AI FILL HIGHLIGHT (tracks fields recently filled by AI for fade animation) ===
  // Currently inert — agent-driven form sync was removed (Task 078).
  // Kept as empty Map to preserve return type contract for consumers.
  const [aiFilledFields] = useState<Map<string, number>>(new Map());

  // Reset when initial data changes (new entity loaded, but skip if form data matches)
  useEffect(() => {
    const newFormData = schema.toFormData(initialData ?? null);
    // Skip reset if the new data matches current baseline (e.g., after save + refetch)
    if (deepEqual(newFormData, initialDataRef.current)) return;
    initialDataRef.current = newFormData;
    lastCommittedStateRef.current = newFormData;
    setHistory([{ state: newFormData, timestamp: Date.now(), source: 'system' }]);
    setHistoryIndex(0);
    setDataInternal(newFormData);
  }, [schema, initialData]);

  // Commit current state to history
  const commitHistory = useCallback((source: 'user' | 'ai' = 'user') => {
    if (historyCommitTimeoutRef.current) {
      clearTimeout(historyCommitTimeoutRef.current);
      historyCommitTimeoutRef.current = null;
    }

    setDataInternal((currentData) => {
      if (deepEqual(currentData, lastCommittedStateRef.current)) {
        return currentData;
      }

      setHistory((prevHistory) => {
        const newHistory = [
          ...prevHistory.slice(0, historyIndex + 1),
          { state: currentData, timestamp: Date.now(), source },
        ];
        if (newHistory.length > maxHistory) {
          newHistory.shift();
        }
        return newHistory;
      });
      setHistoryIndex((prev) => Math.min(prev + 1, maxHistory - 1));
      lastCommittedStateRef.current = currentData;

      return currentData;
    });
  }, [historyIndex, maxHistory]);

  // Set a single field value
  const setField = useCallback(
    <K extends keyof TForm>(field: K, value: TForm[K]) => {
      setDataInternal((prev) => {
        if (prev[field] === value) return prev;
        const next = { ...prev, [field]: value };

        // Schedule history commit after inactivity
        if (historyCommitTimeoutRef.current) {
          clearTimeout(historyCommitTimeoutRef.current);
        }
        historyCommitTimeoutRef.current = setTimeout(() => {
          commitHistory('user');
        }, historyCommitDelay);

        return next;
      });

      // Clear validation error for this field
      if (errors[field as string]) {
        setErrors((prev) => {
          const next = { ...prev };
          delete next[field as string];
          return next;
        });
      }

    },
    [commitHistory, historyCommitDelay, errors]
  );

  // Validate form data
  const validate = useCallback((): ValidationResult => {
    if (schema.validate) {
      const result = schema.validate(data);
      setErrors(result.errors);
      return result;
    }

    // Default validation based on required fields
    const fieldErrors: Record<string, string> = {};
    for (const [fieldName, fieldDef] of Object.entries(schema.fields)) {
      const value = data[fieldName as keyof TForm];
      const definition = fieldDef as { required?: boolean; label: string };
      if (definition.required && (value === undefined || value === null || value === '')) {
        fieldErrors[fieldName] = `${definition.label} is required`;
      }
    }

    const result: ValidationResult = {
      errors: fieldErrors,
      isValid: Object.keys(fieldErrors).length === 0,
    };
    setErrors(result.errors);
    return result;
  }, [schema, data]);

  // Save with specific status
  const saveWithStatus = useCallback(async (status: EntityStatus) => {
    if (!onSave) return;

    const validation = validate();
    if (!validation.isValid) return;

    setIsSaving(true);
    try {
      const entityData = schema.fromFormData(data);
      const statusField = schema.statusField || 'status';
      const dataWithStatus = { ...entityData, [statusField]: status };
      await onSave(dataWithStatus as Partial<TEntity>);
      // Reset baseline so hasChanges becomes false immediately
      initialDataRef.current = data;
      lastCommittedStateRef.current = data;
    } finally {
      setIsSaving(false);
    }
  }, [onSave, validate, schema, data]);

  // Has changes
  const hasChanges = !deepEqual(data, initialDataRef.current);

  // Undo
  const canUndo = historyIndex > 0;
  const undo = useCallback(() => {
    if (!canUndo) return;
    if (historyCommitTimeoutRef.current) {
      clearTimeout(historyCommitTimeoutRef.current);
      historyCommitTimeoutRef.current = null;
    }
    const newIndex = historyIndex - 1;
    setHistoryIndex(newIndex);
    const newState = history[newIndex].state;
    setDataInternal(newState);
    lastCommittedStateRef.current = newState;
  }, [canUndo, historyIndex, history]);

  // Redo
  const canRedo = historyIndex < history.length - 1;
  const redo = useCallback(() => {
    if (!canRedo) return;
    const newIndex = historyIndex + 1;
    setHistoryIndex(newIndex);
    const newState = history[newIndex].state;
    setDataInternal(newState);
    lastCommittedStateRef.current = newState;
  }, [canRedo, historyIndex, history]);

  // Reset to initial data
  const reset = useCallback(() => {
    if (historyCommitTimeoutRef.current) {
      clearTimeout(historyCommitTimeoutRef.current);
      historyCommitTimeoutRef.current = null;
    }
    setDataInternal(initialDataRef.current);
    lastCommittedStateRef.current = initialDataRef.current;
    setHistory([{ state: initialDataRef.current, timestamp: Date.now(), source: 'system' }]);
    setHistoryIndex(0);
    setErrors({});
  }, []);

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (e.shiftKey) { redo(); } else { undo(); }
      } else if (e.key === 'y' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        redo();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (historyCommitTimeoutRef.current) {
        clearTimeout(historyCommitTimeoutRef.current);
      }
    };
  }, []);

  return {
    formData: data,
    setField,
    errors,
    validate,
    saveWithStatus,
    isSaving,
    hasChanges,
    undo,
    redo,
    canUndo,
    canRedo,
    reset,
    aiFilledFields,
  };
}
