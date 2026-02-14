/**
 * Base Repository Interface and Abstract Class
 *
 * All repositories extend this for consistent CRUD operations.
 */

import type Database from 'better-sqlite3';
import type { OrderDir, AllEventTypes, EventCategory, UserRole } from '@capybara-chat/types';
import { buildSelectQuery, Errors } from '@capybara-chat/types';
import { eventBus } from '../events/event-bus.js';

/**
 * Build a LIKE pattern for searching a tag within a JSON array column.
 * Escapes LIKE wildcards (%, _) in the tag value to prevent over-matching.
 */
export function tagLikePattern(tag: string): string {
  const escaped = tag.replace(/[%_\\]/g, '\\$&');
  return `%"${escaped}"%`;
}

export interface FindOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDir?: OrderDir;
}

export interface Repository<T, CreateDTO, UpdateDTO> {
  findById(id: string): T | null;
  findAll(options?: FindOptions): T[];
  create(data: CreateDTO): T;
  update(id: string, data: UpdateDTO): T | null;
  delete(id: string): boolean;
  count(): number;
}

/**
 * Base SQLite repository with common CRUD operations.
 * Subclasses only need to implement entity-specific logic.
 */
export abstract class BaseSQLiteRepository<T, CreateDTO, UpdateDTO> implements Repository<T, CreateDTO, UpdateDTO> {
  constructor(protected db: Database.Database) { }

  /** Table name for SQL queries */
  protected abstract get tableName(): string;

  /** Default ORDER BY column for findAll */
  protected get defaultOrderBy(): string {
    return 'created_at';
  }

  /** Default ORDER direction */
  protected get defaultOrderDir(): OrderDir {
    return 'desc';
  }

  /** Map database row to entity */
  protected abstract mapRow(row: unknown): T;

  /** Create entity - must be implemented by subclass */
  abstract create(data: CreateDTO): T;

  /** Update entity - must be implemented by subclass */
  abstract update(id: string, data: UpdateDTO): T | null;

  findById(id: string): T | null {
    const row = this.db.prepare(`SELECT * FROM ${this.tableName} WHERE id = ?`).get(id);
    return row ? this.mapRow(row) : null;
  }

  findAll(options?: FindOptions): T[] {
    const { sql, params } = buildSelectQuery(
      this.tableName,
      options,
      this.defaultOrderBy,
      this.defaultOrderDir
    );
    const rows = this.db.prepare(sql).all(...params);
    return rows.map((row) => this.mapRow(row));
  }

  delete(id: string): boolean {
    const result = this.db.prepare(`DELETE FROM ${this.tableName} WHERE id = ?`).run(id);
    return result.changes > 0;
  }

  count(): number {
    const row = this.db.prepare(`SELECT COUNT(*) as count FROM ${this.tableName}`).get() as { count: number };
    return row.count;
  }

  /**
   * Execute a filtered query with automatic pagination and row mapping.
   * Eliminates the repeated LIMIT/OFFSET boilerplate across filter methods.
   *
   * @param baseSql - SQL with WHERE/ORDER BY (no LIMIT/OFFSET)
   * @param params - Parameters for WHERE placeholders
   * @param options - Optional pagination (limit, offset)
   */
  protected findWhere(baseSql: string, params: unknown[], options?: FindOptions): T[] {
    let sql = baseSql;
    const allParams = [...params];
    const { limit, offset } = options ?? {};

    if (limit !== undefined) {
      sql += ' LIMIT ?';
      allParams.push(limit);
      if (offset !== undefined) {
        sql += ' OFFSET ?';
        allParams.push(offset);
      }
    }

    const rows = this.db.prepare(sql).all(...allParams);
    return rows.map((row) => this.mapRow(row));
  }

  /**
   * Validate a session_id FK reference. Returns the sessionId if it exists
   * in the sessions table, or null if it doesn't (preventing FK constraint failures).
   * Use this before INSERT/UPDATE on tables with session_id REFERENCES sessions(id).
   */
  protected resolveSessionId(sessionId: string | null | undefined): string | null {
    if (!sessionId) return null;
    const exists = this.db.prepare('SELECT 1 FROM sessions WHERE id = ?').get(sessionId);
    return exists ? sessionId : null;
  }

