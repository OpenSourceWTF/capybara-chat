/**
 * Capybara Data Primitives
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
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'x-api-key', 'x-user-id', 'x-user-role', 'x-workspace-id'],
  exposedHeaders: ['x-user-id', 'x-user-role', 'x-workspace-id'],
  credentials: true,
  maxAge: 86400,
  DEVELOPMENT_ORIGINS: [
    'http://localhost:5173',
    'http://localhost:2279',
    'http://localhost:2281',
  ] as const,
  PRODUCTION_ORIGINS: [] as readonly string[],
} as const;
import {
  SessionStatus,
  SessionType,
  AgentStatus,
  MessageStatus,
  CloneStatus,
  WorktreeStatus,
  SessionHistoryEventType,
  MessageRole,
  Priority,
  AttachmentType,
  SecretScope,
  EventEntityType,
  ActorType,
  GitHubConfigSource,
  Theme,
  OrderDir,
  ProcessStatus,
  AgentModel,
  SEGMENT_COLORS,
  SOCKET_EVENTS,
  PAGINATION,
  SECRET_NAMES,
} from './enums.js';


/**
 * Workspace status report from bridge filesystem scan
 * Used for reconciling DB status with actual filesystem reality
 */
export interface WorkspaceStatusReport {
  repoOwner: string;
  repoName: string;
  cloneStatus: CloneStatus;
  hasLocalChanges?: boolean;
  ahead?: number;
  behind?: number;
  currentBranch?: string;
  error?: string;
}

/**
 * Git worktree for isolated agent work
 */
export interface Worktree {
  id: string;
  workspaceId: string;
  sessionId: string;
  path: string;
  branch: string;
  status: WorktreeStatus;
  prUrl?: string; // Legacy/Optional
  prNumber?: number; // Legacy/Optional
  createdAt: number;
  updatedAt: number;
}

/**
 * Branch statistics relative to remote
 */
export interface BranchStats {
  workspaceId: string;
  localBranch: string;
  remoteBranch: string;
  localCommit: string;    // Short commit hash (7 chars)
  ahead: number;          // Local commits not in remote
  behind: number;         // Remote commits not in local
  hasConflicts: boolean;  // Would merge cause conflicts?
  lastCheckedAt: number;
}

/**
 * Result of a workspace sync operation.
 */
export interface SyncResult {
  success: boolean;
  strategy: 'merge' | 'rebase' | 'reset';
  commitsMerged: number;             // Legacy: commits pulled (for service.sync())
  // Two-way sync fields (for route handler)
  pulled?: boolean;                  // Whether pull was performed
  pushed?: boolean;                  // Whether push was performed
  commitsPulled?: number;            // Commits pulled from remote
  commitsPushed?: number;            // Commits pushed to remote
  conflicts?: string[];              // File paths with conflicts
  error?: string;
}

/**
 * Result of a workspace deletion
 */
export interface DeletionResult {
  success: boolean;
  pushedBranches: string[];
  failedPushes: string[];
  cleanedWorktrees: string[];
  blockedBySessions?: string[];  // Session IDs blocking deletion
  error?: string;
}

/**
 * Progress payload for long-running workspace operations
 */
export interface WorkspaceProgressPayload {
  workspaceId: string;
  operation: 'clone' | 'sync' | 'delete' | 'merge';
  phase: string;
  progress: number;       // 0-100
  message: string;
  detail?: Record<string, unknown>;
}

/**
 * Result of worktree cleanup operation
 */
export interface CleanupResult {
  pushed: boolean;
  prCreated: boolean;
  prUrl?: string;
  prNumber?: number;
  cleaned: boolean;
  error?: string;
}

/**
 * GitHubConfig - GitHub integration status (token not exposed)
 */
export interface GitHubConfig {
  configured: boolean;
  source?: GitHubConfigSource;  // Where the token is stored
  username?: string;
  scopes?: string[];
}

// ===== User & Auth =====

export interface GitHubUser {
  id: number;
  login: string;
  avatar_url: string;
  name?: string | null;
  email?: string | null;
}

export interface GitHubOrg {
  id: number;
  login: string;
  avatar_url: string;
}

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
  default_branch: string;
  owner: { login: string };
}

