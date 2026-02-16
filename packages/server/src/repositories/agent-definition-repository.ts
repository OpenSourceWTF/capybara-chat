/**
 * Agent Definition Repository
 *
 * Data access for AgentDefinition entities.
 * Supports soft-delete, default agents, and subagent resolution.
 */

import type {
  AgentDefinition,
  AgentModel,
  SubagentLink,
  AgentMCPServerConfig,
  ResolvedAgentDefinition,
  ResolvedSubagent,
  EntityStatus,
  PrefilledMessage,
} from '@capybara-chat/types';
import {
  generateAgentDefinitionId,
  now,
  EntityStatus as EntityStatusEnum,
  FieldTransforms,
  buildDynamicUpdate,
} from '@capybara-chat/types';
import { BaseSQLiteRepository, tagLikePattern, type FindOptions } from './base.js';

// DTOs
export interface CreateAgentDefinitionDTO {
  name: string;
  slug: string;
  description: string;
  systemPrompt: string;
  systemPromptSegmentId?: string | null;
  model?: AgentModel;
  role?: string;
  prefilledConversation?: PrefilledMessage[];
  subagents?: SubagentLink[];
  mcpServers?: AgentMCPServerConfig[];
  skills?: string[];
  allowedTools?: string[];
  tags?: string[];
  sessionId?: string;
  isSystem?: boolean;
  createdBy?: string | null;
}

export interface UpdateAgentDefinitionDTO {
  name?: string;
  slug?: string;
  description?: string;
  systemPrompt?: string;
  systemPromptSegmentId?: string | null;
  model?: AgentModel;
  role?: string;
  prefilledConversation?: PrefilledMessage[];
  subagents?: SubagentLink[];
  mcpServers?: AgentMCPServerConfig[];
  skills?: string[];
  allowedTools?: string[];
  tags?: string[];
  status?: EntityStatus;
  isDefault?: boolean;
}

// Repository Interface
export interface AgentDefinitionRepository {
  findById(id: string): AgentDefinition | null;
  findBySlug(slug: string): AgentDefinition | null;
  findAll(options?: FindOptions): AgentDefinition[];
  findByTag(tag: string, options?: FindOptions): AgentDefinition[];
  findByRole(role: string, options?: FindOptions): AgentDefinition[];
  findSystem(options?: FindOptions): AgentDefinition[];
  findDefault(): AgentDefinition | null;
  findDefaultByRole(role: string): AgentDefinition | null;
  setDefaultForRole(agentId: string, role: string): void;
  create(data: CreateAgentDefinitionDTO): AgentDefinition;
  update(id: string, data: UpdateAgentDefinitionDTO): AgentDefinition | null;
  delete(id: string): boolean;
  softDelete(id: string): boolean;
  count(): number;
  resolve(id: string, visited?: Set<string>): ResolvedAgentDefinition | null;
  getResolvedSystemPrompt(id: string): string | null;
  getResolvedSubagents(id: string): Record<string, {
    description: string;
    prompt: string;
    tools?: string[];
    model?: AgentModel;
  }> | null;
  forUser(userId: string, role: import('@capybara-chat/types').UserRole, hasPublishVisibility?: boolean): import('./base.js').ScopedRepository<AgentDefinition, CreateAgentDefinitionDTO, UpdateAgentDefinitionDTO>;
}

