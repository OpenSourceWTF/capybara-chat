/**
 * Tests for timeout-wrapper.ts
 *
 * Verifies:
 * - Successful promise resolution before timeout
 * - Timeout rejection with custom message
 * - Timer cleanup on success (no leaks)
 * - Timer cleanup on timeout (no leaks)
 * - createStreamTimeoutMessage formatting
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { withTimeout, createStreamTimeoutMessage, createIdleTimeout } from './timeout-wrapper.js';

describe('timeout-wrapper', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('withTimeout', () => {
    it('should resolve when promise completes before timeout', async () => {
      const promise = Promise.resolve('success');
      const result = await withTimeout(promise, 1000, 'Timeout error');
      expect(result).toBe('success');
    });

    it('should reject when timeout is reached', async () => {
      const neverResolves = new Promise(() => {});
      const timeoutPromise = withTimeout(neverResolves, 1000, 'Custom timeout message');

      // Advance time past the timeout
      vi.advanceTimersByTime(1001);

      await expect(timeoutPromise).rejects.toThrow('Custom timeout message');
    });

    it('should use default error message when none provided', async () => {
      const neverResolves = new Promise(() => {});
      const timeoutPromise = withTimeout(neverResolves, 5000);

      vi.advanceTimersByTime(5001);

      await expect(timeoutPromise).rejects.toThrow('Operation timed out after 5000ms');
    });

    it('should clear timeout on successful resolution (no timer leak)', async () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

      const promise = Promise.resolve('done');
      await withTimeout(promise, 10000, 'Should not timeout');

      expect(clearTimeoutSpy).toHaveBeenCalled();
      clearTimeoutSpy.mockRestore();
    });

    it('should clear timeout on rejection (no timer leak)', async () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

      const neverResolves = new Promise(() => {});
      const timeoutPromise = withTimeout(neverResolves, 100, 'Timeout');

      vi.advanceTimersByTime(101);

      try {
        await timeoutPromise;
      } catch {
        // Expected
      }

      expect(clearTimeoutSpy).toHaveBeenCalled();
      clearTimeoutSpy.mockRestore();
    });

    it('should propagate promise rejection without timeout interference', async () => {
      const failingPromise = Promise.reject(new Error('Original error'));

      await expect(withTimeout(failingPromise, 10000, 'Timeout')).rejects.toThrow('Original error');
    });

    it('should handle zero timeout', async () => {
      const neverResolves = new Promise(() => {});
      const timeoutPromise = withTimeout(neverResolves, 0, 'Immediate timeout');

      vi.advanceTimersByTime(1);

      await expect(timeoutPromise).rejects.toThrow('Immediate timeout');
    });
  });

  describe('createStreamTimeoutMessage', () => {
    it('should format timeout message in minutes', () => {
      const message = createStreamTimeoutMessage(600000); // 10 minutes
      expect(message).toBe('Stream timeout after 10 minutes - SDK may be hung');
    });

    it('should include context when provided', () => {
      const message = createStreamTimeoutMessage(900000, 'task'); // 15 minutes
      expect(message).toBe('Stream timeout after 15 minutes (task) - SDK may be hung');
    });

    it('should handle fractional minutes', () => {
      const message = createStreamTimeoutMessage(90000); // 1.5 minutes
      expect(message).toBe('Stream timeout after 1.5 minutes - SDK may be hung');
    });
  });

  describe('createIdleTimeout (137-idle-timeout)', () => {
    it('should reject when no activity within timeout period', async () => {
      const { promise, cleanup } = createIdleTimeout(1000, 'Idle timeout');

      // Advance time past the timeout
      vi.advanceTimersByTime(1001);

      await expect(promise).rejects.toThrow('Idle timeout');
      cleanup();
    });

    it('should reset timeout when resetTimeout is called', async () => {
      const { promise, resetTimeout, cleanup } = createIdleTimeout(1000, 'Idle timeout');

      // Advance time but not past timeout
      vi.advanceTimersByTime(800);

      // Reset the timeout (activity detected)
      resetTimeout();

      // Advance time again - but now we have 1000ms from reset
      vi.advanceTimersByTime(800);

      // Promise should not have rejected yet (only 800ms since reset)
      let rejected = false;
      promise.catch(() => { rejected = true; });
      await vi.advanceTimersByTimeAsync(0); // flush microtasks

      expect(rejected).toBe(false);

      // Now advance past the reset timeout
      vi.advanceTimersByTime(300);
      await vi.advanceTimersByTimeAsync(0);

      expect(rejected).toBe(true);
      cleanup();
    });

    it('should use default error message when none provided', async () => {
      const { promise, cleanup } = createIdleTimeout(5000);

      vi.advanceTimersByTime(5001);

      await expect(promise).rejects.toThrow('Idle timeout after 5000ms - no activity detected');
      cleanup();
    });

    it('should clear timeout when cleanup is called', () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

      const { cleanup } = createIdleTimeout(10000, 'Timeout');
      cleanup();

      expect(clearTimeoutSpy).toHaveBeenCalled();
      clearTimeoutSpy.mockRestore();
    });

    it('should handle multiple resetTimeout calls', async () => {
      const { promise, resetTimeout, cleanup } = createIdleTimeout(1000, 'Idle timeout');

      // Multiple activity events
      vi.advanceTimersByTime(900);
      resetTimeout();
      vi.advanceTimersByTime(900);
      resetTimeout();
      vi.advanceTimersByTime(900);
      resetTimeout();

      // Total elapsed: 2700ms, but timer has been reset each time
      // Should not reject yet
      let rejected = false;
      promise.catch(() => { rejected = true; });
      await vi.advanceTimersByTimeAsync(0);

      expect(rejected).toBe(false);

      // Now wait for full timeout period without reset
      vi.advanceTimersByTime(1001);
      await vi.advanceTimersByTimeAsync(0);

      expect(rejected).toBe(true);
      cleanup();
    });
  });
});
