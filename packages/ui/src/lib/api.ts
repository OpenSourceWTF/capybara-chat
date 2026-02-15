/**
 * API Client - Centralized fetch wrapper with JWT auth
 *
 * 032-multitenancy: Uses Authorization: Bearer <token> for authenticated users.
 * Falls back to X-Api-Key for dev-mode / unauthenticated bootstrap requests.
 * Includes automatic 401 → refresh → retry logic.
 */

import { API, AUTH } from '../constants';
import { ApiError } from './errors';

// ===== Module-level token store =====
// JWT lives in memory only (not localStorage) to prevent XSS-based token theft.
// AuthContext calls setAuthToken() whenever the token changes.

let _authToken: string | null = null;
let _refreshPromise: Promise<string | null> | null = null;

export function setAuthToken(token: string | null): void {
  _authToken = token;
}

export function getAuthToken(): string | null {
  return _authToken;
}

// ===== Header builders =====

function authHeaders(): Record<string, string> {
  if (_authToken) {
    return { [API.HEADERS.AUTHORIZATION]: `Bearer ${_authToken}` };
  }
  // Fallback to API key for dev/bootstrap (before auth is established)
  return { [API.HEADERS.API_KEY_HEADER]: API.DEFAULT_API_KEY };
}

function jsonHeaders(): Record<string, string> {
  return { ...authHeaders(), 'Content-Type': API.HEADERS.CONTENT_TYPE };
}

// ===== 401 Refresh Logic =====

/**
 * Attempt to refresh the access token using the httpOnly refresh cookie.
 * Returns the new token or null if refresh failed.
 * Deduplicates concurrent refresh attempts.
 */
async function tryRefresh(): Promise<string | null> {
  if (_refreshPromise) return _refreshPromise;

  _refreshPromise = (async () => {
    try {
      const res = await fetch(AUTH.ENDPOINTS.REFRESH, {
        method: 'POST',
        credentials: 'include', // Send httpOnly cookie
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (data.accessToken) {
        _authToken = data.accessToken;
        return data.accessToken as string;
      }
      return null;
    } catch {
      return null;
    } finally {
      _refreshPromise = null;
    }
  })();

  return _refreshPromise;
}

/**
 * Execute a fetch, and if it returns 401, try to refresh and retry once.
 */
async function fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
  const res = await fetch(url, init);

  // If 401 and we have (or had) a token, try refresh
  if (res.status === 401 && _authToken) {
    const newToken = await tryRefresh();
    if (newToken) {
      // Rebuild headers with new token
      const newHeaders = new Headers(init.headers);
      newHeaders.set(API.HEADERS.AUTHORIZATION, `Bearer ${newToken}`);
      return fetch(url, { ...init, headers: newHeaders });
    }
  }

  return res;
}

// ===== Public API helpers =====

/**
 * Assert that a response is OK, throwing ApiError if not
 */
export async function assertOk(res: Response, context: string): Promise<void> {
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new ApiError(res.status, text || `${context} failed`);
  }
}

/**
 * Parse JSON from response with type assertion
 */
export async function parseJson<T>(res: Response): Promise<T> {
  return res.json() as Promise<T>;
}

/**
 * Fetch and parse JSON in one call with error handling
 */
export async function fetchJson<T>(res: Response, context: string): Promise<T> {
  await assertOk(res, context);
  return parseJson<T>(res);
}

/**
 * Centralized API client with JWT auth + automatic refresh
 */
export const api = {
  get: async (url: string): Promise<Response> => {
    return fetchWithRetry(url, { headers: authHeaders(), credentials: 'include' });
  },

  post: async (url: string, body?: unknown): Promise<Response> => {
    return fetchWithRetry(url, {
      method: 'POST',
      headers: jsonHeaders(),
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'include',
    });
  },

  put: async (url: string, body: unknown): Promise<Response> => {
    return fetchWithRetry(url, {
      method: 'PUT',
      headers: jsonHeaders(),
      body: JSON.stringify(body),
      credentials: 'include',
    });
  },

  patch: async (url: string, body: unknown): Promise<Response> => {
    return fetchWithRetry(url, {
      method: 'PATCH',
      headers: jsonHeaders(),
      body: JSON.stringify(body),
      credentials: 'include',
    });
  },

  delete: async (url: string): Promise<Response> => {
    return fetchWithRetry(url, {
      method: 'DELETE',
      headers: authHeaders(),
      credentials: 'include',
    });
  },
};

/**
 * Build URL with serverUrl base
 */
export function apiUrl(serverUrl: string, path: string): string {
  return `${serverUrl}${path}`;
}
