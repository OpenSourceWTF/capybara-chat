/**
 * Shared API Client Configuration
 *
 * Centralizes server URL, API key, and HTTP request helpers.
 * Supports dependency injection for testability.
 *
 * Production usage:
 *   import { apiGet, apiPost, apiPatch } from './utils/api-client.js';
 *   // Uses process.env configuration
 *
 * Test usage:
 *   const client = createApiClient({ serverUrl: 'http://test', apiKey: 'test-key' });
 *   await client.get('/api/test');
 */

import { SERVER_DEFAULTS, createLogger } from '@capybara-chat/types';
import type { IApiClient, ApiResult } from '../interfaces.js';

const log = createLogger('ApiClient');

/**
 * API client configuration
 */
export interface ApiClientConfig {
  serverUrl: string;
  apiKey?: string;
}

/**
 * Load API client configuration from environment.
 * @param env - Environment object (defaults to process.env)
 */
export function loadApiClientConfig(env: NodeJS.ProcessEnv = process.env): ApiClientConfig {
  const allowDevKey = env.ALLOW_DEV_KEY === 'true';
  return {
    serverUrl: env.CAPYBARA_SERVER_URL || SERVER_DEFAULTS.SERVER_URL,
    apiKey: env.CAPYBARA_API_KEY || (allowDevKey ? 'dev-key' : undefined),
  };
}

/**
 * Legacy configuration - single source of truth for module-level usage.
 * Used by bridge.ts for remote logging at module load time.
 * For new code, prefer createApiClient() for testability.
 */
export const API_CONFIG = {
  SERVER_URL: process.env.CAPYBARA_SERVER_URL || SERVER_DEFAULTS.SERVER_URL,
  ALLOW_DEV_KEY: process.env.ALLOW_DEV_KEY === 'true',
  get API_KEY(): string | undefined {
    return process.env.CAPYBARA_API_KEY || (this.ALLOW_DEV_KEY ? 'dev-key' : undefined);
  },
} as const;

/**
 * Create headers with optional API key authentication
 */
function createHeadersWithConfig(config: ApiClientConfig, contentType?: string): Record<string, string> {
  const headers: Record<string, string> = {};
  if (contentType) {
    headers['Content-Type'] = contentType;
  }
  if (config.apiKey) {
    headers['X-Api-Key'] = config.apiKey;
  }
  return headers;
}

/**
 * Create headers using legacy API_CONFIG (for backwards compatibility)
 * C5 fix: Delegates to createHeadersWithConfig to eliminate duplication
 * D4 fix: Made private - only used internally by legacy apiFetch
 */
function createHeaders(contentType?: string): Record<string, string> {
  return createHeadersWithConfig({ serverUrl: API_CONFIG.SERVER_URL, apiKey: API_CONFIG.API_KEY }, contentType);
}

/**
 * Create an injectable API client.
 *
 * @param config - API client configuration
 * @returns IApiClient implementation
 *
 * @example
 * // Production
 * const client = createApiClient(loadApiClientConfig());
 *
 * // Test
 * const client = createApiClient({ serverUrl: 'http://test:3000', apiKey: 'test-key' });
 */
export function createApiClient(config: ApiClientConfig): IApiClient {
  async function apiFetch<T>(
    path: string,
    options?: RequestInit
  ): Promise<ApiResult<T>> {
    const url = `${config.serverUrl}${path}`;

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...createHeadersWithConfig(config, options?.body ? 'application/json' : undefined),
          ...(options?.headers as Record<string, string> | undefined),
        },
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        return { ok: false, error: errorText, status: response.status };
      }

      // Handle empty responses (204 No Content)
      if (response.status === 204) {
        return { ok: true, data: undefined as T };
      }

      const data = await response.json() as T;
      return { ok: true, data };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.warn('API fetch failed', { path, error: message });
      return { ok: false, error: message };
    }
  }

  return {
    async get<T>(path: string): Promise<ApiResult<T>> {
      return apiFetch<T>(path, { method: 'GET' });
    },

    async post<T>(path: string, body: Record<string, unknown>): Promise<ApiResult<T>> {
      return apiFetch<T>(path, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },

    async patch<T>(path: string, body: Record<string, unknown>): Promise<ApiResult<T>> {
      return apiFetch<T>(path, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
    },
  };
}

// Default client using environment configuration
let defaultClient: IApiClient | null = null;

/**
 * Get the default API client (uses process.env configuration)
 */
export function getApiClient(): IApiClient {
  if (!defaultClient) {
    defaultClient = createApiClient(loadApiClientConfig());
  }
  return defaultClient;
}

/**
 * Reset the default API client (for testing)
 */
export function resetApiClient(): void {
  defaultClient = null;
}

// Legacy functions for backwards compatibility
// These use API_CONFIG directly for module-level initialization

/**
 * Fetch with standard error handling (legacy - uses API_CONFIG)
 * D4 fix: Made private - only used internally by apiGet, apiPost, apiPatch
 */
async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<ApiResult<T>> {
  const url = `${API_CONFIG.SERVER_URL}${path}`;

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...createHeaders(options?.body ? 'application/json' : undefined),
        ...(options?.headers as Record<string, string> | undefined),
      },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      return { ok: false, error: errorText, status: response.status };
    }

    // Handle empty responses (204 No Content)
    if (response.status === 204) {
      return { ok: true, data: undefined as T };
    }

    const data = await response.json() as T;
    return { ok: true, data };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.warn('API fetch failed', { path, error: message });
    return { ok: false, error: message };
  }
}

/**
 * GET request (legacy - uses API_CONFIG)
 */
export async function apiGet<T>(path: string): Promise<ApiResult<T>> {
  return apiFetch<T>(path, { method: 'GET' });
}

/**
 * PATCH request with JSON body (legacy - uses API_CONFIG)
 */
export async function apiPatch<T>(
  path: string,
  body: Record<string, unknown>
): Promise<ApiResult<T>> {
  return apiFetch<T>(path, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

/**
 * POST request with JSON body (legacy - uses API_CONFIG)
 */
export async function apiPost<T>(
  path: string,
  body: Record<string, unknown>
): Promise<ApiResult<T>> {
  return apiFetch<T>(path, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
