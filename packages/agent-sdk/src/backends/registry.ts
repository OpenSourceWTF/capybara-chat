/**
 * Backend Registry
 *
 * Registry of available CLI backends with their configurations.
 */

import type { BackendConfig, BackendRegistry, AgentMessage } from '../types.js';

// ===== Claude CLI Backend =====

// Session ID counter for Claude messages
let claudeSessionIdCounter = 0;

const claudeBackend: BackendConfig = {
  command: 'claude',
  defaultArgs: ['--output-format', 'stream-json', '--input-format', 'stream-json', '--verbose', '-p'],
  capabilities: {
    sessionResume: true,
    sessionFork: false,
    streamJson: true,
    toolUse: true,
    mcp: true,
    modelSelection: true,
    workingDirectory: true,
  },
  parseOutput: (line: string): AgentMessage | null => {
    try {
      const parsed = JSON.parse(line);

      // Handle different message types from Claude CLI
      if (parsed.type === 'assistant') {
        // Full assistant message
        const message = parsed.message;
        if (message?.content && Array.isArray(message.content)) {
          const textContent = message.content
            .filter((b: { type: string }) => b.type === 'text')
            .map((b: { text?: string }) => b.text || '')
            .join('');
          return {
            type: 'message',
            role: 'assistant',
            content: textContent,
            metadata: { uuid: parsed.uuid, sessionId: parsed.session_id },
            raw: line,
            timestamp: Date.now(),
          };
        }
      } else if (parsed.type === 'stream_event') {
        // Streaming delta event
        const event = parsed.event;
        if (event?.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
          return {
            type: 'message',
            role: 'assistant',
            content: event.delta.text,
            delta: true,
            raw: line,
            timestamp: Date.now(),
          };
        }
      } else if (parsed.type === 'result') {
        // Completion result
        return {
          type: 'result',
          metadata: {
            status: parsed.subtype === 'success' ? 'success' : 'error',
            ...parsed,
          },
          raw: line,
          timestamp: Date.now(),
        };
      } else if (parsed.type === 'system') {
        return {
          type: 'message',
          role: 'system',
          content: parsed.message || '',
          metadata: parsed,
          raw: line,
          timestamp: Date.now(),
        };
      }

      // Return raw for unknown types
      return {
        type: parsed.type || 'message',
        metadata: parsed,
        raw: line,
        timestamp: Date.now(),
      };
    } catch {
      return null;
    }
  },
  formatInput: (message: string) => {
    // Claude CLI stream-json input format requires the full SDK message format
    const sessionId = `sdk-session-${++claudeSessionIdCounter}`;
    return JSON.stringify({
      type: 'user',
      message: {
        role: 'user',
        content: message,
      },
      parent_tool_use_id: null,
      session_id: sessionId,
    }) + '\n';
  },
  isComplete: (msg: AgentMessage) => msg.type === 'result',
};

// ===== Gemini CLI Backend =====

const geminiBackend: BackendConfig = {
  command: 'gemini',
  defaultArgs: ['--output-format', 'stream-json'],
  capabilities: {
    sessionResume: true,
    sessionFork: false,
    streamJson: true,
    toolUse: true,
    mcp: true,
    modelSelection: true,
    workingDirectory: false, // Gemini doesn't have --cwd flag
  },
  parseOutput: (line: string): AgentMessage | null => {
    try {
      const parsed = JSON.parse(line);

      if (parsed.type === 'init') {
        return {
          type: 'init',
          metadata: {
            sessionId: parsed.session_id,
            model: parsed.model,
          },
          raw: line,
          timestamp: Date.now(),
        };
      } else if (parsed.type === 'message') {
        return {
          type: 'message',
          role: parsed.role,
          content: parsed.content,
          delta: parsed.delta === true,
          raw: line,
          timestamp: Date.now(),
        };
      } else if (parsed.type === 'result') {
        return {
          type: 'result',
          metadata: {
            status: parsed.status,
            stats: parsed.stats,
          },
          raw: line,
          timestamp: Date.now(),
        };
      } else if (parsed.type === 'tool_use') {
        return {
          type: 'tool_use',
          toolName: parsed.tool_name,
          toolInput: parsed.input,
          toolUseId: parsed.id,
          raw: line,
          timestamp: Date.now(),
        };
      } else if (parsed.type === 'tool_result') {
        return {
          type: 'tool_result',
          toolUseId: parsed.tool_use_id,
          toolOutput: parsed.content,
          raw: line,
          timestamp: Date.now(),
        };
      }

      // Return raw for unknown types
      return {
        type: parsed.type || 'message',
        metadata: parsed,
        raw: line,
        timestamp: Date.now(),
      };
    } catch {
      return null;
    }
  },
  // Gemini uses positional argument for message, not stdin
  // This is handled specially in the client
  formatInput: (message: string) => message,
  isComplete: (msg: AgentMessage) => msg.type === 'result',
};

// ===== Aider CLI Backend =====

const aiderBackend: BackendConfig = {
  command: 'aider',
  defaultArgs: ['--no-pretty', '--yes'],
  capabilities: {
    sessionResume: false,
    sessionFork: false,
    streamJson: false, // Aider outputs plain text
    toolUse: true,
    mcp: false,
    modelSelection: true,
    workingDirectory: true,
  },
  parseOutput: (line: string): AgentMessage | null => {
    // Aider outputs plain text, so we just wrap it as a message
    if (line.trim()) {
      return {
        type: 'message',
        role: 'assistant',
        content: line,
        delta: true,
        raw: line,
        timestamp: Date.now(),
      };
    }
    return null;
  },
  formatInput: (message: string) => message + '\n',
  isComplete: (msg: AgentMessage) => {
    // Aider doesn't have a clear completion marker in plain text mode
    // We'll need to use timeout or pattern matching
    return false;
  },
};

// ===== Registry Implementation =====

class BackendRegistryImpl implements BackendRegistry {
  private backends = new Map<string, BackendConfig>();

  constructor() {
    // Register built-in backends
    this.register('claude', claudeBackend);
    this.register('gemini', geminiBackend);
    this.register('aider', aiderBackend);
  }

  get(name: string): BackendConfig | undefined {
    return this.backends.get(name);
  }

  register(name: string, config: BackendConfig): void {
    this.backends.set(name, config);
  }

  list(): string[] {
    return Array.from(this.backends.keys());
  }
}

// Singleton registry
export const backendRegistry = new BackendRegistryImpl();

// Export individual backends for direct use
export { claudeBackend, geminiBackend, aiderBackend };
