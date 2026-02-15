/**
 * useNavigationState - Bridges browser URL with React navigation state
 *
 * Syncs the URL with app navigation state via History API:
 * - Tab changes and entity selections push history (back works)
 * - Edit/view mode toggles use replaceState (back skips them)
 * - Listens to popstate for back/forward navigation
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { parseRoute, buildPath, type NavigationState } from '../lib/route-parser';

type Tab = NavigationState['tab'];

interface UseNavigationStateReturn {
  state: NavigationState;
  navigateToTab: (tab: Tab) => void;
  navigateToEntity: (tab: Tab, entityId: string, mode?: 'view' | 'edit') => void;
  navigateBack: () => void;
  /** Replace current URL without pushing history (for mode switches) */
  replaceMode: (mode: 'view' | 'edit') => void;
  /** Replace URL after entity creation (new → persisted ID) */
  replaceEntityId: (entityId: string) => void;
  /** Update session in URL (replaceState, no history push) */
  setSessionId: (sessionId: string | null) => void;
}

export function useNavigationState(): UseNavigationStateReturn {
  // Parse initial state from current URL
  const [state, setState] = useState<NavigationState>(() =>
    parseRoute(window.location.pathname, window.location.search)
  );

  // Debounce ref to prevent history spam from rapid clicks
  const pushTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPushedPathRef = useRef<string>(buildPath(state));

  // Listen for popstate (back/forward navigation)
  useEffect(() => {
    const handlePopState = () => {
      const newState = parseRoute(window.location.pathname, window.location.search);
      setState(newState);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Push a new history entry (debounced)
  const pushState = useCallback((newState: NavigationState) => {
    if (pushTimeoutRef.current) {
      clearTimeout(pushTimeoutRef.current);
    }

    pushTimeoutRef.current = setTimeout(() => {
      const path = buildPath(newState);
      if (path !== lastPushedPathRef.current) {
        window.history.pushState(null, '', path);
        lastPushedPathRef.current = path;
      }
      pushTimeoutRef.current = null;
    }, 50);

    setState(newState);
  }, []);

  // Replace current history entry (no new entry)
  const replaceState = useCallback((newState: NavigationState) => {
    const path = buildPath(newState);
    window.history.replaceState(null, '', path);
    lastPushedPathRef.current = path;
    setState(newState);
  }, []);

  const navigateToTab = useCallback((tab: Tab) => {
    pushState({ tab, sessionId: state.sessionId });
  }, [pushState, state.sessionId]);

  const navigateToEntity = useCallback((tab: Tab, entityId: string, mode: 'view' | 'edit' = 'view') => {
    pushState({ tab, entityId, entityMode: mode, sessionId: state.sessionId });
  }, [pushState, state.sessionId]);

  const navigateBack = useCallback(() => {
    window.history.back();
  }, []);

  const replaceMode = useCallback((mode: 'view' | 'edit') => {
    replaceState({ ...state, entityMode: mode });
  }, [replaceState, state]);

  const replaceEntityId = useCallback((entityId: string) => {
    replaceState({ ...state, entityId, entityMode: 'view' });
  }, [replaceState, state]);

  const setSessionId = useCallback((sessionId: string | null) => {
    // Read current state from URL (not closure) to avoid stale state and dep churn
    const current = parseRoute(window.location.pathname, window.location.search);
    replaceState({ ...current, sessionId: sessionId || undefined });
  }, [replaceState]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (pushTimeoutRef.current) {
        clearTimeout(pushTimeoutRef.current);
      }
    };
  }, []);

  return {
    state,
    navigateToTab,
    navigateToEntity,
    navigateBack,
    replaceMode,
    replaceEntityId,
    setSessionId,
  };
}
