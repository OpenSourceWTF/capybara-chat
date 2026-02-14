/**
 * Session Repository
 */

import type { Session, SessionType, AllEventTypes, AgentModel, ContextUsage } from '@capybara-chat/types';
import { generateSessionId, now, SessionStatus, buildDynamicUpdate, buildSelectQuery, FieldTransforms } from '@capybara-chat/types';
import { BaseSQLiteRepository, type FindOptions } from './base.js';

export interface CreateSessionDTO {
  specId?: string;                    // Optional for assistant sessions
  workspaceId?: string;               // Workspace this session operates in
  worktreePath?: string;              // Actual worktree directory path
  sessionType?: SessionType;          // Defaults to 'agent'
  agentId?: string;
  agentDefinitionId?: string;         // Agent definition template for this session
  claudeSessionId?: string;
  forkedFromId?: string;
  createdBy?: string | null;
}

export interface UpdateSessionDTO {
  status?: SessionStatus;
  agentId?: string;
  claudeSessionId?: string;
  containerId?: string;
  endedAt?: number;
  name?: string;
  hidden?: boolean;
  hasUnread?: boolean;
  workspaceId?: string;               // Can update workspace
  worktreePath?: string;              // Can update worktree path
  prUrl?: string;                     // GitHub PR URL
  prNumber?: number;                  // GitHub PR number
  totalCost?: number;                 // Running total API cost in USD
  lastReportedCost?: number;          // Last cost reported by Claude (for delta tracking)
  model?: AgentModel;                 // 135-assistant-model-switch: Current model for this session
  editingEntityType?: string;
  editingEntityId?: string;
  formContextInjected?: boolean;
  // 199-2.1: Pipeline state persistence for crash recovery
  pipelineStatus?: SessionStatus;
  pipelineMessageId?: string;
  pipelineMessageContent?: string;
  pipelineContextInjected?: boolean;
  pipelineContextUsage?: ContextUsage;
  pipelineLastActivity?: number;
}

export interface SessionFindOptions extends FindOptions {
  includeHidden?: boolean;
}

export interface SessionRepository {
  findById(id: string): Session | null;
  findAll(options?: SessionFindOptions): Session[];
  /** 139-timeline-pagination: Add limit support to filter methods */
  findBySpecId(specId: string, options?: FindOptions): Session[];
  findByAgentId(agentId: string, options?: FindOptions): Session[];
  findByWorkspaceId(workspaceId: string, options?: FindOptions): Session[];
  findByStatus(status: SessionStatus, options?: FindOptions): Session[];
  findByType(type: SessionType, includeHidden?: boolean, options?: FindOptions): Session[];
  findActive(options?: FindOptions): Session[];
  findActiveByWorkspace(workspaceId: string, options?: FindOptions): Session[];
  /** 199-2.1: Find sessions by pipeline status (for crash recovery) */
  findByPipelineStatus(status: SessionStatus, options?: FindOptions): Session[];
  /** 199-2.1: Find stale pipelines (active but no activity for N ms) */
  findStalePipelines(staleThresholdMs: number, options?: FindOptions): Session[];
  create(data: CreateSessionDTO): Session;
  update(id: string, data: UpdateSessionDTO): Session | null;
  updateCost(id: string, cost: number): Session | null;
  /** 173-session-lifecycle: Touch last_activity_at without changing other fields */
  touchActivity(id: string): boolean;
  delete(id: string): boolean;
  hideSession(id: string): boolean;
  count(): number;
}

export class SQLiteSessionRepository extends BaseSQLiteRepository<Session, CreateSessionDTO, UpdateSessionDTO> implements SessionRepository {
  protected get tableName(): string {
    return 'sessions';
  }

  protected get defaultOrderBy(): string {
    return 'started_at';
  }

  findAll(options?: SessionFindOptions): Session[] {
    const whereClause = options?.includeHidden ? undefined : '(hidden = 0 OR hidden IS NULL)';
    const { sql, params } = buildSelectQuery('sessions', options, 'started_at', 'desc', whereClause);
    const rows = this.db.prepare(sql).all(...params);
    return rows.map((row) => this.mapRow(row));
  }

