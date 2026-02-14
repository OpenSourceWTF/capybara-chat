/**
 * GitHub OAuth Routes & Auth API
 *
 * OAuth flow for GitHub App authentication + JWT auth endpoints.
 * Handles authorization redirect, callback (with user upsert + JWT issuance),
 * and auth API endpoints (/me, /refresh, /logout).
 */

import { Router } from 'express';
import type Database from 'better-sqlite3';
import { generateId, now, SECRET_NAMES, GITHUB_URLS, SERVER_DEFAULTS } from '@capybara-chat/types';
import { asyncHandler, Errors } from '../middleware/error-handler.js';
import { createLogger } from '../middleware/logger.js';
import { dualAuth, createAccessToken, type AuthenticatedRequest } from '../middleware/auth.js';
import { authRateLimit, refreshRateLimit } from '../middleware/rate-limit.js';
import { getSecretId, getSecretIdByScope, getSecretValue, getSecretsByPrefix } from '../utils/secrets.js';
import {
  exchangeCodeForToken,
  getGitHubUser,
  getGitHubInstallations,
  revokeGrant,
  GitHubApiError,
  type GitHubInstallation,
} from '../utils/github.js';
import { createOAuthState, validateAndConsumeState } from '../utils/oauth-state.js';
import type { SQLiteUserRepository } from '../repositories/user-repository.js';
import type { SQLiteAuthSessionRepository } from '../repositories/auth-session-repository.js';

const log = createLogger('AuthRoutes');

/** 30 days in milliseconds */
const REFRESH_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export interface AuthRouteDeps {
  db: Database.Database;
  userRepo: SQLiteUserRepository;
  authSessionRepo: SQLiteAuthSessionRepository;
}

