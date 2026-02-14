/**
 * Authentication Middleware
 *
 * Dual auth strategy: JWT and API key.
 */

import type { Request, Response, NextFunction } from 'express';
import { jwtVerify, SignJWT } from 'jose';
import type { AuthenticatedUser, User, UserRole } from '@capybara-chat/types';
import type { SQLiteUserRepository } from '../repositories/user-repository.js';

// ===== Lazy state (ESM compatibility) =====

let _apiKey: string | undefined;
let _initialized = false;
let _jwtSecret: Uint8Array | null = null;

export function resetAuthState(): void {
  _apiKey = undefined;
  _initialized = false;
  _jwtSecret = null;
  _userRepo = null;
}

function getApiKey(): string | undefined {
  if (_initialized) return _apiKey;
  _initialized = true;

  const isProduction = process.env.NODE_ENV === 'production';
  const configuredApiKey = process.env.CAPYBARA_API_KEY;
  const allowDevKey = process.env.ALLOW_DEV_KEY === 'true';

  if (isProduction && !configuredApiKey) {
    throw new Error('CAPYBARA_API_KEY environment variable must be set in production');
  }

  _apiKey = configuredApiKey || (allowDevKey ? 'dev-key' : undefined);
  return _apiKey;
}

function getJwtSecret(): Uint8Array {
  if (_jwtSecret) return _jwtSecret;
  const secret = process.env.JWT_SECRET || 'dev-jwt-secret';
  _jwtSecret = new TextEncoder().encode(secret);
  return _jwtSecret;
}

const JWT_ISSUER = 'capybara';
const JWT_AUDIENCE = 'capybara-api';

// ===== User repo injection =====

let _userRepo: SQLiteUserRepository | null = null;

export function setAuthUserRepo(repo: SQLiteUserRepository): void {
  _userRepo = repo;
}

// ===== Request extension =====

export interface AuthenticatedRequest extends Request {
  authenticated: boolean;
  user: AuthenticatedUser;
}

// ===== JWT helpers =====

export async function createAccessToken(user: User): Promise<string> {
  return new SignJWT({ githubLogin: user.githubLogin, role: user.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(getJwtSecret());
}

// ===== Legacy API key auth (kept for backwards compatibility) =====

export function apiKeyAuth(req: Request, res: Response, next: NextFunction): void {
  const apiKey = getApiKey();

  if (!apiKey) {
    res.status(503).json({
      error: 'Server not configured. Set CAPYBARA_API_KEY or ALLOW_DEV_KEY=true for development.',
      code: 'SERVER_NOT_CONFIGURED',
    });
    return;
  }

  const requestApiKey = req.headers['x-api-key'];

  if (!requestApiKey) {
    res.status(401).json({ error: 'API key required', code: 'MISSING_API_KEY' });
    return;
  }

  if (requestApiKey !== apiKey) {
    res.status(403).json({ error: 'Invalid API key', code: 'INVALID_API_KEY' });
    return;
  }

  (req as AuthenticatedRequest).authenticated = true;
  (req as AuthenticatedRequest).user = {
    id: 'system',
    githubLogin: 'system',
    role: 'admin' as UserRole,
    name: 'System',
    avatarUrl: null,
  };
  next();
}

// ===== Dual auth middleware (JWT + API key) =====

export async function dualAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // Strategy 1: JWT Bearer token (browser clients)
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      try {
        const { payload } = await jwtVerify(token, getJwtSecret(), {
          issuer: JWT_ISSUER,
          audience: JWT_AUDIENCE,
        });
        (req as AuthenticatedRequest).authenticated = true;
        (req as AuthenticatedRequest).user = {
          id: payload.sub as string,
          githubLogin: payload.githubLogin as string,
          role: payload.role as UserRole,
          name: '', // Will be enriched if needed
          avatarUrl: null,
        };
        return next();
      } catch {
        // JWT invalid or expired — fall through to API key
      }
    }

    // Strategy 2: API key (bridge, MCP, scripts)
    const requestApiKey = req.headers['x-api-key'];
    const apiKey = getApiKey();
    if (requestApiKey && apiKey && requestApiKey === apiKey) {
      (req as AuthenticatedRequest).authenticated = true;

      // Check for X-User-Id header (MCP with user context)
      const userIdHeader = req.headers['x-user-id'] as string | undefined;
      if (userIdHeader && _userRepo) {
        const user = _userRepo.findById(userIdHeader);
        if (user) {
          (req as AuthenticatedRequest).user = {
            id: user.id,
            githubLogin: user.githubLogin,
            role: user.role,
            name: user.name,
            avatarUrl: user.avatarUrl,
          };
          return next();
        }
      }

      // API key without user context → system/admin access
      (req as AuthenticatedRequest).user = {
        id: 'system',
        githubLogin: 'system',
        role: 'admin' as UserRole,
        name: 'System',
        avatarUrl: null,
      };
      return next();
    }

    res.status(401).json({ error: 'Authentication required', code: 'UNAUTHENTICATED' });
  } catch (err) {
    next(err);
  }
}

// ===== Socket.io auth =====

export function socketAuth(
  socket: { handshake: { auth: { apiKey?: string } } },
  next: (err?: Error) => void
): void {
  const apiKey = getApiKey();

  if (!apiKey) {
    next();
    return;
  }

  const requestApiKey = socket.handshake.auth?.apiKey;

  if (!requestApiKey) {
    next(new Error('API key required'));
    return;
  }

  if (requestApiKey !== apiKey) {
    next(new Error('Invalid API key'));
    return;
  }

  next();
}

export async function socketDualAuth(
  socket: { handshake: { auth: { apiKey?: string; token?: string }; headers: Record<string, string> }; data: Record<string, unknown> },
  next: (err?: Error) => void
): Promise<void> {
  try {
    // Strategy 1: JWT
    const token = socket.handshake.auth?.token;
    if (token) {
      try {
        const { payload } = await jwtVerify(token, getJwtSecret(), {
          issuer: JWT_ISSUER,
          audience: JWT_AUDIENCE,
        });
        socket.data.userId = payload.sub as string;
        socket.data.userRole = payload.role as string;
        socket.data.githubLogin = payload.githubLogin as string;
        return next();
      } catch {
        // Fall through
      }
    }

    // Strategy 2: API key
    const requestApiKey = socket.handshake.auth?.apiKey;
    const apiKey = getApiKey();
    if (requestApiKey && apiKey && requestApiKey === apiKey) {
      socket.data.userId = 'system';
      socket.data.userRole = 'admin';
      socket.data.githubLogin = 'system';
      return next();
    }

    next(new Error('Authentication required'));
  } catch (err) {
    next(err instanceof Error ? err : new Error(String(err)));
  }
}
