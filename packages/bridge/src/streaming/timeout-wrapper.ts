/**
 * Streaming Timeout Wrapper
 *
 * Provides timeout protection for async operations like streaming.
 * Extracted from message-handler.ts and task-executor.ts to eliminate duplication.
 *
 * The pattern solves the SDK hang issue where streams can stall indefinitely.
 * By racing the stream against a timeout, we can detect and recover from hangs.
 *
 * 137-idle-timeout: Added idle-based timeout that resets on activity.
 * This is critical for long-running subagent tasks where the stream is
 * active (tools running) but takes longer than the absolute timeout.
 *
 * Usage:
 *   const result = await withTimeout(
 *     processClaudeStream(stream, callbacks, hooks),
 *     STREAM_TIMEOUT_MS,
 *     'Stream timeout after 10 minutes'
 *   );
 *
 * For idle-based timeout:
 *   const { result, resetTimeout } = createIdleTimeout(TIMEOUT_MS, errorMessage);
 *   // Call resetTimeout() on each stream event
 *   const streamResult = await Promise.race([streamPromise, result]);
 */

import { createLogger } from '@capybara-chat/types';

const log = createLogger('TimeoutWrapper');

/**
 * Execute a promise with timeout protection.
 *
 * @param promise - The promise to execute
 * @param timeoutMs - Timeout in milliseconds
 * @param errorMessage - Error message when timeout occurs
 * @returns The promise result
 * @throws Error if timeout is reached
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage?: string
): Promise<T> {
  let timeoutId: NodeJS.Timeout;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      const message = errorMessage || `Operation timed out after ${timeoutMs}ms`;
      log.warn('Timeout triggered', { timeoutMs, message });
      reject(new Error(message));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    return result;
  } finally {
    // Always clear timeout to prevent timer leak (GAP-002/008 fix)
    clearTimeout(timeoutId!);
  }
}

/**
 * Create an idle-based timeout (137-idle-timeout).
 *
 * Unlike withTimeout(), this returns a resetTimeout() function that should be
 * called whenever activity is detected. The timeout only fires if there's
 * no activity for the specified duration.
 *
 * This is critical for long-running subagent tasks where:
 * - Tools are actively running (stream events keep coming)
 * - Total execution time exceeds the base timeout
 * - But there's no actual "hang" - just slow tool execution
 *
 * @param timeoutMs - Idle timeout in milliseconds
 * @param errorMessage - Error message when timeout occurs
 * @returns Object with promise (rejects on timeout), resetTimeout(), and cleanup()
 */
export function createIdleTimeout(
  timeoutMs: number,
  errorMessage?: string
): {
  promise: Promise<never>;
  resetTimeout: () => void;
  cleanup: () => void;
} {
  let timeoutId: NodeJS.Timeout;
  let reject: (error: Error) => void;

  const promise = new Promise<never>((_, rej) => {
    reject = rej;
  });

  const scheduleTimeout = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      const message = errorMessage || `Idle timeout after ${timeoutMs}ms - no activity detected`;
      log.warn('Idle timeout triggered', { timeoutMs, message });
      reject(new Error(message));
    }, timeoutMs);
  };

  // Schedule initial timeout
  scheduleTimeout();

  return {
    promise,
    resetTimeout: () => {
      // Reschedule timeout - activity detected
      scheduleTimeout();
    },
    cleanup: () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    },
  };
}

/**
 * Create a timeout error message for streaming operations.
 *
 * @param timeoutMs - Timeout in milliseconds
 * @param context - Additional context (e.g., 'session', 'task')
 * @returns Formatted error message
 */
export function createStreamTimeoutMessage(timeoutMs: number, context?: string): string {
  const minutes = timeoutMs / 60000;
  const contextStr = context ? ` (${context})` : '';
  return `Stream timeout after ${minutes} minutes${contextStr} - SDK may be hung`;
}
