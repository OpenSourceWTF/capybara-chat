/**
 * Human Input Request Repository
 *
 * Data access for HumanInputRequest entities (human-in-the-loop).
 * When a session needs human input, it creates a request and pauses.
 */

import type { HumanInputRequest } from '@capybara-chat/types';
import { generateId, now, FieldTransforms } from '@capybara-chat/types';
import { BaseSQLiteRepository, type FindOptions } from './base.js';

export type HumanInputRequestStatus = 'pending' | 'responded' | 'timeout' | 'cancelled';

export interface CreateHumanInputRequestDTO {
  sessionId: string;
  question: string;
  context?: string;
  options?: string[];
  timeout?: number;  // Default 30 minutes
}

export interface RespondToHumanInputDTO {
  response?: string;  // Optional for update() which delegates based on presence
  respondedBy?: string;
}

export interface HumanInputRequestRepository {
  findById(id: string): HumanInputRequest | null;
  findAll(options?: FindOptions): HumanInputRequest[];
  findBySession(sessionId: string): HumanInputRequest[];
  /** 139-timeline-pagination: Add limit support to filter methods */
  findPending(options?: FindOptions): HumanInputRequest[];
  findPendingBySession(sessionId: string): HumanInputRequest | null;
  create(data: CreateHumanInputRequestDTO): HumanInputRequest;
  respond(id: string, data: RespondToHumanInputDTO): HumanInputRequest | null;
  cancel(id: string): HumanInputRequest | null;
  timeoutExpired(): number;
  delete(id: string): boolean;
}

export class SQLiteHumanInputRequestRepository
  extends BaseSQLiteRepository<HumanInputRequest, CreateHumanInputRequestDTO, RespondToHumanInputDTO>
  implements HumanInputRequestRepository {
  protected get tableName(): string {
    return 'human_input_requests';
  }

  protected get defaultOrderBy(): string {
    return 'created_at';
  }

  findBySession(sessionId: string): HumanInputRequest[] {
    const rows = this.db
      .prepare('SELECT * FROM human_input_requests WHERE session_id = ? ORDER BY created_at DESC')
      .all(sessionId);
    return rows.map((row) => this.mapRow(row));
  }

  /**
   * Get all pending human input requests
   * 139-timeline-pagination: Add limit support
   */
  findPending(options?: FindOptions): HumanInputRequest[] {
    const { limit, offset } = options ?? {};
    let sql = "SELECT * FROM human_input_requests WHERE status = 'pending' ORDER BY created_at ASC";
    const params: number[] = [];

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

  /**
   * Get the pending request for a specific session (should be at most one)
   */
  findPendingBySession(sessionId: string): HumanInputRequest | null {
    const row = this.db
      .prepare("SELECT * FROM human_input_requests WHERE session_id = ? AND status = 'pending' LIMIT 1")
      .get(sessionId);
    return row ? this.mapRow(row) : null;
  }

  create(data: CreateHumanInputRequestDTO): HumanInputRequest {
    const id = generateId();
    const timestamp = now();
    const timeout = data.timeout ?? 1800000; // Default 30 minutes

    this.db
      .prepare(
        `
      INSERT INTO human_input_requests (id, session_id, question, context, options, timeout, created_at, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
    `
      )
      .run(
        id,
        data.sessionId,
        data.question,
        data.context ?? null,
        data.options ? JSON.stringify(data.options) : null,
        timeout,
        timestamp
      );

    const request = this.findById(id)!;
    this.emitEvent('human_input:requested', 'human_input_request', { request }, id);
    return request;
  }

  /**
   * Base update method required by BaseSQLiteRepository.
   * For human input requests, use respond() or cancel() instead.
   */
  update(id: string, data: RespondToHumanInputDTO): HumanInputRequest | null {
    // Delegate to respond() for the main update use case
    if (data.response) {
      return this.respond(id, data);
    }
    return this.findById(id);
  }

  /**
   * Respond to a human input request
   */
  respond(id: string, data: RespondToHumanInputDTO): HumanInputRequest | null {
    const existing = this.findById(id);
    if (!existing || existing.status !== 'pending') return null;
    if (!data.response) return null;  // Response is required for respond()

    const timestamp = now();

    this.db
      .prepare(
        `
      UPDATE human_input_requests
      SET response = ?, responded_by = ?, responded_at = ?, status = 'responded'
      WHERE id = ? AND status = 'pending'
    `
      )
      .run(data.response, data.respondedBy ?? null, timestamp, id);

    const updated = this.findById(id);
    if (updated) {
      this.emitEvent('human_input:responded', 'human_input_request', { request: updated }, id);
    }
    return updated;
  }

  /**
   * Cancel a pending human input request
   */
  cancel(id: string): HumanInputRequest | null {
    const existing = this.findById(id);
    if (!existing || existing.status !== 'pending') return null;

    this.db
      .prepare(
        `
      UPDATE human_input_requests SET status = 'cancelled' WHERE id = ? AND status = 'pending'
    `
      )
      .run(id);

    const updated = this.findById(id);
    if (updated) {
      this.emitEvent('human_input:cancelled', 'human_input_request', { request: updated }, id);
    }
    return updated;
  }

  /**
   * Mark expired requests as timed out.
   * Returns number of requests that timed out.
   */
  timeoutExpired(): number {
    const timestamp = now();

    const result = this.db
      .prepare(
        `
      UPDATE human_input_requests
      SET status = 'timeout'
      WHERE status = 'pending' AND (created_at + timeout) < ?
    `
      )
      .run(timestamp);

    return result.changes;
  }

  protected mapRow(row: unknown): HumanInputRequest {
    const r = row as Record<string, unknown>;
    return {
      id: r.id as string,
      sessionId: r.session_id as string,
      question: r.question as string,
      context: r.context as string | undefined,
      options: FieldTransforms.jsonArray(r.options) as string[] | undefined,
      timeout: r.timeout as number,
      createdAt: r.created_at as number,
      respondedAt: r.responded_at as number | undefined,
      response: r.response as string | undefined,
      respondedBy: r.responded_by as string | undefined,
      status: r.status as HumanInputRequest['status'],
    };
  }
}
