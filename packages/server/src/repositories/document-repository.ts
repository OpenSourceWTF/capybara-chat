/**
 * Document Repository
 *
 * Data access for Document and DocumentVersion entities.
 * Supports versioning, soft-delete, and draft/publish workflow.
 */

import type { Document, DocumentVersion, EntityStatus, DocumentCreatedBy, DocumentType } from '@capybara-chat/types';
import {
  generateDocumentId,
  generateDocumentVersionId,
  now,
  EntityStatus as EntityStatusConst,
  DocumentCreatedBy as DocumentCreatedByConst,
  DocumentType as DocumentTypeConst,
  buildDynamicUpdate,
  FieldTransforms,
} from '@capybara-chat/types';
import { BaseSQLiteRepository, tagLikePattern, type FindOptions } from './base.js';

export interface DocumentFindOptions extends FindOptions {
  type?: DocumentType;
}

export interface CreateDocumentDTO {
  name: string;
  content: string;
  type?: DocumentType;
  tags?: string[];
  sessionId?: string;
  status?: EntityStatus;
  createdBy?: string | null;
  versionAuthor?: DocumentCreatedBy;
}

export interface UpdateDocumentDTO {
  name?: string;
  content?: string;
  tags?: string[];
  sessionId?: string;
  status?: EntityStatus;
  versionAuthor?: DocumentCreatedBy;
}

export interface DocumentRepository {
  findById(id: string): Document | null;
  findAll(options?: DocumentFindOptions): Document[];
  findByStatus(status: EntityStatus, type?: DocumentType, options?: FindOptions): Document[];
  findByTag(tag: string, type?: DocumentType, options?: FindOptions): Document[];
  findBySessionId(sessionId: string, type?: DocumentType, options?: FindOptions): Document[];
  findMemoriesBySession(sessionId: string, search?: string, options?: FindOptions): Document[];
  search(query: string, type?: DocumentType, options?: FindOptions): Document[];
  create(data: CreateDocumentDTO): Document;
  update(id: string, data: UpdateDocumentDTO): Document | null;
  delete(id: string): boolean;
  softDelete(id: string): boolean;
  restore(id: string): boolean;
  count(type?: DocumentType): number;
  getVersions(documentId: string): DocumentVersion[];
  getVersion(documentId: string, versionId: string): DocumentVersion | null;
  getLatestVersion(documentId: string): DocumentVersion | null;
  getDiff(documentId: string, versionIdA: string, versionIdB: string): { a: string; b: string } | null;
}

export class SQLiteDocumentRepository extends BaseSQLiteRepository<Document, CreateDocumentDTO, UpdateDocumentDTO> implements DocumentRepository {
  protected get tableName(): string {
    return 'documents';
  }

  protected get defaultOrderBy(): string {
    return 'updated_at';
  }

  findAll(options?: DocumentFindOptions): Document[] {
    const { limit, offset, orderBy, orderDir, type } = options ?? {};
    const actualOrderBy = orderBy ?? this.defaultOrderBy;
    const actualOrderDir = (orderDir ?? this.defaultOrderDir).toUpperCase();

    let sql: string;
    const params: unknown[] = [];

    if (type) {
      sql = `SELECT * FROM ${this.tableName} WHERE type = ? AND deleted_at IS NULL ORDER BY ${actualOrderBy} ${actualOrderDir}`;
      params.push(type);
    } else {
      sql = `SELECT * FROM ${this.tableName} WHERE deleted_at IS NULL ORDER BY ${actualOrderBy} ${actualOrderDir}`;
    }

    if (limit !== undefined) {
      sql += ' LIMIT ?';
      params.push(limit);
      if (offset !== undefined) {
        sql += ' OFFSET ?';
        params.push(offset);
      }
    }

    const rows = this.db.prepare(sql).all(...params);
    return rows.map((row) => this.mapRow(row));
  }

  findByStatus(status: EntityStatus, type?: DocumentType, options?: FindOptions): Document[] {
    const { limit, offset } = options ?? {};
    let sql = 'SELECT * FROM documents WHERE status = ? AND deleted_at IS NULL';
    const params: unknown[] = [status];

    if (type) {
      sql += ' AND type = ?';
      params.push(type);
    }
    sql += ' ORDER BY updated_at DESC';

    if (limit !== undefined) {
      sql += ' LIMIT ?';
      params.push(limit);
      if (offset !== undefined) {
        sql += ' OFFSET ?';
        params.push(offset);
      }
    }

    const rows = this.db.prepare(sql).all(...params);
    return rows.map((row) => this.mapRow(row));
  }

