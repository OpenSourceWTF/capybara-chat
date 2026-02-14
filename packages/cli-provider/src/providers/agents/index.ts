/**
 * CLI Backend Configurations
 */

// Types
export type {
  CLIBackendConfig,
  CLIBackendFeatures,
  CLIMessage,
  CLISessionConfig,
  ExtractedToolUse,
  ExtractedToolResult,
} from './types.js';

// Utilities
export {
  hasOAuthCredentials,
  buildMcpServersConfig,
  computeEffectiveTools,
  BUILTIN_TOOLS,
  OAUTH_CREDENTIAL_PATHS,
  log,
} from './utils.js';

// Backend configurations
export { CLAUDE_BACKEND } from './claude.js';
// We are only porting Claude for now as per plan
// export { GEMINI_BACKEND } from './gemini.js';
// export { OLLAMA_BACKEND } from './ollama.js';
// export { CODEX_BACKEND } from './codex.js';

import type { CLIBackendConfig } from './types.js';
import { CLAUDE_BACKEND } from './claude.js';
// import { GEMINI_BACKEND } from './gemini.js';
// import { OLLAMA_BACKEND } from './ollama.js';
// import { CODEX_BACKEND } from './codex.js';

/**
 * All available CLI backends.
 * Maps backend name to its configuration.
 */
export const BACKENDS: Record<string, CLIBackendConfig | null> = {
  claude: CLAUDE_BACKEND,
  gemini: null, // GEMINI_BACKEND
  ollama: null, // OLLAMA_BACKEND
  codex: null, // CODEX_BACKEND
  openai: null, // CODEX_BACKEND
  custom: null,
};
