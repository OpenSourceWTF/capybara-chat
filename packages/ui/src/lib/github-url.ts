/**
 * GitHub URL Parsing Utilities
 *
 * Centralized parsers for GitHub issue and PR URLs.
 */

export interface GitHubIssueInfo {
  owner: string;
  repo: string;
  issueNumber: number;
}

export interface GitHubPrInfo {
  owner: string;
  repo: string;
  prNumber: number;
}

const GITHUB_ISSUE_REGEX = /github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)/;
const GITHUB_PR_REGEX = /github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/;

/**
 * Parse a GitHub issue URL
 * @returns Issue info or null if invalid
 */
export function parseGitHubIssueUrl(url: string): GitHubIssueInfo | null {
  const match = url.match(GITHUB_ISSUE_REGEX);
  if (!match) return null;

  const [, owner, repo, issueNumber] = match;
  return { owner, repo, issueNumber: parseInt(issueNumber, 10) };
}

/**
 * Parse a GitHub PR URL
 * @returns PR info or null if invalid
 */
export function parseGitHubPrUrl(url: string): GitHubPrInfo | null {
  const match = url.match(GITHUB_PR_REGEX);
  if (!match) return null;

  const [, owner, repo, prNumber] = match;
  return { owner, repo, prNumber: parseInt(prNumber, 10) };
}
