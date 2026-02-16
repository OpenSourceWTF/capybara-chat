/**
 * Prompt Segment Routes
 *
 * REST endpoints for prompt segment CRUD.
 */

import { Router } from 'express';
import type { SQLitePromptSegmentRepository } from '../repositories/prompt-segment-repository.js';
import { asyncHandler, Errors, requireFound, requireDeleted, validateBody } from '../middleware/index.js';
import type { AuthenticatedRequest } from '../middleware/index.js';
import { PAGINATION, CreatePromptSegmentSchema, UpdatePromptSegmentSchema } from '@capybara-chat/types';
import { generateTagCloud, createPublishHandler, createUnpublishHandler, withIsOwner, withIsOwnerList } from '../utils/index.js';

export function createPromptSegmentRoutes(
  repo: SQLitePromptSegmentRepository
): Router {
  const router = Router();

  // GET /api/prompts - List all prompt segments
  router.get('/', asyncHandler(async (req, res) => {
    const { id, role } = (req as AuthenticatedRequest).user;
    const scoped = repo.forUser(id, role);
    const { tag, search } = req.query;
    let segments;

    if (search) {
      segments = scoped.filterVisible(repo.search(search as string));
    } else if (tag) {
      segments = scoped.filterVisible(repo.findByTag(tag as string));
    } else {
      segments = scoped.findAll({ limit: PAGINATION.DEFAULT_LIMIT });
    }

    res.json({ segments: withIsOwnerList(segments, id), total: segments.length });
  }));

  // GET /api/prompts/tags - Get tag cloud
  router.get('/tags', asyncHandler(async (req, res) => {
    const { id, role } = (req as AuthenticatedRequest).user;
    const scoped = repo.forUser(id, role);
    const segments = scoped.findAll({ limit: PAGINATION.MAX_LIMIT });
    const tags = generateTagCloud(segments);
    res.json({ tags });
  }));

  // GET /api/prompts/:id - Get segment by ID
  router.get('/:id', asyncHandler(async (req, res) => {
    const { id, role } = (req as AuthenticatedRequest).user;
    const scoped = repo.forUser(id, role);
    const segment = requireFound(scoped.findById(req.params.id), 'Prompt segment');
    res.json(withIsOwner(segment, id));
  }));

  // POST /api/prompts - Create new segment
  router.post('/', validateBody(CreatePromptSegmentSchema), asyncHandler(async (req, res) => {
    const { id, role } = (req as AuthenticatedRequest).user;
    const scoped = repo.forUser(id, role);
    const { name, content, summary, tags, outputType, sessionId } = req.body;

    if (repo.findByName(name)) {
      throw Errors.conflict('Prompt segment with this name already exists');
    }

    const segment = scoped.create({ name, content, summary, tags, outputType, sessionId });
    res.status(201).json(segment);
  }));

  // PATCH /api/prompts/:id - Update segment
  router.patch('/:id', validateBody(UpdatePromptSegmentSchema), asyncHandler(async (req, res) => {
    const { id, role } = (req as AuthenticatedRequest).user;
    const scoped = repo.forUser(id, role);
    const { name, content, summary, tags, outputType, status, sessionId } = req.body;
    const segment = requireFound(scoped.update(req.params.id, { name, content, summary, tags, outputType, status, sessionId }), 'Prompt segment');
    res.json(segment);
  }));

  // PUT /api/prompts/:id - Update segment (alias for PATCH)
  router.put('/:id', validateBody(UpdatePromptSegmentSchema), asyncHandler(async (req, res) => {
    const { id, role } = (req as AuthenticatedRequest).user;
    const scoped = repo.forUser(id, role);
    const { name, content, summary, tags, outputType, status, sessionId } = req.body;
    const segment = requireFound(scoped.update(req.params.id, { name, content, summary, tags, outputType, status, sessionId }), 'Prompt segment');
    res.json(segment);
  }));

  // DELETE /api/prompts/:id - Delete segment
  router.delete('/:id', asyncHandler(async (req, res) => {
    const { id, role } = (req as AuthenticatedRequest).user;
    const scoped = repo.forUser(id, role);
    requireDeleted(scoped.delete(req.params.id), 'Prompt segment');
    res.status(204).send();
  }));

  // POST /api/prompts/:id/publish
  router.post('/:id/publish', createPublishHandler(repo, { entityName: 'Prompt segment' }));

  // POST /api/prompts/:id/unpublish
  router.post('/:id/unpublish', createUnpublishHandler(repo, { entityName: 'Prompt segment' }));

  // POST /api/prompts/:id/clone
  router.post('/:id/clone', asyncHandler(async (req, res) => {
    const { id, role } = (req as AuthenticatedRequest).user;
    const scoped = repo.forUser(id, role);
    const original = requireFound(scoped.findById(req.params.id), 'Prompt segment');

    let newName = `${original.name} (Copy)`;
    let copyNum = 1;
    while (repo.findByName(newName)) {
      copyNum++;
      newName = `${original.name} (Copy ${copyNum})`;
    }

    const cloned = scoped.create({
      name: newName,
      content: original.content,
      tags: [...original.tags],
    });

    res.status(201).json(cloned);
  }));

  // POST /api/prompts/:id/fork
  router.post('/:id/fork', asyncHandler(async (req, res) => {
    const { id: userId, role } = (req as AuthenticatedRequest).user;
    const scoped = repo.forUser(userId, role);
    const original = requireFound(scoped.findById(req.params.id), 'Prompt segment');

    let newName = `${original.name} (Fork)`;
    let num = 1;
    while (repo.findByName(newName)) {
      num++;
      newName = `${original.name} (Fork ${num})`;
    }

    const forked = scoped.create({
      name: newName,
      content: original.content,
      tags: [...(original.tags || [])],
    });
    res.status(201).json(withIsOwner(forked, userId));
  }));

  return router;
}
