/**
 * SessionContext - Centralized session state management
 *
 * Provides current session ID to all components, eliminating prop drilling.
 * Works alongside SocketContext for real-time updates.
 */

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface SessionContextValue {
  /** Currently active session ID */
  currentSessionId: string | null;
  /** Update the current session ID */
  setCurrentSessionId: (id: string | null) => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

/**
 * Hook to access session state
 * @throws Error if used outside SessionProvider
 */
export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
}

/**
 * Hook to get just the session ID (convenience wrapper)
 * Returns null if no session is active
 */
export function useSessionId(): string | null {
  const { currentSessionId } = useSession();
  return currentSessionId;
}

interface SessionProviderProps {
  children: ReactNode;
  /** Initial session ID (optional) */
  initialSessionId?: string | null;
}

/**
 * Provider component for session state
 * Typically wraps the main app content
 */
export function SessionProvider({ children, initialSessionId = null }: SessionProviderProps) {
  const [currentSessionId, setSessionId] = useState<string | null>(initialSessionId);

  const setCurrentSessionId = useCallback((id: string | null) => {
    setSessionId(id);
  }, []);

  const value: SessionContextValue = {
    currentSessionId,
    setCurrentSessionId,
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
