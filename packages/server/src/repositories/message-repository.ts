/**
 * Message Repository
 *
 * Handles persistence of chat messages for sessions.
 * Includes status tracking for message processing state.
 */

import type Database from 'better-sqlite3';
import { generateMessageId, now, FieldTransforms, PAGINATION, MessageStatus, type ChatMessage, type MessageRole } from '@capybara-chat/types';

// Re-export for consumers - use canonical types from @capybara-chat/types
export type { MessageStatus, MessageRole, ChatMessage } from '@capybara-chat/types';

/** 139-timeline-pagination: Result with cursor for infinite scroll */
export interface PaginatedMessages {
  messages: ChatMessage[];
  /** Cursor for next page (timestamp of oldest message), null if no more */
  nextCursor: number | null;
  /** Whether there are more older messages */
  hasMore: boolean;
}

export interface MessageRepository {
  // id and createdAt are optional - if not provided, generates new ID / uses now()
  create(data: Omit<ChatMessage, 'id' | 'createdAt' | 'status'> & { id?: string; status?: MessageStatus; createdAt?: number }): ChatMessage;
  // GAP-008 FIX: Upsert for streaming messages - insert if new, update content if exists
  upsert(data: Omit<ChatMessage, 'createdAt' | 'status'> & { status?: MessageStatus; createdAt?: number }): ChatMessage;
  findBySessionId(sessionId: string, options?: { limit?: number; offset?: number }): ChatMessage[];
  findById(id: string): ChatMessage | null;
  findLastUserMessage(sessionId: string): ChatMessage | null;
  findByStatus(statuses: MessageStatus[]): ChatMessage[];
  /** 173-session-lifecycle: Find orphaned messages for a specific session */
  findBySessionAndStatus(sessionId: string, statuses: MessageStatus[]): ChatMessage[];
  updateStatus(id: string, status: MessageStatus): boolean;
  deleteBySessionId(sessionId: string): void;
  count(sessionId?: string): number;
  /** 139-timeline-pagination: Cursor-based pagination for infinite scroll (newest first) */
  findPaginated(sessionId: string, options?: { limit?: number; beforeTimestamp?: number }): PaginatedMessages;
}

export class SQLiteMessageRepository implements MessageRepository {
  constructor(private db: Database.Database) { }

