/**
 * Secret Management Utilities
 *
 * Helpers for retrieving secrets from database with environment fallback.
 */

import type Database from 'better-sqlite3';
import { SECRET_NAMES } from '@capybara-chat/types';

export interface TokenResult {
  token: string;
  source: 'database' | 'environment';
}

/**
 * Database row representation of a secret (snake_case).
 */
export interface SecretRow {
  id: string;
  name: string;
  scope: string;
  encrypted_value: string;
  created_at: number;
  last_rotated_at: number | null;
}

/**
 * Get a secret's encrypted value by name.
 */
export function getSecretValue(db: Database.Database, name: string): string | null {
  const secret = db.prepare(
    'SELECT encrypted_value FROM secrets WHERE name = ?'
  ).get(name) as { encrypted_value: string } | undefined;
  return secret?.encrypted_value ?? null;
}

/**
 * Get a secret's ID by name (for update/delete operations).
 */
export function getSecretId(db: Database.Database, name: string): string | null {
  const secret = db.prepare(
    'SELECT id FROM secrets WHERE name = ?'
  ).get(name) as { id: string } | undefined;
  return secret?.id ?? null;
}

/**
 * Get a secret's ID by name and scope.
 */
export function getSecretIdByScope(db: Database.Database, name: string, scope: string): string | null {
  const secret = db.prepare(
    'SELECT id FROM secrets WHERE name = ? AND scope = ?'
  ).get(name, scope) as { id: string } | undefined;
  return secret?.id ?? null;
}

/**
 * Get secrets matching a name prefix.
 */
export function getSecretsByPrefix(
  db: Database.Database,
  prefix: string
): Array<{ scope: string; encrypted_value: string }> {
  return db.prepare(
    'SELECT scope, encrypted_value FROM secrets WHERE name LIKE ?'
  ).all(`${prefix}%`) as Array<{ scope: string; encrypted_value: string }>;
}

/**
 * Get full secret record by name.
 */
export function getSecret(db: Database.Database, name: string): SecretRow | null {
  const secret = db.prepare(
    'SELECT * FROM secrets WHERE name = ?'
  ).get(name) as SecretRow | undefined;
  return secret ?? null;
}

/**
 * Get GitHub token from database or environment variable.
 */
export function getGitHubToken(db: Database.Database): TokenResult | null {
  const secret = db.prepare(
    'SELECT encrypted_value FROM secrets WHERE name = ?'
  ).get(SECRET_NAMES.GITHUB_TOKEN) as { encrypted_value: string } | undefined;

  if (secret?.encrypted_value) {
    return { token: secret.encrypted_value, source: 'database' };
  }

  if (process.env.GITHUB_TOKEN) {
    return { token: process.env.GITHUB_TOKEN, source: 'environment' };
  }

  return null;
}

/**
 * Get GitHub OAuth token from database.
 */
export function getGitHubOAuthToken(db: Database.Database): string | null {
  const secret = db.prepare(
    'SELECT encrypted_value FROM secrets WHERE name = ?'
  ).get(SECRET_NAMES.GITHUB_OAUTH_TOKEN) as { encrypted_value: string } | undefined;

  return secret?.encrypted_value ?? null;
}

/**
 * Get any available GitHub token - OAuth first, then PAT.
 */
export function getAnyGitHubToken(db: Database.Database): TokenResult | null {
  // Try OAuth token first
  const oauthSecret = db.prepare(
    'SELECT encrypted_value FROM secrets WHERE name = ?'
  ).get(SECRET_NAMES.GITHUB_OAUTH_TOKEN) as { encrypted_value: string } | undefined;

  if (oauthSecret?.encrypted_value) {
    return { token: oauthSecret.encrypted_value, source: 'database' };
  }

  // Fall back to PAT
  return getGitHubToken(db);
}
