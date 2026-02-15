/**
 * Tests for Session Concurrency Control
 *
 * These tests verify the lock handoff pattern that prevents race conditions
 * when multiple messages arrive for the same session.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  SessionConcurrencyManager,
  getConcurrencyManager,
  resetConcurrencyManager,
  type QueuedMessageData,
} from './concurrency.js';

describe('SessionConcurrencyManager', () => {
  let manager: SessionConcurrencyManager;

  beforeEach(() => {
    manager = new SessionConcurrencyManager();
  });

  describe('getState', () => {
    it('should create new state for unknown session', () => {
      const state = manager.getState('session-1');

      expect(state.processing).toBe(false);
      expect(state.pendingMessages).toEqual([]);
    });

    it('should return existing state for known session', () => {
      const state1 = manager.getState('session-1');
      state1.processing = true;

      const state2 = manager.getState('session-1');

      expect(state2.processing).toBe(true);
      expect(state2).toBe(state1);
    });

    it('should maintain separate state per session', () => {
      const state1 = manager.getState('session-1');
      const state2 = manager.getState('session-2');

      state1.processing = true;

      expect(state1.processing).toBe(true);
      expect(state2.processing).toBe(false);
    });
  });

  describe('acquireLock', () => {
    const mockData: QueuedMessageData = {
      sessionId: 'session-1',
      content: 'Test message',
    };

    it('should acquire lock immediately when session is idle', () => {
      const result = manager.acquireLock('session-1', mockData);

      expect(result.acquired).toBe(true);
      expect(result.waitPromise).toBeUndefined();
      expect(manager.isProcessing('session-1')).toBe(true);
    });

    it('should queue message when session is busy', () => {
      // First message acquires lock
      manager.acquireLock('session-1', mockData);

      // Second message should be queued
      const result = manager.acquireLock('session-1', { ...mockData, content: 'Second' });

      expect(result.acquired).toBe(false);
      expect(result.waitPromise).toBeInstanceOf(Promise);
      expect(manager.getQueueLength('session-1')).toBe(1);
    });

    it('should queue multiple messages in order', () => {
      manager.acquireLock('session-1', mockData);

      manager.acquireLock('session-1', { ...mockData, content: 'Second' });
      manager.acquireLock('session-1', { ...mockData, content: 'Third' });
      manager.acquireLock('session-1', { ...mockData, content: 'Fourth' });

      expect(manager.getQueueLength('session-1')).toBe(3);
    });

    it('should allow different sessions to process concurrently', () => {
      const result1 = manager.acquireLock('session-1', mockData);
      const result2 = manager.acquireLock('session-2', { ...mockData, sessionId: 'session-2' });

      expect(result1.acquired).toBe(true);
      expect(result2.acquired).toBe(true);
      expect(manager.isProcessing('session-1')).toBe(true);
      expect(manager.isProcessing('session-2')).toBe(true);
    });
  });

  describe('releaseLock', () => {
    const mockData: QueuedMessageData = {
      sessionId: 'session-1',
      content: 'Test message',
    };

    it('should release lock when no messages queued', () => {
      manager.acquireLock('session-1', mockData);
      expect(manager.isProcessing('session-1')).toBe(true);

      manager.releaseLock('session-1');

      expect(manager.isProcessing('session-1')).toBe(false);
    });

    it('should hand lock to next waiter when messages queued', async () => {
      // First message acquires lock
      manager.acquireLock('session-1', mockData);

      // Second message queues and waits
      const result2 = manager.acquireLock('session-1', { ...mockData, content: 'Second' });
      expect(result2.acquired).toBe(false);

      // Release should hand off to second message
      manager.releaseLock('session-1');

      // Lock should still be held (handed to waiter)
      expect(manager.isProcessing('session-1')).toBe(true);

      // Queue should be empty (waiter was dequeued)
      expect(manager.getQueueLength('session-1')).toBe(0);

      // Second message's promise should resolve
      await expect(result2.waitPromise).resolves.toBeUndefined();
    });

    it('should process messages in FIFO order', async () => {
      const order: string[] = [];

      // First message acquires lock
      manager.acquireLock('session-1', mockData);

      // Queue more messages
      const promises = ['Second', 'Third', 'Fourth'].map((content) => {
        const result = manager.acquireLock('session-1', { ...mockData, content });
        return result.waitPromise!.then(() => order.push(content));
      });

      // Release first message - should hand to Second
      manager.releaseLock('session-1');
      await Promise.resolve(); // Let microtask queue process

      // Release Second - should hand to Third
      manager.releaseLock('session-1');
      await Promise.resolve();

      // Release Third - should hand to Fourth
      manager.releaseLock('session-1');
      await Promise.resolve();

      // Wait for all to complete
      await Promise.all(promises);

      expect(order).toEqual(['Second', 'Third', 'Fourth']);
    });

    it('should handle release when not processing (edge case)', () => {
      // Release on a session that's not processing
      manager.releaseLock('session-1');

      // Should not throw, state should remain not processing
      expect(manager.isProcessing('session-1')).toBe(false);
    });
  });

  describe('Race Condition Prevention', () => {
    const mockData: QueuedMessageData = {
      sessionId: 'session-1',
      content: 'Test message',
    };

    it('should prevent new message from acquiring lock during handoff', async () => {
      // Simulate the race condition scenario:
      // 1. Msg1 completes, releases lock
      // 2. Msg2 was waiting, gets resolved
      // 3. BEFORE Msg2 resumes, Msg3 arrives
      // 4. With old code: Msg3 would see processing=false and acquire lock
      // 5. With fix: Msg3 sees processing=true (not released) and queues

      // Msg1 acquires lock
      manager.acquireLock('session-1', { ...mockData, content: 'Msg1' });

      // Msg2 arrives, gets queued
      const msg2Result = manager.acquireLock('session-1', { ...mockData, content: 'Msg2' });
      expect(msg2Result.acquired).toBe(false);

      // Msg1 completes - hands lock to Msg2 (but Msg2 hasn't resumed yet)
      manager.releaseLock('session-1');

      // CRITICAL: At this point, lock should STILL be held (for Msg2)
      expect(manager.isProcessing('session-1')).toBe(true);

      // Msg3 arrives - should queue, NOT acquire lock
      const msg3Result = manager.acquireLock('session-1', { ...mockData, content: 'Msg3' });
      expect(msg3Result.acquired).toBe(false);
      expect(manager.getQueueLength('session-1')).toBe(1); // Msg3 in queue

      // Now Msg2 resumes (its promise resolved)
      await msg2Result.waitPromise;

      // Msg2 finishes, hands lock to Msg3
      manager.releaseLock('session-1');

      // Msg3's promise should resolve
      await msg3Result.waitPromise;

      // All done
      manager.releaseLock('session-1');
      expect(manager.isProcessing('session-1')).toBe(false);
    });

    it('should handle rapid message arrivals correctly', async () => {
      const messageCount = 10;
      const processedOrder: number[] = [];

      // First message acquires lock
      manager.acquireLock('session-1', { ...mockData, content: 'Msg0' });

      // Rapidly queue many messages
      const promises = [];
      for (let i = 1; i < messageCount; i++) {
        const result = manager.acquireLock('session-1', { ...mockData, content: `Msg${i}` });
        if (!result.acquired) {
          promises.push(
            result.waitPromise!.then(() => {
              processedOrder.push(i);
            })
          );
        }
      }

      expect(manager.getQueueLength('session-1')).toBe(messageCount - 1);

      // Process all messages
      for (let i = 0; i < messageCount; i++) {
        manager.releaseLock('session-1');
        await Promise.resolve(); // Let microtasks process
      }

      await Promise.all(promises);

      // Messages should be processed in order
      expect(processedOrder).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    });
  });

  describe('isProcessing', () => {
    it('should return false for unknown session', () => {
      expect(manager.isProcessing('unknown')).toBe(false);
    });

    it('should return true when session is processing', () => {
      manager.acquireLock('session-1', { sessionId: 'session-1', content: 'test' });
      expect(manager.isProcessing('session-1')).toBe(true);
    });

    it('should return false after lock is released', () => {
      manager.acquireLock('session-1', { sessionId: 'session-1', content: 'test' });
      manager.releaseLock('session-1');
      expect(manager.isProcessing('session-1')).toBe(false);
    });
  });

  describe('getQueueLength', () => {
    it('should return 0 for unknown session', () => {
      expect(manager.getQueueLength('unknown')).toBe(0);
    });

    it('should return 0 when no messages queued', () => {
      manager.acquireLock('session-1', { sessionId: 'session-1', content: 'test' });
      expect(manager.getQueueLength('session-1')).toBe(0);
    });

    it('should return correct queue length', () => {
      manager.acquireLock('session-1', { sessionId: 'session-1', content: '1' });
      manager.acquireLock('session-1', { sessionId: 'session-1', content: '2' });
      manager.acquireLock('session-1', { sessionId: 'session-1', content: '3' });
      expect(manager.getQueueLength('session-1')).toBe(2);
    });
  });

  describe('clearSession', () => {
    it('should remove all state for a session', async () => {
      manager.acquireLock('session-1', { sessionId: 'session-1', content: 'test' });
      const result = manager.acquireLock('session-1', { sessionId: 'session-1', content: 'test2' });

      manager.clearSession('session-1');

      expect(manager.isProcessing('session-1')).toBe(false);
      expect(manager.getQueueLength('session-1')).toBe(0);

      // Handle the rejected promise to avoid unhandled rejection
      if (result.waitPromise) {
        await expect(result.waitPromise).rejects.toThrow();
      }
    });

    it('should not affect other sessions', () => {
      manager.acquireLock('session-1', { sessionId: 'session-1', content: 'test' });
      manager.acquireLock('session-2', { sessionId: 'session-2', content: 'test' });

      manager.clearSession('session-1');

      expect(manager.isProcessing('session-1')).toBe(false);
      expect(manager.isProcessing('session-2')).toBe(true);
    });

    it('should reject pending promises when clearing', async () => {
      // First message acquires lock
      manager.acquireLock('session-1', { sessionId: 'session-1', content: 'first' });

      // Second message is queued
      const result = manager.acquireLock('session-1', { sessionId: 'session-1', content: 'second' });
      expect(result.acquired).toBe(false);
      expect(result.waitPromise).toBeDefined();

      // Clear session - should reject the pending promise
      manager.clearSession('session-1');

      // The queued message's promise should reject
      await expect(result.waitPromise).rejects.toThrow('Session session-1 was cleared');
    });
  });

  describe('getActiveMessageIds (173-heartbeat)', () => {
    it('should return empty array when no sessions active', () => {
      expect(manager.getActiveMessageIds()).toEqual([]);
    });

    it('should include processing message ID', () => {
      manager.acquireLock('session-1', { sessionId: 'session-1', content: 'test', messageId: 'msg-1' });

      expect(manager.getActiveMessageIds()).toEqual(['msg-1']);
    });

    it('should include queued message IDs', () => {
      manager.acquireLock('session-1', { sessionId: 'session-1', content: '1', messageId: 'msg-1' });
      manager.acquireLock('session-1', { sessionId: 'session-1', content: '2', messageId: 'msg-2' });
      manager.acquireLock('session-1', { sessionId: 'session-1', content: '3', messageId: 'msg-3' });

      const ids = manager.getActiveMessageIds();
      expect(ids).toContain('msg-1'); // processing
      expect(ids).toContain('msg-2'); // queued
      expect(ids).toContain('msg-3'); // queued
      expect(ids.length).toBe(3);
    });

    it('should aggregate across sessions', () => {
      manager.acquireLock('session-1', { sessionId: 'session-1', content: 'a', messageId: 'msg-a' });
      manager.acquireLock('session-2', { sessionId: 'session-2', content: 'b', messageId: 'msg-b' });

      const ids = manager.getActiveMessageIds();
      expect(ids).toContain('msg-a');
      expect(ids).toContain('msg-b');
      expect(ids.length).toBe(2);
    });

    it('should skip messages without messageId', () => {
      manager.acquireLock('session-1', { sessionId: 'session-1', content: 'no-id' });
      manager.acquireLock('session-1', { sessionId: 'session-1', content: 'has-id', messageId: 'msg-1' });

      const ids = manager.getActiveMessageIds();
      expect(ids).toEqual(['msg-1']);
    });

    it('should update processingMessageId on lock handoff', async () => {
      manager.acquireLock('session-1', { sessionId: 'session-1', content: '1', messageId: 'msg-1' });
      const result2 = manager.acquireLock('session-1', { sessionId: 'session-1', content: '2', messageId: 'msg-2' });

      // Before handoff: msg-1 processing, msg-2 queued
      expect(manager.getActiveMessageIds()).toContain('msg-1');
      expect(manager.getActiveMessageIds()).toContain('msg-2');

      // Release msg-1 → hands off to msg-2
      manager.releaseLock('session-1');
      await result2.waitPromise;

      // After handoff: msg-2 is now processing
      const ids = manager.getActiveMessageIds();
      expect(ids).toEqual(['msg-2']);
    });

    it('should clear processingMessageId on full release', () => {
      manager.acquireLock('session-1', { sessionId: 'session-1', content: '1', messageId: 'msg-1' });
      manager.releaseLock('session-1');

      expect(manager.getActiveMessageIds()).toEqual([]);
    });
  });

  describe('getActiveSessions', () => {
    it('should return empty array when no sessions', () => {
      expect(manager.getActiveSessions()).toEqual([]);
    });

    it('should return all session IDs with state', () => {
      manager.acquireLock('session-1', { sessionId: 'session-1', content: 'test' });
      manager.acquireLock('session-2', { sessionId: 'session-2', content: 'test' });
      manager.getState('session-3'); // Just create state

      const sessions = manager.getActiveSessions();

      expect(sessions).toContain('session-1');
      expect(sessions).toContain('session-2');
      expect(sessions).toContain('session-3');
      expect(sessions.length).toBe(3);
    });
  });
});

describe('Singleton Functions', () => {
  beforeEach(() => {
    resetConcurrencyManager();
  });

  describe('getConcurrencyManager', () => {
    it('should return singleton instance', () => {
      const instance1 = getConcurrencyManager();
      const instance2 = getConcurrencyManager();

      expect(instance1).toBe(instance2);
    });
  });

  describe('resetConcurrencyManager', () => {
    it('should create new instance after reset', () => {
      const instance1 = getConcurrencyManager();
      instance1.acquireLock('session-1', { sessionId: 'session-1', content: 'test' });

      resetConcurrencyManager();

      const instance2 = getConcurrencyManager();
      expect(instance2).not.toBe(instance1);
      expect(instance2.isProcessing('session-1')).toBe(false);
    });
  });
});
