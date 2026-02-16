/**
 * Generic CLI Provider
 *
 * A wrapper that provides Claude Agent SDK-compatible API for multiple CLI backends.
 * Supports Claude Code, Gemini CLI, Ollama, OpenAI, and can be extended for others.
 */

import { spawn, ChildProcess } from 'child_process';
import { Readable } from 'stream';
import { now } from '@capybara-chat/types';
import type {
  AgentProvider,
  SessionConfig,
  SessionHandle,
  AgentProviderEvent,
  AgentContext,
} from '@capybara-chat/types';

// Import backend configurations from agents directory
import {
  BACKENDS,
  log,
  type CLIBackendConfig,
  type CLIBackendFeatures,
  type CLIMessage,
  type CLISessionConfig,
} from './agents/index.js';

// Re-export types for backwards compatibility
export type { CLIBackendConfig, CLIBackendFeatures, CLIMessage, CLISessionConfig } from './agents/index.js';
export type { ExtractedToolUse, ExtractedToolResult } from './agents/index.js';

// ===== Types =====

export const CLIBackend = {
  CLAUDE: 'claude',
  GEMINI: 'gemini',
  OLLAMA: 'ollama',
  CODEX: 'codex',    // OpenAI Codex CLI (official)
  OPENAI: 'openai',  // Alias for codex (backwards compatibility)
  CUSTOM: 'custom',
} as const;
export type CLIBackend = (typeof CLIBackend)[keyof typeof CLIBackend];

export interface GenericCLIConfig {
  backend: CLIBackend;
  /** Custom backend config (required if backend is 'custom') */
  customConfig?: CLIBackendConfig;
  /** Model to use */
  model?: string;
  /** Working directory */
  cwd?: string;
  /** Additional environment variables */
  env?: Record<string, string>;
  /** Timeout for first response from CLI (ms). Default: 60000 (1 minute) */
  initTimeoutMs?: number;
  /** Timeout between responses during streaming (ms). Default: 300000 (5 minutes) */
  responseTimeoutMs?: number;
  /** Disable internal timeout handling */
  noInternalTimeout?: boolean;
}

// ===== Error Classes =====

export class CLIError extends Error {
  constructor(
    message: string,
    public readonly sessionId: string,
    public readonly context: CLIErrorContext
  ) {
    super(message);
    this.name = 'CLIError';
  }

  toDetailedString(): string {
    const lines = [
      `[CLIError] ${this.message}`,
      `  Session: ${this.sessionId}`,
      `  Backend: ${this.context.backend}`,
      `  Command: ${this.context.command}`,
      `  PID: ${this.context.pid ?? 'N/A'}`,
      `  Exit Code: ${this.context.exitCode ?? 'still running'}`,
      `  Runtime: ${this.context.runtimeMs ?? 'N/A'}ms`,
    ];
    if (this.context.stderrTail?.length) {
      lines.push(`  Stderr (last ${this.context.stderrTail.length} lines):`);
      for (const line of this.context.stderrTail) {
        lines.push(`    ${line}`);
      }
    }
    if (this.context.lastInput) {
      lines.push(`  Last Input: ${this.context.lastInput.substring(0, 100)}...`);
    }
    return lines.join('\n');
  }
}

export interface CLIErrorContext {
  backend: string;
  command: string;
  pid?: number;
  exitCode?: number | null;
  killed?: boolean;
  runtimeMs?: number;
  stderrTail?: string[];
  lastInput?: string;
}

export class CLITimeoutError extends CLIError {
  constructor(
    message: string,
    sessionId: string,
    context: CLIErrorContext,
    public readonly timeoutMs: number,
    public readonly phase: 'init' | 'response'
  ) {
    super(message, sessionId, context);
    this.name = 'CLITimeoutError';
  }
}

