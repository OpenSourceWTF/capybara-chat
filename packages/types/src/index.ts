/**
 * Capybara Chat Data Primitives
 *
 * Core entities for the chat application.
 */

export * from './enums.js';
export * from './utils.js';
export * from './events.js';
export * from './schemas.js';
export * from './errors.js';

export const CORS_DEFAULTS = {
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'x-api-key', 'x-user-id', 'x-user-role'],
  exposedHeaders: ['x-user-id', 'x-user-role'],
  credentials: true,
  maxAge: 86400,
  DEVELOPMENT_ORIGINS: [
    'http://localhost:5173',
    'http://localhost:3279',
    'http://localhost:3281',
  ] as const,
  PRODUCTION_ORIGINS: [] as readonly string[],
} as const;

import {
  SessionStatus,
  SessionType,
  AgentModel,
  SEGMENT_COLORS,
  SessionMode,
  FormEntityType,
  EntityStatus,
  PromptOutputType,
  AgentDefinitionRole,
  DocumentType,
  DocumentCreatedBy,
  SOCKET_EVENTS,
  MessageStatus,
  MessageRole,
  AttachmentType,
  SecretScope,
  EventEntityType,
  ActorType,
} from './enums.js';

export const SOCKET_DEFAULTS = {
  RECONNECTION_ATTEMPTS: 5,
  RECONNECTION_DELAY: 1000,
  RECONNECTION: true,
} as const;

export const API_PATHS = {
  SESSIONS: '/api/sessions',
  PROMPTS: '/api/prompts',
  DOCUMENTS: '/api/documents',
  SETTINGS: '/api/settings',
  AGENT_DEFINITIONS: '/api/agent-definitions',
} as const;

export const sessionPath = (sessionId: string, subPath?: string) =>
  `${API_PATHS.SESSIONS}/${sessionId}${subPath ? `/${subPath}` : ''}`;

export const entityPath = (basePath: string, id: string, subPath?: string) =>
  `${basePath}/${id}${subPath ? `/${subPath}` : ''}`;

// ===== User & Auth =====

/**
 * User roles: admin has full access, member sees own + published assets
 */
export const UserRoleConst = {
  ADMIN: 'admin',
  MEMBER: 'member',
} as const;
export type UserRole = (typeof UserRoleConst)[keyof typeof UserRoleConst];

/**
 * User - A locally-authenticated account
 */
export interface User {
  id: string;
  username: string;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
  role: UserRole;
  lastLoginAt: number | null;
  createdAt: number;
  updatedAt: number;
}

/**
 * Author - User details for display attribution
 */
export interface Author {
  name: string;
  username: string;
  avatarUrl: string | null;
}

/**
 * AuthSession - Refresh token store (revocable, tracks active browser sessions)
 */
export interface AuthSession {
  id: string;
  userId: string;
  expiresAt: number;
  createdAt: number;
  lastActiveAt: number;
}

/**
 * JWT access token payload (short-lived, 15 min)
 */
export interface JWTPayload {
  sub: string;
  username: string;
  role: UserRole;
  iat: number;
  exp: number;
}

/**
 * Authenticated user context attached to req.user by dualAuth middleware
 */
export interface AuthenticatedUser {
  id: string;
  username: string;
  name?: string | null;
  avatarUrl?: string | null;
  role: UserRole;
}

/**
 * Git identity for commit attribution
 */
export interface GitIdentity {
  name: string;
  email: string;
}

/**
 * Commit attribution: author = human, committer = agent
 */
export interface CommitAttribution {
  author: GitIdentity;
  committer: GitIdentity;
}

/**
 * Generate unique ID for users
 */
export function generateUserId(): string {
  return `user_${crypto.randomUUID()}`;
}

/**
 * Generate a secure random refresh token
 */
export function generateRefreshToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

// ===== Core Primitives =====

/**
 * PromptSegment - Composable prompt building block with template variables
 */
export interface PromptSegment {
  id: string;
  name: string;
  content: string;              // Template with {{variables}}
  summary: string;              // AI-generated description for library
  tags: string[];               // For library organization
  variables: string[];          // Auto-extracted from content
  color: SegmentColor;          // Visual color for rendering
  status: EntityStatus;         // Draft/published status
  sessionId?: string;           // Originating chat session
  outputType?: PromptOutputType; // What type of output this prompt generates
  createdBy: string | null;     // User ID who created this segment
  author?: Author;              // Display details for createdBy
  createdAt: number;
  updatedAt: number;
}

