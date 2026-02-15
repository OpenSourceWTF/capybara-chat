/**
 * Session Context Tests
 *
 * Tests for pure data SessionContext and addEvent helper.
 */

import { describe, it, expect } from 'vitest';
import { addEvent, MAX_EVENTS, type SessionContext } from './session-context.js';

describe('SessionContext', () => {
  it('should create valid session context', () => {
    const ctx: SessionContext = {
      sessionId: 'sess-123',
      status: 'idle',
      currentMessage: {
        id: 'msg-1',
        content: 'test message',
        createdAt: Date.now(),
      },
      queue: { inbound: [], outbound: [] },
      events: [],
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
    };

    expect(ctx.sessionId).toBe('sess-123');
    expect(ctx.status).toBe('idle');
    expect(ctx.events).toEqual([]);
  });

  it('should be fully serializable', () => {
    const ctx: SessionContext = {
      sessionId: 'sess-123',
      status: 'streaming',
      claudeSessionId: 'claude-456',
      currentMessage: {
        id: 'msg-1',
        content: 'test',
        createdAt: Date.now(),
      },
      queue: { inbound: [], outbound: [] },
      events: [
        { type: 'test', timestamp: Date.now(), status: 'idle' }
      ],
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
    };

    // Should serialize and deserialize without loss
    const json = JSON.stringify(ctx);
    const parsed = JSON.parse(json);

    expect(parsed.sessionId).toBe(ctx.sessionId);
    expect(parsed.status).toBe(ctx.status);
    expect(parsed.events[0].type).toBe('test');
  });
});

describe('addEvent', () => {
  it('should add event with timestamp and status', () => {
    const ctx: SessionContext = {
      sessionId: 'sess-1',
      status: 'idle',
      currentMessage: { id: '', content: '', createdAt: 0 },
      queue: { inbound: [], outbound: [] },
      events: [],
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
    };

    addEvent(ctx, 'test:event', { foo: 'bar' });

    expect(ctx.events.length).toBe(1);
    expect(ctx.events[0].type).toBe('test:event');
    expect(ctx.events[0].status).toBe('idle');
    expect(ctx.events[0].data).toEqual({ foo: 'bar' });
    expect(ctx.events[0].timestamp).toBeGreaterThan(0);
  });

  it('should trim events to MAX_EVENTS (GAP-024)', () => {
    const ctx: SessionContext = {
      sessionId: 'sess-1',
      status: 'idle',
      currentMessage: { id: '', content: '', createdAt: 0 },
      queue: { inbound: [], outbound: [] },
      events: [],
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
    };

    // Add MAX_EVENTS + 50 events
    for (let i = 0; i < MAX_EVENTS + 50; i++) {
      addEvent(ctx, `event-${i}`);
    }

    // Should only keep last MAX_EVENTS
    expect(ctx.events.length).toBe(MAX_EVENTS);
    expect(ctx.events[0].type).toBe('event-50'); // First 50 trimmed
    expect(ctx.events[MAX_EVENTS - 1].type).toBe(`event-${MAX_EVENTS + 49}`);
  });

  it('should not trim if under MAX_EVENTS', () => {
    const ctx: SessionContext = {
      sessionId: 'sess-1',
      status: 'idle',
      currentMessage: { id: '', content: '', createdAt: 0 },
      queue: { inbound: [], outbound: [] },
      events: [],
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
    };

    // Add 50 events (under MAX_EVENTS)
    for (let i = 0; i < 50; i++) {
      addEvent(ctx, `event-${i}`);
    }

    expect(ctx.events.length).toBe(50);
    expect(ctx.events[0].type).toBe('event-0'); // None trimmed
  });
});
