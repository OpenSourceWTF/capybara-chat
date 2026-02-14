/**
 * Rate Limiting Middleware
 *
 * Protects API endpoints from abuse in multi-user deployments.
 */

import type { Request, Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from './auth.js';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimitConfig {
  /** Maximum requests allowed in the window */
  max: number;
  /** Window duration in milliseconds */
  windowMs: number;
  /** Extract key from request (default: IP address) */
  keyFn?: (req: Request) => string;
  /** Message returned when rate limited */
  message?: string;
  /** Skip rate limiting entirely (e.g., for testing) */
  skip?: (req: Request) => boolean;
}

const stores = new Map<string, Map<string, RateLimitEntry>>();

export function rateLimit(config: RateLimitConfig) {
  const {
    max,
    windowMs,
    keyFn = (req: Request) => req.ip ?? req.socket.remoteAddress ?? 'unknown',
    message = 'Too many requests, please try again later.',
    skip,
  } = config;

  const storeId = `rl_${stores.size}_${Date.now()}`;
  const store = new Map<string, RateLimitEntry>();
  stores.set(storeId, store);

  return (req: Request, res: Response, next: NextFunction) => {
    if (skip?.(req)) return next();

    // Skip rate limiting in test environment
    if (process.env.NODE_ENV === 'test') return next();

    const key = keyFn(req);
    const now = Date.now();
    const entry = store.get(key);

    if (!entry || now >= entry.resetAt) {
      // New window
      store.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    entry.count++;

    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({ error: message });
    }

    return next();
  };
}

export function userOrIpKey(req: Request): string {
  const authReq = req as AuthenticatedRequest;
  return authReq.user?.id ?? req.ip ?? req.socket.remoteAddress ?? 'unknown';
}

// ===== Pre-configured limiters =====

export const authRateLimit = rateLimit({
  max: 20,
  windowMs: 15 * 60 * 1000,
  message: 'Too many authentication attempts. Please try again later.',
});

export const refreshRateLimit = rateLimit({
  max: 30,
  windowMs: 60 * 1000,
  message: 'Too many refresh requests. Please try again later.',
});

export const writeRateLimit = rateLimit({
  max: 200,
  windowMs: 60 * 60 * 1000,
  keyFn: userOrIpKey,
  message: 'Write rate limit exceeded. Please try again later.',
});

const CLEANUP_INTERVAL = 5 * 60 * 1000;
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

export function startRateLimitCleanup(): void {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const store of stores.values()) {
      for (const [key, entry] of store) {
        if (now >= entry.resetAt) {
          store.delete(key);
        }
      }
    }
  }, CLEANUP_INTERVAL);
  // Don't prevent process exit
  cleanupTimer.unref();
}

export function stopRateLimitCleanup(): void {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
}

export function clearRateLimitStores(): void {
  for (const store of stores.values()) {
    store.clear();
  }
}