  // 139-timeline-pagination: Add limit support to filter methods
  findBySpecId(specId: string, options?: FindOptions): Session[] {
    const { limit, offset } = options ?? {};
    let sql = 'SELECT * FROM sessions WHERE spec_id = ? ORDER BY started_at DESC';
    const params: unknown[] = [specId];

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

  findByAgentId(agentId: string, options?: FindOptions): Session[] {
    const { limit, offset } = options ?? {};
    let sql = 'SELECT * FROM sessions WHERE agent_id = ? ORDER BY started_at DESC';
    const params: unknown[] = [agentId];

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

  findByWorkspaceId(workspaceId: string, options?: FindOptions): Session[] {
    const { limit, offset } = options ?? {};
    let sql = 'SELECT * FROM sessions WHERE workspace_id = ? AND (hidden = 0 OR hidden IS NULL) ORDER BY started_at DESC';
    const params: unknown[] = [workspaceId];

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

  findActiveByWorkspace(workspaceId: string, options?: FindOptions): Session[] {
    const { limit, offset } = options ?? {};
    const activeStatuses = [SessionStatus.RUNNING, SessionStatus.PAUSED, SessionStatus.WAITING_HUMAN, SessionStatus.WAITING_FOR_PR];
    const placeholders = activeStatuses.map(() => '?').join(', ');
    let sql = `SELECT * FROM sessions WHERE workspace_id = ? AND status IN (${placeholders}) AND (hidden = 0 OR hidden IS NULL) ORDER BY last_activity_at DESC`;
    const params: unknown[] = [workspaceId, ...activeStatuses];

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

  findByStatus(status: SessionStatus, options?: FindOptions): Session[] {
    const { limit, offset } = options ?? {};
    let sql = 'SELECT * FROM sessions WHERE status = ? AND (hidden = 0 OR hidden IS NULL) ORDER BY last_activity_at DESC';
    const params: unknown[] = [status];

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

  findByType(type: SessionType, includeHidden = false, options?: FindOptions): Session[] {
    const { limit, offset } = options ?? {};
    const hiddenFilter = includeHidden ? '' : 'AND (hidden = 0 OR hidden IS NULL)';
    let sql = `SELECT * FROM sessions WHERE session_type = ? ${hiddenFilter} ORDER BY last_activity_at DESC`;
    const params: unknown[] = [type];

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

  findActive(options?: FindOptions): Session[] {
    const { limit, offset } = options ?? {};
    const activeStatuses = [SessionStatus.RUNNING, SessionStatus.PAUSED, SessionStatus.WAITING_HUMAN, SessionStatus.WAITING_FOR_PR];
    const placeholders = activeStatuses.map(() => '?').join(', ');
    let sql = `SELECT * FROM sessions WHERE status IN (${placeholders}) AND (hidden = 0 OR hidden IS NULL) ORDER BY last_activity_at DESC`;
    const params: unknown[] = [...activeStatuses];

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
   * 199-2.1: Find sessions by pipeline status (for crash recovery)
   * Used to find sessions that were mid-stream when bridge crashed.
   */
  findByPipelineStatus(status: SessionStatus, options?: FindOptions): Session[] {
    const { limit, offset } = options ?? {};
    let sql = 'SELECT * FROM sessions WHERE pipeline_status = ? AND (hidden = 0 OR hidden IS NULL) ORDER BY pipeline_last_activity DESC';
    const params: unknown[] = [status];

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

  findAllByEditingEntity(entityType: string, entityId: string, options?: FindOptions): Session[] {
    const { limit, offset } = options ?? {};
    // Note: This assumes editing_entity_type and editing_entity_id columns exist, or mapped from session_type/spec_id
    // For now, mapping assistant sessions based on spec_id if type is spec
    if (entityType === 'spec') {
      return this.findBySpecId(entityId, options);
    }
    return [];
  }

  /**
   * 199-2.1: Find stale pipelines (active but no activity for threshold ms)
   * Used by cleanup service to detect and reset stuck sessions.
   */
  findStalePipelines(staleThresholdMs: number, options?: FindOptions): Session[] {
    const { limit, offset } = options ?? {};
    const cutoffTime = now() - staleThresholdMs;
    // Find sessions with active pipeline states that haven't been updated
    let sql = `
      SELECT * FROM sessions
      WHERE pipeline_status NOT IN ('idle', 'complete', 'error')
        AND pipeline_status IS NOT NULL
        AND pipeline_last_activity < ?
        AND (hidden = 0 OR hidden IS NULL)
      ORDER BY pipeline_last_activity ASC
    `;
    const params: unknown[] = [cutoffTime];

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

  create(data: CreateSessionDTO): Session {
    const id = generateSessionId();
    const timestamp = now();

    this.db.prepare(`
      INSERT INTO sessions (id, spec_id, workspace_id, worktree_path, session_type, agent_id, agent_definition_id, claude_session_id, status, forked_from_id, created_by, started_at, last_activity_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.specId ?? null,
      data.workspaceId ?? null,
      data.worktreePath ?? null,
      data.sessionType ?? 'agent',
      data.agentId ?? null,
      data.agentDefinitionId ?? null,
      data.claudeSessionId ?? null,
      SessionStatus.PENDING,
      data.forkedFromId ?? null,
      data.createdBy ?? null,
      timestamp,
      timestamp
    );

    const session = this.findById(id)!;
    this.emitEvent('session:created', 'session', { session }, id);
    return session;
  }

  update(id: string, data: UpdateSessionDTO): Session | null {
    const existing = this.findById(id);
    if (!existing) return null;

    const fieldMappings = {
      status: { column: 'status' },
      agentId: { column: 'agent_id' },
      claudeSessionId: { column: 'claude_session_id' },
      containerId: { column: 'container_id' },
      endedAt: { column: 'ended_at' },
      name: { column: 'name' },
      hidden: { column: 'hidden', transform: (v: unknown) => (v ? 1 : 0) },
      hasUnread: { column: 'has_unread', transform: (v: unknown) => (v ? 1 : 0) },
      workspaceId: { column: 'workspace_id' },
      worktreePath: { column: 'worktree_path' },
      prUrl: { column: 'pr_url' },
      prNumber: { column: 'pr_number' },
      totalCost: { column: 'total_cost' },
      lastReportedCost: { column: 'last_reported_cost' },
      model: { column: 'model' },
      // 199-2.1: Pipeline state persistence
      pipelineStatus: { column: 'pipeline_status' },
      pipelineMessageId: { column: 'pipeline_message_id' },
      pipelineMessageContent: { column: 'pipeline_message_content' },
      pipelineContextInjected: { column: 'pipeline_context_injected', transform: (v: unknown) => (v ? 1 : 0) },
      pipelineContextUsage: { column: 'pipeline_context_usage', transform: (v: unknown) => v ? JSON.stringify(v) : null },
      pipelineLastActivity: { column: 'pipeline_last_activity' },
    };

    const { setClauses, params, hasChanges } = buildDynamicUpdate(data, fieldMappings);

    if (!hasChanges) return existing;

    setClauses.push('last_activity_at = ?');
    params.push(now(), id);

    this.db.prepare(`UPDATE sessions SET ${setClauses.join(', ')} WHERE id = ?`).run(...params);

    const updated = this.findById(id)!;

    // Emit status change event if status changed
    if (data.status !== undefined && data.status !== existing.status) {
      const eventType = this.getStatusEventType(data.status);
      this.emitEvent(eventType, 'session', { session: updated, previousStatus: existing.status }, id);
    }

    return updated;
  }

  hideSession(id: string): boolean {
    // 173-fix: Also transition to COMPLETE so status is meaningful for assistants.
    // Without this, hidden sessions stay in RUNNING forever.
    const result = this.db.prepare(
      'UPDATE sessions SET hidden = 1, status = ?, last_activity_at = ? WHERE id = ?'
    ).run(SessionStatus.COMPLETE, now(), id);
    if (result.changes > 0) {
      this.emitEvent('session:hidden', 'session', { sessionId: id }, id);
      return true;
    }
    return false;
  }

  /**
   * 173-session-lifecycle: Touch last_activity_at without requiring other field changes.
   * Used by throttled tool event tracking to keep session activity timestamps fresh.
   */
  touchActivity(id: string): boolean {
    const result = this.db.prepare('UPDATE sessions SET last_activity_at = ? WHERE id = ?').run(now(), id);
    return result.changes > 0;
  }

  /**
   * Update the running total cost for a session.
   * This replaces the cost (from Claude's reported total), not increments it.
   */
  updateCost(id: string, cost: number): Session | null {
    const result = this.db.prepare('UPDATE sessions SET total_cost = ?, last_activity_at = ? WHERE id = ?').run(cost, now(), id);
    if (result.changes > 0) {
      return this.findById(id);
    }
    return null;
  }

  private getStatusEventType(status: SessionStatus): AllEventTypes {
    switch (status) {
      case SessionStatus.RUNNING: return 'session:started';
      case SessionStatus.PAUSED: return 'session:paused';
      case SessionStatus.WAITING_FOR_PR: return 'session:waiting_for_pr';
      case SessionStatus.COMPLETE: return 'session:completed';
      case SessionStatus.FAILED: return 'session:failed';
      default: return 'session:created';
    }
  }

  protected mapRow(row: unknown): Session {
    const r = row as Record<string, unknown>;
    return {
      id: r.id as string,
      specId: r.spec_id as string | undefined,
      workspaceId: r.workspace_id as string | undefined,
      worktreePath: r.worktree_path as string | undefined,
      sessionType: (r.session_type as SessionType) ?? 'agent',
      agentId: r.agent_id as string | undefined,
      agentDefinitionId: r.agent_definition_id as string | undefined,
      claudeSessionId: r.claude_session_id as string | undefined,
      status: r.status as SessionStatus,
      forkedFromId: r.forked_from_id as string | undefined,
      containerId: r.container_id as string | undefined,
      name: r.name as string | undefined,
      hidden: FieldTransforms.boolean(r.hidden),
      hasUnread: FieldTransforms.boolean(r.has_unread),
      prUrl: r.pr_url as string | undefined,
      prNumber: r.pr_number as number | undefined,
      totalCost: r.total_cost as number | undefined,
      lastReportedCost: r.last_reported_cost as number | undefined,
      model: r.model as AgentModel | undefined,
      // 199-2.1: Pipeline state persistence
      pipelineStatus: r.pipeline_status as SessionStatus | undefined,
      pipelineMessageId: r.pipeline_message_id as string | undefined,
      pipelineMessageContent: r.pipeline_message_content as string | undefined,
      pipelineContextInjected: FieldTransforms.boolean(r.pipeline_context_injected),
      pipelineContextUsage: r.pipeline_context_usage ? JSON.parse(r.pipeline_context_usage as string) as ContextUsage : undefined,
      pipelineLastActivity: r.pipeline_last_activity as number | undefined,
      createdBy: (r.created_by as string) ?? null,
      startedAt: r.started_at as number,
      lastActivityAt: r.last_activity_at as number,
      endedAt: r.ended_at as number | undefined,
    };
  }
}