export class CLIProcessExitError extends CLIError {
  constructor(
    message: string,
    sessionId: string,
    context: CLIErrorContext
  ) {
    super(message, sessionId, context);
    this.name = 'CLIProcessExitError';
  }
}

export class CLIParseError extends CLIError {
  constructor(
    message: string,
    sessionId: string,
    context: CLIErrorContext,
    public readonly rawLine: string
  ) {
    super(message, sessionId, context);
    this.name = 'CLIParseError';
  }
}

const DEFAULT_INIT_TIMEOUT_MS = 60_000;
const DEFAULT_RESPONSE_TIMEOUT_MS = 300_000;

/**
 * Custom line reader that uses explicit read() calls instead of async iterator.
 */
export class LineReader {
  private buffer = '';
  private lines: string[] = [];
  private waitingResolve: ((line: string | null) => void) | null = null;
  private waitingReject: ((error: Error) => void) | null = null;
  private closed = false;
  private closeReason: string | null = null;
  private timeoutHandle: NodeJS.Timeout | null = null;
  private linesRead = 0;
  private bytesRead = 0;

  constructor(private stream: Readable, private sessionId: string) {
    stream.on('readable', () => {
      let chunk;
      while (null !== (chunk = stream.read())) {
        const data = chunk.toString();
        this.bytesRead += data.length;
        this.buffer += data;
        this.processBuffer();
      }
    });

    stream.on('end', () => {
      log.info('LineReader stream ended', {
        sessionId,
        linesRead: this.linesRead,
        bytesRead: this.bytesRead,
        bufferedLines: this.lines.length
      });
      this.closeWithReason('stream ended');
    });

    stream.on('error', (err) => {
      log.error('LineReader stream error', {
        sessionId,
        error: String(err),
        linesRead: this.linesRead,
        bytesRead: this.bytesRead
      });
      this.closeWithReason(`stream error: ${err.message}`);
    });

    stream.on('close', () => {
      if (!this.closed) {
        log.info('LineReader stream closed', { sessionId });
        this.closeWithReason('stream closed');
      }
    });
  }

  private closeWithReason(reason: string): void {
    this.closed = true;
    this.closeReason = reason;
    this.clearTimeout();

    if (this.buffer.length > 0) {
      this.lines.push(this.buffer);
      this.buffer = '';
    }

    if (this.waitingResolve) {
      const resolve = this.waitingResolve;
      this.waitingResolve = null;
      this.waitingReject = null;
      if (this.lines.length > 0) {
        resolve(this.lines.shift()!);
      } else {
        resolve(null);
      }
    }
  }

  private clearTimeout(): void {
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = null;
    }
  }

  private processBuffer(): void {
    const parts = this.buffer.split('\n');
    for (let i = 0; i < parts.length - 1; i++) {
      const line = parts[i];
      if (line.length > 0) {
        this.linesRead++;
        log.debug('LineReader buffered line', {
          sessionId: this.sessionId,
          lineNumber: this.linesRead,
          lineLength: line.length,
          preview: line.substring(0, 80)
        });
        if (this.waitingResolve) {
          this.clearTimeout();
          const resolve = this.waitingResolve;
          this.waitingResolve = null;
          this.waitingReject = null;
          resolve(line);
        } else {
          this.lines.push(line);
        }
      }
    }
    this.buffer = parts[parts.length - 1];
  }

  async nextLine(timeoutMs?: number): Promise<string | null> {
    if (this.lines.length > 0) {
      return this.lines.shift()!;
    }
    if (this.closed) {
      return null;
    }

    return new Promise((resolve, reject) => {
      this.waitingResolve = resolve;
      this.waitingReject = reject;

      if (timeoutMs && timeoutMs > 0) {
        this.timeoutHandle = setTimeout(() => {
          if (this.waitingReject) {
            const error = new Error(
              `Timeout waiting for CLI response after ${timeoutMs}ms. ` +
              `Lines read so far: ${this.linesRead}, bytes: ${this.bytesRead}, ` +
              `buffer size: ${this.buffer.length} chars`
            );
            this.waitingResolve = null;
            this.waitingReject = null;
            reject(error);
          }
        }, timeoutMs);
      }
    });
  }

  async *[Symbol.asyncIterator](): AsyncGenerator<string> {
    while (true) {
      const line = await this.nextLine();
      if (line === null) {
        break;
      }
      yield line;
    }
  }

  close(): void {
    this.closeWithReason('manually closed');
  }

  getDiagnostics() {
    return {
      closed: this.closed,
      closeReason: this.closeReason,
      linesRead: this.linesRead,
      bytesRead: this.bytesRead,
      bufferedLines: this.lines.length,
      bufferSize: this.buffer.length,
    };
  }
}

