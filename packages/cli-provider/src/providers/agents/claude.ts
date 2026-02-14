/**
 * Claude CLI Backend
 *
 * Full-featured Claude Code CLI integration with feature parity to ClaudeV2Provider.
 */

import type { CLIBackendConfig, CLISessionConfig, CLIMessage, ExtractedToolUse, ExtractedToolResult } from './types.js';
import { hasOAuthCredentials, computeEffectiveTools, log } from './utils.js';
import { MODEL_DEFAULTS, resolveModelToApiString } from '@capybara-chat/types';

export const CLAUDE_BACKEND: CLIBackendConfig = {
  command: 'claude',
  // --print is REQUIRED for non-interactive mode (piped stdin)
  // Without it, CLI starts interactive session and ignores stdin
  args: ['--print', '--output-format', 'stream-json', '--input-format', 'stream-json', '--verbose'],
  defaultModel: MODEL_DEFAULTS.CLAUDE_SONNET,
  features: {
    sessionResume: true,
    mcpServers: true,
    systemPrompt: true,
    subagents: true,
    allowedTools: true,
    permissionMode: true,
  },

  buildArgs: (config: CLISessionConfig, baseArgs: string[]): string[] => {
    const args = [...baseArgs];
    const ctx = config.agentContext;

    // Model selection: resolve short name (e.g. 'opus-latest') to API string (e.g. 'claude-opus-4-6')
    const model = resolveModelToApiString(ctx?.model);
    args.push('--model', model);

    // NOTE: Claude Code does NOT have a --cwd flag.
    // Working directory is set via spawn() cwd option, not CLI flag.

    // Additional directories (--add-dir for each additional path)
    // Useful when agent needs access to multiple projects
    if (config.additionalDirs?.length) {
      for (const dir of config.additionalDirs) {
        args.push('--add-dir', dir);
      }
    }

    // Session resume (--resume or -r)
    if (config.claudeSessionIdToResume) {
      args.push('--resume', config.claudeSessionIdToResume);
    }

    // System prompt (replaces entire default prompt)
    if (ctx?.systemPrompt) {
      args.push('--system-prompt', ctx.systemPrompt);
    }

    // Permission mode: for autonomous operation, use --dangerously-skip-permissions
    // BUT: Claude CLI rejects this flag when running as root for security reasons
    const isRoot = process.getuid?.() === 0;
    if (!isRoot) {
      args.push('--dangerously-skip-permissions');
    } else {
      log.warn('Running as root - cannot use --dangerously-skip-permissions, using allowedTools only', {
        sessionId: config.sessionId,
      });
    }

    // Allowed tools (--allowedTools, camelCase per official docs)
    // These execute without prompting for permission
    const effectiveTools = computeEffectiveTools(ctx);
    for (const tool of effectiveTools) {
      args.push('--allowedTools', tool);
    }

    // MCP servers: DO NOT use --mcp-config flag!
    // There's a bug in Claude CLI 2.1.29 where --mcp-config causes the process to hang.
    // Instead, MCP servers are pre-configured via `claude mcp add` in the container entrypoint.
    // SESSION_ID is passed via environment variable (see buildEnv below).
    // See: docker/agent-bridge/entrypoint.sh for MCP configuration

    // Subagents (--agents with JSON object)
    if (ctx?.subagents && Object.keys(ctx.subagents).length > 0) {
      args.push('--agents', JSON.stringify(ctx.subagents));
      log.info('Passing subagents to Claude CLI', {
        sessionId: config.sessionId,
        subagentCount: Object.keys(ctx.subagents).length,
        subagentNames: Object.keys(ctx.subagents),
      });
    }

    return args;
  },

  buildEnv: (config: CLISessionConfig, baseEnv: Record<string, string>): Record<string, string> => {
    const env = { ...baseEnv };

    // Pass SESSION_ID for MCP servers (they inherit env from Claude CLI process)
    // This is required because --mcp-config flag is broken in CLI 2.1.29
    env.SESSION_ID = config.sessionId;

    // 148-prompt-hierarchy: Pass TASK_ID for task_update_progress MCP tool
    // This enables agents to report progress during task execution
    if (config.taskId) {
      env.TASK_ID = config.taskId;

      // Force all subagents to run in foreground during task execution.
      // Background subagents don't have MCP access (Claude CLI limitation),
      // so analyzers/writers spawned via Task tool would fail to call MCP tools.
      // Foreground subagents inherit MCP from parent → tools work.
      env.CLAUDE_CODE_DISABLE_BACKGROUND_TASKS = '1';
    }

    // 032-multitenancy: Pass user identity for scoped MCP API calls
    // MCP servers inherit env from the Claude CLI process
    if (config.agentContext?.userId) {
      env.CAPYBARA_USER_ID = config.agentContext.userId;
    }

    // OAuth only - CLI mode requires mounted OAuth credentials
    // API key auth is NOT supported for CLI provider (use SDK mode with gateway instead)
    if (hasOAuthCredentials('claude')) {
      log.debug('Using OAuth credentials for Claude CLI');
    } else {
      log.warn('No OAuth credentials found at ~/.claude/.credentials.json - CLI will fail');
    }
    return env;
  },

  parseMessage: (line: string): CLIMessage | null => {
    try {
      const parsed = JSON.parse(line);
      const msg: CLIMessage = {
        type: parsed.type,
        subtype: parsed.subtype,
        content: parsed,
        raw: line,
      };

      // Capture session ID from init message
      if (parsed.type === 'system' && parsed.subtype === 'init' && parsed.session_id) {
        msg.claudeSessionId = parsed.session_id;
      }

      // Capture tool progress
      if (parsed.type === 'tool_progress') {
        msg.toolProgress = {
          toolUseId: parsed.tool_use_id,
          toolName: parsed.tool_name,
          parentToolUseId: parsed.parent_tool_use_id,
          elapsedSeconds: parsed.elapsed_time_seconds,
        };
      }

      return msg;
    } catch {
      return null;
    }
  },

  formatInput: (message: string) => JSON.stringify({
    type: 'user',
    message: { role: 'user', content: message }
  }) + '\n',
  isComplete: (msg: CLIMessage) => msg.type === 'result',

  extractContent: (msg: CLIMessage) => {
    const content = msg.content as Record<string, unknown>;
    if (msg.type === 'assistant' && content?.message) {
      const message = content.message as { content?: Array<{ type: string; text?: string }> };
      if (Array.isArray(message.content)) {
        return message.content
          .filter(b => b.type === 'text')
          .map(b => b.text || '')
          .join('\n\n');
      }
    }
    return null;
  },

  extractToolUses: (msg: CLIMessage): ExtractedToolUse[] => {
    const content = msg.content as Record<string, unknown>;
    if (msg.type === 'assistant' && content?.message) {
      const message = content.message as { content?: Array<{ type: string; id?: string; name?: string; input?: unknown }> };
      if (Array.isArray(message.content)) {
        return message.content
          .filter(b => b.type === 'tool_use')
          .map(b => ({
            id: b.id ?? '',
            name: b.name ?? '',
            input: b.input,
          }));
      }
    }
    return [];
  },

  extractThinking: (msg: CLIMessage): string | null => {
    const content = msg.content as Record<string, unknown>;
    if (msg.type === 'assistant' && content?.message) {
      const message = content.message as { content?: Array<{ type: string; thinking?: string }> };
      if (Array.isArray(message.content)) {
        const thinking = message.content
          .filter(b => b.type === 'thinking')
          .map(b => b.thinking ?? '')
          .join('\n');
        return thinking || null;
      }
    }
    return null;
  },

  extractToolResults: (msg: CLIMessage): ExtractedToolResult[] => {
    const content = msg.content as Record<string, unknown>;
    // Tool results come in user messages with tool_result content blocks
    if (msg.type === 'user' && content?.message) {
      const message = content.message as {
        role?: string;
        content?: Array<{
          type: string;
          tool_use_id?: string;
          content?: unknown;
          is_error?: boolean;
        }>
      };
      if (message.role === 'user' && Array.isArray(message.content)) {
        return message.content
          .filter(b => b.type === 'tool_result')
          .map(b => ({
            toolUseId: b.tool_use_id ?? '',
            output: b.content,
            error: b.is_error ? String(b.content) : undefined,
          }));
      }
    }
    return [];
  },
};
