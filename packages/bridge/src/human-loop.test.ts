/**
 * Tests for HumanLoopHandler
 *
 * Tests the human-in-the-loop blocking mechanism:
 * - requestInput blocks until response or timeout
 * - provideInput resolves the pending request
 * - cancelRequest rejects and cleans up
 * - Only one pending request per session
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HumanLoopHandler, type EventEmitter } from './human-loop.js';
import { SOCKET_EVENTS } from '@capybara-chat/types';

describe('HumanLoopHandler', () => {
  let handler: HumanLoopHandler;
  let mockEmitter: EventEmitter;

  beforeEach(() => {
    vi.useFakeTimers();
    handler = new HumanLoopHandler();
    mockEmitter = vi.fn();
    handler.setEventEmitter(mockEmitter);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('requestInput', () => {
    it('should emit SESSION_HUMAN_INPUT_REQUESTED event', async () => {
      const requestPromise = handler.requestInput('session-1', {
        question: 'What is your name?',
        context: 'Need user info',
        options: ['Option A', 'Option B'],
      });

      expect(mockEmitter).toHaveBeenCalledWith(
        SOCKET_EVENTS.SESSION_HUMAN_INPUT_REQUESTED,
        expect.objectContaining({
          sessionId: 'session-1',
          question: 'What is your name?',
          context: 'Need user info',
          options: ['Option A', 'Option B'],
          timestamp: expect.any(Number),
        })
      );

      // Clean up by providing input
      handler.provideInput('session-1', 'Test response');
      await requestPromise;
    });

    it('should block until provideInput is called', async () => {
      let resolved = false;
      const requestPromise = handler.requestInput('session-1', {
        question: 'Continue?',
      }).then((response) => {
        resolved = true;
        return response;
      });

      expect(resolved).toBe(false);

      handler.provideInput('session-1', 'Yes');

      const result = await requestPromise;
      expect(resolved).toBe(true);
      expect(result).toBe('Yes');
    });

    it('should reject on timeout', async () => {
      const requestPromise = handler.requestInput(
        'session-1',
        { question: 'Test?' },
        1000 // 1 second timeout
      );

      // Advance time past the timeout
      vi.advanceTimersByTime(1001);

      await expect(requestPromise).rejects.toThrow('Human input request timed out after 1000ms');
    });

    it('should throw if session already has pending request', async () => {
      // Start first request (don't await)
      const firstPromise = handler.requestInput('session-1', { question: 'First?' });

      // Try to start second request on same session
      await expect(
        handler.requestInput('session-1', { question: 'Second?' })
      ).rejects.toThrow('Session session-1 already has a pending request');

      // Clean up
      handler.provideInput('session-1', 'Done');
      await firstPromise;
    });

    it('should allow different sessions to have pending requests', async () => {
      const promise1 = handler.requestInput('session-1', { question: 'Q1?' });
      const promise2 = handler.requestInput('session-2', { question: 'Q2?' });

      handler.provideInput('session-1', 'A1');
      handler.provideInput('session-2', 'A2');

      const [result1, result2] = await Promise.all([promise1, promise2]);

      expect(result1).toBe('A1');
      expect(result2).toBe('A2');
    });

    it('should work without event emitter set', async () => {
      const noEmitterHandler = new HumanLoopHandler();
      const requestPromise = noEmitterHandler.requestInput('session-1', {
        question: 'Test?',
      });

      noEmitterHandler.provideInput('session-1', 'Response');

      const result = await requestPromise;
      expect(result).toBe('Response');
    });
  });

  describe('provideInput', () => {
    it('should return true when request exists', async () => {
      const requestPromise = handler.requestInput('session-1', { question: 'Test?' });

      const result = handler.provideInput('session-1', 'Response');

      expect(result).toBe(true);
      await requestPromise;
    });

    it('should return false when no pending request', () => {
      const result = handler.provideInput('nonexistent-session', 'Response');

      expect(result).toBe(false);
    });

    it('should clear the pending request after providing input', async () => {
      const requestPromise = handler.requestInput('session-1', { question: 'Test?' });

      handler.provideInput('session-1', 'Response');
      await requestPromise;

      expect(handler.getPendingRequest('session-1')).toBeUndefined();
    });

    it('should clear the timeout when input is provided', async () => {
      const requestPromise = handler.requestInput(
        'session-1',
        { question: 'Test?' },
        5000
      );

      handler.provideInput('session-1', 'Response');
      await requestPromise;

      // Advance past the original timeout - should not throw
      vi.advanceTimersByTime(10000);

      // If timeout wasn't cleared, this would have thrown
      expect(handler.getPendingRequest('session-1')).toBeUndefined();
    });
  });

  describe('cancelRequest', () => {
    it('should reject the pending promise with reason', async () => {
      const requestPromise = handler.requestInput('session-1', { question: 'Test?' });

      handler.cancelRequest('session-1', 'User cancelled');

      await expect(requestPromise).rejects.toThrow('User cancelled');
    });

    it('should return true when request exists', async () => {
      const requestPromise = handler.requestInput('session-1', { question: 'Test?' });

      const result = handler.cancelRequest('session-1');

      expect(result).toBe(true);
      await expect(requestPromise).rejects.toThrow();
    });

    it('should return false when no pending request', () => {
      const result = handler.cancelRequest('nonexistent-session');

      expect(result).toBe(false);
    });

    it('should use default reason when not provided', async () => {
      const requestPromise = handler.requestInput('session-1', { question: 'Test?' });

      handler.cancelRequest('session-1');

      await expect(requestPromise).rejects.toThrow('Cancelled by user');
    });

    it('should clear the timeout (GAP-009 fix)', async () => {
      const requestPromise = handler.requestInput(
        'session-1',
        { question: 'Test?' },
        5000
      );

      handler.cancelRequest('session-1');
      await expect(requestPromise).rejects.toThrow();

      // Advance past the original timeout - timer should be cleared
      vi.advanceTimersByTime(10000);

      // Verify no lingering timeout effects
      expect(handler.getPendingRequest('session-1')).toBeUndefined();
    });
  });

  describe('getPendingRequest', () => {
    it('should return undefined when no pending request', () => {
      expect(handler.getPendingRequest('nonexistent')).toBeUndefined();
    });

    it('should return the pending request', async () => {
      const requestPromise = handler.requestInput('session-1', {
        question: 'Test?',
        context: 'Some context',
      });

      const pending = handler.getPendingRequest('session-1');

      expect(pending).toBeDefined();
      expect(pending?.sessionId).toBe('session-1');
      expect(pending?.request.question).toBe('Test?');
      expect(pending?.request.context).toBe('Some context');
      expect(pending?.createdAt).toBeDefined();

      // Clean up
      handler.provideInput('session-1', 'Done');
      await requestPromise;
    });
  });

  describe('getAllPendingRequests', () => {
    it('should return empty array when no pending requests', () => {
      expect(handler.getAllPendingRequests()).toEqual([]);
    });

    it('should return all pending requests', async () => {
      const promise1 = handler.requestInput('session-1', { question: 'Q1?' });
      const promise2 = handler.requestInput('session-2', { question: 'Q2?' });
      const promise3 = handler.requestInput('session-3', { question: 'Q3?' });

      const pending = handler.getAllPendingRequests();

      expect(pending).toHaveLength(3);
      expect(pending.map((p) => p.sessionId).sort()).toEqual([
        'session-1',
        'session-2',
        'session-3',
      ]);

      // Clean up
      handler.provideInput('session-1', 'A1');
      handler.provideInput('session-2', 'A2');
      handler.provideInput('session-3', 'A3');
      await Promise.all([promise1, promise2, promise3]);
    });
  });
});