  /**
   * Emit an event through the event bus.
   * Standardizes event emission across all repositories.
   */
  protected emitEvent(
    type: AllEventTypes,
    category: EventCategory,
    payload: Record<string, unknown>,
    entityId: string
  ): void {
    eventBus.emit({
      type,
      category,
      source: 'server',
      payload,
      metadata: { [`${category}Id`]: entityId },
    });
  }

  /**
   * Returns a scoped view of this repository for a specific user.
   * Admin role bypasses scoping (sees everything).
   * @param hasPublishVisibility - true for entities where status=published means "visible to all"
   *   (specs, documents, prompts, pipelines, agent_definitions).
   *   false for entities where status means lifecycle state (sessions, worker_tasks).
   */
  forUser(userId: string, role: UserRole, hasPublishVisibility = true): ScopedRepository<T, CreateDTO, UpdateDTO> {
    return new ScopedRepository(this, userId, role, hasPublishVisibility);
  }
}

/**
 * Scoped repository that enforces user ownership and visibility.
 *
 * - findAll / filterVisible: returns user's own + published (if hasPublishVisibility), admin sees all
 * - findById: returns entity only if user owns it OR it's published, admin sees all
 * - create: injects createdBy = userId
 * - update / delete: ownership check (admin can edit/delete any)
 *
 * Application-layer filtering is used rather than SQL-level scoping to avoid
 * composing ownership WHERE clauses with each repo's custom soft-delete/type filters.
 * At target scale (5-50 users), this is efficient and keeps scoping centralized.
 */
export class ScopedRepository<T, CreateDTO, UpdateDTO> {
  constructor(
    private base: Repository<T, CreateDTO, UpdateDTO>,
    public readonly userId: string,
    public readonly role: UserRole,
    private hasPublishVisibility: boolean = true,
  ) { }

  /** Returns user's own + published entities (admin: all).
   *  Accepts extended FindOptions (e.g. DocumentFindOptions with type filter). */
  findAll(options?: FindOptions & Record<string, unknown>): T[] {
    const all = this.base.findAll(options as FindOptions);
    return this.filterVisible(all);
  }

  /** Returns entity only if user owns it or it's published (admin: any) */
  findById(id: string): T | null {
    const entity = this.base.findById(id);
    if (!entity) return null;
    if (this.role === 'admin') return entity;
    if ((entity as Record<string, unknown>).createdBy === this.userId) return entity;
    if (this.hasPublishVisibility && (entity as Record<string, unknown>).status === 'published') return entity;
    return null;
  }

  /** Creates with createdBy = userId */
  create(data: CreateDTO): T {
    return this.base.create({ ...data, createdBy: this.userId } as CreateDTO);
  }

  /** Updates only if user owns entity (admin: any) */
  update(id: string, data: UpdateDTO): T | null {
    this.assertOwnership(id);
    return this.base.update(id, data);
  }

  /** Deletes only if user owns entity (admin: any) */
  delete(id: string): boolean {
    this.assertOwnership(id);
    return this.base.delete(id);
  }

  /**
   * Filter an array of entities by visibility rules.
   * Use this to scope results from specialized repo methods (findByTag, search, etc.).
   */
  filterVisible(items: T[]): T[] {
    if (this.role === 'admin') return items;
    return items.filter(item => {
      const record = item as Record<string, unknown>;
      if (record.createdBy === this.userId) return true;
      if (this.hasPublishVisibility && record.status === 'published') return true;
      return false;
    });
  }

  private assertOwnership(id: string): void {
    if (this.role === 'admin') return;
    const entity = this.base.findById(id);
    if (!entity || (entity as Record<string, unknown>).createdBy !== this.userId) {
      throw Errors.forbidden('You do not own this resource');
    }
  }
}
