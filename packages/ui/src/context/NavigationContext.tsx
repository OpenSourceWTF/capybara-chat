/**
 * NavigationContext - Centralized navigation callbacks
 *
 * Provides common navigation actions (back, close, save) to components,
 * reducing callback prop drilling for modal/view navigation patterns.
 */

import { createContext, useContext, useCallback, useState, type ReactNode } from 'react';

type NavigationHandler = () => void;
type SaveHandler<T = unknown> = (data: T) => void | Promise<void>;

interface NavigationContextValue {
  /** Navigate back (e.g., close panel, go to previous view) */
  onBack: NavigationHandler | null;
  /** Close current view/modal */
  onClose: NavigationHandler | null;
  /** Save current entity/form */
  onSave: SaveHandler | null;
  /** Register a back handler for the current scope */
  setBackHandler: (handler: NavigationHandler | null) => void;
  /** Register a close handler for the current scope */
  setCloseHandler: (handler: NavigationHandler | null) => void;
  /** Register a save handler for the current scope */
  setSaveHandler: (handler: SaveHandler | null) => void;
}

const NavigationContext = createContext<NavigationContextValue | null>(null);

/**
 * Hook to access navigation actions
 * @throws Error if used outside NavigationProvider
 */
export function useNavigation(): NavigationContextValue {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
}

/**
 * Hook to get just the back handler (convenience)
 */
export function useBackNavigation(): NavigationHandler | null {
  const { onBack } = useNavigation();
  return onBack;
}

interface NavigationProviderProps {
  children: ReactNode;
  /** Initial back handler */
  onBack?: NavigationHandler | null;
  /** Initial close handler */
  onClose?: NavigationHandler | null;
  /** Initial save handler */
  onSave?: SaveHandler | null;
}

/**
 * Provider component for navigation callbacks
 *
 * Can be nested - inner providers override outer handlers
 */
export function NavigationProvider({
  children,
  onBack: initialBack = null,
  onClose: initialClose = null,
  onSave: initialSave = null,
}: NavigationProviderProps) {
  // Use parent context as fallback for handlers
  const parent = useContext(NavigationContext);

  // Local state for dynamically registered handlers
  const [backHandler, setBackHandler] = useState<NavigationHandler | null>(initialBack);
  const [closeHandler, setCloseHandler] = useState<NavigationHandler | null>(initialClose);
  const [saveHandler, setSaveHandler] = useState<SaveHandler | null>(initialSave);

  // Resolve handlers: local > initial > parent
  const onBack = backHandler ?? initialBack ?? parent?.onBack ?? null;
  const onClose = closeHandler ?? initialClose ?? parent?.onClose ?? null;
  const onSave = saveHandler ?? initialSave ?? parent?.onSave ?? null;

  const value: NavigationContextValue = {
    onBack,
    onClose,
    onSave,
    setBackHandler: useCallback((h: NavigationHandler | null) => setBackHandler(() => h), []),
    setCloseHandler: useCallback((h: NavigationHandler | null) => setCloseHandler(() => h), []),
    setSaveHandler: useCallback((h: SaveHandler | null) => setSaveHandler(() => h), []),
  };

  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}
