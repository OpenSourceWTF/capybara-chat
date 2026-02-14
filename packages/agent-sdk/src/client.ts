/**
 * Agent Client
 *
 * Main client for interacting with CLI-based AI agents.
 * Uses one-shot execution per message with session resumption for multi-turn.
 * Supports plugins for extensibility.
 */

import { spawn } from 'child_process';
import { createInterface } from 'readline';
import { backendRegistry } from './backends/registry.js';
import type {
  AgentClient,
  AgentClientConfig,
  AgentMessage,
  AgentResult,
  BackendConfig,
  BackendCapabilities,
  Plugin,
  Session,
  SessionConfig,
} from './types.js';

// ===== Simple ID Generator =====

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// ===== Debug Logger =====

function createLogger(debug: boolean) {
  return {
    debug: (...args: unknown[]) => {
      if (debug) console.log('[agent-sdk]', ...args);
    },
    info: (...args: unknown[]) => console.log('[agent-sdk]', ...args),
    error: (...args: unknown[]) => console.error('[agent-sdk]', ...args),
  };
}

// ===== Client Implementation =====

export class AgentClientImpl implements AgentClient {
  readonly name: string;
  readonly backend: BackendConfig;
  readonly plugins: Plugin[] = [];

  private config: AgentClientConfig;
  private sessions = new Map<string, Session>();
  private log: ReturnType<typeof createLogger>;

  constructor(config: AgentClientConfig) {
    this.config = config;
    this.log = createLogger(config.debug ?? false);

    // Resolve backend
    if (config.customBackend) {
      this.backend = config.customBackend;
      this.name = `agent-sdk-custom`;
    } else {
      const backend = backendRegistry.get(config.backend);
      if (!backend) {
        throw new Error(`Unknown backend: ${config.backend}. Available: ${backendRegistry.list().join(', ')}`);
      }
      this.backend = backend;
      this.name = `agent-sdk-${config.backend}`;
    }

    // Register plugins
    if (config.plugins) {
      for (const plugin of config.plugins) {
        this.use(plugin);
      }
    }

    this.log.debug('Client created', { backend: config.backend, plugins: this.plugins.map(p => p.name) });
  }

