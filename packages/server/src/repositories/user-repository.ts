/**
 * User Repository
 *
 * Data access for User entities (GitHub-authenticated accounts).
 * Supports upsert by github_id for OAuth login flow.
 */

import type { User, UserRole } from '@capybara-chat/types';
import { generateUserId, now } from '@capybara-chat/types';
import { BaseSQLiteRepository, type FindOptions } from './base.js';

export interface CreateUserDTO {
  githubId: number;
  githubLogin: string;
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  role?: UserRole;
}

export interface UpdateUserDTO {
  githubLogin?: string;
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  githubToken?: string | null;
  role?: UserRole;
  lastLoginAt?: number;
}

export interface UserRepository {
  findById(id: string): User | null;
  findByGithubId(githubId: number): User | null;
  findByGithubLogin(login: string): User | null;
  findAll(options?: FindOptions): User[];
  create(data: CreateUserDTO): User;
  update(id: string, data: UpdateUserDTO): User | null;
  upsertByGithubId(data: CreateUserDTO & { githubToken?: string | null }): User;
  delete(id: string): boolean;
  count(): number;
}

export class SQLiteUserRepository
  extends BaseSQLiteRepository<User, CreateUserDTO, UpdateUserDTO>
  implements UserRepository {
  protected get tableName(): string {
    return 'users';
  }

  protected get defaultOrderBy(): string {
    return 'created_at';
  }

  findByGithubId(githubId: number): User | null {
    const row = this.db.prepare('SELECT * FROM users WHERE github_id = ?').get(githubId);
    return row ? this.mapRow(row) : null;
  }

  findByGithubLogin(login: string): User | null {
    const row = this.db.prepare('SELECT * FROM users WHERE github_login = ?').get(login);
    return row ? this.mapRow(row) : null;
  }

  create(data: CreateUserDTO): User {
    const id = generateUserId();
    const timestamp = now();

    this.db.prepare(`
      INSERT INTO users (id, github_id, github_login, name, email, avatar_url, role, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.githubId,
      data.githubLogin,
      data.name ?? null,
      data.email ?? null,
      data.avatarUrl ?? null,
      data.role ?? 'member',
      timestamp,
      timestamp
    );

    return this.findById(id)!;
  }

  update(id: string, data: UpdateUserDTO): User | null {
    const existing = this.findById(id);
    if (!existing) return null;

    const setClauses: string[] = [];
    const params: unknown[] = [];

    if (data.githubLogin !== undefined) { setClauses.push('github_login = ?'); params.push(data.githubLogin); }
    if (data.name !== undefined) { setClauses.push('name = ?'); params.push(data.name); }
    if (data.email !== undefined) { setClauses.push('email = ?'); params.push(data.email); }
    if (data.avatarUrl !== undefined) { setClauses.push('avatar_url = ?'); params.push(data.avatarUrl); }
    if (data.githubToken !== undefined) { setClauses.push('github_token = ?'); params.push(data.githubToken); }
    if (data.role !== undefined) { setClauses.push('role = ?'); params.push(data.role); }
    if (data.lastLoginAt !== undefined) { setClauses.push('last_login_at = ?'); params.push(data.lastLoginAt); }

    if (setClauses.length === 0) return existing;

    setClauses.push('updated_at = ?');
    params.push(now(), id);

    this.db.prepare(`UPDATE users SET ${setClauses.join(', ')} WHERE id = ?`).run(...params);
    return this.findById(id)!;
  }

  /**
   * Upsert a user by GitHub ID — used during OAuth login.
   * If user exists, updates profile fields + token + last_login_at.
   * If user doesn't exist, creates a new user.
   */
  upsertByGithubId(data: CreateUserDTO & { githubToken?: string | null }): User {
    const existing = this.findByGithubId(data.githubId);

    if (existing) {
      return this.update(existing.id, {
        githubLogin: data.githubLogin,
        name: data.name,
        email: data.email,
        avatarUrl: data.avatarUrl,
        githubToken: data.githubToken,
        lastLoginAt: now(),
      })!;
    }

    const user = this.create(data);
    this.update(user.id, {
      githubToken: data.githubToken,
      lastLoginAt: now(),
    });
    return this.findById(user.id)!;
  }

  protected mapRow(row: unknown): User {
    const r = row as Record<string, unknown>;
    return {
      id: r.id as string,
      githubId: r.github_id as number,
      githubLogin: r.github_login as string,
      name: (r.name as string) ?? null,
      email: (r.email as string) ?? null,
      avatarUrl: (r.avatar_url as string) ?? null,
      role: (r.role as UserRole) ?? 'member',
      lastLoginAt: (r.last_login_at as number) ?? null,
      createdAt: r.created_at as number,
      updatedAt: r.updated_at as number,
    };
  }
}
