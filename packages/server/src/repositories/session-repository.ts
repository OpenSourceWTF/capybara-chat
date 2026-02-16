/**
 * Session Repository
 *
 * Data access for chat sessions. Stripped of workspace/spec/task references.
 */

import type { Session, SessionType, AllEventTypes, AgentModel, ContextUsage, SessionMode, FormEntityType } from '@capybara-chat/types';
import { generateSessionId, now, SessionStatus, buildDynamicUpdate, buildSelectQuery, FieldTransforms } from '@capybara-chat/types';
import { BaseSQLiteRepository, type FindOptions } from './base.js';

export interface CreateSessionDTO {
  sessionType?: SessionType;
  agentDefinitionId?: string;
  claudeSessionId?: string;
  forkedFromId?: string;
  createdBy?: string | null;
  name?: string;
  mode?: string;
  editingEntityType?: string;
  editingEntityId?: string;
}

export interface UpdateSessionDTO {
  status?: SessionStatus;
  claudeSessionId?: string;
  endedAt?: number;
  name?: string;
  hidden?: boolean;
  hasUnread?: boolean;
  totalCost?: number;
  lastReportedCost?: number;
  model?: AgentModel;
  editingEntityType?: string;
  editingEntityId?: string;
  formContextInjected?: boolean;
  // Pipeline state persistence for crash recovery
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
  findByStatus(status: SessionStatus, options?: FindOptions): Session[];
  findByType(type: SessionType, includeHidden?: boolean, options?: FindOptions): Session[];
  findActive(options?: FindOptions): Session[];
  findByPipelineStatus(status: SessionStatus, options?: FindOptions): Session[];
  findStalePipelines(staleThresholdMs: number, options?: FindOptions): Session[];
  findAllByEditingEntity(entityType: string, entityId: string, options?: FindOptions): Session[];
  create(data: CreateSessionDTO): Session;
  update(id: string, data: UpdateSessionDTO): Session | null;
  updateCost(id: string, cost: number): Session | null;
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

  findByStatus(status: SessionStatus, options?: FindOptions): Session[] {
    return this.findWhere(
      'SELECT * FROM sessions WHERE status = ? AND (hidden = 0 OR hidden IS NULL) ORDER BY last_activity_at DESC',
      [status],
      options
    );
  }

  findByType(type: SessionType, includeHidden = false, options?: FindOptions): Session[] {
    const hiddenFilter = includeHidden ? '' : 'AND (hidden = 0 OR hidden IS NULL)';
    return this.findWhere(
      `SELECT * FROM sessions WHERE session_type = ? ${hiddenFilter} ORDER BY last_activity_at DESC`,
      [type],
      options
    );
  }

  findActive(options?: FindOptions): Session[] {
    const activeStatuses = [SessionStatus.RUNNING, SessionStatus.PAUSED, SessionStatus.WAITING_HUMAN];
    const placeholders = activeStatuses.map(() => '?').join(', ');
    return this.findWhere(
      `SELECT * FROM sessions WHERE status IN (${placeholders}) AND (hidden = 0 OR hidden IS NULL) ORDER BY last_activity_at DESC`,
      [...activeStatuses],
      options
    );
  }

  findByPipelineStatus(status: SessionStatus, options?: FindOptions): Session[] {
    return this.findWhere(
      'SELECT * FROM sessions WHERE pipeline_status = ? AND (hidden = 0 OR hidden IS NULL) ORDER BY pipeline_last_activity DESC',
      [status],
      options
    );
  }

  findStalePipelines(staleThresholdMs: number, options?: FindOptions): Session[] {
    const cutoffTime = now() - staleThresholdMs;
    return this.findWhere(
      `SELECT * FROM sessions
       WHERE pipeline_status NOT IN ('idle', 'complete', 'error')
         AND pipeline_status IS NOT NULL
         AND pipeline_last_activity < ?
         AND (hidden = 0 OR hidden IS NULL)
       ORDER BY pipeline_last_activity ASC`,
      [cutoffTime],
      options
    );
  }

