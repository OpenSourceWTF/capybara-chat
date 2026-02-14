/**
 * CLI Backend Utilities
 *
 * Shared utilities for CLI backend configurations.
 */

import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { createLogger } from '@capybara-chat/types';
import type { AgentContext, AgentMCPServerConfig } from '@capybara-chat/types';

export const log = createLogger('GenericCLI');

/**
 * OAuth credential paths for each CLI backend.
 * Used to determine if OAuth is available (prefer OAuth over API keys).
 */
export const OAUTH_CREDENTIAL_PATHS: Record<string, string> = {
  claude: '.claude/.credentials.json',
  gemini: '.gemini/settings.json',
  codex: '.codex/auth.json',  // OpenAI Codex stores creds in ~/.codex/auth.json
};

/**
 * Check if OAuth credentials exist for a given backend.
 * Used to prefer OAuth over API key authentication.
 */
export function hasOAuthCredentials(backend: string): boolean {
  const oauthPath = OAUTH_CREDENTIAL_PATHS[backend];
  if (!oauthPath) return false;
  try {
    const fullPath = join(homedir(), oauthPath);
    return existsSync(fullPath);
  } catch {
    return false;
  }
}

/**
 * Build MCP servers configuration for Claude CLI.
 * Merges huddle-mcp (always included) with agent-specific MCP servers.
 *
 * Set MCP_DISABLED=true to skip MCP configuration entirely (for debugging).
 */
export function buildMcpServersConfig(
  sessionId: string,
  agentMcpServers?: AgentMCPServerConfig[],
  userId?: string
): Record<string, { command: string; args: string[]; env: Record<string, string> }> {
  // Allow disabling MCP entirely for debugging CLI issues
  if (process.env.MCP_DISABLED === 'true') {
    log.warn('MCP servers disabled via MCP_DISABLED env var', { sessionId });
    return {};
  }

  // NOTE: This path might need adjustment for the new monorepo if huddle-mcp is moved
  // But for now, we'll keep the env var override
  const huddleCliPath = process.env.MCP_HUDDLE_CLI_PATH || '/app/packages/huddle-mcp/src/cli.ts';

  // 032-multitenancy: Common env vars for all MCP servers
  const commonEnv: Record<string, string> = {
    SESSION_ID: sessionId,
    CAPYBARA_SERVER_URL: process.env.CAPYBARA_SERVER_URL || 'http://localhost:2279', // Should use env var
    CAPYBARA_API_KEY: process.env.CAPYBARA_API_KEY || '',
    ...(userId ? { CAPYBARA_USER_ID: userId } : {}),
  };

  const servers: Record<string, { command: string; args: string[]; env: Record<string, string> }> = {
    // Huddle MCP: ALWAYS included - provides spec/prompt/document management
    'capybara-huddle': {
      command: 'npx',
      args: ['tsx', huddleCliPath],
      env: {
        ...commonEnv,
        ALLOW_DEV_KEY: process.env.ALLOW_DEV_KEY || 'true',
      },
    },
  };

  // Merge agent-specific MCP servers
  if (agentMcpServers) {
    for (const srv of agentMcpServers) {
      if (!srv.enabled) continue;
      if (servers[srv.name]) continue; // Don't override built-in
      servers[srv.name] = {
        command: srv.command,
        args: srv.args ?? [],
        env: {
          ...(srv.env || {}),
          ...commonEnv,
        },
      };
    }
  }

  return servers;
}

/**
 * Default allowed tools for Claude CLI (same as ClaudeV2Provider).
 */
export const BUILTIN_TOOLS = [
  'Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep',
  'Task', 'WebFetch', 'WebSearch', 'NotebookEdit', 'TodoWrite', 'AskUserQuestion',
];

/**
 * Compute effective tool permissions from agent context.
 */
export function computeEffectiveTools(agentContext?: AgentContext): string[] {
  // Built-in tools: use agent's allowedTools, or fall back to all built-in
  const builtinPerms = agentContext?.allowedTools?.length
    ? agentContext.allowedTools.filter(t => !t.startsWith('mcp__'))
    : BUILTIN_TOOLS;

  // MCP tool permissions: auto-computed from mcpServers
  const mcpPerms = (agentContext?.mcpServers || [])
    .filter(s => s.enabled)
    .map(s => `mcp__${s.name}__*`);

  // Always include Huddle MCP permission
  if (!mcpPerms.includes('mcp__capybara-huddle__*')) {
    mcpPerms.push('mcp__capybara-huddle__*');
  }

  return [...builtinPerms, ...mcpPerms];
}