/**
 * ContextUsage - Token usage tracking for a session
 */
export interface ContextUsage {
  used: number;
  total: number;
  percent: number;
}

/**
 * HumanInputRequest - Request for human input during a session
 */
export interface HumanInputRequest {
  id: string;
  sessionId: string;
  question: string;
  context?: string;
  options?: string[];
  timeout: number;
  createdAt: number;
  respondedAt?: number;
  response?: string;
  respondedBy?: string;
  status: 'pending' | 'responded' | 'timeout' | 'cancelled';
}

/**
 * Document - A markdown document in the document library
 */
export interface Document {
  id: string;
  name: string;
  content: string;
  type: DocumentType;
  tags: string[];
  sessionId?: string;
  status: EntityStatus;
  createdBy: string | null;
  author?: Author;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
}

/**
 * DocumentVersion - A version of a document's content
 */
export interface DocumentVersion {
  id: string;
  documentId: string;
  content: string;
  createdAt: number;
  createdBy: DocumentCreatedBy;
}

/**
 * Session - A chat or assistant conversation
 */
export interface Session {
  id: string;
  sessionType: SessionType;
  agentDefinitionId?: string;
  claudeSessionId?: string;
  status: SessionStatus;
  forkedFromId?: string;
  name?: string;
  hidden?: boolean;
  hasUnread?: boolean;
  totalCost?: number;
  lastReportedCost?: number;
  model?: AgentModel;

  // Pipeline state persistence for crash recovery
  pipelineStatus?: SessionStatus;
  pipelineMessageId?: string;
  pipelineMessageContent?: string;
  pipelineContextInjected?: boolean;
  pipelineContextUsage?: ContextUsage;
  pipelineLastActivity?: number;

  createdBy: string | null;
  author?: Author;
  // Entity-editing mode (for MCP Forms)
  mode?: SessionMode;
  editingEntityType?: FormEntityType;
  editingEntityId?: string;
  formContextInjected?: boolean;
  startedAt: number;
  lastActivityAt: number;
  endedAt?: number;
}

/**
 * Artifact - File/diff/output attached to a session
 */
export interface Artifact {
  id: string;
  sessionId: string;
  name: string;
  type: AttachmentType;
  content: string;
  mimeType?: string;
  createdAt: number;
}

/**
 * ChatMessage - A message in the session chat
 */
export interface ChatMessage {
  id: string;
  sessionId: string;
  role: MessageRole;
  content: string;
  toolUse?: {
    name: string;
    input: unknown;
    result?: unknown;
  };
  status: MessageStatus;
  createdAt: number;
}

/**
 * Cozy color palette for segment visualization
 */
export type SegmentColor = typeof SEGMENT_COLORS[number] | string;

/**
 * Secret - Managed secret for MCP tools and agents
 */
export interface Secret {
  id: string;
  name: string;
  scope: SecretScope;
  encryptedValue: string;
  lastRotatedAt?: number;
  createdAt: number;
}

/**
 * Event - Audit log entry
 */
export interface Event {
  id: string;
  type: string;
  entityType: EventEntityType;
  entityId: string;
  actorType: ActorType;
  actorId: string;
  payload?: Record<string, unknown>;
  timestamp: number;
}

// ============================================================================
// AGENT DEFINITIONS - Configurable agent templates
// ============================================================================

/**
 * Prefilled conversation message
 */
export interface PrefilledMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Subagent link - reference to another AgentDefinition
 */
export interface SubagentLink {
  agentDefinitionId: string;
  alias?: string;
  descriptionOverride?: string;
  model?: AgentModel;
}

/**
 * Agent Definition - Configurable agent template
 */
export interface AgentDefinition {
  id: string;
  name: string;
  slug: string;
  description: string;
  systemPromptSegmentId?: string | null;
  role: AgentDefinitionRole;
  prefilledConversation?: PrefilledMessage[];
  skills?: string[];
  tags: string[];
  status: EntityStatus;
  sessionId?: string;
  isSystem?: boolean;
  isDefault?: boolean;
  createdBy: string | null;
  author?: Author;
  createdAt: number;
  updatedAt: number;
  agentContext: AgentContext;
}

