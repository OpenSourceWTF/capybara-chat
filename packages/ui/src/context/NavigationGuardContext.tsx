import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface NavigationGuardContextType {
  isDirty: boolean;
  setDirty: (dirty: boolean) => void;
  navigate: (action: () => void) => void;
  pendingNavigation: (() => void) | null;
  confirmNavigation: () => void;
  cancelNavigation: () => void;
}

const NavigationGuardContext = createContext<NavigationGuardContextType | null>(null);

export function NavigationGuardProvider({ children }: { children: ReactNode }) {
  const [isDirty, setIsDirty] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);

  const navigate = useCallback((action: () => void) => {
    if (isDirty) {
      setPendingNavigation(() => action);
    } else {
      action();
    }
  }, [isDirty]);

  const confirmNavigation = useCallback(() => {
    if (pendingNavigation) {
      pendingNavigation();
      setPendingNavigation(null);
      setIsDirty(false); // Assume confirmed navigation implies handling dirty state
    }
  }, [pendingNavigation]);

  const cancelNavigation = useCallback(() => {
    setPendingNavigation(null);
  }, []);

  return (
    <NavigationGuardContext.Provider
      value={{
        isDirty,
        setDirty: setIsDirty,
        navigate,
        pendingNavigation,
        confirmNavigation,
        cancelNavigation,
      }}
    >
      {children}
    </NavigationGuardContext.Provider>
  );
}

export function useNavigationGuard() {
  const context = useContext(NavigationGuardContext);
  if (!context) {
    throw new Error('useNavigationGuard must be used within a NavigationGuardProvider');
  }
  return context;
}
