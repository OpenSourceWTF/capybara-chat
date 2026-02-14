/**
 * Session Event Repository
 *
 * Handles persistence of session timeline events (opened, closed, resumed, etc.)
 * These events are displayed inline in the chat timeline.
 */

import type Database from 'better-sqlite3';
import { generateEventId, now, SessionHistoryEventType, PAGINATION, FieldTransforms } from '@capybara-chat/types';

// Re-export from types for consumers
export { SessionHistoryEventType } from '@capybara-chat/types';

export interface SessionEvent {
  id: string;
  sessionId: string;
  type: SessionHistoryEventType;
  metadata?: Record<string, unknown>;
  createdAt: number;
}

export interface SessionEventRepository {
  create(data: Omit<SessionEvent, 'id' | 'createdAt'>): SessionEvent;
  findBySessionId(sessionId: string, options?: { limit?: number; offset?: number }): SessionEvent[];
  getLastEvent(sessionId: string): SessionEvent | null;
  /** 139-timeline-pagination: Find tool_use events for specific messageIds */
  findToolsByMessageIds(sessionId: string, messageIds: string[]): SessionEvent[];
}

export class SQLiteSessionEventRepository implements SessionEventRepository {
  constructor(private db: Database.Database) { }

  create(data: Omit<SessionEvent, 'id' | 'createdAt'>): SessionEvent {
    const id = generateEventId();
    const createdAt = now();

    const stmt = this.db.prepare(`
      INSERT INTO session_events (id, session_id, type, metadata, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      data.sessionId,
      data.type,
      data.metadata ? JSON.stringify(data.metadata) : null,
      createdAt
    );

    return {
      id,
      sessionId: data.sessionId,
      type: data.type,
      metadata: data.metadata,
      createdAt,
    };
  }

  findBySessionId(sessionId: string, options?: { limit?: number; offset?: number }): SessionEvent[] {
    const limit = options?.limit ?? PAGINATION.DEFAULT_LIMIT;
    const offset = options?.offset ?? PAGINATION.DEFAULT_OFFSET;

    const rows = this.db.prepare(`
      SELECT * FROM session_events
      WHERE session_id = ?
      ORDER BY created_at ASC
      LIMIT ? OFFSET ?
    `).all(sessionId, limit, offset);

    return rows.map((row) => this.mapRow(row));
  }

  getLastEvent(sessionId: string): SessionEvent | null {
    const row = this.db.prepare(`
      SELECT * FROM session_events
      WHERE session_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `).get(sessionId);

    return row ? this.mapRow(row) : null;
  }

  /**
   * 139-timeline-pagination: Find tool_use events for specific messageIds.
   * This enables loading tools for only the visible messages rather than all events.
   */
  findToolsByMessageIds(sessionId: string, messageIds: string[]): SessionEvent[] {
    if (messageIds.length === 0) return [];

    // Build dynamic placeholders for IN clause
    const placeholders = messageIds.map(() => '?').join(',');

    const rows = this.db.prepare(`
      SELECT * FROM session_events
      WHERE session_id = ?
        AND type = 'tool_use'
        AND json_extract(metadata, '$.messageId') IN (${placeholders})
      ORDER BY created_at ASC
    `).all(sessionId, ...messageIds);

    return rows.map((row) => this.mapRow(row));
  }

  private mapRow(row: unknown): SessionEvent {
    const r = row as Record<string, unknown>;
    return {
      id: r.id as string,
      sessionId: r.session_id as string,
      type: r.type as SessionHistoryEventType,
      metadata: FieldTransforms.jsonOptional(r.metadata),
      createdAt: r.created_at as number,
    };
  }
}
