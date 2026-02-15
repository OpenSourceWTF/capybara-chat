/**
 * Task Message Queue Tests (090-task-resume)
 *
 * Unit tests for the TaskMessageQueue class which manages
 * per-session message queues for running task sessions.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TaskMessageQueue, QueuedTaskMessage, getTaskMessageQueue, resetTaskMessageQueue } from './task-message-queue.js';
import { SOCKET_EVENTS } from '@capybara-chat/types';

// Mock socket
function createMockSocket() {
  return {
    emit: vi.fn(),
  };
}

describe('TaskMessageQueue', () => {
  let queue: TaskMessageQueue;
  let mockSocket: ReturnType<typeof createMockSocket>;

  beforeEach(() => {
    queue = new TaskMessageQueue();
    mockSocket = createMockSocket();
    queue.setSocket(mockSocket as any);
  });

  describe('enqueue', () => {
    it('should add message to queue', () => {
      const message: QueuedTaskMessage = {
        content: 'test message',
        messageId: 'msg-1',
        timestamp: Date.now(),
      };

      const result = queue.enqueue('session-1', message);

      expect(result).toBe(true);
      expect(queue.getQueueSize('session-1')).toBe(1);
    });

    it('should emit SESSION_MESSAGE_QUEUED event', () => {
      const message: QueuedTaskMessage = {
        content: 'test message',
        messageId: 'msg-1',
        timestamp: Date.now(),
      };

      queue.enqueue('session-1', message);

      expect(mockSocket.emit).toHaveBeenCalledWith(
        SOCKET_EVENTS.SESSION_MESSAGE_QUEUED,
        expect.objectContaining({
          sessionId: 'session-1',
          messageId: 'msg-1',
          position: 1,
          queueSize: 1,
        })
      );
    });

    it('should queue multiple messages in order', () => {
      queue.enqueue('session-1', { content: 'first', messageId: 'msg-1', timestamp: 1 });
      queue.enqueue('session-1', { content: 'second', messageId: 'msg-2', timestamp: 2 });
      queue.enqueue('session-1', { content: 'third', messageId: 'msg-3', timestamp: 3 });

      expect(queue.getQueueSize('session-1')).toBe(3);
      expect(queue.peek('session-1')?.content).toBe('first');
    });

    it('should reject when queue is full (max 10)', () => {
      // Fill queue to max
      for (let i = 0; i < 10; i++) {
        queue.enqueue('session-1', {
          content: `message-${i}`,
          messageId: `msg-${i}`,
          timestamp: i,
        });
      }

      // Try to add one more
      const result = queue.enqueue('session-1', {
        content: 'overflow',
        messageId: 'msg-overflow',
        timestamp: 100,
      });

      expect(result).toBe(false);
      expect(queue.getQueueSize('session-1')).toBe(10);
    });

    it('should maintain separate queues per session', () => {
      queue.enqueue('session-1', { content: 's1-m1', messageId: 's1-msg-1', timestamp: 1 });
      queue.enqueue('session-2', { content: 's2-m1', messageId: 's2-msg-1', timestamp: 2 });
      queue.enqueue('session-1', { content: 's1-m2', messageId: 's1-msg-2', timestamp: 3 });

      expect(queue.getQueueSize('session-1')).toBe(2);
      expect(queue.getQueueSize('session-2')).toBe(1);
    });
  });

  describe('peek', () => {
    it('should return next message without removing', () => {
      queue.enqueue('session-1', { content: 'first', messageId: 'msg-1', timestamp: 1 });
      queue.enqueue('session-1', { content: 'second', messageId: 'msg-2', timestamp: 2 });

      const peeked = queue.peek('session-1');

      expect(peeked?.content).toBe('first');
      expect(queue.getQueueSize('session-1')).toBe(2); // Still has both
    });

    it('should return undefined for empty queue', () => {
      expect(queue.peek('nonexistent')).toBeUndefined();
    });
  });

  describe('dequeue', () => {
    it('should return messages in FIFO order', () => {
      queue.enqueue('session-1', { content: 'first', messageId: 'msg-1', timestamp: 1 });
      queue.enqueue('session-1', { content: 'second', messageId: 'msg-2', timestamp: 2 });

      const first = queue.dequeue('session-1');
      const second = queue.dequeue('session-1');

      expect(first?.content).toBe('first');
      expect(second?.content).toBe('second');
    });

    it('should emit SESSION_MESSAGE_DEQUEUED event', () => {
      queue.enqueue('session-1', { content: 'test', messageId: 'msg-1', timestamp: 1 });
      mockSocket.emit.mockClear(); // Clear enqueue emit

      queue.dequeue('session-1');

      expect(mockSocket.emit).toHaveBeenCalledWith(
        SOCKET_EVENTS.SESSION_MESSAGE_DEQUEUED,
        expect.objectContaining({
          sessionId: 'session-1',
          messageId: 'msg-1',
          remaining: 0,
        })
      );
    });

    it('should return undefined for empty queue', () => {
      expect(queue.dequeue('nonexistent')).toBeUndefined();
    });

    it('should clean up empty queues from map', () => {
      queue.enqueue('session-1', { content: 'only', messageId: 'msg-1', timestamp: 1 });
      queue.dequeue('session-1');

      expect(queue.hasMessages('session-1')).toBe(false);
    });
  });

  describe('drain', () => {
    it('should return all messages and clear queue', () => {
      queue.enqueue('session-1', { content: 'first', messageId: 'msg-1', timestamp: 1 });
      queue.enqueue('session-1', { content: 'second', messageId: 'msg-2', timestamp: 2 });

      const messages = queue.drain('session-1');

      expect(messages).toHaveLength(2);
      expect(messages[0].content).toBe('first');
      expect(messages[1].content).toBe('second');
      expect(queue.hasMessages('session-1')).toBe(false);
    });

    it('should return empty array for nonexistent session', () => {
      const messages = queue.drain('nonexistent');
      expect(messages).toEqual([]);
    });
  });

  describe('hasMessages', () => {
    it('should return true when messages are queued', () => {
      queue.enqueue('session-1', { content: 'test', messageId: 'msg-1', timestamp: 1 });
      expect(queue.hasMessages('session-1')).toBe(true);
    });

    it('should return false for empty queue', () => {
      expect(queue.hasMessages('session-1')).toBe(false);
    });

    it('should return false after draining', () => {
      queue.enqueue('session-1', { content: 'test', messageId: 'msg-1', timestamp: 1 });
      queue.drain('session-1');
      expect(queue.hasMessages('session-1')).toBe(false);
    });
  });

  describe('getQueueSize', () => {
    it('should return correct count', () => {
      expect(queue.getQueueSize('session-1')).toBe(0);

      queue.enqueue('session-1', { content: 'first', messageId: 'msg-1', timestamp: 1 });
      expect(queue.getQueueSize('session-1')).toBe(1);

      queue.enqueue('session-1', { content: 'second', messageId: 'msg-2', timestamp: 2 });
      expect(queue.getQueueSize('session-1')).toBe(2);

      queue.dequeue('session-1');
      expect(queue.getQueueSize('session-1')).toBe(1);
    });
  });

  describe('clear', () => {
    it('should remove all messages for session', () => {
      queue.enqueue('session-1', { content: 'first', messageId: 'msg-1', timestamp: 1 });
      queue.enqueue('session-1', { content: 'second', messageId: 'msg-2', timestamp: 2 });

      queue.clear('session-1');

      expect(queue.hasMessages('session-1')).toBe(false);
      expect(queue.getQueueSize('session-1')).toBe(0);
    });

    it('should not affect other sessions', () => {
      queue.enqueue('session-1', { content: 's1', messageId: 'msg-1', timestamp: 1 });
      queue.enqueue('session-2', { content: 's2', messageId: 'msg-2', timestamp: 2 });

      queue.clear('session-1');

      expect(queue.hasMessages('session-1')).toBe(false);
      expect(queue.hasMessages('session-2')).toBe(true);
    });
  });

  describe('reset', () => {
    it('should clear all queues', () => {
      queue.enqueue('session-1', { content: 's1', messageId: 'msg-1', timestamp: 1 });
      queue.enqueue('session-2', { content: 's2', messageId: 'msg-2', timestamp: 2 });

      queue.reset();

      expect(queue.hasMessages('session-1')).toBe(false);
      expect(queue.hasMessages('session-2')).toBe(false);
    });
  });
});

describe('Singleton', () => {
  beforeEach(() => {
    resetTaskMessageQueue();
  });

  it('should return same instance', () => {
    const instance1 = getTaskMessageQueue();
    const instance2 = getTaskMessageQueue();

    expect(instance1).toBe(instance2);
  });

  it('should reset singleton', () => {
    const instance1 = getTaskMessageQueue();
    resetTaskMessageQueue();
    const instance2 = getTaskMessageQueue();

    expect(instance1).not.toBe(instance2);
  });
});
