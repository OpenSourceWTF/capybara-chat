/**
 * Prompt Segment Repository
 *
 * Data access for PromptSegment entities with summary and tags.
 * Supports soft-delete via deleted_at column.
 */

import type { PromptSegment, SegmentColor, EntityStatus, PromptOutputType } from '@capybara-chat/types';
import { generateSegmentId, now, SEGMENT_COLORS, EntityStatus as EntityStatusConst, buildDynamicUpdate, FieldTransforms } from '@capybara-chat/types';
import { BaseSQLiteRepository, tagLikePattern, type FindOptions } from './base.js';
import { extractVariables } from '../services/variable-parser.js';

export interface CreatePromptSegmentDTO {
  name: string;
  content: string;
  summary?: string;
  tags?: string[];
  color?: SegmentColor;
  status?: EntityStatus;
  sessionId?: string;
  outputType?: PromptOutputType;
  createdBy?: string | null;
}

export interface UpdatePromptSegmentDTO {
  name?: string;
  content?: string;
  summary?: string;
  tags?: string[];
  color?: SegmentColor;
  status?: EntityStatus;
  sessionId?: string;
  outputType?: PromptOutputType;
}

export interface PromptSegmentRepository {
  findById(id: string): PromptSegment | null;
  findAll(options?: FindOptions): PromptSegment[];
  findByTag(tag: string): PromptSegment[];
  findByName(name: string): PromptSegment | null;
  search(query: string): PromptSegment[];
  create(data: CreatePromptSegmentDTO): PromptSegment;
  update(id: string, data: UpdatePromptSegmentDTO): PromptSegment | null;
  delete(id: string): boolean;
  softDelete(id: string): boolean;
  count(): number;
}

export class SQLitePromptSegmentRepository extends BaseSQLiteRepository<PromptSegment, CreatePromptSegmentDTO, UpdatePromptSegmentDTO> implements PromptSegmentRepository {
  protected get tableName(): string {
    return 'prompt_segments';
  }

  protected get defaultOrderBy(): string {
    return 'name';
  }

  protected get defaultOrderDir(): 'asc' | 'desc' {
    return 'asc';
  }

  findById(id: string): PromptSegment | null {
    const row = this.db.prepare('SELECT * FROM prompt_segments WHERE id = ? AND deleted_at IS NULL').get(id);
    return row ? this.mapRow(row) : null;
  }

