/**
 * AuthContext - Standalone Authentication Provider
 *
 * Always-on standalone mode: auto-authenticates with mock-token.
 * Token is kept in memory only (never localStorage).
 */

import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react';
import { AUTH } from '../constants';
import { setAuthToken } from '../lib/api';
import { createLogger } from '../lib/logger';

const log = createLogger('Auth');

// ===== Types =====

export interface AuthUser {
  id: string;
  username: string;
  role: string;
  avatarUrl: string | null;
  name: string | null;
}

interface AuthContextValue {
  /** Current authenticated user, or null if not logged in */
  user: AuthUser | null;
  /** True while checking auth state (initial load) */
  loading: boolean;
  /** Current JWT access token (for socket.io auth) */
  token: string | null;
  /** Log out: clear session + cookie */
  logout: () => Promise<void>;
}

// ===== Context =====

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// ===== Provider =====

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const initRef = useRef(false);

  // Sync token to api.ts module-level store
  useEffect(() => {
    setAuthToken(token);
  }, [token]);

  // Initialize auth on mount
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    initAuth();
  }, []);

  async function initAuth() {
    log.info('Standalone mode — auto-authenticating');
    setToken('mock-token');

    // Fetch the actual user profile from the server
    try {
      const res = await fetch(AUTH.ENDPOINTS.ME, {
        headers: { Authorization: 'Bearer mock-token' },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          setUser(data.user);
          setLoading(false);
          return;
        }
      }
    } catch (err) {
      log.warn('Failed to fetch user profile, using fallback', { error: err });
    }

    // Fallback: use hardcoded defaults
    setUser({
      id: 'user',
      username: 'user',
      name: 'User',
      avatarUrl: null,
      role: 'admin',
    });
    setLoading(false);
  }

  const logout = useCallback(async () => {
    try {
      await fetch(AUTH.ENDPOINTS.LOGOUT, {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // Best-effort — continue with local cleanup
    }

    setToken(null);
    setUser(null);
    setAuthToken(null);
    log.info('Logged out');
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, token, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