  findByTag(tag: string, type?: DocumentType, options?: FindOptions): Document[] {
    const { limit, offset } = options ?? {};
    let sql = "SELECT * FROM documents WHERE tags LIKE ? ESCAPE '\\' AND deleted_at IS NULL";
    const params: unknown[] = [tagLikePattern(tag)];

    if (type) {
      sql += ' AND type = ?';
      params.push(type);
    }
    sql += ' ORDER BY updated_at DESC';

    if (limit !== undefined) {
      sql += ' LIMIT ?';
      params.push(limit);
      if (offset !== undefined) {
        sql += ' OFFSET ?';
        params.push(offset);
      }
    }

    const rows = this.db.prepare(sql).all(...params);
    return rows.map((row) => this.mapRow(row));
  }

  findBySessionId(sessionId: string, type?: DocumentType, options?: FindOptions): Document[] {
    const { limit, offset } = options ?? {};
    let sql = 'SELECT * FROM documents WHERE session_id = ? AND deleted_at IS NULL';
    const params: unknown[] = [sessionId];

    if (type) {
      sql += ' AND type = ?';
      params.push(type);
    }
    sql += ' ORDER BY updated_at DESC';

    if (limit !== undefined) {
      sql += ' LIMIT ?';
      params.push(limit);
      if (offset !== undefined) {
        sql += ' OFFSET ?';
        params.push(offset);
      }
    }

    const rows = this.db.prepare(sql).all(...params);
    return rows.map((row) => this.mapRow(row));
  }

  findMemoriesBySession(sessionId: string, search?: string, options?: FindOptions): Document[] {
    const { limit, offset } = options ?? {};
    let sql = 'SELECT * FROM documents WHERE session_id = ? AND type = ? AND deleted_at IS NULL';
    const params: unknown[] = [sessionId, DocumentTypeConst.MEMORY];

    if (search) {
      sql += ' AND (name LIKE ? OR content LIKE ?)';
      const pattern = `%${search}%`;
      params.push(pattern, pattern);
    }
    sql += ' ORDER BY created_at DESC';

    if (limit !== undefined) {
      sql += ' LIMIT ?';
      params.push(limit);
      if (offset !== undefined) {
        sql += ' OFFSET ?';
        params.push(offset);
      }
    }

    const rows = this.db.prepare(sql).all(...params);
    return rows.map((row) => this.mapRow(row));
  }

  search(query: string, type?: DocumentType, options?: FindOptions): Document[] {
    const { limit, offset } = options ?? {};
    const pattern = `%${query}%`;
    let sql = 'SELECT * FROM documents WHERE (name LIKE ? OR content LIKE ?) AND deleted_at IS NULL';
    const params: unknown[] = [pattern, pattern];

    if (type) {
      sql += ' AND type = ?';
      params.push(type);
    }
    sql += ' ORDER BY updated_at DESC';

    if (limit !== undefined) {
      sql += ' LIMIT ?';
      params.push(limit);
      if (offset !== undefined) {
        sql += ' OFFSET ?';
        params.push(offset);
      }
    }

    const rows = this.db.prepare(sql).all(...params);
    return rows.map((row) => this.mapRow(row));
  }