export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  html_url: string;
  state: 'open' | 'closed';
  user: { login: string };
}

export interface GitHubInstallation {
  id: number;
  account: { login: string; type: string };
}

/**
 * User roles: admin has full access, member sees own + published assets
 */
export const UserRoleConst = {
  ADMIN: 'admin',
  MEMBER: 'member',
} as const;
export type UserRole = (typeof UserRoleConst)[keyof typeof UserRoleConst];

/**
 * User - A GitHub-authenticated account
 */
export interface User {
  id: string;                    // user_<uuid>
  githubId: number;              // GitHub numeric ID (stable across renames)
  githubLogin: string;           // GitHub username (can change)
  name: string | null;           // Display name
  email: string | null;          // Email (optional)
  avatarUrl: string | null;      // GitHub avatar
  role: UserRole;                // admin | member
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
  id: string;                    // refresh token value (crypto.randomBytes)
  userId: string;                // FK to users
  expiresAt: number;             // 30-day expiry
  createdAt: number;
  lastActiveAt: number;
}

/**
 * JWT access token payload (short-lived, 15 min)
 */
export interface JWTPayload {
  sub: string;                   // user.id
  githubLogin: string;
  role: UserRole;
  iat: number;
  exp: number;
}

/**
 * Authenticated user context attached to req.user by dualAuth middleware
 */
export interface AuthenticatedUser {
  id: string;
  githubLogin: string;
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
  // 32 bytes = 256 bits of entropy, base64url encoded
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

// ===== Core Primitives =====

/**
 * ContextUsage - Token usage tracking for a session
 *
 * Used for auto-compaction decisions and displaying usage in UI.
 */
export interface ContextUsage {
  used: number;
  total: number;
  percent: number;
}

/**
 * Session - An execution instance of a spec OR a assistant conversation
 */
export interface Session {
  id: string;
  specId?: string;
  workspaceId?: string;
  worktreePath?: string;
  sessionType: SessionType;
  agentId?: string;
  agentDefinitionId?: string;
  claudeSessionId?: string;
  status: SessionStatus;
  forkedFromId?: string;
  containerId?: string;
  name?: string;
  hidden?: boolean;
  hasUnread?: boolean;
  prUrl?: string;
  prNumber?: number;
  totalCost?: number;
  lastReportedCost?: number;
  model?: AgentModel;

  // Pipeline state
  pipelineStatus?: SessionStatus;
  pipelineMessageId?: string;
  pipelineMessageContent?: string;
  pipelineContextInjected?: boolean;
  pipelineContextUsage?: ContextUsage;
  pipelineLastActivity?: number;

