/**
 * User Repository
 *
 * Data access for User entities (local authentication).
 */

import type { User, UserRole } from '@capybara-chat/types';
import { generateUserId, now } from '@capybara-chat/types';
import { BaseSQLiteRepository, type FindOptions } from './base.js';

export interface CreateUserDTO {
  username: string;
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  role?: UserRole;
}

export interface UpdateUserDTO {
  username?: string;
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  role?: UserRole;
  lastLoginAt?: number;
}

export interface UserRepository {
  findById(id: string): User | null;
  findByUsername(username: string): User | null;
  findAll(options?: FindOptions): User[];
  create(data: CreateUserDTO): User;
  update(id: string, data: UpdateUserDTO): User | null;
  upsertLocalUser(data: { name: string; email: string }): User;
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

  findByUsername(username: string): User | null {
    const row = this.db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    return row ? this.mapRow(row) : null;
  }

  create(data: CreateUserDTO): User {
    const id = generateUserId();
    const timestamp = now();

    this.db.prepare(`
      INSERT INTO users (id, username, name, email, avatar_url, role, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.username,
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

    if (data.username !== undefined) { setClauses.push('username = ?'); params.push(data.username); }
    if (data.name !== undefined) { setClauses.push('name = ?'); params.push(data.name); }
    if (data.email !== undefined) { setClauses.push('email = ?'); params.push(data.email); }
    if (data.avatarUrl !== undefined) { setClauses.push('avatar_url = ?'); params.push(data.avatarUrl); }
    if (data.role !== undefined) { setClauses.push('role = ?'); params.push(data.role); }
    if (data.lastLoginAt !== undefined) { setClauses.push('last_login_at = ?'); params.push(data.lastLoginAt); }

    if (setClauses.length === 0) return existing;

    setClauses.push('updated_at = ?');
    params.push(now(), id);

    this.db.prepare(`UPDATE users SET ${setClauses.join(', ')} WHERE id = ?`).run(...params);
    return this.findById(id)!;
  }

  protected mapRow(row: unknown): User {
    const r = row as Record<string, unknown>;
    return {
      id: r.id as string,
      username: r.username as string,
      name: (r.name as string) ?? null,
      email: (r.email as string) ?? null,
      avatarUrl: (r.avatar_url as string) ?? null,
      role: (r.role as UserRole) ?? 'member',
      lastLoginAt: (r.last_login_at as number) ?? null,
      createdAt: r.created_at as number,
      updatedAt: r.updated_at as number,
    };
  }

  upsertLocalUser(data: { name: string; email: string }): User {
    const existing = this.findByUsername('local-user');
    if (existing) {
      return this.update(existing.id, {
        lastLoginAt: now(),
      })!;
    }

    return this.create({
      username: 'local-user',
      name: data.name,
      email: data.email,
      role: 'admin'
    });
  }
}