interface CLISession {
  id: string;
  claudeSessionId?: string;
  process: ChildProcess;
  lineReader: LineReader;
  backend: CLIBackend;
  agentContext?: AgentContext;
  workingDirectory?: string;
  stderrBuffer: string[];
  startedAt: number;
  lastActivityAt: number;
  initialized: boolean;
  lastInput?: string;
  messagesSent: number;
  responsesReceived: number;
  onExit?: () => void;
}

const MAX_STDERR_LINES = 50;

// ===== Generic CLI Provider =====

export class GenericCLIProvider implements AgentProvider {
  name = 'generic-cli';
  displayName = 'Generic CLI';

  private config: GenericCLIConfig;
  private backendConfig: CLIBackendConfig;
  private sessions = new Map<string, CLISession>();
  private eventHandlers = new Map<string, Set<(event: AgentProviderEvent) => void>>();

  constructor(config: GenericCLIConfig) {
    this.config = {
      initTimeoutMs: DEFAULT_INIT_TIMEOUT_MS,
      responseTimeoutMs: DEFAULT_RESPONSE_TIMEOUT_MS,
      ...config,
    };

    if (config.backend === CLIBackend.CUSTOM) {
      if (!config.customConfig) {
        throw new Error('customConfig is required when backend is "custom"');
      }
      this.backendConfig = config.customConfig;
    } else {
      const backend = BACKENDS[config.backend];
      if (!backend) {
        throw new Error(`Unknown backend: ${config.backend}`);
      }
      this.backendConfig = backend;
    }

    this.name = `generic-cli-${config.backend}`;
    this.displayName = `Generic CLI (${config.backend})`;
  }

  private buildErrorContext(session: CLISession): CLIErrorContext {
    return {
      backend: String(session.backend),
      command: this.backendConfig.command,
      pid: session.process.pid,
      exitCode: session.process.exitCode,
      killed: session.process.killed,
      runtimeMs: now() - session.startedAt,
      stderrTail: session.stderrBuffer.slice(-10),
      lastInput: session.lastInput,
    };
  }

