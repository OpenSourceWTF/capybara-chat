/**
 * Server Utilities
 */

export { getGitHubToken, getAnyGitHubToken, getGitHubOAuthToken, getSecretValue, getSecretId, getSecretIdByScope, getSecretsByPrefix, getSecret, type TokenResult, type SecretRow } from './secrets.js';
// Unified GitHub API
export {
  // Errors
  GitHubApiError,
  GitHubTokenNotConfiguredError,
  GITHUB_ERROR_MESSAGES,
  // Low-level fetch
  createGitHubHeaders,
  githubFetch,
  githubFetchRaw,
  // User & Auth
  getGitHubUser,
  getGitHubUserWithScopes,
  getGitHubUserOrgs,
  getGitHubInstallations,
  // Repositories
  getOrgRepos,
  getUserRepos,
  // Issues
  createGitHubIssue,
  // OAuth
  exchangeCodeForToken,
  revokeGrant,
  // High-level helpers
  withGitHub,
  // Types
  type GitHubAccessTokenResponse,
  type GitHubUserWithScopes,
  type GitHubResult,
  type GitHubUser,
  type GitHubOrg,
  type GitHubRepo,
  type GitHubIssue,
  type GitHubInstallation,
} from './github.js';
export { withTransaction, withTransactionAsync } from './transaction.js';

/**
 * Strip embedded credentials from a URL.
 */
export function stripCredentialsFromUrl(url: string): string {
  const credentialPattern = /^(https?:\/\/)[^@]+@/;
  if (credentialPattern.test(url)) {
    return url.replace(credentialPattern, '$1');
  }
  return url;
}