  create(data: Omit<ChatMessage, 'id' | 'createdAt' | 'status'> & { id?: string; status?: MessageStatus; createdAt?: number }): ChatMessage {
    const id = data.id ?? generateMessageId();  // Use provided ID or generate new
    const createdAt = data.createdAt ?? now(); // Use provided timestamp or default to now
    const status = data.status ?? MessageStatus.SENT;

    const stmt = this.db.prepare(`
      INSERT INTO chat_messages (id, session_id, role, content, tool_use, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      data.sessionId,
      data.role,
      data.content,
      data.toolUse ? JSON.stringify(data.toolUse) : null,
      status,
      createdAt
    );

    return {
      id,
      sessionId: data.sessionId,
      role: data.role,
      content: data.content,
      toolUse: data.toolUse,
      status,
      createdAt,
    };
  }

  // GAP-008 FIX: Upsert for streaming messages
  upsert(data: Omit<ChatMessage, 'createdAt' | 'status'> & { status?: MessageStatus; createdAt?: number }): ChatMessage {
    const createdAt = data.createdAt ?? now();
    const status = data.status ?? MessageStatus.SENT;

    // Use INSERT OR REPLACE to upsert
    // Note: This preserves the original createdAt if the message exists
    const stmt = this.db.prepare(`
      INSERT INTO chat_messages (id, session_id, role, content, tool_use, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        content = excluded.content,
        status = excluded.status,
        tool_use = COALESCE(excluded.tool_use, chat_messages.tool_use)
    `);

    stmt.run(
      data.id,
      data.sessionId,
      data.role,
      data.content,
      data.toolUse ? JSON.stringify(data.toolUse) : null,
      status,
      createdAt
    );

    return {
      id: data.id,
      sessionId: data.sessionId,
      role: data.role,
      content: data.content,
      toolUse: data.toolUse,
      status,
      createdAt,
    };
  }

  findBySessionId(sessionId: string, options?: { limit?: number; offset?: number }): ChatMessage[] {
    const limit = options?.limit ?? PAGINATION.DEFAULT_LIMIT;
    const offset = options?.offset ?? PAGINATION.DEFAULT_OFFSET;

    const rows = this.db.prepare(`
      SELECT * FROM chat_messages
      WHERE session_id = ?
      ORDER BY created_at ASC
      LIMIT ? OFFSET ?
    `).all(sessionId, limit, offset);

    return rows.map((row) => this.mapRow(row));
  }

  findById(id: string): ChatMessage | null {
    const row = this.db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(id);
    return row ? this.mapRow(row) : null;
  }

  findLastUserMessage(sessionId: string): ChatMessage | null {
    const row = this.db.prepare(`
      SELECT * FROM chat_messages
      WHERE session_id = ? AND role = 'user'
      ORDER BY created_at DESC
      LIMIT 1
    `).get(sessionId);
    return row ? this.mapRow(row) : null;
  }

  /**
   * Find messages by status(es).
   * Used for crash recovery - find orphaned messages stuck in queued/processing.
   */
  findByStatus(statuses: MessageStatus[]): ChatMessage[] {
    if (statuses.length === 0) return [];

    const placeholders = statuses.map(() => '?').join(',');
    const rows = this.db.prepare(`
      SELECT * FROM chat_messages
      WHERE status IN (${placeholders})
      ORDER BY created_at ASC
    `).all(...statuses);

    return rows.map((row) => this.mapRow(row));
  }

  /**
   * 173-session-lifecycle: Find orphaned messages for a specific session.
   * Used to recover stale queued/processing messages when a new message arrives.
   */
  findBySessionAndStatus(sessionId: string, statuses: MessageStatus[]): ChatMessage[] {
    if (statuses.length === 0) return [];

    const placeholders = statuses.map(() => '?').join(',');
    const rows = this.db.prepare(`
      SELECT * FROM chat_messages
      WHERE session_id = ? AND status IN (${placeholders})
      ORDER BY created_at ASC
    `).all(sessionId, ...statuses);

    return rows.map((row) => this.mapRow(row));
  }

  // Update message status (used for tracking queue/processing state)
  updateStatus(id: string, status: MessageStatus): boolean {
    const stmt = this.db.prepare(`UPDATE chat_messages SET status = ? WHERE id = ?`);
    const result = stmt.run(status, id);
    return result.changes > 0;
  }

  deleteBySessionId(sessionId: string): void {
    const stmt = this.db.prepare(`DELETE FROM chat_messages WHERE session_id = ?`);
    stmt.run(sessionId);
  }

  count(sessionId?: string): number {
    if (sessionId) {
      const stmt = this.db.prepare(`SELECT COUNT(*) as count FROM chat_messages WHERE session_id = ?`);
      const row = stmt.get(sessionId) as { count: number };
      return row.count;
    }

    const stmt = this.db.prepare(`SELECT COUNT(*) as count FROM chat_messages`);
    const row = stmt.get() as { count: number };
    return row.count;
  }

  /**
   * 139-timeline-pagination: Cursor-based pagination for infinite scroll.
   * Returns messages newest-first, with cursor pointing to oldest message.
   * Use beforeTimestamp to load older messages (scroll up).
   */
  findPaginated(sessionId: string, options?: { limit?: number; beforeTimestamp?: number }): PaginatedMessages {
    const limit = options?.limit ?? PAGINATION.DEFAULT_LIMIT;
    const beforeTimestamp = options?.beforeTimestamp;

    // Fetch limit+1 to detect if there are more
    const fetchLimit = limit + 1;

    let rows: unknown[];
    if (beforeTimestamp) {
      // Load messages OLDER than the cursor (scroll up)
      rows = this.db.prepare(`
        SELECT * FROM chat_messages
        WHERE session_id = ? AND created_at < ?
        ORDER BY created_at DESC
        LIMIT ?
      `).all(sessionId, beforeTimestamp, fetchLimit);
    } else {
      // Initial load: get most recent messages
      rows = this.db.prepare(`
        SELECT * FROM chat_messages
        WHERE session_id = ?
        ORDER BY created_at DESC
        LIMIT ?
      `).all(sessionId, fetchLimit);
    }

    const hasMore = rows.length > limit;
    const resultRows = hasMore ? rows.slice(0, limit) : rows;

    // Map and reverse to get chronological order (oldest first)
    const messages = resultRows.map((row) => this.mapRow(row)).reverse();

    // Cursor is the timestamp of the oldest message in this batch
    const nextCursor = messages.length > 0 ? messages[0].createdAt : null;

    return {
      messages,
      nextCursor: hasMore ? nextCursor : null,
      hasMore,
    };
  }

  private mapRow(row: unknown): ChatMessage {
    const r = row as Record<string, unknown>;
    return {
      id: r.id as string,
      sessionId: r.session_id as string,
      role: r.role as MessageRole,
      content: r.content as string,
      toolUse: FieldTransforms.jsonOptional(r.tool_use),
      status: (r.status || MessageStatus.SENT) as MessageStatus,
      createdAt: r.created_at as number,
    };
  }
}
