/**
 * Agent Definition Routes
 *
 * REST endpoints for agent definition CRUD with subagent resolution.
 */

import { Router } from 'express';
import type { AgentDefinitionRepository, SQLiteAgentDefinitionRepository } from '../repositories/agent-definition-repository.js';
import type { UserRepository } from '../repositories/user-repository.js';
import {
  CreateAgentDefinitionSchema,
  UpdateAgentDefinitionSchema,
  PAGINATION,
} from '@capybara-chat/types';
import { asyncHandler, validateBody, requireFound, requireDeleted, getPaginationParams } from '../middleware/index.js';
import type { AuthenticatedRequest } from '../middleware/index.js';
import { createPublishHandler, createUnpublishHandler, withIsOwner, withIsOwnerList } from '../utils/index.js';
import { enrichWithUser, enrichItemWithUser } from '../utils/user-enrichment.js';

/**
 * Detect transitive circular subagent references.
 */
function detectCircularSubagents(
  targetId: string,
  newSubagentIds: string[],
  repo: AgentDefinitionRepository
): string | null {
  const visited = new Set<string>();

  function walk(id: string, path: string[]): string | null {
    if (id === targetId) return [...path, id].join(' → ');
    if (visited.has(id)) return null;
    visited.add(id);

    const def = repo.findById(id);
    if (!def) return null;
    const subagentIds = def?.agentContext?.subagents ? Object.keys(def.agentContext.subagents) : [];
    if (subagentIds.length === 0) return null;

    for (const subId of subagentIds) {
      const result = walk(subId, [...path, id]);
      if (result) return result;
    }
    return null;
  }

  for (const subId of newSubagentIds) {
    const result = walk(subId, [targetId]);
    if (result) return result;
  }
  return null;
}

