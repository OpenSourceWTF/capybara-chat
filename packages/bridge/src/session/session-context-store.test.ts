/**
 * Session Context Store Tests
 *
 * Tests for SessionContextStore with validation (GAP-021).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SessionContextStore } from './session-context-store.js';
import type { SessionContext } from './session-context.js';

describe('SessionContextStore', () => {
  let store: SessionContextStore;

  beforeEach(() => {
    store = new SessionContextStore();
  });

  describe('getOrCreate', () => {
    it('should create new context if not exists', () => {
      const ctx = store.getOrCreate('sess-1');

      expect(ctx.sessionId).toBe('sess-1');
      expect(ctx.status).toBe('idle');
      expect(ctx.events).toEqual([]);
      expect(ctx.queue.inbound).toEqual([]);
      expect(ctx.queue.outbound).toEqual([]);
    });

    it('should return existing context if exists', () => {
      const ctx1 = store.getOrCreate('sess-1');
      ctx1.status = 'locked';

      const ctx2 = store.getOrCreate('sess-1');

      expect(ctx2).toBe(ctx1); // Same object reference
      expect(ctx2.status).toBe('locked');
    });
  });

  describe('get', () => {
    it('should return undefined if not exists', () => {
      const ctx = store.get('sess-nonexistent');
      expect(ctx).toBeUndefined();
    });

    it('should return existing context', () => {
      const created = store.getOrCreate('sess-1');
      const fetched = store.get('sess-1');

      expect(fetched).toBe(created);
    });
  });

  describe('update - GAP-021 validation', () => {
    it('should throw if updating non-existent session (GAP-021)', () => {
      const ctx: SessionContext = {
        sessionId: 'sess-nonexistent',
        status: 'idle',
        currentMessage: { id: '', content: '', createdAt: 0 },
        queue: { inbound: [], outbound: [] },
        events: [],
        createdAt: Date.now(),
        lastActivityAt: Date.now(),
      };

      expect(() => store.update(ctx)).toThrow('Cannot update non-existent session');
    });

    it('should warn if updating with different object reference (GAP-021)', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const ctx1 = store.getOrCreate('sess-1');

      // Create new object with same sessionId (suspicious!)
      const ctx2: SessionContext = {
        ...ctx1,
        status: 'locked',
      };

      store.update(ctx2);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('different object reference')
      );

      warnSpy.mockRestore();
    });

    it('should accept update with same object reference', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const ctx = store.getOrCreate('sess-1');
      ctx.status = 'locked'; // Mutate

      store.update(ctx); // Update same object

      expect(warnSpy).not.toHaveBeenCalled();
      expect(store.get('sess-1')?.status).toBe('locked');

      warnSpy.mockRestore();
    });
  });

  describe('delete', () => {
    it('should delete existing session', () => {
      store.getOrCreate('sess-1');
      expect(store.get('sess-1')).toBeDefined();

      store.delete('sess-1');
      expect(store.get('sess-1')).toBeUndefined();
    });

    it('should not throw if deleting non-existent session', () => {
      expect(() => store.delete('sess-nonexistent')).not.toThrow();
    });
  });

  describe('getAllSessionIds', () => {
    it('should return empty array if no sessions', () => {
      const ids = store.getAllSessionIds();
      expect(ids).toEqual([]);
    });

    it('should return all session IDs', () => {
      store.getOrCreate('sess-1');
      store.getOrCreate('sess-2');
      store.getOrCreate('sess-3');

      const ids = store.getAllSessionIds();
      expect(ids).toContain('sess-1');
      expect(ids).toContain('sess-2');
      expect(ids).toContain('sess-3');
      expect(ids.length).toBe(3);
    });
  });

  describe('getBadSessions', () => {
    it('should return sessions in error status', () => {
      const ctx1 = store.getOrCreate('sess-1');
      ctx1.status = 'error';

      const ctx2 = store.getOrCreate('sess-2');
      ctx2.status = 'idle';

      const bad = store.getBadSessions();

      expect(bad.length).toBe(1);
      expect(bad[0].sessionId).toBe('sess-1');
    });

    it('should return sessions stuck in non-idle status for > 5min', () => {
      const ctx = store.getOrCreate('sess-1');
      ctx.status = 'streaming';
      ctx.lastActivityAt = Date.now() - (6 * 60 * 1000); // 6 minutes ago

      const bad = store.getBadSessions();

      expect(bad.length).toBe(1);
      expect(bad[0].sessionId).toBe('sess-1');
    });

    it('should not return idle sessions even if old', () => {
      const ctx = store.getOrCreate('sess-1');
      ctx.status = 'idle';
      ctx.lastActivityAt = Date.now() - (6 * 60 * 1000); // 6 minutes ago

      const bad = store.getBadSessions();

      expect(bad.length).toBe(0);
    });

    it('should not return recent sessions in active status', () => {
      const ctx = store.getOrCreate('sess-1');
      ctx.status = 'streaming';
      ctx.lastActivityAt = Date.now() - (2 * 60 * 1000); // 2 minutes ago

      const bad = store.getBadSessions();

      expect(bad.length).toBe(0);
    });
  });

  describe('dumpSession - GAP-022 formatting', () => {
    let logSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
      logSpy.mockRestore();
    });

    it('should output formatted session state', () => {
      const ctx = store.getOrCreate('sess-1');
      ctx.status = 'streaming';
      ctx.claudeSessionId = 'claude-123';

      store.dumpSession('sess-1');

      // Check that log was called with formatting
      expect(logSpy).toHaveBeenCalled();
      const output = logSpy.mock.calls.map(call => call[0]).join('\n');

      expect(output).toContain('SESSION STATE DUMP');
      expect(output).toContain('sess-1');
      expect(output).toContain('streaming');
      expect(output).toContain('claude-123');
    });

    it('should handle non-existent session', () => {
      store.dumpSession('sess-nonexistent');

      expect(logSpy).toHaveBeenCalledWith('Session sess-nonexistent not found');
    });
  });
});
