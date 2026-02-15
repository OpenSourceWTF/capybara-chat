/**
 * AuthContext - JWT Authentication Provider
 *
 * 032-multitenancy: Manages the full auth lifecycle:
 * 1. Extract JWT from URL fragment after GitHub OAuth callback
 * 2. Silent refresh via httpOnly cookie on page load
 * 3. Expose user state (id, githubLogin, role, avatar) to the app
 * 4. Sync token to api.ts module-level store for REST calls
 *
 * Token storage: JWT is kept in memory only (never localStorage).
 * Refresh token lives in an httpOnly cookie managed by the server.
 */

import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react';
import { AUTH } from '../constants';
import { setAuthToken } from '../lib/api';
import { createLogger } from '../lib/logger';

const log = createLogger('Auth');

// ===== Types =====

export interface AuthUser {
  id: string;
  githubLogin: string;
  role: string;
  avatarUrl: string | null;
  name: string | null;
}

interface AuthContextValue {
  /** Current authenticated user, or null if not logged in */
  user: AuthUser | null;
  /** True while checking auth state (initial load / refresh) */
  loading: boolean;
  /** Current JWT access token (for socket.io auth) */
  token: string | null;
  /** Redirect to GitHub OAuth login */
  login: () => void;
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
    // Step 1: Check URL fragment for OAuth callback token
    const fragmentToken = extractTokenFromFragment();
    if (fragmentToken) {
      log.info('Token extracted from OAuth callback');
      setToken(fragmentToken);
      localStorage.setItem(AUTH.STORAGE_KEY, 'true');

      // Fetch user profile with the new token
      const fetchedUser = await fetchMe(fragmentToken);
      if (fetchedUser) {
        setUser(fetchedUser);
        setLoading(false);
        return;
      }
    }

    // Step 2: Try silent refresh (uses httpOnly cookie)
    const knownAuth = localStorage.getItem(AUTH.STORAGE_KEY);
    // Always try refresh — the cookie might be valid even without the flag
    const refreshed = await tryRefresh();
    if (refreshed) {
      setLoading(false);
      return;
    }

    // Step 3: No valid auth — if we previously had auth, clear the flag
    if (knownAuth) {
      localStorage.removeItem(AUTH.STORAGE_KEY);
    }
    setLoading(false);
  }

  /**
   * Extract #token=... from URL fragment (OAuth callback).
   * Clears the fragment via replaceState so the token isn't in browser history.
   */
  function extractTokenFromFragment(): string | null {
    const hash = window.location.hash;
    if (!hash.includes('token=')) return null;

    const params = new URLSearchParams(hash.slice(1));
    const jwt = params.get('token');

    // Clean up URL — navigate to root since /auth/callback isn't a real route
    window.history.replaceState(null, '', '/');
    return jwt;
  }

  /**
   * Fetch /api/auth/me with a given token
   */
  async function fetchMe(accessToken: string): Promise<AuthUser | null> {
    try {
      const res = await fetch(AUTH.ENDPOINTS.ME, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.user ?? null;
    } catch (err) {
      log.error('Failed to fetch user profile', { error: err });
      return null;
    }
  }

  /**
   * Silent refresh via httpOnly cookie
   */
  async function tryRefresh(): Promise<boolean> {
    try {
      const res = await fetch(AUTH.ENDPOINTS.REFRESH, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) return false;

      const data = await res.json();
      if (data.accessToken && data.user) {
        setToken(data.accessToken);
        setUser(data.user);
        localStorage.setItem(AUTH.STORAGE_KEY, 'true');
        log.info('Silent refresh successful', { userId: data.user.id });
        return true;
      }
      return false;
    } catch (err) {
      log.warn('Silent refresh failed', { error: err });
      return false;
    }
  }

  const login = useCallback(() => {
    // Redirect to server's GitHub OAuth endpoint
    window.location.href = AUTH.ENDPOINTS.LOGIN;
  }, []);

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
    localStorage.removeItem(AUTH.STORAGE_KEY);
    log.info('Logged out');
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
