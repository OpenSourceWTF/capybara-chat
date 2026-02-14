/**
 * Agent SDK Types
 *
 * Unified types for multi-backend CLI agent wrapper.
 */

// ===== Core Enums =====

export const AgentMessageType = {
  MESSAGE: 'message',
  TOOL_USE: 'tool_use',
  TOOL_RESULT: 'tool_result',
  ERROR: 'error',
  INIT: 'init',
  RESULT: 'result',
} as const;
export type AgentMessageType = (typeof AgentMessageType)[keyof typeof AgentMessageType];

export const AgentMessageRole = {
  USER: 'user',
  ASSISTANT: 'assistant',
  SYSTEM: 'system',
} as const;
export type AgentMessageRole = (typeof AgentMessageRole)[keyof typeof AgentMessageRole];

export const AgentResultStatus = {
  SUCCESS: 'success',
  ERROR: 'error',
  INTERRUPTED: 'interrupted',
} as const;
export type AgentResultStatus = (typeof AgentResultStatus)[keyof typeof AgentResultStatus];

/**
 * Backend process status (distinct from application-level SessionStatus in @capybara/types)
 * Represents the state of the CLI process, not the workflow state.
 */
export const BackendSessionStatus = {
  STARTING: 'starting',
  RUNNING: 'running',
  STOPPED: 'stopped',
  ERROR: 'error',
} as const;
export type BackendSessionStatus = (typeof BackendSessionStatus)[keyof typeof BackendSessionStatus];

// ===== Core Message Types =====

export interface AgentMessage {
  type: AgentMessageType;
  role?: AgentMessageRole;
  content?: string;
  delta?: boolean;
  toolUseId?: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  toolOutput?: string;
  error?: string;
  metadata?: Record<string, unknown>;
  raw?: string;
  timestamp?: number;
}

export interface AgentResult {
  type: 'result';
  status: AgentResultStatus;
  stats?: {
    totalTokens?: number;
    inputTokens?: number;
    outputTokens?: number;
    durationMs?: number;
    toolCalls?: number;
  };
}

// ===== Backend Configuration =====

export interface BackendConfig {
  /** CLI command to execute */
  command: string;
  /** Default arguments */
  defaultArgs: string[];
  /** Environment variables */
  env?: Record<string, string>;
  /** Parser for stdout lines */
  parseOutput: (line: string) => AgentMessage | null;
  /** Format input for stdin */
  formatInput: (message: string) => string;
  /** Check if message indicates completion */
  isComplete: (msg: AgentMessage) => boolean;
  /** Backend capabilities */
  capabilities: BackendCapabilities;
}

export interface BackendCapabilities {
  /** Supports session resumption */
  sessionResume?: boolean;
  /** Supports session forking */
  sessionFork?: boolean;
  /** Supports streaming JSON output */
  streamJson?: boolean;
  /** Supports tool use */
  toolUse?: boolean;
  /** Supports MCP servers */
  mcp?: boolean;
  /** Supports model selection */
  modelSelection?: boolean;
  /** Supports working directory setting */
  workingDirectory?: boolean;
}

// ===== Session Types =====

export interface SessionConfig {
  /** Model to use (if supported) */
  model?: string;
  /** Working directory */
  cwd?: string;
  /** Additional environment variables */
  env?: Record<string, string>;
  /** System prompt */
  systemPrompt?: string;
  /** Additional CLI arguments */
  extraArgs?: string[];
}

export interface Session {
  id: string;
  backendName: string;
  status: BackendSessionStatus;
  startedAt: number;
  lastActivityAt: number;
  config: SessionConfig;
}

// ===== Plugin System =====

export interface Plugin {
  /** Plugin name */
  name: string;
  /** Plugin version */
  version: string;
  /** Called when plugin is registered */
  onRegister?: (client: AgentClient) => void | Promise<void>;
  /** Called before session creation */
  beforeCreateSession?: (config: SessionConfig, backend: BackendConfig) => SessionConfig;
  /** Called after session creation */
  afterCreateSession?: (session: Session) => void | Promise<void>;
  /** Called before sending message */
  beforeSendMessage?: (sessionId: string, message: string) => string;
  /** Called after receiving message */
  afterReceiveMessage?: (sessionId: string, message: AgentMessage) => AgentMessage;
  /** Called on session stop */
  onSessionStop?: (sessionId: string) => void | Promise<void>;
}

// ===== Client Interface =====

export interface AgentClientConfig {
  /** Backend to use */
  backend: string;
  /** Custom backend config (overrides built-in) */
  customBackend?: BackendConfig;
  /** Default model */
  model?: string;
  /** Working directory */
  cwd?: string;
  /** Environment variables */
  env?: Record<string, string>;
  /** Plugins to load */
  plugins?: Plugin[];
  /** Debug mode */
  debug?: boolean;
}

export interface AgentClient {
  /** Client name */
  readonly name: string;
  /** Currently active backend */
  readonly backend: BackendConfig;
  /** Registered plugins */
  readonly plugins: Plugin[];

  /** Check if backend CLI is available */
  isAvailable(): Promise<boolean>;

  /** Create a new session */
  createSession(config?: SessionConfig): Promise<Session>;

  /** Resume an existing session (if supported) */
  resumeSession?(sessionId: string): Promise<Session>;

  /** Fork an existing session (if supported) */
  forkSession?(sessionId: string): Promise<Session>;

  /** Send a message and stream responses */
  streamMessages(sessionId: string, message: string): AsyncGenerator<AgentMessage>;

  /** Send a message and get final result */
  sendMessage(sessionId: string, message: string): Promise<AgentResult>;

  /** Stop a session */
  stopSession(sessionId: string): Promise<void>;

  /** Get active sessions */
  getActiveSessions(): Session[];

  /** Register a plugin */
  use(plugin: Plugin): void;

  /** Get backend capabilities */
  getCapabilities(): BackendCapabilities;
}

// ===== Backend Registry =====

export const BackendName = {
  CLAUDE: 'claude',
  GEMINI: 'gemini',
  AIDER: 'aider',
  CUSTOM: 'custom',
} as const;
export type BackendName = (typeof BackendName)[keyof typeof BackendName];

export interface BackendRegistry {
  get(name: string): BackendConfig | undefined;
  register(name: string, config: BackendConfig): void;
  list(): string[];
}