export function createAgentDefinitionRoutes(
  agentDefinitionRepo: SQLiteAgentDefinitionRepository,
  userRepo: UserRepository
): Router {
  const router = Router();

  // GET /api/agent-definitions - List all
  router.get('/', asyncHandler(async (req, res) => {
    const { id, role } = (req as AuthenticatedRequest).user;
    const scoped = agentDefinitionRepo.forUser(id, role);
    const { tag, status, system, role: roleFilter } = req.query;
    const { limit, offset } = getPaginationParams(req);

    let definitions;
    if (system === 'true') {
      definitions = scoped.filterVisible(agentDefinitionRepo.findSystem({ limit, offset }));
    } else if (roleFilter) {
      const roles = (roleFilter as string).split(',');
      definitions = scoped.filterVisible(
        roles.flatMap(r => agentDefinitionRepo.findByRole(r.trim(), { limit, offset }))
      );
      const seen = new Set<string>();
      definitions = definitions.filter(d => {
        if (seen.has(d.id)) return false;
        seen.add(d.id);
        return true;
      });
    } else if (tag) {
      definitions = scoped.filterVisible(agentDefinitionRepo.findByTag(tag as string, { limit, offset }));
    } else {
      definitions = scoped.findAll({ limit, offset });
    }

    if (status) {
      definitions = definitions.filter(d => d.status === status);
    }

    const itemsWithOwnership = withIsOwnerList(definitions, id);
    const enrichedItems = enrichWithUser(itemsWithOwnership, userRepo);
    res.json({ agentDefinitions: enrichedItems, total: definitions.length });
  }));

  // GET /api/agent-definitions/default
  router.get('/default', asyncHandler(async (_req, res) => {
    const defaultAgent = agentDefinitionRepo.findDefault();
    if (!defaultAgent) {
      res.status(404).json({ error: 'No default agent configured' });
      return;
    }

    const resolvedSystemPrompt = agentDefinitionRepo.getResolvedSystemPrompt(defaultAgent.id);
    const resolvedSubagents = agentDefinitionRepo.getResolvedSubagents(defaultAgent.id);

    res.json({
      ...defaultAgent,
      resolvedSystemPrompt: resolvedSystemPrompt || defaultAgent.agentContext?.systemPrompt,
      resolvedSubagents,
    });
  }));

  // GET /api/agent-definitions/tags
  router.get('/tags', asyncHandler(async (req, res) => {
    const { id, role } = (req as AuthenticatedRequest).user;
    const scoped = agentDefinitionRepo.forUser(id, role);
    const all = scoped.findAll({ limit: PAGINATION.MAX_LIMIT });
    const tagCounts = new Map<string, number>();

    for (const def of all) {
      for (const tag of def.tags) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
    }

    const tags = Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count);

    res.json({ tags });
  }));

  // GET /api/agent-definitions/:id
  router.get('/:id', asyncHandler(async (req, res) => {
    const { id, role } = (req as AuthenticatedRequest).user;
    const scoped = agentDefinitionRepo.forUser(id, role);
    const definition = requireFound(scoped.findById(req.params.id), 'Agent Definition');
    const resolvedSystemPrompt = agentDefinitionRepo.getResolvedSystemPrompt(req.params.id);
    const resolvedSubagents = agentDefinitionRepo.getResolvedSubagents(req.params.id);

    const itemWithOwnership = withIsOwner({
      ...definition,
      resolvedSystemPrompt: resolvedSystemPrompt || definition.agentContext?.systemPrompt,
      resolvedSubagents,
    }, id);

    res.json(enrichItemWithUser(itemWithOwnership, userRepo));
  }));

  // GET /api/agent-definitions/:id/resolved
  router.get('/:id/resolved', asyncHandler(async (req, res) => {
    try {
      const { id, role } = (req as AuthenticatedRequest).user;
      const scoped = agentDefinitionRepo.forUser(id, role);
      requireFound(scoped.findById(req.params.id), 'Agent Definition');
      const resolved = agentDefinitionRepo.resolve(req.params.id);
      if (!resolved) {
        res.status(404).json({ error: 'Agent Definition not found' });
        return;
      }
      res.json(resolved);
    } catch (err) {
      if (err instanceof Error && err.message.includes('Circular')) {
        res.status(400).json({ error: err.message });
        return;
      }
      throw err;
    }
  }));

  // POST /api/agent-definitions - Create
  router.post('/', validateBody(CreateAgentDefinitionSchema), asyncHandler(async (req, res) => {
    const { id, role } = (req as AuthenticatedRequest).user;
    const scoped = agentDefinitionRepo.forUser(id, role);
    const { subagentIds, subagents: subagentLinks, agentContext, ...data } = req.body;

    let resolvedSubagents;
    if (subagentLinks?.length) {
      resolvedSubagents = subagentLinks;
    } else if (subagentIds?.length) {
      resolvedSubagents = subagentIds.map((sid: string) => ({
        agentDefinitionId: sid,
        descriptionOverride: '',
      }));
    }

    const definition = scoped.create({
      ...data,
      subagents: resolvedSubagents,
      systemPrompt: agentContext?.systemPrompt ?? data.systemPrompt,
      model: agentContext?.model,
      allowedTools: agentContext?.allowedTools,
      mcpServers: agentContext?.mcpServers,
    });

    const itemWithOwnership = withIsOwner(definition, id);
    res.status(201).json(enrichItemWithUser(itemWithOwnership, userRepo));
  }));

  // Shared handler for PATCH and PUT
  const handleUpdate = asyncHandler(async (req, res) => {
    const { id, role } = (req as AuthenticatedRequest).user;
    const scoped = agentDefinitionRepo.forUser(id, role);
    const { subagentIds, subagents: subagentLinks, agentContext, ...data } = req.body;

    const selfRefInIds = subagentIds?.includes(req.params.id);
    const selfRefInLinks = subagentLinks?.some((l: { agentDefinitionId: string }) => l.agentDefinitionId === req.params.id);
    if (selfRefInIds || selfRefInLinks) {
      res.status(400).json({ error: 'Agent cannot reference itself as a subagent' });
      return;
    }

    const newSubagentIds = subagentLinks?.map((l: { agentDefinitionId: string }) => l.agentDefinitionId)
      ?? subagentIds;
    if (newSubagentIds?.length) {
      const circular = detectCircularSubagents(req.params.id, newSubagentIds, agentDefinitionRepo);
      if (circular) {
        res.status(400).json({ error: `Circular subagent reference: ${circular}` });
        return;
      }
    }

    const updateData: Record<string, unknown> = { ...data };
    if (subagentLinks !== undefined) {
      updateData.subagents = subagentLinks;
    } else if (subagentIds !== undefined) {
      updateData.subagents = subagentIds.map((sid: string) => ({ agentDefinitionId: sid, descriptionOverride: '' }));
    }

    if (agentContext !== undefined) {
      if (agentContext.systemPrompt !== undefined) updateData.systemPrompt = agentContext.systemPrompt;
      if (agentContext.model !== undefined) updateData.model = agentContext.model;
      if (agentContext.allowedTools !== undefined) updateData.allowedTools = agentContext.allowedTools;
      if (agentContext.mcpServers !== undefined) updateData.mcpServers = agentContext.mcpServers;
    }

    const definition = requireFound(
      scoped.update(req.params.id, updateData),
      'Agent Definition'
    );

    if (data.isDefault === true) {
      agentDefinitionRepo.setDefaultForRole(definition.id, definition.role);
    }

    const itemWithOwnership = withIsOwner(definition, id);
    res.json(enrichItemWithUser(itemWithOwnership, userRepo));
  });

  // PATCH /api/agent-definitions/:id - Update
  router.patch('/:id', validateBody(UpdateAgentDefinitionSchema), handleUpdate);

  // PUT /api/agent-definitions/:id - Update (alias)
  router.put('/:id', validateBody(UpdateAgentDefinitionSchema), handleUpdate);

  // POST /api/agent-definitions/:id/publish
  router.post('/:id/publish', createPublishHandler(agentDefinitionRepo, { entityName: 'Agent Definition' }));

  // POST /api/agent-definitions/:id/unpublish
  router.post('/:id/unpublish', createUnpublishHandler(agentDefinitionRepo, { entityName: 'Agent definition' }));

  // POST /api/agent-definitions/:id/fork
  router.post('/:id/fork', asyncHandler(async (req, res) => {
    const { id: userId, role } = (req as AuthenticatedRequest).user;
    const scoped = agentDefinitionRepo.forUser(userId, role);
    const original = requireFound(scoped.findById(req.params.id), 'Agent definition');

    const forked = scoped.create({
      name: `${original.name} (Fork)`,
      slug: `${original.slug}-fork-${Date.now()}`,
      description: original.description ?? '',
      role: original.role,
      tags: [...(original.tags || [])],
      systemPrompt: original.agentContext?.systemPrompt ?? '',
      model: original.agentContext?.model as import('@capybara-chat/types').AgentModel | undefined,
      allowedTools: original.agentContext?.allowedTools,
      mcpServers: original.agentContext?.mcpServers,
    });

    const itemWithOwnership = withIsOwner(forked, userId);
    res.status(201).json(enrichItemWithUser(itemWithOwnership, userRepo));
  }));

  // DELETE /api/agent-definitions/:id
  router.delete('/:id', asyncHandler(async (req, res) => {
    const { id, role } = (req as AuthenticatedRequest).user;
    const scoped = agentDefinitionRepo.forUser(id, role);
    try {
      requireDeleted(scoped.delete(req.params.id), 'Agent Definition');
      res.status(204).send();
    } catch (err) {
      if (err instanceof Error && err.message.includes('system agent')) {
        res.status(403).json({ error: err.message });
        return;
      }
      throw err;
    }
  }));

  return router;
}