/**
 * Form data for AgentDefinition editor (UI)
 */
export interface AgentDefinitionFormData {
  name: string;
  slug: string;
  description: string;
  systemPromptSegmentId: string | null;
  role: AgentDefinitionRole;
  prefilledConversation: PrefilledMessage[];
  skills: string;
  tags: string;
  agentContext: AgentContext;
}

/**
 * Resolved agent with expanded subagents
 */
export interface ResolvedAgentDefinition extends Omit<AgentDefinition, 'subagents'> {
  subagents: ResolvedSubagent[];
}

export interface ResolvedSubagent {
  name: string;
  description: string;
  definition: AgentDefinition;
}

/**
 * Generate unique ID for agent definitions
 */
export function generateAgentDefinitionId(): string {
  return `agdef_${crypto.randomUUID().slice(0, 8)}`;
}

// ===== SDK Types =====

/**
 * Subagent definition for Claude SDK's agents parameter.
 */
export interface SDKSubagentDefinition {
  description: string;
  prompt: string;
  tools?: string[];
  model?: AgentModel;
}

export interface AgentMCPServerConfig {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  enabled?: boolean;
  injectDocs?: boolean;
}

export interface AgentContext {
  model?: string;
  systemPrompt?: string;
  userId?: string;
  allowedTools?: string[];
  mcpServers?: AgentMCPServerConfig[];
  [key: string]: unknown;
}

export interface SessionConfig {
  sessionId: string;
  initialPrompt?: string;
  workingDirectory?: string;
  environment?: Record<string, string>;
  agentContext?: AgentContext;
}

export const SessionHandleStatus = {
  RUNNING: 'running',
  STOPPED: 'stopped',
  ERROR: 'error',
} as const;
export type SessionHandleStatus = (typeof SessionHandleStatus)[keyof typeof SessionHandleStatus];

/**
 * Handle to an active agent session
 */
export interface SessionHandle {
  id: string;
  claudeSessionId?: string;
  providerId: string;
  status: SessionHandleStatus;
  startedAt: number;
}

/**
 * Events emitted by agent providers
 */
export const AgentProviderEventType = {
  MESSAGE: 'message',
  THINKING: 'thinking',
  TOOL_USE: 'tool_use',
  TOOL_RESULT: 'tool_result',
  PROGRESS: 'progress',
  HUMAN_REQUEST: 'human_request',
  ERROR: 'error',
  COMPLETE: 'complete',
} as const;
export type AgentProviderEventType = (typeof AgentProviderEventType)[keyof typeof AgentProviderEventType];

export interface AgentProviderEvent {
  type: AgentProviderEventType;
  sessionId: string;
  timestamp: number;
  data: unknown;
}

/**
 * Unified interface for agent providers (Claude, etc.)
 */
export interface AgentProvider {
  name: string;
  displayName: string;
  isAvailable(): Promise<boolean>;
  createSession(config: SessionConfig): Promise<SessionHandle>;
  resumeSession(sessionId: string, claudeSessionId: string): Promise<SessionHandle>;
  forkSession(sessionId: string, newSessionId: string): Promise<SessionHandle>;
  sendMessage(sessionId: string, message: string): Promise<void>;
  onEvent(sessionId: string, handler: (event: AgentProviderEvent) => void): () => void;
  stopSession(sessionId: string): Promise<void>;
  streamMessages(
    sessionId: string,
    message: string
  ): AsyncGenerator<{ type: string; content?: string; data?: unknown }>;
  getClaudeSessionId?(sessionId: string): string | undefined;
}

/**
 * Human input request socket event data
 */
export interface SessionHumanInputData {
  sessionId: string;
  question: string;
  context?: string;
  options?: string[];
  timestamp?: number;
}

// SocketEvent type alias
export type SocketEvent = (typeof SOCKET_EVENTS)[keyof typeof SOCKET_EVENTS];

/**
 * Socket.io event payload types for type-safe event handling
 */
