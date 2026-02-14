/**
 * Capybara Chat - CLI Provider
 *
 * Provides a unified interface for CLI-based AI agents (Claude, Gemini, etc.).
 *
 * @example
 * ```typescript
 * import { createClaudeCLIProvider } from '@capybara-chat/cli-provider';
 *
 * const provider = createClaudeCLIProvider();
 * const session = await provider.createSession({ sessionId: 'test' });
 * ```
 */

export {
  GenericCLIProvider,
  createClaudeCLIProvider,
  CLIBackend,
  CLIError,
  CLITimeoutError,
  CLIProcessExitError,
  CLIParseError,
  LineReader,
} from './providers/generic-cli.js';

export type {
  CLIBackendConfig,
  CLIMessage,
  GenericCLIConfig,
  CLIErrorContext,
} from './providers/generic-cli.js';
