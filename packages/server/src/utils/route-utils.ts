/**
 * Route Utilities
 *
 * Shared route handler factories for publish/unpublish/ownership.
 */

import type { Request, Response, RequestHandler } from 'express';
import { EntityStatus } from '@capybara-chat/types';
import { asyncHandler, requireFound } from '../middleware/index.js';
import type { AuthenticatedRequest } from '../middleware/index.js';
import type { ScopedRepository } from '../repositories/base.js';

export interface PublishableRepository {
  findById(id: string): unknown;
  update(id: string, data: Record<string, any>): unknown;
  forUser(userId: string, role: any, hasPublishVisibility?: boolean): ScopedRepository<any, any, any>;
}

export interface PublishHandlerOptions {
  entityName: string;
  statusField?: string;
}

/**
 * Create a generic publish endpoint handler.
 */
export function createPublishHandler(
  repo: PublishableRepository,
  options: PublishHandlerOptions
): RequestHandler {
  const { entityName, statusField = 'status' } = options;

  return asyncHandler(async (req: Request, res: Response) => {
    const { id: userId, role } = (req as AuthenticatedRequest).user;
    const scoped = repo.forUser(userId, role);

    requireFound(scoped.findById(req.params.id), entityName);

    const updated = requireFound(
      scoped.update(req.params.id, { [statusField]: EntityStatus.PUBLISHED }),
      entityName
    );
    res.json(updated);
  });
}

/**
 * Create a generic unpublish endpoint handler.
 */
export function createUnpublishHandler(
  repo: PublishableRepository,
  options: PublishHandlerOptions
): RequestHandler {
  const { entityName, statusField = 'status' } = options;

  return asyncHandler(async (req: Request, res: Response) => {
    const { id: userId, role } = (req as AuthenticatedRequest).user;
    const scoped = repo.forUser(userId, role);

    requireFound(scoped.findById(req.params.id), entityName);

    const updated = requireFound(
      scoped.update(req.params.id, { [statusField]: EntityStatus.DRAFT }),
      entityName
    );
    res.json(updated);
  });
}

/**
 * Enrich an entity with a computed `isOwner` field.
 */
export function withIsOwner<T>(entity: T, userId: string): T & { isOwner: boolean } {
  return { ...entity, isOwner: (entity as { createdBy?: string | null }).createdBy === userId };
}

/**
 * Enrich an array of entities with computed `isOwner` fields.
 */
export function withIsOwnerList<T>(entities: T[], userId: string): (T & { isOwner: boolean })[] {
  return entities.map(e => withIsOwner(e, userId));
}