  createdBy: string | null;             // User ID who started this session
  author?: Author;                      // Display details for createdBy
  startedAt: number;
  lastActivityAt: number;
  endedAt?: number;
}

/**
 * Agent - A running agent instance
 * 
 * Agents are locked to specific workspaces (repos).
 */
export interface Agent {
  id: string;
  name: string;
  status: AgentStatus;
  currentSessionId?: string;
  containerId?: string;
  workspaceIds: string[];         // Locked to these workspaces (repos)
  iconSeed: number;               // For random capybara vector generator
  lastSeenAt: number;
  createdAt: number;
}

/**
 * Artifact - File/diff/output attached to a session
 */
export interface Artifact {
  id: string;
  sessionId: string;
  name: string;
  type: AttachmentType;
  content: string;              // For text, or path for binary
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
 * Workspace - A GitHub repo that agents can work in
 * 
 * Agents are locked to one or more workspaces. Each workspace
 * corresponds to a checked-out repo with worktrees for sessions.
 */
export interface Workspace {
  id: string;
  name: string;                   // Display name
  repoUrl: string;                // e.g. "https://github.com/owner/repo"
  repoOwner: string;              // e.g. "owner"
  repoName: string;               // e.g. "repo"
  defaultBranch: string;          // e.g. "main"
  localPath: string;              // Path to checked-out repo
  worktreesPath: string;          // Path to worktrees directory
  cloneStatus?: CloneStatus;      // Status of git clone operation
  cloneError?: string;            // Error message if clone failed
  createdAt: number;
  lastSyncedAt?: number;
}

/**
 * Cozy color palette for segment visualization
 * Warm, low-pressure colors that work in both light and dark themes
 */
export type SegmentColor = typeof SEGMENT_COLORS[number] | string;

/**
 * Secret - Managed secret for MCP tools and agents
 */
export interface Secret {
  id: string;
  name: string;                 // e.g. "ANTHROPIC_API_KEY"
  scope: SecretScope;
  encryptedValue: string;       // Encrypted with age/sops
  lastRotatedAt?: number;
  createdAt: number;
}

/**
 * Event - Audit log entry
 */
export interface Event {
  id: string;
  type: string;                 // e.g. "spec:created", "session:forked"
  entityType: EventEntityType;
  entityId: string;
  actorType: ActorType;
  actorId: string;
  payload?: Record<string, unknown>;
  timestamp: number;
}

// ===== SDK Types =====

/**
 * Subagent definition for Claude SDK's agents parameter.
 * Maps to SDK's AgentDefinition type.
 */
export interface SDKSubagentDefinition {
  /** Description of when to use this subagent (required by SDK) */
  description: string;
  /** System prompt for the subagent */
  prompt: string;
  /** Allowed tools for the subagent (if omitted, inherits from parent) */
  tools?: string[];
  /** Model override (sonnet/opus/opus-latest/haiku/inherit) */
  model?: AgentModel;
}

export interface AgentMCPServerConfig {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  enabled?: boolean;
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
  sessionId: string;                            // REQUIRED - identity flows from server
  initialPrompt?: string;                       // Initial prompt for agent
  workingDirectory?: string;
  environment?: Record<string, string>;
  worktreePath?: string;                        // Path to git worktree
  branchName?: string;                          // Agent branch name
  /** Task ID for background tasks (148-prompt-hierarchy: enables task_update_progress MCP tool) */
  taskId?: string;
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
  claudeSessionId?: string;       // Actual Claude session ID for persistence/resume
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
 * Unified interface for agent providers (Claude, Codex, etc.)
 */
export interface AgentProvider {
  /** Unique provider identifier */
  name: string;

  /** Human-readable display name */
  displayName: string;

  /** Check if this provider is available/configured */
  isAvailable(): Promise<boolean>;

  /** Create a new session */
  createSession(config: SessionConfig): Promise<SessionHandle>;

  /** Resume an existing session */
  resumeSession(
    sessionId: string,
    claudeSessionId: string,
    worktreePath?: string
  ): Promise<SessionHandle>;

  /** Fork an existing session (new session with same context) */
  forkSession(sessionId: string, newSessionId: string, worktreePath?: string): Promise<SessionHandle>;

  /** Send a message/prompt to an active session */
  sendMessage(sessionId: string, message: string): Promise<void>;

  /** Subscribe to events from a session */
  onEvent(sessionId: string, handler: (event: AgentProviderEvent) => void): () => void;

  /** Stop a running session */
  stopSession(sessionId: string): Promise<void>;

  /**
   * Stream messages from a session as an async generator.
   * Returns events including message content, tool_use, tool_progress, and result.
   */
  streamMessages(
    sessionId: string,
    message: string
  ): AsyncGenerator<{ type: string; content?: string; data?: unknown }>;