export function createGitHubAuthRoutes(deps: AuthRouteDeps): Router {
  const { db, userRepo, authSessionRepo } = deps;
  const router = Router();

  const clientId = process.env.GITHUB_APP_CLIENT_ID;
  const clientSecret = process.env.GITHUB_APP_CLIENT_SECRET;

  // GET /api/auth/github - Redirect to GitHub OAuth authorization
  router.get('/', authRateLimit, asyncHandler(async (_req, res) => {
    if (!clientId) {
      throw Errors.internal('GitHub App not configured');
    }

    const { state, codeChallenge } = createOAuthState(true);

    const authUrl = new URL(GITHUB_URLS.AUTHORIZE);
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('redirect_uri', `${getBaseUrl()}/api/auth/github/callback`);
    authUrl.searchParams.set('allow_signup', 'false');
    // Request repo access for cloning and read:user for profile info
    authUrl.searchParams.set('scope', 'repo workflow read:org read:user');

    if (codeChallenge) {
      authUrl.searchParams.set('code_challenge', codeChallenge);
      authUrl.searchParams.set('code_challenge_method', 'S256');
    }

    res.redirect(authUrl.toString());
  }));

  // GET /api/auth/github/callback - Handle OAuth callback
  router.get('/callback', asyncHandler(async (req, res) => {
    const { code, state } = req.query;

    if (!code || typeof code !== 'string') {
      throw Errors.badRequest('Missing authorization code');
    }

    if (!clientId || !clientSecret) {
      throw Errors.internal('GitHub App not configured');
    }

    let codeVerifier: string | null = null;
    try {
      codeVerifier = validateAndConsumeState(state as string | undefined);
    } catch (err) {
      throw Errors.badRequest((err as Error).message);
    }

    let tokenData;
    try {
      tokenData = await exchangeCodeForToken(code, clientId, clientSecret, codeVerifier);
    } catch (err) {
      if (err instanceof GitHubApiError) {
        throw Errors.internal(`Failed to exchange code for token: ${err.message}`);
      }
      throw err;
    }

    if (!tokenData.access_token) {
      throw Errors.internal('No access token in response');
    }

    let user;
    try {
      user = await getGitHubUser(tokenData.access_token);
    } catch (err) {
      if (err instanceof GitHubApiError) {
        throw Errors.internal('Failed to get user info');
      }
      throw err;
    }

    let installations: GitHubInstallation[] = [];
    try {
      installations = await getGitHubInstallations(tokenData.access_token);
    } catch {
      log.warn('Failed to fetch GitHub installations');
    }

    // Upsert user
    const dbUser = userRepo.upsertByGithubId({
      githubId: user.id,
      githubLogin: user.login,
      name: user.name || null,
      email: user.email || null,
      avatarUrl: user.avatar_url || null,
      githubToken: tokenData.access_token,
    });
    log.info('User upserted', { userId: dbUser.id, login: user.login });

    // Store OAuth token
    const timestamp = now();
    const existingTokenId = getSecretId(db, SECRET_NAMES.GITHUB_OAUTH_TOKEN);

    if (existingTokenId) {
      db.prepare(`
        UPDATE secrets SET encrypted_value = ?, last_rotated_at = ?
        WHERE id = ?
      `).run(tokenData.access_token, timestamp, existingTokenId);
    } else {
      db.prepare(`
        INSERT INTO secrets (id, name, scope, encrypted_value, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(generateId(), SECRET_NAMES.GITHUB_OAUTH_TOKEN, 'global', tokenData.access_token, timestamp);
    }

    // Store installations
    for (const installation of installations) {
      const existingInstallationId = getSecretIdByScope(
        db,
        `${SECRET_NAMES.GITHUB_INSTALLATION_PREFIX}${installation.id}`,
        installation.account.login
      );

      if (!existingInstallationId) {
        db.prepare(`
          INSERT INTO secrets (id, name, scope, encrypted_value, created_at)
          VALUES (?, ?, ?, ?, ?)
        `).run(
          generateId(),
          `${SECRET_NAMES.GITHUB_INSTALLATION_PREFIX}${installation.id}`,
          installation.account.login,
          JSON.stringify(installation),
          timestamp
        );
      }
    }

    // Create session & tokens
    const session = authSessionRepo.create(dbUser.id);
    const accessToken = await createAccessToken(dbUser);

    res.cookie('cap_refresh', session.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/auth',
      maxAge: REFRESH_COOKIE_MAX_AGE_MS,
    });

    const frontendUrl = process.env.FRONTEND_URL || SERVER_DEFAULTS.HUDDLE_URL;
    res.redirect(`${frontendUrl}/auth/callback#token=${accessToken}`);
  }));

  // GET /api/auth/github/status
  router.get('/status', dualAuth, asyncHandler(async (_req, res) => {
    const oauthToken = getSecretValue(db, SECRET_NAMES.GITHUB_OAUTH_TOKEN);

    if (!oauthToken) {
      const patToken = getSecretValue(db, SECRET_NAMES.GITHUB_TOKEN);
      if (patToken || process.env.GITHUB_TOKEN) {
        res.json({
          connected: true,
          method: 'pat',
          installations: [],
        });
        return;
      }
      res.json({ connected: false });
      return;
    }

    let user;
    try {
      user = await getGitHubUser(oauthToken);
    } catch (err) {
      if (err instanceof GitHubApiError) {
        res.json({ connected: false, error: 'Token expired' });
        return;
      }
      throw err;
    }

    const installations = getSecretsByPrefix(db, SECRET_NAMES.GITHUB_INSTALLATION_PREFIX);

    res.json({
      connected: true,
      method: 'oauth',
      user: {
        login: user.login,
        avatar_url: user.avatar_url,
      },
      scopes: [],
      installations: installations.map(i => {
        try {
          return JSON.parse(i.encrypted_value);
        } catch {
          return { account: { login: i.scope } };
        }
      }),
    });
  }));

  // POST /api/auth/github/disconnect
  router.post('/disconnect', dualAuth, asyncHandler(async (_req, res) => {
    if (clientId && clientSecret) {
      try {
        const oauthToken = getSecretValue(db, SECRET_NAMES.GITHUB_OAUTH_TOKEN);
        if (oauthToken) {
          await revokeGrant(clientId, clientSecret, oauthToken);
        }
      } catch (err) {
        log.warn('Error revoking GitHub OAuth grant:', { error: err });
      }
    }

    db.prepare('DELETE FROM secrets WHERE name = ?').run(SECRET_NAMES.GITHUB_OAUTH_TOKEN);
    db.prepare('DELETE FROM secrets WHERE name LIKE ?').run(`${SECRET_NAMES.GITHUB_INSTALLATION_PREFIX}%`);

    res.status(204).send();
  }));

  return router;
}

export function createAuthRoutes(deps: AuthRouteDeps): Router {
  const { userRepo, authSessionRepo } = deps;
  const router = Router();

  // GET /api/auth/me
  router.get('/me', dualAuth, asyncHandler(async (req, res) => {
    const { id } = (req as AuthenticatedRequest).user;

    if (id === 'system') {
      res.json({
        user: { id: 'system', githubLogin: 'system', role: 'admin', avatarUrl: null, name: 'System' },
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
        githubLogin: user.githubLogin,
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
        githubLogin: user.githubLogin,
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

function getBaseUrl(): string {
  return process.env.BASE_URL || `http://localhost:${process.env.PORT || SERVER_DEFAULTS.SERVER_PORT}`;
}
