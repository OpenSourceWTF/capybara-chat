/**
 * CLI Backend Types
 *
 * Shared type definitions for all CLI backends.
 */

import type { AgentContext } from '@capybara-chat/types';

/**
 * Feature flags indicating backend capabilities.
 * Used to prevent runtime errors when using unsupported features.
 */
export interface CLIBackendFeatures {
  /** Supports --resume flag for session continuity */
  sessionResume: boolean;
  /** Supports --mcp-servers for MCP configuration */
  mcpServers: boolean;
  /** Supports --system-prompt */
  systemPrompt: boolean;
  /** Supports --agents for subagent definitions */
  subagents: boolean;
  /** Supports --allowed-tools for tool permissions */
  allowedTools: boolean;
  /** Supports --permission-mode for autonomous operation */
  permissionMode: boolean;
}

/**
 * Tool use block extracted from assistant message content
 */
export interface ExtractedToolUse {
  id: string;
  name: string;
  input: unknown;
}

/**
 * Tool result block extracted from user message content (136-timeout-spinner-issues)
 * Claude CLI emits tool results in user messages with tool_result content blocks
 */
export interface ExtractedToolResult {
  toolUseId: string;
  output: unknown;
  error?: string;
}

/**
 * Parsed CLI message from stdout
 */
export interface CLIMessage {
  type: string;
  subtype?: string;
  content?: unknown;
  raw: string;
  /** Tool uses extracted from this message */
  toolUses?: ExtractedToolUse[];
  /** Claude session ID (from init message) */
  claudeSessionId?: string;
  /** Tool progress data */
  toolProgress?: {
    toolUseId: string;
    toolName: string;
    parentToolUseId?: string;
    elapsedSeconds?: number;
  };
}

/**
 * Session configuration passed to buildArgs/buildEnv.
 * Mirrors SessionConfig but with resolved values.
 */
export interface CLISessionConfig {
  sessionId: string;
  worktreePath?: string;
  agentContext?: AgentContext;
  claudeSessionIdToResume?: string;
  /** Additional directories to add (for Claude --add-dir) */
  additionalDirs?: string[];
  /** Task ID for background tasks (148-prompt-hierarchy: enables task_update_progress MCP tool) */
  taskId?: string;
}

/**
 * Backend configuration defining how to interact with a CLI tool.
 */
export interface CLIBackendConfig {
  /** Command to execute */
  command: string;
  /** Base arguments to pass */
  args: string[];
  /** Default model for this backend (used when no model specified in agentContext) */
  defaultModel?: string;
  /** Environment variables */
  env?: Record<string, string>;
  /** Feature flags for this backend */
  features?: CLIBackendFeatures;
  /** Parse output message */
  parseMessage: (line: string) => CLIMessage | null;
  /** Format input message */
  formatInput: (message: string) => string;
  /** Check if message indicates completion */
  isComplete: (msg: CLIMessage) => boolean;
  /** Extract text content from message */
  extractContent: (msg: CLIMessage) => string | null;
  /** Extract tool_use blocks from message (for feature parity with ClaudeV2Provider) */
  extractToolUses?: (msg: CLIMessage) => ExtractedToolUse[];
  /** Extract thinking/reasoning content from assistant messages */
  extractThinking?: (msg: CLIMessage) => string | null;
  /** Extract tool_result blocks from user messages (136-timeout-spinner-issues)
   * Claude CLI emits tool results in user messages with tool_result content blocks */
  extractToolResults?: (msg: CLIMessage) => ExtractedToolResult[];
  /** Build full CLI args from session config (for backends with advanced features) */
  buildArgs?: (sessionConfig: CLISessionConfig, baseArgs: string[]) => string[];
  /** Build environment variables from session config */
  buildEnv?: (sessionConfig: CLISessionConfig, baseEnv: Record<string, string>) => Record<string, string>;
}
