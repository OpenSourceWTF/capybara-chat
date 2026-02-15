/**
 * Circuit Breaker for Subagent Execution
 *
 * Prevents repeated failures of the same subagent type.
 * Uses sliding window to track failures within time window.
 *
 * Design source: 087-prevent-subagent-hangs
 * Addresses: GAP-003, GAP-005, GAP-007
 */

import {
  CIRCUIT_BREAKER_FAILURE_THRESHOLD,
  CIRCUIT_BREAKER_WINDOW_MS,
  CIRCUIT_BREAKER_COOLDOWN_MS,
} from './config.js';
import { createLogger } from '@capybara-chat/types';

const logger = createLogger('CircuitBreaker');

interface FailureRecord {
  count: number;
  window: number[];  // Timestamps of failures
  lastFailureAt: number;
}

/**
 * Circuit breaker for subagent execution.
 * Prevents repeated failures of the same subagent type.
 *
 * State is transient (not persisted across restarts).
 * This is intentional - fresh start after bridge restart (GAP-003).
 */
export class SubagentCircuitBreaker {
  private failures = new Map<string, FailureRecord>();

  /**
   * Check if a subagent type should be allowed to execute.
   *
   * @param subagentType - Type of subagent (e.g., 'Explore', 'Plan')
   * @returns true if should allow, false if circuit is open
   */
  shouldAllow(subagentType: string): boolean {
    const record = this.failures.get(subagentType);
    if (!record) return true;

    const now = Date.now();

    // Clean up old timestamps (addresses GAP-005 - prevents unbounded growth)
    const recentFailures = record.window.filter(
      ts => now - ts < CIRCUIT_BREAKER_WINDOW_MS
    );

    // Update the record with cleaned window
    if (recentFailures.length < record.window.length) {
      record.window = recentFailures;
      this.failures.set(subagentType, record);
    }

    // Check cooldown period (allows retry after cooldown)
    const timeSinceLastFailure = now - record.lastFailureAt;
    if (timeSinceLastFailure > CIRCUIT_BREAKER_COOLDOWN_MS) {
      logger.info('[CircuitBreaker] Cooldown expired, allowing retry', {
        subagentType,
        timeSinceLast: timeSinceLastFailure,
        cooldown: CIRCUIT_BREAKER_COOLDOWN_MS,
      });
      return true;  // Half-open state - allow one attempt
    }

    // Check if circuit should trip
    const shouldTrip = recentFailures.length >= CIRCUIT_BREAKER_FAILURE_THRESHOLD;

    if (shouldTrip) {
      logger.warn('[CircuitBreaker] Circuit OPEN - blocking execution', {
        subagentType,
        recentFailures: recentFailures.length,
        threshold: CIRCUIT_BREAKER_FAILURE_THRESHOLD,
        windowMs: CIRCUIT_BREAKER_WINDOW_MS,
      });
    }

    return !shouldTrip;
  }

  /**
   * Record a subagent failure.
   */
  recordFailure(subagentType: string) {
    const now = Date.now();
    const record = this.failures.get(subagentType) ?? {
      count: 0,
      window: [],
      lastFailureAt: 0,
    };

    record.count++;
    record.window.push(now);
    record.lastFailureAt = now;

    this.failures.set(subagentType, record);

    logger.debug('[CircuitBreaker] Recorded failure', {
      subagentType,
      totalCount: record.count,
      recentCount: record.window.length,
    });
  }

  /**
   * Record a subagent success - resets the circuit.
   */
  recordSuccess(subagentType: string) {
    const hadFailures = this.failures.has(subagentType);
    this.failures.delete(subagentType);

    if (hadFailures) {
      logger.info('[CircuitBreaker] Success - circuit RESET', { subagentType });
    }
  }

  /**
   * Get current state for observability.
   */
  getState(): Record<string, { recentFailures: number; isOpen: boolean }> {
    const state: Record<string, { recentFailures: number; isOpen: boolean }> = {};
    const now = Date.now();

    this.failures.forEach((record, subagentType) => {
      const recentFailures = record.window.filter(
        ts => now - ts < CIRCUIT_BREAKER_WINDOW_MS
      ).length;

      state[subagentType] = {
        recentFailures,
        isOpen: recentFailures >= CIRCUIT_BREAKER_FAILURE_THRESHOLD,
      };
    });

    return state;
  }
}

// Singleton instance
export const circuitBreaker = new SubagentCircuitBreaker();