  getSessionDiagnostics(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { exists: false };
    }
    return {
      exists: true,
      initialized: session.initialized,
      processAlive: session.process.exitCode === null && !session.process.killed,
      pid: session.process.pid,
      exitCode: session.process.exitCode,
      runtime: now() - session.startedAt,
      messagesSent: session.messagesSent,
      responsesReceived: session.responsesReceived,
      readerDiagnostics: session.lineReader.getDiagnostics(),
      stderrTail: session.stderrBuffer.slice(-5),
    };
  }

  async isAvailable(): Promise<boolean> {
    try {
      const { execSync } = await import('child_process');
      execSync(`which ${this.backendConfig.command}`, { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  getClaudeSessionId(sessionId: string): string | undefined {
    return this.sessions.get(sessionId)?.claudeSessionId;
  }

  getFeatures(): CLIBackendFeatures | undefined {
    return this.backendConfig.features;
  }

  async createSession(sessionConfig: SessionConfig): Promise<SessionHandle> {
    const { sessionId, agentContext, workingDirectory } = sessionConfig;
    log.info('Creating session', {
      sessionId,
      backend: this.config.backend,
      workingDirectory: workingDirectory ?? '(none)',
      hasAgentContext: !!agentContext,
    });

    const stderrBuffer: string[] = [];
    let args: string[];

    if (this.backendConfig.buildArgs) {
      const cliConfig: CLISessionConfig = {
        sessionId,
        workingDirectory: workingDirectory || this.config.cwd,
        agentContext: agentContext || { model: this.config.model },
      };
      args = this.backendConfig.buildArgs(cliConfig, [...this.backendConfig.args]);
    } else {
      args = [...this.backendConfig.args];
      if (this.config.model) {
        args.push('--model', this.config.model);
      }
      if (workingDirectory || this.config.cwd) {
        args.push('--cwd', workingDirectory || this.config.cwd!);
      }
    }

    let env: Record<string, string> = {
      ...process.env as Record<string, string>,
      ...this.config.env,
    };
    if (this.backendConfig.buildEnv) {
      const cliConfig: CLISessionConfig = { sessionId, workingDirectory, agentContext };
      env = this.backendConfig.buildEnv(cliConfig, env);
    }

    log.info('Spawning CLI', {
      sessionId,
      command: this.backendConfig.command,
      argCount: args.length,
      cwd: workingDirectory || this.config.cwd,
    });

    const childProcess = spawn(this.backendConfig.command, args, {
      cwd: workingDirectory || this.config.cwd,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    childProcess.on('error', (err) => {
      log.error('CLI spawn error', {
        sessionId,
        error: err.message,
        command: this.backendConfig.command,
        code: (err as NodeJS.ErrnoException).code,
      });
    });

    const lineReader = new LineReader(childProcess.stdout!, sessionId);

    childProcess.stderr?.on('data', (data) => {
      const lines = data.toString().trim().split('\n');
      for (const line of lines) {
        if (line) {
          stderrBuffer.push(line);
          if (stderrBuffer.length > MAX_STDERR_LINES) {
            stderrBuffer.shift();
          }
          const isError = /error|fail|exception|panic/i.test(line);
          if (isError) {
            log.error('CLI stderr (error detected)', { sessionId, message: line.substring(0, 300) });
          } else {
            log.info('CLI stderr', { sessionId, message: line.substring(0, 200) });
          }
        }
      }
    });

    const session: CLISession = {
      id: sessionId,
      process: childProcess,
      lineReader,
      backend: this.config.backend,
      agentContext,
      workingDirectory,
      stderrBuffer,
      startedAt: now(),
      lastActivityAt: now(),
      initialized: false,
      messagesSent: 0,
      responsesReceived: 0,
    };

    this.sessions.set(sessionId, session);

    childProcess.on('exit', (code) => {
      log.info('CLI process exited', {
        sessionId,
        code,
        runtimeMs: now() - session.startedAt,
        messagesSent: session.messagesSent,
        responsesReceived: session.responsesReceived,
      });
      this.sessions.delete(sessionId);
      session.onExit?.();
    });

    return {
      id: sessionId,
      claudeSessionId: undefined,
      providerId: this.name,
      status: 'running',
      startedAt: session.startedAt,
    };
  }

  async resumeSession(
    sessionId: string,
    claudeSessionId: string,
    workingDirectory?: string,
    agentContext?: AgentContext,
  ): Promise<SessionHandle> {
    log.info('Resuming session', { sessionId, claudeSessionId, workingDirectory: workingDirectory ?? '(none)' });

    const existing = this.sessions.get(sessionId);
    if (existing) {
      log.info('Session already active', { sessionId });
      return {
        id: sessionId,
        claudeSessionId: existing.claudeSessionId,
        providerId: this.name,
        status: 'running',
        startedAt: existing.startedAt,
      };
    }

    if (!this.backendConfig.features?.sessionResume) {
      throw new Error(`Backend ${this.config.backend} does not support session resume`);
    }

    const stderrBuffer: string[] = [];
    let args: string[];

    if (this.backendConfig.buildArgs) {
      const cliConfig: CLISessionConfig = {
        sessionId,
        workingDirectory: workingDirectory || this.config.cwd,
        agentContext: agentContext || { model: this.config.model },
        claudeSessionIdToResume: claudeSessionId,
      };
      args = this.backendConfig.buildArgs(cliConfig, [...this.backendConfig.args]);
    } else {
      args = [...this.backendConfig.args, '--resume', claudeSessionId];
      if (this.config.model) {
        args.push('--model', this.config.model);
      }
      if (workingDirectory || this.config.cwd) {
        args.push('--cwd', workingDirectory || this.config.cwd!);
      }
    }

    let env: Record<string, string> = {
      ...process.env as Record<string, string>,
      ...this.config.env,
    };
    if (this.backendConfig.buildEnv) {
      const cliConfig: CLISessionConfig = { sessionId, workingDirectory, agentContext, claudeSessionIdToResume: claudeSessionId };
      env = this.backendConfig.buildEnv(cliConfig, env);
    }

    log.info('Spawning CLI for resume', {
      sessionId,
      claudeSessionId,
      command: this.backendConfig.command,
      cwd: workingDirectory || this.config.cwd,
    });

    const childProcess = spawn(this.backendConfig.command, args, {
      cwd: workingDirectory || this.config.cwd,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const lineReader = new LineReader(childProcess.stdout!, sessionId);

    childProcess.stderr?.on('data', (data) => {
      const lines = data.toString().trim().split('\n');
      for (const line of lines) {
        if (line) {
          stderrBuffer.push(line);
          if (stderrBuffer.length > MAX_STDERR_LINES) {
            stderrBuffer.shift();
          }
          const isError = /error|fail|exception|panic/i.test(line);
          if (isError) {
            log.error('CLI stderr (error detected)', { sessionId, message: line.substring(0, 300) });
          } else {
            log.info('CLI stderr', { sessionId, message: line.substring(0, 200) });
          }
        }
      }
    });

    const session: CLISession = {
      id: sessionId,
      claudeSessionId,
      process: childProcess,
      lineReader,
      backend: this.config.backend,
      agentContext,
      workingDirectory,
      stderrBuffer,
      startedAt: now(),
      lastActivityAt: now(),
      initialized: true,
      messagesSent: 0,
      responsesReceived: 0,
    };

    this.sessions.set(sessionId, session);

    childProcess.on('exit', (code) => {
      log.info('CLI resume process exited', { sessionId, code });
      this.sessions.delete(sessionId);
      session.onExit?.();
    });

    return {
      id: sessionId,
      claudeSessionId,
      providerId: this.name,
      status: 'running',
      startedAt: session.startedAt,
    };
  }

  async forkSession(sessionId: string, newSessionId: string, workingDirectory?: string): Promise<SessionHandle> {
    throw new Error('Fork session not implemented for CLI provider yet');
  }

  async sendMessage(sessionId: string, message: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const input = this.backendConfig.formatInput(message);
    log.debug('Writing to stdin', { sessionId, inputLength: input.length });

    session.lastInput = input;
    session.messagesSent++;
    session.lastActivityAt = now();

    if (!session.process.stdin?.writable) {
      throw new Error(`CLI process stdin not writable for session ${sessionId}`);
    }

    session.process.stdin.write(input);
  }

  async stopSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    log.info('Stopping session', { sessionId });
    // Soft kill first
    session.process.kill('SIGTERM');

    // Wait and force kill if needed
    setTimeout(() => {
      if (session.process.exitCode === null) {
        log.warn('Force killing session', { sessionId });
        session.process.kill('SIGKILL');
      }
    }, 5000);
  }

  onEvent(sessionId: string, handler: (event: AgentProviderEvent) => void): () => void {
    if (!this.eventHandlers.has(sessionId)) {
      this.eventHandlers.set(sessionId, new Set());
    }
    this.eventHandlers.get(sessionId)!.add(handler);
    return () => {
      this.eventHandlers.get(sessionId)?.delete(handler);
      if (this.eventHandlers.get(sessionId)?.size === 0) {
        this.eventHandlers.delete(sessionId);
      }
    };
  }

  private emit(sessionId: string, event: AgentProviderEvent) {
    const handlers = this.eventHandlers.get(sessionId);
    if (handlers) {
      handlers.forEach(h => h(event));
    }
  }

  async *streamMessages(
    sessionId: string,
    message: string
  ): AsyncGenerator<{ type: string; content?: string; data?: unknown }> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // Send message (unless it's an init resume where we just listen)
    if (message) {
      await this.sendMessage(sessionId, message);
    }

    try {
      while (true) {
        const timeoutMs = session.initialized ? this.config.responseTimeoutMs : this.config.initTimeoutMs;
        const line = await session.lineReader.nextLine(this.config.noInternalTimeout ? 0 : timeoutMs);

        if (line === null) {
          // Stream ended
          if (session.process.exitCode !== null && session.process.exitCode !== 0) {
            throw new CLIProcessExitError(
              'CLI process exited unexpectedly',
              sessionId,
              this.buildErrorContext(session)
            );
          }
          break;
        }

        const msg = this.backendConfig.parseMessage(line);
        if (!msg) {
          log.warn('Unparseable CLI output', { sessionId, line: line.substring(0, 100) });
          // Emit error event but don't crash stream unless necessary
          continue;
        }

        // Handle init (Claude session ID)
        if (msg.claudeSessionId) {
          session.claudeSessionId = msg.claudeSessionId;
          session.initialized = true;
          log.info('Captured Claude session ID', { sessionId, claudeSessionId: msg.claudeSessionId });
        }

        // Handle content extraction
        const content = this.backendConfig.extractContent(msg);
        if (content) {
          yield { type: 'message', content };
        }

        // Handle tool uses
        if (this.backendConfig.extractToolUses && msg.toolUses) {
          yield { type: 'tool_use', data: msg.toolUses };
        }
        // Also try manual extraction if backend doesn't populate toolUses directly
        const toolUses = this.backendConfig.extractToolUses ? this.backendConfig.extractToolUses(msg) : undefined;
        if (toolUses && toolUses.length > 0) {
          yield { type: 'tool_use', data: toolUses };
        }

        // Handle thinking
        if (this.backendConfig.extractThinking) {
          const thinking = this.backendConfig.extractThinking(msg);
          if (thinking) {
            yield { type: 'thinking', content: thinking };
          }
        }

        // Handle tool results (from user message in Claude CLI)
        if (this.backendConfig.extractToolResults) {
          const toolResults = this.backendConfig.extractToolResults(msg);
          if (toolResults && toolResults.length > 0) {
            yield { type: 'tool_result', data: toolResults };
          }
        }

        // Handle tool progress
        if (msg.toolProgress) {
          yield { type: 'progress', data: msg.toolProgress };
        }

        if (this.backendConfig.isComplete(msg)) {
          session.responsesReceived++;
          yield { type: 'complete', data: msg.content };
          break;
        }
      }
    } catch (err: unknown) {
      const error = err as Error;
      // Handle timeout specifically
      if (error instanceof CLIError || error.message.includes('Timeout')) {
        throw error; // Re-throw wrapped errors
      }
      throw new Error(`Stream error: ${error.message}`);
    }
  }
}

/**
 * Factory for creating a Claude CLI provider
 */
export function createClaudeCLIProvider(config?: Partial<GenericCLIConfig>): GenericCLIProvider {
  return new GenericCLIProvider({
    backend: CLIBackend.CLAUDE,
    ...config,
  });
}
