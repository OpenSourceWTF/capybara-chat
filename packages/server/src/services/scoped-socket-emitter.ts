/**
 * Scoped Socket Emitter
 *
 * Centralized utility for room-based socket broadcasts.
 * Simplified for Capybara Chat (no worker tasks).
 */

import type { Server as SocketServer } from 'socket.io';
import { createLogger } from '../middleware/index.js';

const log = createLogger('ScopedEmitter');

export interface SessionOwnerLookup {
  findById(id: string): { createdBy?: string | null } | null;
}

/**
 * Room name helpers
 */
export function userRoom(userId: string): string {
  return `user:${userId}`;
}

export const ROOM_AUTHENTICATED = 'authenticated';
export const ROOM_BRIDGE = 'bridge';

export class ScopedSocketEmitter {
  private sessionOwnerCache = new Map<string, string>();

  constructor(
    private io: SocketServer,
    private sessionRepo: SessionOwnerLookup,
  ) { }

  /**
   * Resolve the owner userId for a given sessionId.
   * Cached in-memory — sessions don't change owners.
   */
  getSessionOwner(sessionId: string): string | null {
    const cached = this.sessionOwnerCache.get(sessionId);
    if (cached) return cached;

    const session = this.sessionRepo.findById(sessionId);
    const owner = session?.createdBy ?? null;
    if (owner) {
      this.sessionOwnerCache.set(sessionId, owner);
    }
    return owner;
  }

  /**
   * Invalidate cache for a session (e.g., on session delete).
   */
  invalidateSession(sessionId: string): void {
    this.sessionOwnerCache.delete(sessionId);
  }

  /**
   * Emit to the session owner's user room.
   */
  toSessionOwner(sessionId: string, event: string, data: unknown): void {
    const owner = this.getSessionOwner(sessionId);
    if (owner) {
      this.io.to(userRoom(owner)).emit(event, data);
    } else {
      log.warn('Cannot resolve session owner, dropping event', { sessionId, event });
    }
  }

  /**
   * Emit to a specific user's room.
   */
  toUser(userId: string, event: string, data: unknown): void {
    this.io.to(userRoom(userId)).emit(event, data);
  }

  /**
   * Emit to all authenticated users.
   */
  toAuthenticated(event: string, data: unknown): void {
    this.io.to(ROOM_AUTHENTICATED).emit(event, data);
  }

  /**
   * Emit to bridge room only.
   */
  toBridge(event: string, data: unknown): void {
    this.io.to(ROOM_BRIDGE).emit(event, data);
  }

  /**
   * Compatibility helper for older code that expects emitToSession
   */
  emitToSession(sessionId: string, event: string, payload: any): void {
    // In strict mode, we might want to emit to the session ROOM, not just owner?
    // Original code: io.to(`session:${sessionId}`).emit(event, payload);
    // But ScopedEmitter uses toSessionOwner?
    // Let's support both.
    this.io.to(`session:${sessionId}`).emit(event, payload);
  }

  emitToUser(userId: string, event: string, payload: any): void {
    this.toUser(userId, event, payload);
  }

  get raw(): SocketServer {
    return this.io;
  }
}