  /**
   * Get the Claude session ID for resumption (if available).
   * Not all providers support this - returns undefined if not captured.
   */
  getClaudeSessionId?(sessionId: string): string | undefined;
}

/**
 * HumanInputRequest - Request for human input during task execution
 *
 * Created when Claude calls request_human_input MCP tool.
 * Task is paused until human responds or timeout.
 */
export interface HumanInputRequest {
  id: string;
  taskId: string;                     // Legacy: Task that needs input (or session ID)
  sessionId?: string;                 // Session (if using session infrastructure)
  question: string;                   // What Claude is asking
  context?: string;                   // Additional context
  options?: string[];                 // Multiple choice options (if any)
  timeout: number;                    // Timeout in milliseconds
  createdAt: number;
  respondedAt?: number;               // When human responded
  response?: string;                  // Human's response
  respondedBy?: string;               // Who responded
  status: 'pending' | 'responded' | 'timeout' | 'cancelled';
}

/**
 * Human input request socket event data (for SESSION_HUMAN_INPUT_REQUESTED)
 * Different from HumanInputRequest entity which is the database record.
 */
export interface SessionHumanInputData {
  sessionId: string;
  question: string;
  context?: string;
  options?: string[];
  timestamp?: number;
}

// ===== Worktree Socket Events (092-worktree-design) =====

/**
 * Bridge → Server: Request fresh token for git operation
 */
export interface WorktreeTokenRequest {
  /** Correlation ID for matching response */
  requestId: string;
  /** Workspace to get token for */
  workspaceId: string;
  /** Type of operation requiring token */
  operation: 'clone' | 'fetch' | 'push';
}

/**
 * Server → Bridge: Return fresh token
 */
export interface WorktreeTokenResponse {
  /** Correlation ID for matching request */
  requestId: string;
  /** Whether token was successfully fetched */
  success: boolean;
  /** Fresh ghs_* token (valid for ~1 hour) */
  token?: string;
  /** Token expiration timestamp (ms) */
  expiresAt?: number;
  /** Clean repo URL (https://github.com/owner/repo) */
  repoUrl?: string;
  /** Default branch name */
  defaultBranch?: string;
  /** Error message if success=false */
  error?: string;
}

/**
 * Bridge → Server: Report worktree operation result
 */
export interface WorktreeOperationResult {
  /** Task ID this operation was for */
  taskId: string;
  /** Type of operation completed */
  operation: 'create' | 'push' | 'pr' | 'cleanup';
  /** Whether operation succeeded */
  success: boolean;
  /** Path to created worktree (for create operation) */
  worktreePath?: string;
  /** Branch name */
  branchName?: string;
  /** PR URL if created */
  prUrl?: string;
  /** PR number if created */
  prNumber?: number;
  /** Error message if success=false */
  error?: string;
}

/**
 * Server → Bridge: Request branch push (150-task-ui-git-actions)
 * Used when user manually triggers push from task detail UI
 */
export interface WorktreePushRequest {
  /** Correlation ID for matching response */
  requestId: string;
  /** Task ID to push branch for */
  taskId: string;
  /** Workspace ID */
  workspaceId: string;
  /** Path to the worktree (may not exist if cleaned up after task completion) */
  worktreePath: string;
  /** Branch name to push */
  branchName: string;
  /** Fallback: workspace local path (used if worktree doesn't exist) */
  workspaceLocalPath?: string;
}

/**
 * Bridge → Server: Push result
 */
export interface WorktreePushResponse {
  /** Correlation ID for matching request */
  requestId: string;
  /** Whether push was successful */
  success: boolean;
  /** Error message if success=false */
  error?: string;
  /** 150: Short HEAD commit hash (7 chars) after push */
  headCommit?: string;
}

// ===== Constants =====

/**
 * GitHub API and OAuth URLs
 */
export const GITHUB_URLS = {
  API_BASE: 'https://api.github.com',
  AUTHORIZE: 'https://github.com/login/oauth/authorize',
  ACCESS_TOKEN: 'https://github.com/login/oauth/access_token',
  USER: 'https://api.github.com/user',
  USER_ORGS: 'https://api.github.com/user/orgs',
  USER_REPOS: 'https://api.github.com/user/repos',
  INSTALLATIONS: 'https://api.github.com/user/installations',
} as const;

/**
 * GitHub API headers
 */
export const GITHUB_HEADERS = {
  ACCEPT: 'application/vnd.github.v3+json',
  CONTENT_TYPE: 'application/json',
} as const;

/**
 * Timeout values in milliseconds
 */
export const TIMEOUTS = {
  /** Git clone operation (5 minutes) */
  CLONE: 300_000,
  /** Git operation like pull, fetch (1 minute) */
  GIT_OPERATION: 60_000,
  /** Worktree cleanup delay (1 hour) */
  WORKTREE_CLEANUP: 3_600_000,
  /** Event bus wait timeout (30 seconds) */
  EVENT_BUS: 30_000,
  /** Startup timeout (1 minute) */
  STARTUP: 60_000,
} as const;

/**
 * Content preview/truncation lengths
 */
export const CONTENT_LENGTHS = {
  /** Short preview (titles, names) */
  PREVIEW_SHORT: 50,
  /** Long preview (message content) */
  PREVIEW_LONG: 100,
  /** Maximum message length */
  MAX_MESSAGE: 100_000,
  /** Maximum spec content length */
  MAX_SPEC: 500_000,
} as const;

/**
 * Workspace-related paths and constants
 */
export const WORKSPACE = {
  /** Base path for workspace repositories */
  BASE_PATH: '/workspaces',
  /** Base path for worktrees (root-level, outside repos) */
  WORKTREES_BASE: '/workspaces/.worktrees',
  /** Worktrees subdirectory name (legacy, inside repo) */
  WORKTREES_DIR: '.worktrees',
  /** Separator for flattened owner--repo directory names */
  SEPARATOR: '--',
  /** Prefix for AI-generated branches */
  BRANCH_PREFIX: 'capybara/',
  /** GitHub HTTPS URL prefix */
  GITHUB_HTTPS_PREFIX: 'https://github.com',
} as const;

// ===== Workspace Path Helpers =====

/**
 * Build flattened workspace directory name: owner--repo
 */

export function buildWorkspaceDirName(owner: string, repo: string): string {
  return `${owner}${WORKSPACE.SEPARATOR}${repo}`;
}

/**
 * Parse flattened workspace directory name back to owner and repo
 */
export function parseWorkspaceDirName(dirName: string): { owner: string; repo: string } | null {
  const idx = dirName.indexOf(WORKSPACE.SEPARATOR);
  if (idx === -1) return null;
  return {
    owner: dirName.substring(0, idx),
    repo: dirName.substring(idx + WORKSPACE.SEPARATOR.length),
  };
}

/**
 * Get the worktrees directory path for a workspace
 */
export function getWorktreesPath(repoOwner: string, repoName: string): string {
  return `${WORKSPACE.WORKTREES_BASE}/${buildWorkspaceDirName(repoOwner, repoName)}`;
}

/**
 * Generate a branch name from task information
 */
export function generateBranchName(task: { name: string; type?: string }): string {
  // Map task types to conventional prefixes
  const typeMap: Record<string, string> = {
    feature: 'feat',
    bugfix: 'fix',
    bug: 'fix',
    refactor: 'refactor',
    docs: 'docs',
    test: 'test',
    chore: 'chore',
  };

  const typePrefix = task.type?.toLowerCase() || 'task';
  const prefix = typeMap[typePrefix] || 'task';

  // Slugify task name
  const slug = task.name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')  // Remove special chars
    .trim()
    .replace(/\s+/g, '-')           // Spaces to dashes
    .replace(/-+/g, '-')            // Collapse multiple dashes
    .substring(0, 40);              // Max 40 chars for description

  return `${WORKSPACE.BRANCH_PREFIX}${prefix}/${slug}`;
}

/**
 * Agent-related constants
 */
export const AGENT = {
  /** Maximum icon seed value for random capybara generation */
  MAX_ICON_SEED: 1_000_000,
} as const;

/**
 * Git defaults
 */
export const GIT = {
  /** Default branch name */
  DEFAULT_BRANCH: 'main',
} as const;

/**
 * Default server URLs and ports
 */
export const SERVER_DEFAULTS = {
  /** Main Capybara server URL */
  SERVER_URL: 'http://localhost:2279',
  /** Server port */
  SERVER_PORT: 2279,
  /** Agent bridge URL */
  BRIDGE_URL: 'http://localhost:2280',
  /** Bridge port */
  BRIDGE_PORT: 2280,
  /** Huddle frontend URL */
  HUDDLE_URL: 'http://localhost:2281',
  /** Huddle frontend port (alias: GATEWAY_PORT for backwards compatibility) */
  HUDDLE_PORT: 2281,
  /** @deprecated Use HUDDLE_PORT instead */
  GATEWAY_PORT: 2281,
} as const;

export * from './logger.js';
// ===== GitHub Types =====
export interface GitHubUser {
  id: number;
  login: string;
  avatar_url: string;
  name?: string | null;
  email?: string | null;
}

export interface GitHubOrg {
  id: number;
  login: string;
  avatar_url: string;
}

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
  default_branch: string;
  owner: { login: string };
}

export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  html_url: string;
  state: 'open' | 'closed';
  user: { login: string };
}

export interface GitHubInstallation {
  id: number;
  account: { login: string; type: string };
}
