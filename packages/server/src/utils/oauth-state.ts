/**
 * OAuth State Management
 *
 * Provides CSRF protection via state parameter and PKCE support
 * for GitHub OAuth flows.
 */

import { randomBytes, createHash } from 'crypto';
import { generateId } from '@capybara-chat/types';

interface PendingOAuthState {
  createdAt: number;
  codeVerifier?: string;
}

// In-memory state store with automatic cleanup
const pendingStates = new Map<string, PendingOAuthState>();

// State expires after 10 minutes
const STATE_EXPIRY_MS = 10 * 60 * 1000;

// Cleanup interval (every 5 minutes)
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

// Start cleanup interval
let cleanupInterval: NodeJS.Timeout | null = null;

function startCleanupInterval(): void {
  if (cleanupInterval) return;
  cleanupInterval = setInterval(() => {
    cleanupExpiredStates();
  }, CLEANUP_INTERVAL_MS);
  // Don't prevent process exit
  cleanupInterval.unref();
}

/**
 * Remove expired states from the store
 */
export function cleanupExpiredStates(): number {
  const now = Date.now();
  let removed = 0;
  for (const [state, data] of pendingStates.entries()) {
    if (now - data.createdAt > STATE_EXPIRY_MS) {
      pendingStates.delete(state);
      removed++;
    }
  }
  return removed;
}

/**
 * Generate PKCE code verifier and challenge
 */
export function generatePKCE(): { verifier: string; challenge: string } {
  // 32 bytes = 256 bits of entropy
  const verifier = randomBytes(32).toString('base64url');

  // S256: SHA-256 hash of verifier, base64url encoded
  const challenge = createHash('sha256')
    .update(verifier)
    .digest('base64url');

  return { verifier, challenge };
}

/**
 * Generate and store a new OAuth state with optional PKCE
 */
export function createOAuthState(withPKCE = true): {
  state: string;
  codeChallenge?: string;
} {
  startCleanupInterval();

  const state = generateId();
  const pending: PendingOAuthState = {
    createdAt: Date.now(),
  };

  let codeChallenge: string | undefined;

  if (withPKCE) {
    const pkce = generatePKCE();
    pending.codeVerifier = pkce.verifier;
    codeChallenge = pkce.challenge;
  }

  pendingStates.set(state, pending);

  return { state, codeChallenge };
}

/**
 * Validate and consume a state parameter
 */
export function validateAndConsumeState(state: string | undefined): string | null {
  if (!state) {
    throw new Error('Missing state parameter');
  }

  const pending = pendingStates.get(state);

  if (!pending) {
    throw new Error('Invalid or unknown state parameter');
  }

  // Check expiry
  if (Date.now() - pending.createdAt > STATE_EXPIRY_MS) {
    pendingStates.delete(state);
    throw new Error('State parameter expired');
  }

  // Consume (one-time use)
  pendingStates.delete(state);

  return pending.codeVerifier || null;
}

export function getPendingStateCount(): number {
  return pendingStates.size;
}

export function clearPendingStates(): void {
  pendingStates.clear();
}
