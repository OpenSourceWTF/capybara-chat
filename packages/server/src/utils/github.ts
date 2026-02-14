/**
 * GitHub API Utilities
 */

import type { Database } from 'better-sqlite3';
import {
  GITHUB_URLS,
  GITHUB_HEADERS,
  type GitHubUser,
  type GitHubOrg,
  type GitHubRepo,
  type GitHubIssue,
  type GitHubInstallation,
} from '@capybara-chat/types';
import { createLogger } from '../middleware/logger.js';
import type { TokenResult } from './secrets.js';

// Re-export types
export type { GitHubUser, GitHubOrg, GitHubRepo, GitHubIssue, GitHubInstallation } from '@capybara-chat/types';

const log = createLogger('GitHub');

// ============================================================
// TYPES
// ============================================================

export interface GitHubAccessTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
  error?: string;
  error_description?: string;
}

export interface GitHubUserWithScopes {
  user: GitHubUser;
  scopes: string[];
}

export type { TokenResult } from './secrets.js';

export interface GitHubResult<T> {
  data: T;
  source: 'database' | 'environment';
}

// ============================================================
// ERRORS
// ============================================================

export class GitHubApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly endpoint: string
  ) {
    super(message);
    this.name = 'GitHubApiError';
  }
}

export class GitHubTokenNotConfiguredError extends Error {
  constructor() {
    super('GitHub token not configured');
    this.name = 'GitHubTokenNotConfiguredError';
  }
}

export const GITHUB_ERROR_MESSAGES = {
  TOKEN_NOT_CONFIGURED: 'GitHub token not configured',
  INVALID_TOKEN: 'Invalid GitHub token',
} as const;

// ============================================================
// LOW-LEVEL FETCH
// ============================================================

export function createGitHubHeaders(
  token: string,
  includeContentType = false
): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: GITHUB_HEADERS.ACCEPT,
  };
  if (includeContentType) {
    headers['Content-Type'] = GITHUB_HEADERS.CONTENT_TYPE;
  }
  return headers;
}

export async function githubFetchRaw(
  endpoint: string,
  token: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = endpoint.startsWith('http') ? endpoint : `${GITHUB_URLS.API_BASE}${endpoint}`;

  return fetch(url, {
    ...options,
    headers: {
      ...createGitHubHeaders(token, !!options.body),
      ...options.headers,
    },
  });
}

export async function githubFetch<T>(
  endpoint: string,
  token: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await githubFetchRaw(endpoint, token, options);

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    log.error('GitHub API request failed', { endpoint, status: response.status, error: errorText });
    throw new GitHubApiError(response.status, errorText, endpoint);
  }

  return response.json() as Promise<T>;
}

// ============================================================
// USER & AUTH
// ============================================================

export async function getGitHubUser(token: string): Promise<GitHubUser> {
  return githubFetch<GitHubUser>('/user', token);
}

export async function getGitHubUserWithScopes(token: string): Promise<GitHubUserWithScopes> {
  const response = await githubFetchRaw('/user', token);

  if (!response.ok) {
    throw new GitHubApiError(response.status, 'Invalid token', '/user');
  }

  const user = (await response.json()) as GitHubUser;
  const scopes = response.headers.get('x-oauth-scopes')?.split(', ') ?? [];

  return { user, scopes };
}

export async function getGitHubUserOrgs(token: string): Promise<GitHubOrg[]> {
  return githubFetch<GitHubOrg[]>('/user/orgs', token);
}

export async function getGitHubInstallations(token: string): Promise<GitHubInstallation[]> {
  const response = await githubFetch<{ installations: GitHubInstallation[] }>(
    GITHUB_URLS.INSTALLATIONS,
    token
  );
  return response.installations || [];
}

// ============================================================
// REPOSITORIES
// ============================================================

export async function getOrgRepos(
  token: string,
  org: string,
  options: { perPage?: number; sort?: string } = {}
): Promise<GitHubRepo[]> {
  const { perPage = 100, sort = 'updated' } = options;
  return githubFetch<GitHubRepo[]>(
    `/orgs/${org}/repos?per_page=${perPage}&sort=${sort}`,
    token
  );
}

export async function getUserRepos(
  token: string,
  options: { perPage?: number; sort?: string; type?: string } = {}
): Promise<GitHubRepo[]> {
  const { perPage = 100, sort = 'updated', type = 'owner' } = options;
  return githubFetch<GitHubRepo[]>(
    `/user/repos?per_page=${perPage}&sort=${sort}&type=${type}`,
    token
  );
}

// ============================================================
// ISSUES
// ============================================================

export async function createGitHubIssue(
  token: string,
  owner: string,
  repo: string,
  data: { title: string; body?: string; labels?: string[] }
): Promise<GitHubIssue> {
  return githubFetch<GitHubIssue>(
    `/repos/${owner}/${repo}/issues`,
    token,
    {
      method: 'POST',
      body: JSON.stringify({
        title: data.title,
        body: data.body ?? '',
        labels: data.labels ?? [],
      }),
    }
  );
}

// ============================================================
// OAUTH
// ============================================================

export async function exchangeCodeForToken(
  code: string,
  clientId: string,
  clientSecret: string,
  codeVerifier?: string | null
): Promise<GitHubAccessTokenResponse> {
  const body: Record<string, string> = {
    client_id: clientId,
    client_secret: clientSecret,
    code,
  };

  if (codeVerifier) {
    body.code_verifier = codeVerifier;
  }

  const response = await fetch(GITHUB_URLS.ACCESS_TOKEN, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': GITHUB_HEADERS.CONTENT_TYPE,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    log.error('Failed to exchange code for token', { status: response.status, error: errorText });
    throw new GitHubApiError(response.status, errorText, 'access_token');
  }

  const data = (await response.json()) as GitHubAccessTokenResponse;

  if (data.error) {
    log.error('OAuth error', { error: data.error, description: data.error_description });
    throw new GitHubApiError(400, data.error_description || data.error, 'access_token');
  }

  return data;
}

export async function revokeGrant(
  clientId: string,
  clientSecret: string,
  token: string
): Promise<boolean> {
  const response = await fetch(`${GITHUB_URLS.API_BASE}/applications/${clientId}/grant`, {
    method: 'DELETE',
    headers: {
      Accept: GITHUB_HEADERS.ACCEPT,
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'Content-Type': GITHUB_HEADERS.CONTENT_TYPE,
    },
    body: JSON.stringify({ access_token: token }),
  });

  if (!response.ok && response.status !== 404) {
    log.warn('Failed to revoke GitHub grant', { status: response.status });
    return false;
  }

  return true;
}

// ============================================================
// HIGH-LEVEL HELPERS
// ============================================================

export async function withGitHub<T>(
  db: Database,
  getToken: (db: Database) => TokenResult | null,
  operation: (token: string) => Promise<T>,
  errorHandler?: (err: GitHubApiError) => Error
): Promise<GitHubResult<T>> {
  const tokenResult = getToken(db);
  if (!tokenResult) {
    throw new GitHubTokenNotConfiguredError();
  }

  try {
    const data = await operation(tokenResult.token);
    return { data, source: tokenResult.source };
  } catch (err) {
    if (err instanceof GitHubApiError) {
      if (errorHandler) {
        throw errorHandler(err);
      }
    }
    throw err;
  }
}