export interface SocketEventPayloads {
  [SOCKET_EVENTS.BRIDGE_REGISTER]: { bridgeId: string };
  [SOCKET_EVENTS.BRIDGE_HEARTBEAT]: { activeMessageIds: string[] };
  [SOCKET_EVENTS.AGENT_STATUS]: { status: 'online' | 'offline' | 'connecting'; bridgeId?: string | null };
  [SOCKET_EVENTS.SESSION_SEND]: {
    sessionId: string;
    messageId?: string;
    content: string;
    type?: string;
    editingContext?: {
      mode: typeof SessionMode.ENTITY_EDITING;
      entityType: FormEntityType;
      entityId?: string;
      formContextInjected: boolean;
    };
  };
  [SOCKET_EVENTS.SESSION_MESSAGE]: {
    sessionId: string;
    messageId?: string;
    content?: string;
    type?: string;
    editingContext?: {
      mode: typeof SessionMode.ENTITY_EDITING;
      entityType: FormEntityType;
      entityId?: string;
      formContextInjected: boolean;
    };
  };
  [SOCKET_EVENTS.SESSION_RESPONSE]: {
    sessionId: string;
    messageId?: string;
    message: {
      id: string;
      content: string;
      role: string;
      streaming?: boolean;
      createdAt: number;
      toolUse?: { name: string; input: unknown; result?: string };
    };
  };
  [SOCKET_EVENTS.SESSION_ERROR]: { sessionId: string; error: string };
  [SOCKET_EVENTS.MESSAGE_STATUS]: { sessionId: string; messageId: string; status: MessageStatus };
  [SOCKET_EVENTS.COMMAND_RESULT]: {
    sessionId: string;
    messageId?: string;
    command: string;
    result: string;
    success: boolean;
  };
  [SOCKET_EVENTS.SESSION_CREATED]: Session;
  [SOCKET_EVENTS.SESSION_HIDDEN]: { sessionId: string };
  [SOCKET_EVENTS.SESSION_MODEL_SWITCH]: {
    sessionId: string;
    model: AgentModel;
  };
  [SOCKET_EVENTS.SESSION_STOP]: {
    sessionId: string;
  };
  [SOCKET_EVENTS.SESSION_UPDATED]: {
    sessionId: string;
    name?: string;
    messageCount?: number;
    lastMessagePreview?: string;
    lastActivityAt?: number;
    hasUnread?: boolean;
  };
  [SOCKET_EVENTS.SESSION_CLAUDE_ID]: {
    sessionId: string;
    claudeSessionId: string;
  };
  [SOCKET_EVENTS.SESSION_CONTEXT_RESET]: {
    sessionId: string;
    reason: string;
    previousClaudeSessionId?: string;
  };
  [SOCKET_EVENTS.SESSION_THINKING]: {
    sessionId: string;
    content: string;
    timestamp: number;
  };
  [SOCKET_EVENTS.SESSION_CONTEXT_INJECTED]: {
    sessionId: string;
    messageId?: string;
    entityType: FormEntityType;
    entityId?: string;
    contextType: 'full' | 'minimal';
    contextPreview?: string;
  };
  [SOCKET_EVENTS.SESSION_HUMAN_INPUT_REQUESTED]: SessionHumanInputData;
  [SOCKET_EVENTS.SESSION_HUMAN_INPUT_RESPONSE]: {
    sessionId: string;
    response: string;
  };
  [SOCKET_EVENTS.SESSION_PROGRESS]: {
    sessionId: string;
    message: string;
    phase?: 'analyzing' | 'implementing' | 'testing' | 'finalizing';
    timestamp?: number;
  };
  [SOCKET_EVENTS.SESSION_BLOCKED]: {
    sessionId: string;
    reason: string;
    blockedOn: string;
    timestamp?: number;
  };
  [SOCKET_EVENTS.SESSION_HALTED]: {
    sessionId: string;
    reason: 'timeout' | 'cli_error' | 'process_exit' | 'cli_disconnected';
    errorMessage: string;
    canResume: boolean;
    timestamp?: number;
  };
  [SOCKET_EVENTS.SESSION_ARTIFACT]: { sessionId: string; artifact: Artifact };
  [SOCKET_EVENTS.SESSION_LOG]: {
    sessionId: string;
    level: 'debug' | 'info' | 'warn' | 'error';
    message: string;
    context?: Record<string, unknown>;
    timestamp: number;
    source?: 'pipeline' | 'stage' | 'adapter';
  };
  [SOCKET_EVENTS.SESSION_PIPELINE_STATE]: {
    sessionId: string;
    pipelineStatus: SessionStatus;
    pipelineMessageId?: string;
    pipelineMessageContent?: string;
    pipelineContextInjected?: boolean;
    pipelineContextUsage?: ContextUsage;
  };
  [SOCKET_EVENTS.SESSION_ACTIVITY]: {
    sessionId: string;
    activity: {
      type: 'tool_start' | 'tool_end' | 'thinking' | 'subagent' | 'subagent_timeout' | 'resuming' | 'starting';
      toolName?: string;
      subagentName?: string;
      toolUseId?: string;
      elapsedMs?: number;
      status: 'running' | 'complete' | 'timeout' | 'error';
    };
  };
  [SOCKET_EVENTS.SESSION_COST]: {
    sessionId: string;
    cost: number;
    turnCost?: number;
  };
  [SOCKET_EVENTS.SESSION_TOOL_USE]: {
    sessionId: string;
    toolUseId: string;
    toolName: string;
    input: unknown;
    output?: unknown;
    error?: string;
    parentToolUseId?: string | null;
    elapsedMs?: number;
    timestamp: number;
    messageId?: string;
  };
  [SOCKET_EVENTS.SESSION_CONTEXT_USAGE]: {
    sessionId: string;
    usage: ContextUsage;
    timestamp: number;
  };
  [SOCKET_EVENTS.SESSION_COMPACTED]: {
    sessionId: string;
    beforeUsage: ContextUsage;
    afterUsage?: ContextUsage;
    timestamp: number;
  };
  [SOCKET_EVENTS.SYNC_FULL]: {
    sessions: Session[];
    prompts: PromptSegment[];
    agentStatus: 'online' | 'offline';
    processingSessions: string[];
  };
  [SOCKET_EVENTS.EVENT]: import('./events.js').CapybaraEvent;