  findAllByEditingEntity(entityType: string, entityId: string, options?: FindOptions): Session[] {
    return this.findWhere(
      'SELECT * FROM sessions WHERE editing_entity_type = ? AND editing_entity_id = ? AND (hidden = 0 OR hidden IS NULL) ORDER BY last_activity_at DESC',
      [entityType, entityId],
      options
    );
  }

  create(data: CreateSessionDTO): Session {
    const id = generateSessionId();
    const timestamp = now();

    this.db.prepare(`
      INSERT INTO sessions (id, session_type, agent_definition_id, claude_session_id, status, forked_from_id, name, mode, editing_entity_type, editing_entity_id, created_by, started_at, last_activity_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.sessionType ?? 'assistant:general',
      data.agentDefinitionId ?? null,
      data.claudeSessionId ?? null,
      SessionStatus.PENDING,
      data.forkedFromId ?? null,
      data.name ?? null,
      data.mode ?? 'chat',
      data.editingEntityType ?? null,
      data.editingEntityId ?? null,
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
      claudeSessionId: { column: 'claude_session_id' },
      endedAt: { column: 'ended_at' },
      name: { column: 'name' },
      hidden: { column: 'hidden', transform: (v: unknown) => (v ? 1 : 0) },
      hasUnread: { column: 'has_unread', transform: (v: unknown) => (v ? 1 : 0) },
      totalCost: { column: 'total_cost' },
      lastReportedCost: { column: 'last_reported_cost' },
      model: { column: 'model' },
      editingEntityType: { column: 'editing_entity_type' },
      editingEntityId: { column: 'editing_entity_id' },
      formContextInjected: { column: 'form_context_injected', transform: (v: unknown) => (v ? 1 : 0) },
      // Pipeline state persistence
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

    if (data.status !== undefined && data.status !== existing.status) {
      const eventType = this.getStatusEventType(data.status);
      this.emitEvent(eventType, 'session', { session: updated, previousStatus: existing.status }, id);
    }

    return updated;
  }

  hideSession(id: string): boolean {
    const result = this.db.prepare(
      'UPDATE sessions SET hidden = 1, status = ?, last_activity_at = ? WHERE id = ?'
    ).run(SessionStatus.COMPLETE, now(), id);
    if (result.changes > 0) {
      this.emitEvent('session:hidden', 'session', { sessionId: id }, id);
      return true;
    }
    return false;
  }

  touchActivity(id: string): boolean {
    const result = this.db.prepare('UPDATE sessions SET last_activity_at = ? WHERE id = ?').run(now(), id);
    return result.changes > 0;
  }

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
      case SessionStatus.COMPLETE: return 'session:completed';
      case SessionStatus.FAILED: return 'session:failed';
      default: return 'session:created';
    }
  }

  protected mapRow(row: unknown): Session {
    const r = row as Record<string, unknown>;
    return {
      id: r.id as string,
      sessionType: (r.session_type as SessionType) ?? 'assistant:general',
      agentDefinitionId: r.agent_definition_id as string | undefined,
      claudeSessionId: r.claude_session_id as string | undefined,
      status: r.status as SessionStatus,
      forkedFromId: r.forked_from_id as string | undefined,
      name: r.name as string | undefined,
      hidden: FieldTransforms.boolean(r.hidden),
      hasUnread: FieldTransforms.boolean(r.has_unread),
      totalCost: r.total_cost as number | undefined,
      lastReportedCost: r.last_reported_cost as number | undefined,
      model: r.model as AgentModel | undefined,
      mode: (r.mode as SessionMode | undefined) ?? 'chat',
      editingEntityType: r.editing_entity_type as FormEntityType | undefined,
      editingEntityId: r.editing_entity_id as string | undefined,
      formContextInjected: FieldTransforms.boolean(r.form_context_injected),
      // Pipeline state
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
