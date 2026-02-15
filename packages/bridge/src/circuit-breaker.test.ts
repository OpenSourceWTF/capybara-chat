/**
 * Unit tests for SubagentCircuitBreaker (087-prevent-subagent-hangs)
 *
 * Tests verify:
 * 1. Circuit opens after threshold failures
 * 2. Circuit allows retry after cooldown
 * 3. Success resets the circuit
 * 4. Old timestamps are cleaned up
 * 5. getState() returns accurate information
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SubagentCircuitBreaker } from './circuit-breaker.js';

describe('SubagentCircuitBreaker', () => {
  let breaker: SubagentCircuitBreaker;

  beforeEach(() => {
    breaker = new SubagentCircuitBreaker();
    // Reset time mocking
    vi.restoreAllMocks();
  });

  describe('shouldAllow', () => {
    it('should allow when no failures recorded', () => {
      expect(breaker.shouldAllow('explore')).toBe(true);
      expect(breaker.shouldAllow('plan')).toBe(true);
    });

    it('should allow when failures are below threshold', () => {
      breaker.recordFailure('explore');
      expect(breaker.shouldAllow('explore')).toBe(true);

      breaker.recordFailure('explore');
      expect(breaker.shouldAllow('explore')).toBe(true);
    });

    it('should block after threshold failures (3) within window', () => {
      // Record 3 failures
      breaker.recordFailure('explore');
      breaker.recordFailure('explore');
      breaker.recordFailure('explore');

      // Circuit should be open (blocked)
      expect(breaker.shouldAllow('explore')).toBe(false);
    });

    it('should not block different subagent types', () => {
      // Record 3 failures for 'explore'
      breaker.recordFailure('explore');
      breaker.recordFailure('explore');
      breaker.recordFailure('explore');

      // 'explore' should be blocked
      expect(breaker.shouldAllow('explore')).toBe(false);

      // 'plan' should still be allowed (different type)
      expect(breaker.shouldAllow('plan')).toBe(true);
    });

    it('should allow after cooldown period expires', () => {
      // Mock Date.now() to control time
      const baseTime = 1000000;
      vi.spyOn(Date, 'now')
        .mockReturnValueOnce(baseTime)       // First failure
        .mockReturnValueOnce(baseTime + 1000)  // Second failure
        .mockReturnValueOnce(baseTime + 2000); // Third failure

      breaker.recordFailure('explore');
      breaker.recordFailure('explore');
      breaker.recordFailure('explore');

      // Circuit should be open
      vi.spyOn(Date, 'now').mockReturnValue(baseTime + 3000);
      expect(breaker.shouldAllow('explore')).toBe(false);

      // After cooldown (10 minutes = 600000ms), circuit allows retry
      const COOLDOWN_MS = 10 * 60 * 1000;
      vi.spyOn(Date, 'now').mockReturnValue(baseTime + 2000 + COOLDOWN_MS + 1);
      expect(breaker.shouldAllow('explore')).toBe(true);
    });

    it('should clean up old timestamps outside window', () => {
      const baseTime = 1000000;
      const WINDOW_MS = 10 * 60 * 1000; // 10 minutes

      // Record failure at baseTime
      vi.spyOn(Date, 'now').mockReturnValue(baseTime);
      breaker.recordFailure('explore');

      // Record 2 more failures way in the future (outside window)
      vi.spyOn(Date, 'now').mockReturnValue(baseTime + WINDOW_MS + 1000);
      breaker.recordFailure('explore');

      vi.spyOn(Date, 'now').mockReturnValue(baseTime + WINDOW_MS + 2000);
      breaker.recordFailure('explore');

      // Check shouldAllow at the future time
      vi.spyOn(Date, 'now').mockReturnValue(baseTime + WINDOW_MS + 3000);

      // Only 2 recent failures (the first one was cleaned up)
      // So circuit should still be open (need 3 to block)
      expect(breaker.shouldAllow('explore')).toBe(true);

      // Add one more to hit threshold
      breaker.recordFailure('explore');
      expect(breaker.shouldAllow('explore')).toBe(false);
    });
  });

  describe('recordFailure', () => {
    it('should increment failure count', () => {
      breaker.recordFailure('explore');

      const state = breaker.getState();
      expect(state.explore).toBeDefined();
      expect(state.explore.recentFailures).toBe(1);
    });

    it('should add timestamp to window', () => {
      const baseTime = 1000000;
      vi.spyOn(Date, 'now').mockReturnValue(baseTime);

      breaker.recordFailure('explore');

      vi.spyOn(Date, 'now').mockReturnValue(baseTime + 1000);
      breaker.recordFailure('explore');

      const state = breaker.getState();
      expect(state.explore.recentFailures).toBe(2);
    });

    it('should track multiple subagent types independently', () => {
      breaker.recordFailure('explore');
      breaker.recordFailure('explore');
      breaker.recordFailure('plan');

      const state = breaker.getState();
      expect(state.explore.recentFailures).toBe(2);
      expect(state.plan.recentFailures).toBe(1);
    });
  });

  describe('recordSuccess', () => {
    it('should reset circuit (delete record)', () => {
      // Record failures
      breaker.recordFailure('explore');
      breaker.recordFailure('explore');
      breaker.recordFailure('explore');

      // Verify circuit is open
      expect(breaker.shouldAllow('explore')).toBe(false);

      // Record success
      breaker.recordSuccess('explore');

      // Circuit should be closed (reset)
      expect(breaker.shouldAllow('explore')).toBe(true);

      // State should be empty for this type
      const state = breaker.getState();
      expect(state.explore).toBeUndefined();
    });

    it('should not affect other subagent types', () => {
      breaker.recordFailure('explore');
      breaker.recordFailure('explore');
      breaker.recordFailure('explore');

      breaker.recordFailure('plan');
      breaker.recordFailure('plan');

      // Reset 'explore'
      breaker.recordSuccess('explore');

      // 'explore' should be allowed
      expect(breaker.shouldAllow('explore')).toBe(true);

      // 'plan' should still have failures
      const state = breaker.getState();
      expect(state.explore).toBeUndefined();
      expect(state.plan.recentFailures).toBe(2);
    });

    it('should be idempotent (safe to call multiple times)', () => {
      breaker.recordFailure('explore');

      breaker.recordSuccess('explore');
      breaker.recordSuccess('explore');
      breaker.recordSuccess('explore');

      // Should still work
      expect(breaker.shouldAllow('explore')).toBe(true);
    });
  });

  describe('getState', () => {
    it('should return empty object when no failures', () => {
      const state = breaker.getState();
      expect(state).toEqual({});
    });

    it('should return current state for all subagent types', () => {
      breaker.recordFailure('explore');
      breaker.recordFailure('explore');
      breaker.recordFailure('plan');

      const state = breaker.getState();

      expect(state.explore).toEqual({
        recentFailures: 2,
        isOpen: false,  // Not open yet (need 3)
      });

      expect(state.plan).toEqual({
        recentFailures: 1,
        isOpen: false,
      });
    });

    it('should filter timestamps to recent failures only', () => {
      const baseTime = 1000000;
      const WINDOW_MS = 10 * 60 * 1000; // 10 minutes

      // Old failure (outside window)
      vi.spyOn(Date, 'now').mockReturnValue(baseTime);
      breaker.recordFailure('explore');

      // Recent failures (inside window)
      vi.spyOn(Date, 'now').mockReturnValue(baseTime + WINDOW_MS + 1000);
      breaker.recordFailure('explore');

      vi.spyOn(Date, 'now').mockReturnValue(baseTime + WINDOW_MS + 2000);
      breaker.recordFailure('explore');

      // Get state at current time
      vi.spyOn(Date, 'now').mockReturnValue(baseTime + WINDOW_MS + 3000);
      const state = breaker.getState();

      // Should only count the 2 recent failures
      expect(state.explore.recentFailures).toBe(2);
      expect(state.explore.isOpen).toBe(false);
    });

    it('should correctly set isOpen flag', () => {
      breaker.recordFailure('explore');
      breaker.recordFailure('explore');

      let state = breaker.getState();
      expect(state.explore.isOpen).toBe(false);

      // Add third failure to trip circuit
      breaker.recordFailure('explore');

      state = breaker.getState();
      expect(state.explore.isOpen).toBe(true);
    });
  });

  describe('Integration scenarios', () => {
    it('should handle rapid successive failures', () => {
      const baseTime = 1000000;

      // Simulate 5 failures in quick succession
      for (let i = 0; i < 5; i++) {
        vi.spyOn(Date, 'now').mockReturnValue(baseTime + i * 100);
        breaker.recordFailure('explore');
      }

      // Circuit should be open after 3rd failure
      vi.spyOn(Date, 'now').mockReturnValue(baseTime + 600);
      expect(breaker.shouldAllow('explore')).toBe(false);

      const state = breaker.getState();
      expect(state.explore.recentFailures).toBe(5);
      expect(state.explore.isOpen).toBe(true);
    });

    it('should handle failure -> success -> failure pattern', () => {
      // Initial failures
      breaker.recordFailure('explore');
      breaker.recordFailure('explore');

      // Success resets
      breaker.recordSuccess('explore');
      expect(breaker.shouldAllow('explore')).toBe(true);

      // New failures should start from scratch
      breaker.recordFailure('explore');
      expect(breaker.shouldAllow('explore')).toBe(true);

      breaker.recordFailure('explore');
      expect(breaker.shouldAllow('explore')).toBe(true);

      breaker.recordFailure('explore');
      expect(breaker.shouldAllow('explore')).toBe(false); // 3 new failures
    });

    it('should handle window boundary edge case', () => {
      const baseTime = 1000000;
      const WINDOW_MS = 10 * 60 * 1000;

      // Failure exactly at window boundary
      vi.spyOn(Date, 'now').mockReturnValue(baseTime);
      breaker.recordFailure('explore');

      // Check at exactly WINDOW_MS later
      vi.spyOn(Date, 'now').mockReturnValue(baseTime + WINDOW_MS);

      // Timestamp should be EXCLUDED (< WINDOW_MS, not <=)
      // So shouldAllow should be true (no recent failures)
      expect(breaker.shouldAllow('explore')).toBe(true);
    });
  });
});
