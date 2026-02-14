/**
 * Agent SDK
 *
 * A unified interface for CLI-based AI agents with plugin support.
 * Supports multiple backends: Claude, Gemini, Aider, and custom CLIs.
 *
 * @example
 * ```typescript
 * import { createGeminiClient, createMessageAccumulatorPlugin } from '@capybara-chat/agent-sdk';
 *
 * const client = createGeminiClient({
 *   model: 'gemini-2.5-pro',
 *   plugins: [createMessageAccumulatorPlugin()],
 * });
 *
 * const session = await client.createSession();
 *
 * for await (const msg of client.streamMessages(session.id, 'Hello!')) {
 *   if (msg.type === 'message' && msg.role === 'assistant') {
 *     console.log(msg.content);
 *   }
 * }
 *
 * await client.stopSession(session.id);
 * ```
 */

// Client
export {
  AgentClientImpl,
  createClient,
  createClaudeClient,
  createGeminiClient,
  createAiderClient,
} from './client.js';

// Types
export type {
  AgentMessage,
  AgentResult,
  BackendConfig,
  BackendCapabilities,
  SessionConfig,
  Session,
  Plugin,
  AgentClient,
  AgentClientConfig,
  BackendName,
  BackendRegistry,
} from './types.js';

// Backends
export {
  backendRegistry,
  claudeBackend,
  geminiBackend,
  aiderBackend,
} from './backends/index.js';

// Plugins
export {
  createMessageAccumulatorPlugin,
  createSessionResumePlugin,
  resumeSession,
} from './plugins/index.js';
export type {
  MessageAccumulatorOptions,
  SessionResumeOptions,
} from './plugins/index.js';