// Implementation
export class SQLiteAgentDefinitionRepository
  extends BaseSQLiteRepository<AgentDefinition, CreateAgentDefinitionDTO, UpdateAgentDefinitionDTO>
  implements AgentDefinitionRepository {

  protected get tableName(): string {
    return 'agent_definitions';
  }

  protected get defaultOrderBy(): string {
    return 'updated_at';
  }

  // Find methods (all exclude soft-deleted)

  findById(id: string): AgentDefinition | null {
    const row = this.db.prepare(
      'SELECT * FROM agent_definitions WHERE id = ? AND deleted_at IS NULL'
    ).get(id);
    return row ? this.mapRow(row) : null;
  }

  findAll(options?: FindOptions): AgentDefinition[] {
    const { orderBy, orderDir } = options ?? {};
    const actualOrderBy = orderBy ?? this.defaultOrderBy;
    const actualOrderDir = orderDir ?? this.defaultOrderDir;
    return this.findWhere(
      `SELECT * FROM agent_definitions WHERE deleted_at IS NULL ORDER BY ${actualOrderBy} ${actualOrderDir}`,
      [],
      options
    );
  }

  findBySlug(slug: string): AgentDefinition | null {
    const row = this.db.prepare(
      'SELECT * FROM agent_definitions WHERE slug = ? AND deleted_at IS NULL'
    ).get(slug);
    return row ? this.mapRow(row) : null;
  }

  findByTag(tag: string, options?: FindOptions): AgentDefinition[] {
    return this.findWhere(
      "SELECT * FROM agent_definitions WHERE tags LIKE ? ESCAPE '\\' AND deleted_at IS NULL ORDER BY is_system DESC, updated_at DESC",
      [tagLikePattern(tag)],
      options
    );
  }

  findByRole(role: string, options?: FindOptions): AgentDefinition[] {
    return this.findWhere(
      'SELECT * FROM agent_definitions WHERE role = ? AND deleted_at IS NULL ORDER BY is_system DESC, updated_at DESC',
      [role],
      options
    );
  }

  findSystem(options?: FindOptions): AgentDefinition[] {
    return this.findWhere(
      'SELECT * FROM agent_definitions WHERE is_system = 1 AND deleted_at IS NULL ORDER BY name ASC',
      [],
      options
    );
  }

  findDefault(): AgentDefinition | null {
    const row = this.db.prepare(
      'SELECT * FROM agent_definitions WHERE is_default = 1 AND deleted_at IS NULL LIMIT 1'
    ).get();
    return row ? this.mapRow(row) : null;
  }

  findDefaultByRole(role: string): AgentDefinition | null {
    const row = this.db.prepare(
      'SELECT * FROM agent_definitions WHERE is_default = 1 AND role = ? AND deleted_at IS NULL LIMIT 1'
    ).get(role);
    return row ? this.mapRow(row) : null;
  }

  setDefaultForRole(agentId: string, role: string): void {
    this.db.transaction(() => {
      this.db.prepare(
        'UPDATE agent_definitions SET is_default = 0 WHERE role = ? AND deleted_at IS NULL'
      ).run(role);
      this.db.prepare(
        'UPDATE agent_definitions SET is_default = 1 WHERE id = ? AND deleted_at IS NULL'
      ).run(agentId);
    })();
  }

  count(): number {
    const row = this.db.prepare(
      'SELECT COUNT(*) as count FROM agent_definitions WHERE deleted_at IS NULL'
    ).get() as { count: number };
    return row.count;
  }

  /**
   * Get the resolved system prompt for an agent.
   * If systemPromptSegmentId is set, loads from prompt_segments.
   * Falls back to the inline systemPrompt field.
   * Auto-appends subagent descriptions if linked.
   */
  getResolvedSystemPrompt(id: string): string | null {
    const agent = this.findById(id);
    if (!agent) return null;

    let prompt: string | null = null;
    if (agent.systemPromptSegmentId) {
      const segment = this.db.prepare(
        'SELECT content FROM prompt_segments WHERE id = ? AND deleted_at IS NULL'
      ).get(agent.systemPromptSegmentId) as { content: string } | undefined;

      if (segment) prompt = segment.content;
    }
    if (!prompt) prompt = agent.agentContext?.systemPrompt || null;
    if (!prompt) return null;

    // Auto-compose subagent descriptions
    const rawRow = this.db.prepare('SELECT subagent_links FROM agent_definitions WHERE id = ? AND deleted_at IS NULL').get(agent.id) as { subagent_links: string } | undefined;
    const subagentLinks: SubagentLink[] = rawRow?.subagent_links ? JSON.parse(rawRow.subagent_links) : [];
    if (subagentLinks.length > 0) {
      const descriptions = this.resolveSubagentDescriptions(subagentLinks);
      if (descriptions) prompt = `${prompt}\n\n${descriptions}`;
    }

    return prompt;
  }

  private resolveSubagentDescriptions(links: SubagentLink[]): string | null {
    const entries: Array<{ slug: string; description: string }> = [];

    for (const link of links) {
      const subDef = this.findById(link.agentDefinitionId);
      if (!subDef) continue;
      entries.push({
        slug: subDef.slug,
        description: link.descriptionOverride || subDef.description,
      });
    }

    if (entries.length === 0) return null;

    let section = '<available_subagents>\nYou can delegate work to these specialized agents by name:\n';
    for (const e of entries) {
      section += `- **${e.slug}**: ${e.description}\n`;
    }
    section += '</available_subagents>';
    return section;
  }

  /**
   * Resolve subagent links to Claude SDK AgentDefinition format.
   */
  getResolvedSubagents(id: string): Record<string, {
    description: string;
    prompt: string;
    tools?: string[];
    model?: AgentModel;
  }> | null {
    const agent = this.findById(id);
    if (!agent) return null;

    const rawRow = this.db.prepare('SELECT subagent_links FROM agent_definitions WHERE id = ? AND deleted_at IS NULL').get(id) as { subagent_links: string } | undefined;
    const subagentLinks: SubagentLink[] = rawRow?.subagent_links ? JSON.parse(rawRow.subagent_links) : [];
    if (subagentLinks.length === 0) return null;

    const resolved: Record<string, { description: string; prompt: string; tools?: string[]; model?: AgentModel }> = {};

    for (const link of subagentLinks) {
      const subDef = this.findById(link.agentDefinitionId);
      if (!subDef) continue;

      const subPrompt = this.getResolvedSystemPrompt(subDef.id) || subDef.agentContext?.systemPrompt || '';

      let model: AgentModel | undefined;
      const subDefModel = subDef.agentContext?.model;
      if (subDefModel) {
        if (['opus', 'opus-latest', 'sonnet', 'haiku'].includes(subDefModel)) {
          model = subDefModel as AgentModel;
        } else {
          model = 'inherit' as AgentModel;
        }
      }

      const builtinTools = (subDef.agentContext?.allowedTools || []).filter(t => !t.startsWith('mcp__'));
      const mcpPerms = (subDef.agentContext?.mcpServers || [])
        .filter(s => s.enabled)
        .map(s => `mcp__${s.name}__*`);
      const effectiveTools = [...builtinTools, ...mcpPerms];

      resolved[subDef.slug] = {
        description: link.descriptionOverride || subDef.description,
        prompt: subPrompt,
        tools: effectiveTools.length > 0 ? effectiveTools : undefined,
        model,
      };
    }

    return Object.keys(resolved).length > 0 ? resolved : null;
  }

  // Create
  create(data: CreateAgentDefinitionDTO): AgentDefinition {
    const id = generateAgentDefinitionId();
    const timestamp = now();
    const resolvedSessionId = this.resolveSessionId(data.sessionId);

    this.db.prepare(`
      INSERT INTO agent_definitions (
        id, name, slug, description, system_prompt, system_prompt_segment_id, model, role,
        prefilled_conversation, subagent_links, mcp_servers, skills, allowed_tools,
        tags, status, session_id, is_system, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.name,
      data.slug,
      data.description,
      data.systemPrompt,
      data.systemPromptSegmentId ?? null,
      data.model ?? 'sonnet',
      data.role ?? 'assistant',
      JSON.stringify(data.prefilledConversation ?? []),
      JSON.stringify(data.subagents ?? []),
      JSON.stringify(data.mcpServers ?? []),
      JSON.stringify(data.skills ?? []),
      JSON.stringify(data.allowedTools ?? []),
      JSON.stringify(data.tags ?? []),
      EntityStatusEnum.DRAFT,
      resolvedSessionId,
      data.isSystem ? 1 : 0,
      data.createdBy ?? null,
      timestamp,
      timestamp
    );

    const agentDefinition = this.findById(id)!;
    this.emitEvent('agentDefinition:created', 'agentDefinition', { agentDefinition }, id);
    return agentDefinition;
  }

  // Update
  update(id: string, data: UpdateAgentDefinitionDTO): AgentDefinition | null {
    const existing = this.findById(id);
    if (!existing) return null;

    const fieldMappings = {
      name: { column: 'name' },
      slug: { column: 'slug' },
      description: { column: 'description' },
      systemPrompt: { column: 'system_prompt' },
      systemPromptSegmentId: { column: 'system_prompt_segment_id' },
      model: { column: 'model' },
      role: { column: 'role' },
      prefilledConversation: { column: 'prefilled_conversation', transform: JSON.stringify },
      subagents: { column: 'subagent_links', transform: JSON.stringify },
      mcpServers: { column: 'mcp_servers', transform: JSON.stringify },
      skills: { column: 'skills', transform: JSON.stringify },
      allowedTools: { column: 'allowed_tools', transform: JSON.stringify },
      tags: { column: 'tags', transform: JSON.stringify },
      status: { column: 'status' },
      isDefault: { column: 'is_default', transform: (v: unknown) => v ? 1 : 0 },
    };

    const { setClauses, params, hasChanges } = buildDynamicUpdate(data, fieldMappings);
    if (!hasChanges) return existing;

    setClauses.push('updated_at = ?');
    params.push(now(), id);

    this.db.prepare(
      `UPDATE agent_definitions SET ${setClauses.join(', ')} WHERE id = ? AND deleted_at IS NULL`
    ).run(...params);

    const updated = this.findById(id)!;
    this.emitEvent('agentDefinition:updated', 'agentDefinition', { agentDefinition: updated }, id);
    return updated;
  }

  // Soft Delete (with system agent protection)
  softDelete(id: string): boolean {
    const existing = this.findById(id);
    if (!existing) return false;

    if (existing.isSystem) {
      throw new Error('Cannot delete system agent definition');
    }

    const result = this.db.prepare(
      'UPDATE agent_definitions SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL'
    ).run(now(), id);

    if (result.changes > 0) {
      this.emitEvent('agentDefinition:deleted', 'agentDefinition', { id }, id);
      return true;
    }
    return false;
  }

  delete(id: string): boolean {
    return this.softDelete(id);
  }

  // Resolve (expand subagents with circular reference detection)
  resolve(id: string, visited: Set<string> = new Set()): ResolvedAgentDefinition | null {
    if (visited.has(id)) {
      throw new Error(`Circular subagent reference detected: ${id}`);
    }

    const definition = this.findById(id);
    if (!definition) return null;

    visited.add(id);

    const rawRow = this.db.prepare('SELECT subagent_links FROM agent_definitions WHERE id = ? AND deleted_at IS NULL').get(id) as { subagent_links: string } | undefined;
    const subagentLinks: SubagentLink[] = rawRow?.subagent_links ? JSON.parse(rawRow.subagent_links) : [];

    const resolvedSubagents: ResolvedSubagent[] = [];
    for (const link of subagentLinks) {
      const subDef = this.findById(link.agentDefinitionId);
      if (subDef) {
        resolvedSubagents.push({
          name: link.alias ?? subDef.name,
          description: link.descriptionOverride ?? subDef.description,
          definition: subDef,
        });
      }
    }

    return { ...definition, subagents: resolvedSubagents };
  }

  // Row mapper
  protected mapRow(row: unknown): AgentDefinition {
    const r = row as Record<string, unknown>;

    const subagentLinks: SubagentLink[] = FieldTransforms.jsonArray(r.subagent_links) || [];
    const subagentsRecord: Record<string, { description: string; prompt: string; tools?: string[]; model?: AgentModel }> = {};
    for (const link of subagentLinks) {
      subagentsRecord[link.agentDefinitionId] = {
        description: link.descriptionOverride || '',
        prompt: '',
      };
    }

    return {
      id: r.id as string,
      name: r.name as string,
      slug: r.slug as string,
      description: r.description as string,
      systemPromptSegmentId: r.system_prompt_segment_id as string | undefined,
      role: ((r.role as string) ?? 'assistant') as import('@capybara-chat/types').AgentDefinitionRole,
      prefilledConversation: FieldTransforms.jsonArray(r.prefilled_conversation),
      skills: FieldTransforms.jsonArray(r.skills),
      tags: FieldTransforms.jsonArray(r.tags),
      status: (r.status as EntityStatus) ?? EntityStatusEnum.DRAFT,
      sessionId: r.session_id as string | undefined,
      isSystem: FieldTransforms.boolean(r.is_system),
      isDefault: FieldTransforms.boolean(r.is_default),
      createdBy: (r.created_by as string) ?? null,
      createdAt: r.created_at as number,
      updatedAt: r.updated_at as number,
      agentContext: {
        systemPrompt: r.system_prompt as string | undefined,
        model: r.model as AgentModel | undefined,
        allowedTools: r.allowed_tools ? FieldTransforms.jsonArray(r.allowed_tools) : undefined,
        mcpServers: FieldTransforms.jsonArray(r.mcp_servers),
        subagents: Object.keys(subagentsRecord).length > 0 ? subagentsRecord : undefined,
      },
    };
  }
}