  create(data: CreateDocumentDTO): Document {
    const id = generateDocumentId();
    const timestamp = now();
    const docType = data.type ?? DocumentTypeConst.DOCUMENT;

    if (docType === DocumentTypeConst.MEMORY && !data.sessionId) {
      throw new Error('Memory documents require a sessionId');
    }

    const resolvedSessionId = this.resolveSessionId(data.sessionId);

    this.db.prepare(`
      INSERT INTO documents (id, name, content, type, tags, session_id, status, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.name,
      data.content,
      docType,
      JSON.stringify(data.tags ?? []),
      resolvedSessionId,
      data.status ?? EntityStatusConst.DRAFT,
      data.createdBy ?? null,
      timestamp,
      timestamp
    );

    this.createVersion(id, data.content, data.versionAuthor ?? DocumentCreatedByConst.USER);

    const document = this.findById(id)!;
    const isMemory = docType === DocumentTypeConst.MEMORY;
    const eventName = isMemory ? 'memory:created' : 'document:created';
    const category = isMemory ? 'memory' : 'document';
    this.emitEvent(eventName, category, { document }, id);
    return document;
  }

  update(id: string, data: UpdateDocumentDTO): Document | null {
    const existing = this.findById(id);
    if (!existing) return null;

    const fieldMappings = {
      name: { column: 'name' },
      content: { column: 'content' },
      tags: { column: 'tags', transform: JSON.stringify },
      sessionId: { column: 'session_id', transform: (v: unknown) => this.resolveSessionId(v as string) },
      status: { column: 'status' },
    };

    const { setClauses, params, hasChanges } = buildDynamicUpdate(data, fieldMappings);
    if (!hasChanges) return existing;

    if (data.content !== undefined && data.content !== existing.content) {
      this.createVersion(id, data.content, data.versionAuthor ?? DocumentCreatedByConst.USER);
    }

    setClauses.push('updated_at = ?');
    params.push(now(), id);

    this.db.prepare(`UPDATE documents SET ${setClauses.join(', ')} WHERE id = ?`).run(...params);

    const updated = this.findById(id)!;
    this.emitEvent('document:updated', 'document', { document: updated }, id);
    return updated;
  }

  softDelete(id: string): boolean {
    const existing = this.findById(id);
    if (!existing) return false;

    const result = this.db.prepare(
      'UPDATE documents SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL'
    ).run(now(), id);
    if (result.changes > 0) {
      const isMemory = existing.type === DocumentTypeConst.MEMORY;
      const eventName = isMemory ? 'memory:deleted' : 'document:deleted';
      const category = isMemory ? 'memory' : 'document';
      this.emitEvent(eventName, category, { documentId: id, soft: true }, id);
      return true;
    }
    return false;
  }

  restore(id: string): boolean {
    const result = this.db.prepare(
      'UPDATE documents SET deleted_at = NULL WHERE id = ? AND deleted_at IS NOT NULL'
    ).run(id);
    return result.changes > 0;
  }

  delete(id: string): boolean {
    return this.softDelete(id);
  }

  count(type?: DocumentType): number {
    let sql = 'SELECT COUNT(*) as count FROM documents WHERE deleted_at IS NULL';
    const params: unknown[] = [];

    if (type) {
      sql += ' AND type = ?';
      params.push(type);
    }

    const row = this.db.prepare(sql).get(...params) as { count: number };
    return row.count;
  }

  // Version management
  getVersions(documentId: string): DocumentVersion[] {
    const rows = this.db.prepare(
      'SELECT * FROM document_versions WHERE document_id = ? ORDER BY created_at DESC'
    ).all(documentId);
    return rows.map((row) => this.mapVersionRow(row));
  }

  getVersion(documentId: string, versionId: string): DocumentVersion | null {
    const row = this.db.prepare(
      'SELECT * FROM document_versions WHERE id = ? AND document_id = ?'
    ).get(versionId, documentId);
    return row ? this.mapVersionRow(row) : null;
  }

  getLatestVersion(documentId: string): DocumentVersion | null {
    const row = this.db.prepare(
      'SELECT * FROM document_versions WHERE document_id = ? ORDER BY created_at DESC LIMIT 1'
    ).get(documentId);
    return row ? this.mapVersionRow(row) : null;
  }

  getDiff(documentId: string, versionIdA: string, versionIdB: string): { a: string; b: string } | null {
    const versionA = this.getVersion(documentId, versionIdA);
    const versionB = this.getVersion(documentId, versionIdB);
    if (!versionA || !versionB) return null;
    return { a: versionA.content, b: versionB.content };
  }

  private createVersion(documentId: string, content: string, createdBy: DocumentCreatedBy): DocumentVersion {
    const id = generateDocumentVersionId();
    const timestamp = now();

    this.db.prepare(`
      INSERT INTO document_versions (id, document_id, content, created_at, created_by)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, documentId, content, timestamp, createdBy);

    return { id, documentId, content, createdAt: timestamp, createdBy };
  }

  // Override findById to exclude soft-deleted
  findById(id: string): Document | null {
    const row = this.db.prepare('SELECT * FROM documents WHERE id = ? AND deleted_at IS NULL').get(id);
    return row ? this.mapRow(row) : null;
  }

  protected mapRow(row: unknown): Document {
    const r = row as Record<string, unknown>;
    return {
      id: r.id as string,
      name: r.name as string,
      content: r.content as string,
      type: (r.type as DocumentType) ?? DocumentTypeConst.DOCUMENT,
      tags: FieldTransforms.jsonArray(r.tags) as string[],
      sessionId: r.session_id as string | undefined,
      status: (r.status as EntityStatus) ?? EntityStatusConst.DRAFT,
      createdBy: (r.created_by as string) ?? null,
      createdAt: r.created_at as number,
      updatedAt: r.updated_at as number,
      deletedAt: r.deleted_at as number | undefined,
    };
  }

  private mapVersionRow(row: unknown): DocumentVersion {
    const r = row as Record<string, unknown>;
    return {
      id: r.id as string,
      documentId: r.document_id as string,
      content: r.content as string,
      createdAt: r.created_at as number,
      createdBy: r.created_by as DocumentCreatedBy,
    };
  }
}
