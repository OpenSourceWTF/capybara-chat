/**
 * Capybara API Configuration
 *
 * Centralized configuration for API clients across all packages.
 * Use this instead of scattered process.env access.
 *
 * @example
 * import { getApiConfig } from '@capybara/types';
 *
 * const config = getApiConfig();
 * fetch(`${config.serverUrl}/api/sessions`, {
 *   headers: config.createHeaders(),
 * });
 */

import { SERVER_DEFAULTS } from './index.js';

// ===== Configuration Types =====

export interface ApiConfig {
  /** Server URL (e.g., http://localhost:3279) */
  serverUrl: string;
  /** Bridge URL (e.g., http://localhost:3280) */
  bridgeUrl: string;
  /** API key for authentication (if configured) */
  apiKey?: string;
  /** Whether dev-key fallback is allowed */
  allowDevKey: boolean;
}

// ===== Environment Access (with safety) =====

function getEnv(key: string): string | undefined {
  // Browser-safe environment access
  if (typeof globalThis !== 'undefined' && !('window' in globalThis)) {
    try {
      const proc = (globalThis as Record<string, unknown>).process as
        | { env?: Record<string, string> }
        | undefined;
      return proc?.env?.[key];
    } catch {
      return undefined;
    }
  }
  return undefined;
}

// ===== Configuration Singleton =====

let cachedConfig: ApiConfig | null = null;

/**
 * Get the API configuration.
 * Configuration is computed once and cached.
 *
 * Environment variables:
 * - CAPYBARA_SERVER_URL: Server URL (default: http://localhost:3279)
 * - CAPYBARA_BRIDGE_URL: Bridge URL (default: http://localhost:3280)
 * - CAPYBARA_API_KEY: API key for authentication
 * - ALLOW_DEV_KEY: Set to 'true' to allow 'dev-key' as fallback API key
 */
export function getApiConfig(): ApiConfig {
  if (cachedConfig) return cachedConfig;

  const allowDevKey = getEnv('ALLOW_DEV_KEY') === 'true';
  const explicitApiKey = getEnv('CAPYBARA_API_KEY');
  const apiKey = explicitApiKey || (allowDevKey ? 'dev-key' : undefined);

  cachedConfig = {
    serverUrl: getEnv('CAPYBARA_SERVER_URL') || SERVER_DEFAULTS.SERVER_URL,
    bridgeUrl: getEnv('CAPYBARA_BRIDGE_URL') || SERVER_DEFAULTS.BRIDGE_URL,
    apiKey,
    allowDevKey,
  };

  return cachedConfig;
}

/**
 * Reset the cached configuration.
 * Useful for testing or when environment changes.
 */
export function resetApiConfig(): void {
  cachedConfig = null;
}

// ===== Header Utilities =====

/**
 * Create standard API headers with optional authentication.
 *
 * @param contentType - Content-Type header value (default: 'application/json' if body present)
 * @param includeAuth - Whether to include X-Api-Key header (default: true)
 */
export function createApiHeaders(
  options: {
    contentType?: string;
    includeAuth?: boolean;
  } = {}
): Record<string, string> {
  const { contentType, includeAuth = true } = options;
  const config = getApiConfig();
  const headers: Record<string, string> = {};

  if (contentType) {
    headers['Content-Type'] = contentType;
  }

  if (includeAuth && config.apiKey) {
    headers['X-Api-Key'] = config.apiKey;
  }

  return headers;
}

/**
 * Create headers for a JSON request body.
 */
export function createJsonHeaders(includeAuth = true): Record<string, string> {
  return createApiHeaders({ contentType: 'application/json', includeAuth });
}