  // Agent Definition Events
  [SOCKET_EVENTS.AGENT_DEFINITION_CREATED]: { agentDefinition: AgentDefinition };
  [SOCKET_EVENTS.AGENT_DEFINITION_UPDATED]: { agentDefinition: AgentDefinition };
  [SOCKET_EVENTS.AGENT_DEFINITION_DELETED]: { id: string };

  // Entity CRUD Events
  [SOCKET_EVENTS.DOCUMENT_CREATED]: { document: Document };
  [SOCKET_EVENTS.DOCUMENT_UPDATED]: { document: Document };
  [SOCKET_EVENTS.DOCUMENT_DELETED]: { documentId: string; soft?: boolean };
  [SOCKET_EVENTS.MEMORY_CREATED]: { document: Document };
  [SOCKET_EVENTS.MEMORY_DELETED]: { documentId: string };
  [SOCKET_EVENTS.PROMPT_CREATED]: { segment: PromptSegment };
  [SOCKET_EVENTS.PROMPT_UPDATED]: { segment: PromptSegment };
  [SOCKET_EVENTS.PROMPT_DELETED]: { segmentId: string };
}

// ===== Constants =====

/**
 * Timeout values in milliseconds
 */
export const TIMEOUTS = {
  /** Event bus wait timeout (30 seconds) */
  EVENT_BUS: 30_000,
  /** Startup timeout (1 minute) */
  STARTUP: 60_000,
} as const;

/**
 * Content preview/truncation lengths
 */
export const CONTENT_LENGTHS = {
  PREVIEW_SHORT: 50,
  PREVIEW_LONG: 100,
  MAX_MESSAGE: 100_000,
} as const;

/**
 * Agent-related constants
 */
export const AGENT = {
  MAX_ICON_SEED: 1_000_000,
} as const;

/**
 * Git defaults
 */
export const GIT = {
  DEFAULT_BRANCH: 'main',
} as const;

/**
 * Default server URLs and ports
 */
export const SERVER_DEFAULTS = {
  SERVER_URL: 'http://localhost:3279',
  SERVER_PORT: 3279,
  BRIDGE_URL: 'http://localhost:3280',
  BRIDGE_PORT: 3280,
  HUDDLE_URL: 'http://localhost:3281',
  HUDDLE_PORT: 3281,
} as const;

export * from './logger.js';
