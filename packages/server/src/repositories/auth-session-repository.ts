/**
 * Auth Session Repository
 *
 * Data access for refresh token sessions.
 * Handles create, validate, extend (touch), cleanup expired, and delete.
 */

import type { AuthSession } from '@capybara-chat/types';
import { generateRefreshToken, now } from '@capybara-chat/types';
import type Database from 'better-sqlite3';

/** 30 days in milliseconds */
const REFRESH_TOKEN_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;

export interface AuthSessionRepository {
  create(userId: string): AuthSession;
  findValid(refreshToken: string): AuthSession | null;
  touch(refreshToken: string): void;
  delete(refreshToken: string): boolean;
  deleteAllForUser(userId: string): number;
  cleanupExpired(): number;
}

export class SQLiteAuthSessionRepository implements AuthSessionRepository {
  constructor(private db: Database.Database) { }

  /**
   * Create a new refresh token session for a user.
   */
  create(userId: string): AuthSession {
    const token = generateRefreshToken();
    const timestamp = now();
    const expiresAt = timestamp + REFRESH_TOKEN_LIFETIME_MS;

    this.db.prepare(`
      INSERT INTO auth_sessions (id, user_id, expires_at, created_at, last_active_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(token, userId, expiresAt, timestamp, timestamp);

    return {
      id: token,
      userId,
      expiresAt,
      createdAt: timestamp,
      lastActiveAt: timestamp,
    };
  }

  /**
   * Find a valid (non-expired) auth session by refresh token.
   * Returns null if token doesn't exist or is expired.
   */
  findValid(refreshToken: string): AuthSession | null {
    const row = this.db.prepare(
      'SELECT * FROM auth_sessions WHERE id = ? AND expires_at > ?'
    ).get(refreshToken, now());
    return row ? this.mapRow(row) : null;
  }

  /**
   * Extend the session: update last_active_at and slide expires_at forward.
   * This implements sliding expiry — each refresh extends the session by 30 days.
   */
  touch(refreshToken: string): void {
    const timestamp = now();
    const newExpiresAt = timestamp + REFRESH_TOKEN_LIFETIME_MS;
    this.db.prepare(
      'UPDATE auth_sessions SET last_active_at = ?, expires_at = ? WHERE id = ?'
    ).run(timestamp, newExpiresAt, refreshToken);
  }

  /**
   * Delete a specific refresh token (logout).
   */
  delete(refreshToken: string): boolean {
    const result = this.db.prepare('DELETE FROM auth_sessions WHERE id = ?').run(refreshToken);
    return result.changes > 0;
  }

  /**
   * Delete all refresh tokens for a user (logout everywhere).
   */
  deleteAllForUser(userId: string): number {
    const result = this.db.prepare('DELETE FROM auth_sessions WHERE user_id = ?').run(userId);
    return result.changes;
  }

  /**
   * Remove expired sessions (housekeeping).
   */
  cleanupExpired(): number {
    const result = this.db.prepare('DELETE FROM auth_sessions WHERE expires_at <= ?').run(now());
    return result.changes;
  }

  private mapRow(row: unknown): AuthSession {
    const r = row as Record<string, unknown>;
    return {
      id: r.id as string,
      userId: r.user_id as string,
      expiresAt: r.expires_at as number,
      createdAt: r.created_at as number,
      lastActiveAt: r.last_active_at as number,
    };
  }
}
