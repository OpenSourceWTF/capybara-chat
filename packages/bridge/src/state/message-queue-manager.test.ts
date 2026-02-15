/**
 * Message Queue Manager Tests
 *
 * Demonstrates testability improvements:
 * - Clean state reset between tests
 * - No external dependencies
 * - Fast, isolated unit tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MessageQueueManager, getMessageQueueManager, resetMessageQueueManager } from './message-queue-manager.js';

describe('MessageQueueManager', () => {
  let manager: MessageQueueManager;

  beforeEach(() => {
    // Create fresh instance for each test - no shared state!
    manager = new MessageQueueManager();
  });

  describe('getOrCreate', () => {
    it('should create new queue for unknown session', () => {
      const queue = manager.getOrCreate('session-1');

      expect(queue).toBeDefined();
      expect(queue.inbound).toEqual([]);
      expect(queue.outbound).toEqual([]);
    });

    it('should return existing queue for known session', () => {
      const queue1 = manager.getOrCreate('session-1');
      queue1.inbound.push({ id: 'msg-1', content: 'test', createdAt: Date.now() });

      const queue2 = manager.getOrCreate('session-1');

      expect(queue2).toBe(queue1);
      expect(queue2.inbound).toHaveLength(1);
    });

    it('should maintain separate queues per session', () => {
      const queue1 = manager.getOrCreate('session-1');
      const queue2 = manager.getOrCreate('session-2');

      queue1.inbound.push({ id: 'msg-1', content: 'test1', createdAt: Date.now() });

      expect(queue1.inbound).toHaveLength(1);
      expect(queue2.inbound).toHaveLength(0);
    });
  });

  describe('addInbound', () => {
    it('should add message with auto-generated id', () => {
      const msg = manager.addInbound('session-1', 'Hello Claude');

      expect(msg.id).toBeDefined();
      expect(msg.id).toMatch(/^msg_/);
      expect(msg.content).toBe('Hello Claude');
      expect(msg.createdAt).toBeGreaterThan(0);
    });

    it('should create queue if not exists', () => {
      expect(manager.has('new-session')).toBe(false);

      manager.addInbound('new-session', 'First message');

      expect(manager.has('new-session')).toBe(true);
    });

    it('should append to existing inbound queue', () => {
      manager.addInbound('session-1', 'First');
      manager.addInbound('session-1', 'Second');

      const queue = manager.get('session-1');
      expect(queue?.inbound).toHaveLength(2);
      expect(queue?.inbound[0].content).toBe('First');
      expect(queue?.inbound[1].content).toBe('Second');
    });
  });

  describe('addOutbound', () => {
    it('should add message with default role', () => {
      const msg = manager.addOutbound('session-1', 'Hello human');

      expect(msg.id).toBeDefined();
      expect(msg.content).toBe('Hello human');
      expect(msg.role).toBe('assistant');
    });

    it('should accept custom role', () => {
      const msg = manager.addOutbound('session-1', 'System message', 'system');

      expect(msg.role).toBe('system');
    });

    it('should accept custom id and createdAt', () => {
      const customId = 'custom-msg-id';
      const customTime = 1234567890;

      const msg = manager.addOutbound('session-1', 'Test', 'assistant', customId, customTime);

      expect(msg.id).toBe(customId);
      expect(msg.createdAt).toBe(customTime);
    });
  });

  describe('popOutbound', () => {
    it('should return and clear outbound messages', () => {
      manager.addOutbound('session-1', 'First');
      manager.addOutbound('session-1', 'Second');

      const messages = manager.popOutbound('session-1');

      expect(messages).toHaveLength(2);
      expect(messages[0].content).toBe('First');
      expect(messages[1].content).toBe('Second');

      // Queue should be empty now
      const emptyMessages = manager.popOutbound('session-1');
      expect(emptyMessages).toHaveLength(0);
    });

    it('should return empty array for unknown session', () => {
      const messages = manager.popOutbound('unknown');

      expect(messages).toEqual([]);
    });

    it('should not affect inbound messages', () => {
      manager.addInbound('session-1', 'Inbound');
      manager.addOutbound('session-1', 'Outbound');

      manager.popOutbound('session-1');

      const queue = manager.get('session-1');
      expect(queue?.inbound).toHaveLength(1);
      expect(queue?.outbound).toHaveLength(0);
    });
  });

  describe('delete', () => {
    it('should remove queue for session', () => {
      manager.addInbound('session-1', 'Test');

      const deleted = manager.delete('session-1');

      expect(deleted).toBe(true);
      expect(manager.has('session-1')).toBe(false);
    });

    it('should return false for unknown session', () => {
      const deleted = manager.delete('unknown');

      expect(deleted).toBe(false);
    });
  });

  describe('getSessionIds', () => {
    it('should return all session IDs', () => {
      manager.addInbound('session-a', 'Test');
      manager.addInbound('session-b', 'Test');
      manager.addInbound('session-c', 'Test');

      const ids = manager.getSessionIds();

      expect(ids).toHaveLength(3);
      expect(ids).toContain('session-a');
      expect(ids).toContain('session-b');
      expect(ids).toContain('session-c');
    });

    it('should return empty array when no queues', () => {
      const ids = manager.getSessionIds();

      expect(ids).toEqual([]);
    });
  });

  describe('reset', () => {
    it('should clear all queues', () => {
      manager.addInbound('session-1', 'Test 1');
      manager.addInbound('session-2', 'Test 2');
      manager.addInbound('session-3', 'Test 3');

      manager.reset();

      expect(manager.getSessionIds()).toEqual([]);
      expect(manager.has('session-1')).toBe(false);
      expect(manager.has('session-2')).toBe(false);
      expect(manager.has('session-3')).toBe(false);
    });
  });
});

describe('Singleton pattern', () => {
  beforeEach(() => {
    resetMessageQueueManager();
  });

  it('should return same instance', () => {
    const instance1 = getMessageQueueManager();
    const instance2 = getMessageQueueManager();

    expect(instance1).toBe(instance2);
  });

  it('should reset singleton correctly', () => {
    const instance1 = getMessageQueueManager();
    instance1.addInbound('session-1', 'Test');

    resetMessageQueueManager();

    const instance2 = getMessageQueueManager();
    expect(instance2).not.toBe(instance1);
    expect(instance2.has('session-1')).toBe(false);
  });
});
