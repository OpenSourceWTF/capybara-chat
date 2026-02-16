/**
 * Agent Bridge Interfaces
 *
 * Dependency interfaces for testability. These enable type-safe mocking
 * without monkey-patching or module mocking.
 *
 * Usage in production: Use default implementations
 * Usage in tests: Pass mock implementations via dependency injection
 */

// C3 fix: Import proper types for session fields
import type { SessionType, SessionStatus, SessionMode } from '@capybara-chat/types';

/**
 * API client result type
 */
export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number };

/**
 * API client interface - abstracts HTTP operations
 */
export interface IApiClient {
  get<T>(path: string): Promise<ApiResult<T>>;
  post<T>(path: string, body: Record<string, unknown>): Promise<ApiResult<T>>;
  patch<T>(path: string, body: Record<string, unknown>): Promise<ApiResult<T>>;
}

/**
 * Bridge configuration interface
 */
export interface BridgeConfig {
  serverUrl: string;
  bridgePort: number;
  apiKey?: string;
  model?: string;
  allowDevKey?: boolean;
  /**
   * Use CLI provider instead of SDK provider.
   *
   * When true, the bridge spawns CLI tools (claude, gemini, etc.) as subprocesses
   * instead of using the Claude SDK directly.
   *
   * CLI provider mode:
   * - Uses OAuth authentication via the CLI (no API key needed for claude)
   * - Supports session resume via CLI's native --resume flag
   * - Can use any supported CLI backend (claude, gemini, ollama, codex)
   *
   * Set via USE_CLI_PROVIDER=true environment variable.
   */
  useCliProvider?: boolean;
  /**
   * CLI backend to use when useCliProvider is true.
   *
   * Options:
   * - 'claude' (default): Claude CLI with OAuth
   * - 'gemini': Google Gemini CLI
   * - 'ollama': Local Ollama models
   * - 'codex': OpenAI Codex CLI (official)
   * - 'openai': Alias for codex (backwards compatibility)
   *
   * Set via CLI_BACKEND environment variable.
   */
  cliBackend?: 'claude' | 'gemini' | 'ollama' | 'codex' | 'openai';
}

/**
 * Session data from server including editing state.
 * Used by bridge to fetch session details for resumption and context injection.
 * C3 fix: Use proper enum types from @capybara-chat/types instead of strings
 */
export interface ServerSession {
  id?: string;
  claudeSessionId?: string;
  agentDefinitionId?: string;
  /** Session type (agent, assistant:*, etc.) */
  sessionType?: SessionType;
  /** Session status (running, complete, failed, etc.) */
  status?: SessionStatus;
  /** Session mode (chat or entity-editing) */
  mode?: SessionMode;
  /** Type of entity being edited (for MCP Forms context injection) */
  editingEntityType?: string;
  /** ID of entity being edited */
  editingEntityId?: string;
  /** Whether form context has been injected */
  formContextInjected?: boolean;
  /** 032-multitenancy: Session owner (GitHub login). Used to scope MCP API calls. */
  createdBy?: string | null;
}