  findAll(options?: FindOptions): PromptSegment[] {
    const { limit, offset, orderBy, orderDir } = options ?? {};
    const actualOrderBy = orderBy ?? this.defaultOrderBy;
    const actualOrderDir = orderDir ?? this.defaultOrderDir;

    let sql = `SELECT * FROM prompt_segments WHERE deleted_at IS NULL ORDER BY ${actualOrderBy} ${actualOrderDir}`;
    const params: (number | string)[] = [];

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

  findByTag(tag: string): PromptSegment[] {
    const rows = this.db.prepare(
      "SELECT * FROM prompt_segments WHERE tags LIKE ? ESCAPE '\\' AND deleted_at IS NULL ORDER BY name ASC"
    ).all(tagLikePattern(tag));
    return rows.map((row) => this.mapRow(row));
  }

  findByName(name: string): PromptSegment | null {
    const row = this.db.prepare('SELECT * FROM prompt_segments WHERE name = ? AND deleted_at IS NULL').get(name);
    return row ? this.mapRow(row) : null;
  }

  search(query: string): PromptSegment[] {
    const pattern = `%${query}%`;
    const rows = this.db.prepare(
      'SELECT * FROM prompt_segments WHERE (name LIKE ? OR summary LIKE ?) AND deleted_at IS NULL ORDER BY name ASC'
    ).all(pattern, pattern);
    return rows.map((row) => this.mapRow(row));
  }

  create(data: CreatePromptSegmentDTO): PromptSegment {
    const id = generateSegmentId();
    const timestamp = now();
    const variables = extractVariables(data.content);
    const color = data.color ?? this.getNextColor();
    const resolvedSessionId = this.resolveSessionId(data.sessionId);

    this.db.prepare(`
      INSERT INTO prompt_segments (id, name, content, summary, tags, variables, color, status, session_id, output_type, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.name,
      data.content,
      data.summary ?? '',
      JSON.stringify(data.tags ?? []),
      JSON.stringify(variables),
      color,
      data.status ?? EntityStatusConst.DRAFT,
      resolvedSessionId,
      data.outputType ?? null,
      data.createdBy ?? null,
      timestamp,
      timestamp
    );

    const segment = this.findById(id)!;
    this.emitEvent('prompt:created', 'prompt', { segment }, id);
    return segment;
  }

  update(id: string, data: UpdatePromptSegmentDTO): PromptSegment | null {
    const existing = this.findById(id);
    if (!existing) return null;

    const fieldMappings = {
      name: { column: 'name' },
      content: { column: 'content' },
      summary: { column: 'summary' },
      tags: { column: 'tags', transform: JSON.stringify },
      color: { column: 'color' },
      status: { column: 'status' },
      sessionId: { column: 'session_id', transform: (v: unknown) => this.resolveSessionId(v as string) },
      outputType: { column: 'output_type' },
    };

    const { setClauses, params, hasChanges } = buildDynamicUpdate(data, fieldMappings);

    if (data.content !== undefined) {
      setClauses.push('variables = ?');
      params.push(JSON.stringify(extractVariables(data.content)));
    }

    if (!hasChanges) return existing;

    setClauses.push('updated_at = ?');
    params.push(now(), id);

    this.db.prepare(`UPDATE prompt_segments SET ${setClauses.join(', ')} WHERE id = ? AND deleted_at IS NULL`).run(...params);

    const updated = this.findById(id)!;
    this.emitEvent('prompt:updated', 'prompt', { segment: updated }, id);
    return updated;
  }

  softDelete(id: string): boolean {
    const result = this.db.prepare(
      'UPDATE prompt_segments SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL'
    ).run(now(), id);

    if (result.changes > 0) {
      this.emitEvent('prompt:deleted', 'prompt', { segmentId: id }, id);
      return true;
    }
    return false;
  }

  delete(id: string): boolean {
    return this.softDelete(id);
  }

  count(): number {
    const row = this.db.prepare('SELECT COUNT(*) as count FROM prompt_segments WHERE deleted_at IS NULL').get() as { count: number };
    return row.count;
  }

  protected mapRow(row: unknown): PromptSegment {
    const r = row as Record<string, unknown>;
    return {
      id: r.id as string,
      name: r.name as string,
      content: r.content as string,
      summary: (r.summary as string) ?? '',
      tags: FieldTransforms.jsonArray(r.tags) as string[],
      variables: FieldTransforms.jsonArray(r.variables) as string[],
      color: (r.color as SegmentColor) ?? '#E8D4B8',
      status: (r.status as EntityStatus) ?? EntityStatusConst.PUBLISHED,
      sessionId: r.session_id as string | undefined,
      outputType: r.output_type as PromptOutputType | undefined,
      createdBy: (r.created_by as string) ?? null,
      createdAt: r.created_at as number,
      updatedAt: r.updated_at as number,
    };
  }

  private getNextColor(): string {
    const usageCounts = this.db.prepare(
      'SELECT color, COUNT(*) as count FROM prompt_segments WHERE deleted_at IS NULL GROUP BY color'
    ).all() as Array<{ color: string; count: number }>;

    const usageMap = new Map(usageCounts.map(r => [r.color, r.count]));

    let minUsage = Infinity;
    let bestColor: typeof SEGMENT_COLORS[number] = SEGMENT_COLORS[0];

    for (const color of SEGMENT_COLORS) {
      const usage = usageMap.get(color) ?? 0;
      if (usage < minUsage) {
        minUsage = usage;
        bestColor = color;
      }
    }

    return bestColor;
  }
}
