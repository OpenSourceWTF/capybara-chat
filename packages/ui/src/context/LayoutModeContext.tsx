/**
 * LayoutModeContext - Manages layout mode state across the application
 *
 * Three modes:
 * - NORMAL: Standard 3-pane layout (lists, browsing)
 * - FOCUS: Expanded right pane for editing (forms, editors)
 * - IMMERSIVE: Full-screen content (full-screen editors)
 */

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { LayoutMode } from '../constants';
import { FormEntityType, SessionMode } from '@capybara-chat/types';

// Re-export LayoutMode from canonical source for consumers
export type { LayoutMode } from '../constants';

export interface FocusContext {
  entityType: string;
  entityId?: string;
  wizardMode?: boolean;
  formData?: Record<string, unknown>;
}

export interface PreviousState {
  tab: string;
  selectedEntity: { type: string; id: string } | null;
}

/**
 * Entity editing context for passing with messages to the bridge
 */
export interface EditingContext {
  mode: typeof SessionMode.ENTITY_EDITING;
  entityType: FormEntityType;
  /** Entity ID - undefined for new/unsaved entities */
  entityId?: string;
  formContextInjected: boolean;
}

export interface LayoutModeContextValue {
  mode: LayoutMode;
  setMode: (mode: LayoutMode) => void;
  focusContext: FocusContext | null;
  previousState: PreviousState | null;
  currentSessionId: string | null;
  setCurrentSessionId: (id: string | null) => void;
  // Entity editing context for messages
  editingContext: EditingContext | null;
  setEditingContext: (ctx: EditingContext | null) => void;
  enterFocus: (context: FocusContext, prevState?: PreviousState) => void;
  exitFocus: () => void;
  enterImmersive: (context?: FocusContext) => void;
  exitImmersive: () => void;
}

// Create context with undefined default (will throw if used outside provider)
const LayoutModeContext = createContext<LayoutModeContextValue | undefined>(undefined);

// Provider props
interface LayoutModeProviderProps {
  children: ReactNode;
  initialMode?: LayoutMode;
  initialSessionId?: string | null;
}

/**
 * LayoutModeProvider - Provides layout mode state to the component tree
 */
export function LayoutModeProvider({
  children,
  initialMode = 'normal',
  initialSessionId = null,
}: LayoutModeProviderProps) {
  const [mode, setModeState] = useState<LayoutMode>(initialMode);
  const [focusContext, setFocusContext] = useState<FocusContext | null>(null);
  const [previousState, setPreviousState] = useState<PreviousState | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(initialSessionId);
  const [editingContext, setEditingContext] = useState<EditingContext | null>(null);

  const setMode = useCallback((newMode: LayoutMode) => {
    setModeState(newMode);
  }, []);

  const enterFocus = useCallback((context: FocusContext, prevState?: PreviousState) => {
    if (prevState) {
      setPreviousState(prevState);
    }
    setFocusContext(context);
    setModeState('focus');
  }, []);

  const exitFocus = useCallback(() => {
    setModeState('normal');
    setFocusContext(null);
    // Note: previousState is preserved so App.tsx can read it to restore state
  }, []);

  const enterImmersive = useCallback((context?: FocusContext) => {
    if (context) {
      setFocusContext(context);
    }
    setModeState('immersive');
  }, []);

  const exitImmersive = useCallback(() => {
    setModeState('normal');
    setFocusContext(null);
  }, []);

  const value: LayoutModeContextValue = {
    mode,
    setMode,
    focusContext,
    previousState,
    currentSessionId,
    setCurrentSessionId,
    editingContext,
    setEditingContext,
    enterFocus,
    exitFocus,
    enterImmersive,
    exitImmersive,
  };

  return (
    <LayoutModeContext.Provider value={value}>
      {children}
    </LayoutModeContext.Provider>
  );
}

/**
 * useLayoutMode - Hook to access layout mode context
 * @throws Error if used outside LayoutModeProvider
 */
export function useLayoutMode(): LayoutModeContextValue {
  const context = useContext(LayoutModeContext);
  if (context === undefined) {
    throw new Error('useLayoutMode must be used within a LayoutModeProvider');
  }
  return context;
}
