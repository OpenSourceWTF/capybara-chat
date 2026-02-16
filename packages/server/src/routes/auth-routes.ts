/**
 * Auth API Routes
 *
 * JWT auth endpoints: /me, /refresh, /logout.
 */

import { Router } from 'express';
import { asyncHandler, Errors } from '../middleware/error-handler.js';
import { dualAuth, createAccessToken, type AuthenticatedRequest } from '../middleware/auth.js';
import { refreshRateLimit } from '../middleware/rate-limit.js';
import type { SQLiteUserRepository } from '../repositories/user-repository.js';
import type { SQLiteAuthSessionRepository } from '../repositories/auth-session-repository.js';

export interface AuthRouteDeps {
  userRepo: SQLiteUserRepository;
  authSessionRepo: SQLiteAuthSessionRepository;
}

export function createAuthRoutes(deps: AuthRouteDeps): Router {
  const { userRepo, authSessionRepo } = deps;
  const router = Router();

  // GET /api/auth/me
  router.get('/me', dualAuth, asyncHandler(async (req, res) => {
    const { id } = (req as AuthenticatedRequest).user;

    if (id === 'system') {
      res.json({
        user: { id: 'system', username: 'system', role: 'admin', avatarUrl: null, name: 'System' },
      });
      return;
    }

    const user = userRepo.findById(id);
    if (!user) {
      throw Errors.notFound('User not found');
    }

    res.json({
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        avatarUrl: user.avatarUrl,
        name: user.name,
      },
    });
  }));

  // PATCH /api/auth/me - Update profile (name, etc.)
  router.patch('/me', dualAuth, asyncHandler(async (req, res) => {
    const { id } = (req as AuthenticatedRequest).user;
    if (id === 'system') {
      throw Errors.forbidden('Cannot update system user');
    }

    const { name } = req.body as { name?: string };
    if (name !== undefined && typeof name !== 'string') {
      throw Errors.badRequest('name must be a string');
    }

    const user = userRepo.update(id, { name: name ?? null });
    if (!user) {
      throw Errors.notFound('User not found');
    }

    res.json({
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        avatarUrl: user.avatarUrl,
        name: user.name,
      },
    });
  }));

  // POST /api/auth/refresh
  router.post('/refresh', refreshRateLimit, asyncHandler(async (req, res) => {
    const refreshToken = req.cookies?.cap_refresh;
    if (!refreshToken) {
      throw Errors.unauthorized('No refresh token');
    }

    const session = authSessionRepo.findValid(refreshToken);
    if (!session) {
      res.clearCookie('cap_refresh', { path: '/api/auth' });
      throw Errors.unauthorized('Invalid or expired refresh token');
    }

    const user = userRepo.findById(session.userId);
    if (!user) {
      throw Errors.unauthorized('User not found');
    }

    authSessionRepo.touch(session.id);
    const accessToken = await createAccessToken(user);

    res.json({
      accessToken,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        avatarUrl: user.avatarUrl,
      },
    });
  }));

  // POST /api/auth/logout
  router.post('/logout', asyncHandler(async (req, res) => {
    const refreshToken = req.cookies?.cap_refresh;
    if (refreshToken) {
      authSessionRepo.delete(refreshToken);
      res.clearCookie('cap_refresh', { path: '/api/auth' });
    }
    res.status(204).send();
  }));

  return router;
}
