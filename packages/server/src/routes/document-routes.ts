/**
 * Document Routes
 *
 * REST endpoints for document CRUD, versioning, and diff.
 */

import { Router } from 'express';
import type { SQLiteDocumentRepository } from '../repositories/document-repository.js';
import type { UserRepository } from '../repositories/user-repository.js';
import { asyncHandler, Errors, requireFound, requireDeleted, validateBody, validateQuery, getPaginationParams } from '../middleware/index.js';
import type { AuthenticatedRequest } from '../middleware/index.js';
import { PAGINATION, EntityStatus, DocumentType, CreateDocumentSchema, UpdateDocumentSchema, DiffQuerySchema } from '@capybara-chat/types';
import { generateTagCloud, createPublishHandler, createUnpublishHandler, withIsOwner, withIsOwnerList } from '../utils/index.js';
import { enrichWithUser, enrichItemWithUser } from '../utils/user-enrichment.js';

export function createDocumentRoutes(
  repo: SQLiteDocumentRepository,
  userRepo: UserRepository
): Router {
  const router = Router();

  // GET /api/documents - List documents with optional type filter (scoped: own + published)
  router.get('/', asyncHandler(async (req, res) => {
    const { id, role } = (req as AuthenticatedRequest).user;
    const scoped = repo.forUser(id, role);
    const { tag, search, status, sessionId, type = 'document' } = req.query;
    const { limit, offset } = getPaginationParams(req);

    if (type !== 'document' && type !== 'memory' && type !== 'all') {
      throw Errors.badRequest('Invalid type. Must be: document, memory, or all');
    }

    const typeFilter = type === 'all' ? undefined : type as DocumentType;

    let documents;
    if (search) {
      documents = scoped.filterVisible(repo.search(search as string, typeFilter, { limit, offset }));
    } else if (tag) {
      documents = scoped.filterVisible(repo.findByTag(tag as string, typeFilter, { limit, offset }));
    } else if (status) {
      documents = scoped.filterVisible(repo.findByStatus(status as EntityStatus, typeFilter, { limit, offset }));
    } else if (sessionId) {
      documents = scoped.filterVisible(repo.findBySessionId(sessionId as string, typeFilter, { limit, offset }));
    } else {
      documents = scoped.findAll({ limit, offset, type: typeFilter });
    }

    const itemsWithOwnership = withIsOwnerList(documents, id);
    const enrichedItems = enrichWithUser(itemsWithOwnership, userRepo);
    res.json({ documents: enrichedItems, total: documents.length });
  }));

  // GET /api/documents/tags - Get tag cloud
  router.get('/tags', asyncHandler(async (req, res) => {
    const { id, role } = (req as AuthenticatedRequest).user;
    const scoped = repo.forUser(id, role);
    const documents = scoped.findAll({ limit: PAGINATION.MAX_LIMIT });
    const tags = generateTagCloud(documents);
    res.json({ tags });
  }));

  // GET /api/documents/:id - Get document by ID
  router.get('/:id', asyncHandler(async (req, res) => {
    const { id, role } = (req as AuthenticatedRequest).user;
    const scoped = repo.forUser(id, role);
    const document = requireFound(scoped.findById(req.params.id), 'Document');
    const itemWithOwnership = withIsOwner(document, id);
    res.json(enrichItemWithUser(itemWithOwnership, userRepo));
  }));

  // POST /api/documents - Create new document or memory
  router.post('/', validateBody(CreateDocumentSchema), asyncHandler(async (req, res) => {
    const { id, role } = (req as AuthenticatedRequest).user;
    const scoped = repo.forUser(id, role);
    const { name, content, type, tags, sessionId, status } = req.body;
    const document = scoped.create({ name, content, type, tags, sessionId, status });
    const itemWithOwnership = withIsOwner(document, id);
    res.status(201).json(enrichItemWithUser(itemWithOwnership, userRepo));
  }));

  // PATCH /api/documents/:id - Update document
  router.patch('/:id', validateBody(UpdateDocumentSchema), asyncHandler(async (req, res) => {
    const { id, role } = (req as AuthenticatedRequest).user;
    const scoped = repo.forUser(id, role);
    const { name, content, tags, sessionId, status } = req.body;
    const document = requireFound(
      scoped.update(req.params.id, { name, content, tags, sessionId, status }),
      'Document'
    );
    res.json(document);
  }));

  // PUT /api/documents/:id - Update document (alias for PATCH)
  router.put('/:id', validateBody(UpdateDocumentSchema), asyncHandler(async (req, res) => {
    const { id, role } = (req as AuthenticatedRequest).user;
    const scoped = repo.forUser(id, role);
    const { name, content, tags, sessionId, status } = req.body;
    const document = requireFound(
      scoped.update(req.params.id, { name, content, tags, sessionId, status }),
      'Document'
    );
    res.json(document);
  }));

  // DELETE /api/documents/:id - Soft delete document
  router.delete('/:id', asyncHandler(async (req, res) => {
    const { id, role } = (req as AuthenticatedRequest).user;
    const scoped = repo.forUser(id, role);
    requireDeleted(scoped.delete(req.params.id), 'Document');
    res.status(204).send();
  }));

  // POST /api/documents/:id/publish
  router.post('/:id/publish', createPublishHandler(repo, { entityName: 'Document' }));

  // POST /api/documents/:id/unpublish
  router.post('/:id/unpublish', createUnpublishHandler(repo, { entityName: 'Document' }));

  // POST /api/documents/:id/fork
  router.post('/:id/fork', asyncHandler(async (req, res) => {
    const { id: userId, role } = (req as AuthenticatedRequest).user;
    const scoped = repo.forUser(userId, role);
    const original = requireFound(scoped.findById(req.params.id), 'Document');

    const forked = scoped.create({
      name: `${original.name} (Fork)`,
      content: original.content,
      type: original.type,
      tags: [...(original.tags || [])],
    });

    const itemWithOwnership = withIsOwner(forked, userId);
    res.status(201).json(enrichItemWithUser(itemWithOwnership, userRepo));
  }));

  // POST /api/documents/:id/restore
  router.post('/:id/restore', asyncHandler(async (req, res) => {
    const { id, role } = (req as AuthenticatedRequest).user;
    const scoped = repo.forUser(id, role);
    requireFound(scoped.findById(req.params.id), 'Document');
    const restored = repo.restore(req.params.id);
    if (!restored) {
      throw Errors.notFound('Document not found or not deleted');
    }
    const document = requireFound(repo.findById(req.params.id), 'Document');
    const itemWithOwnership = withIsOwner(document, id);
    res.json(enrichItemWithUser(itemWithOwnership, userRepo));
  }));

  // GET /api/documents/:id/versions
  router.get('/:id/versions', asyncHandler(async (req, res) => {
    const { id, role } = (req as AuthenticatedRequest).user;
    const scoped = repo.forUser(id, role);
    requireFound(scoped.findById(req.params.id), 'Document');
    const versions = repo.getVersions(req.params.id);
    const enrichedVersions = enrichWithUser(versions, userRepo);
    res.json({ versions: enrichedVersions, total: versions.length });
  }));

  // GET /api/documents/:id/versions/:versionId
  router.get('/:id/versions/:versionId', asyncHandler(async (req, res) => {
    const { id, role } = (req as AuthenticatedRequest).user;
    const scoped = repo.forUser(id, role);
    requireFound(scoped.findById(req.params.id), 'Document');
    const version = requireFound(
      repo.getVersion(req.params.id, req.params.versionId),
      'Document version'
    );
    res.json(enrichItemWithUser(version, userRepo));
  }));

  // GET /api/documents/:id/diff
  router.get('/:id/diff', validateQuery(DiffQuerySchema), asyncHandler(async (req, res) => {
    const { id, role } = (req as AuthenticatedRequest).user;
    const scoped = repo.forUser(id, role);
    requireFound(scoped.findById(req.params.id), 'Document');
    const { a, b } = req.query as { a: string; b: string };

    const diff = repo.getDiff(req.params.id, a, b);
    if (!diff) {
      throw Errors.notFound('One or both versions not found');
    }

    res.json({ versionA: a, versionB: b, contentA: diff.a, contentB: diff.b });
  }));

  return router;
}
