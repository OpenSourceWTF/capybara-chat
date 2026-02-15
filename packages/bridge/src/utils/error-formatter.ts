/**
 * Error Formatter Utility
 *
 * Extracts and formats CLI errors into user-friendly messages
 * with appropriate halt reasons for UI display.
 *
 * Consolidates duplicate error formatting from:
 * - message-handler.ts pipeline path (lines 332-345)
 * - message-handler.ts legacy path (lines 574-589)
 */

import { CLIError, CLITimeoutError, CLIProcessExitError } from '@capybara-chat/cli-provider';

/**
 * Halt reasons for session error events
 */
export type HaltReason = 'timeout' | 'cli_error' | 'process_exit';

/**
 * Formatted error result
 */
export interface FormattedError {
  message: string;
  haltReason: HaltReason;
}

/**
 * Format a CLI error into a user-friendly message with halt reason.
 *
 * @param error - The error to format (may be any type)
 * @param context - Optional context for the error message
 * @returns Formatted error with message and halt reason
 *
 * @example
 * ```typescript
 * try {
 *   await streamClaudeResponse(...);
 * } catch (error) {
 *   const { message, haltReason } = formatCLIError(error);
 *   socket.emit(SESSION_HALTED, { reason: haltReason, errorMessage: message });
 * }
 * ```
 */
export function formatCLIError(
  error: unknown,
  context?: string
): FormattedError {
  // Default fallback
  let message = context
    ? `[Error] ${context}: ${error}`
    : `[Error] ${error}`;
  let haltReason: HaltReason = 'cli_error';

  if (error instanceof CLITimeoutError) {
    const timeoutSec = Math.round((error as any).timeoutMs / 1000);
    message = `[Timeout] Claude CLI did not respond within ${timeoutSec}s (${(error as any).phase} phase)`;
    haltReason = 'timeout';
  } else if (error instanceof CLIProcessExitError) {
    const exitCode = (error as any).context.exitCode ?? 'unknown';
    message = `[Process Error] Claude CLI process exited unexpectedly. Exit code: ${exitCode}`;
    haltReason = 'process_exit';
  } else if (error instanceof CLIError) {
    message = `[CLI Error] ${(error as any).message}`;
    haltReason = 'cli_error';
  }

  return { message, haltReason };
}