  async isAvailable(): Promise<boolean> {
    try {
      const { execSync } = await import('child_process');
      execSync(`which ${this.backend.command}`, { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  async createSession(sessionConfig: SessionConfig = {}): Promise<Session> {
    const sessionId = generateId();
    this.log.debug('Creating session', { sessionId });

    // Apply plugin beforeCreateSession hooks
    let config = { ...sessionConfig };
    for (const plugin of this.plugins) {
      if (plugin.beforeCreateSession) {
        config = plugin.beforeCreateSession(config, this.backend);
      }
    }

    const now = Date.now();
    const session: Session = {
      id: sessionId,
      backendName: this.config.backend,
      status: 'running',
      startedAt: now,
      lastActivityAt: now,
      config,
    };

    this.sessions.set(sessionId, session);

    // Apply plugin afterCreateSession hooks
    for (const plugin of this.plugins) {
      if (plugin.afterCreateSession) {
        await plugin.afterCreateSession(session);
      }
    }

    return session;
  }

  async *streamMessages(sessionId: string, message: string): AsyncGenerator<AgentMessage> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    session.lastActivityAt = Date.now();

    // Apply plugin beforeSendMessage hooks
    let processedMessage = message;
    for (const plugin of this.plugins) {
      if (plugin.beforeSendMessage) {
        processedMessage = plugin.beforeSendMessage(sessionId, processedMessage);
      }
    }

    // Build arguments
    const args = [...this.backend.defaultArgs];

    // Add model if supported and specified
    const model = session.config.model ?? this.config.model;
    if (model && this.backend.capabilities.modelSelection) {
      args.push('--model', model);
    }

    // Add working directory if supported and specified
    const cwd = session.config.cwd ?? this.config.cwd;
    if (cwd && this.backend.capabilities.workingDirectory) {
      args.push('--cwd', cwd);
    }

    // Add extra args (may include --resume from plugins)
    if (session.config.extraArgs) {
      args.push(...session.config.extraArgs);
    }

    // Add message as appropriate for the backend
    if (this.config.backend === 'gemini') {
      // Gemini uses positional argument
      args.push(processedMessage);
    } else if (this.config.backend === 'claude') {
      // Claude uses stdin with -p flag (already in defaultArgs)
      // We'll pipe the message
    }

    // Build environment
    const env = {
      ...process.env,
      ...this.config.env,
      ...session.config.env,
    };

    this.log.debug('Spawning process', { command: this.backend.command, args: args.slice(0, 10) });

    const childProcess = spawn(this.backend.command, args, {
      cwd: cwd,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // For Claude, send message via stdin
    if (this.config.backend === 'claude') {
      const input = this.backend.formatInput(processedMessage);
      this.log.debug('Writing to stdin', { sessionId, input: input.substring(0, 100) });
      childProcess.stdin?.write(input);
      childProcess.stdin?.end();
    } else {
      // For Gemini and others using positional args, close stdin
      childProcess.stdin?.end();
    }

    const readline = createInterface({
      input: childProcess.stdout!,
      crlfDelay: Infinity,
    });

    // Log stderr
    let stderrOutput = '';
    childProcess.stderr?.on('data', (data) => {
      const text = data.toString();
      stderrOutput += text;
      this.log.debug('stderr', { sessionId, data: text.trim() });
    });

    // Store the real session ID from the backend for resumption
    let backendSessionId: string | null = null;

    // Stream responses
    for await (const line of readline) {
      this.log.debug('Received line', { sessionId, line: line.substring(0, 200) });

      let msg = this.backend.parseOutput(line);
      if (!msg) continue;

      // Extract session ID from init message for resumption
      if (msg.type === 'init' && msg.metadata) {
        const initMeta = msg.metadata as { sessionId?: string };
        if (initMeta.sessionId) {
          backendSessionId = initMeta.sessionId;
          // Update session config for future resumption
          session.config.extraArgs = session.config.extraArgs || [];
          if (!session.config.extraArgs.includes('--resume')) {
            session.config.extraArgs.push('--resume', backendSessionId);
          }
          this.log.debug('Captured backend session ID for resumption', { backendSessionId });
        }
      }

      // Apply plugin afterReceiveMessage hooks
      for (const plugin of this.plugins) {
        if (plugin.afterReceiveMessage) {
          msg = plugin.afterReceiveMessage(sessionId, msg);
        }
      }

      yield msg;

      if (this.backend.isComplete(msg)) {
        break;
      }
    }

    // Wait for process to exit
    await new Promise<void>((resolve) => {
      childProcess.on('exit', (code) => {
        this.log.debug('Process exited', { sessionId, code });
        if (code !== 0 && stderrOutput) {
          this.log.debug('stderr output', { stderrOutput });
        }
        resolve();
      });
    });
  }

  async sendMessage(sessionId: string, message: string): Promise<AgentResult> {
    let finalResult: AgentResult = {
      type: 'result',
      status: 'success',
    };

    for await (const msg of this.streamMessages(sessionId, message)) {
      if (msg.type === 'result') {
        const metadata = msg.metadata as Record<string, unknown> | undefined;
        finalResult = {
          type: 'result',
          status: (metadata?.status as 'success' | 'error') || 'success',
          stats: metadata?.stats as AgentResult['stats'],
        };
      }
    }

    return finalResult;
  }

  async stopSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    this.log.debug('Stopping session', { sessionId });

    // Apply plugin onSessionStop hooks
    for (const plugin of this.plugins) {
      if (plugin.onSessionStop) {
        await plugin.onSessionStop(sessionId);
      }
    }

    session.status = 'stopped';
    this.sessions.delete(sessionId);
  }

  getActiveSessions(): Session[] {
    return Array.from(this.sessions.values());
  }

  use(plugin: Plugin): void {
    this.plugins.push(plugin);
    this.log.debug('Plugin registered', { name: plugin.name, version: plugin.version });

    if (plugin.onRegister) {
      plugin.onRegister(this);
    }
  }

  getCapabilities(): BackendCapabilities {
    return { ...this.backend.capabilities };
  }
}

// ===== Factory Functions =====

export function createClient(config: AgentClientConfig): AgentClient {
  return new AgentClientImpl(config);
}

export function createClaudeClient(options?: Partial<AgentClientConfig>): AgentClient {
  return new AgentClientImpl({ backend: 'claude', ...options });
}

export function createGeminiClient(options?: Partial<AgentClientConfig>): AgentClient {
  return new AgentClientImpl({ backend: 'gemini', ...options });
}

export function createAiderClient(options?: Partial<AgentClientConfig>): AgentClient {
  return new AgentClientImpl({ backend: 'aider', ...options });
}
