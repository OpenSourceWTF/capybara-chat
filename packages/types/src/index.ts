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
  SessionMode,
  FormEntityType,
  EntityStatus,
  PromptOutputType,
  DeliverableType,
  AgentDefinitionRole,
  DocumentType,
  AssistantType,
  AssistantPhase,
  GitHubPRState,
  PRChecksStatus,
  PRReviewDecision,
  TaskResolution,
  DocumentCreatedBy,
  TaskStatus,
  SOCKET_EVENTS,
  PAGINATION,
  SpecStatus,
  WorkerTaskState,
  PRMergeableState,
  SECRET_NAMES,
} from './enums.js';

export const SOCKET_DEFAULTS = {
  RECONNECTION_ATTEMPTS: 5,
  RECONNECTION_DELAY: 1000,
  RECONNECTION: true,
} as const;

export const API_PATHS = {
  SESSIONS: '/api/sessions',
  SPECS: '/api/specs',
  PROMPTS: '/api/prompts',
  PIPELINES: '/api/pipelines',
  DOCUMENTS: '/api/documents',
  AGENTS: '/api/agents',
  WORKSPACES: '/api/workspaces',
  AUTH_GITHUB: '/api/auth/github',
  GITHUB_INSTALLATIONS: '/api/github/installations',
  SETTINGS: '/api/settings',
  SETTINGS_GITHUB: '/api/settings/github',
  ASSISTANTS: '/api/assistants',
  TECHNIQUES: '/api/techniques',
  TASKS: '/api/tasks',
  AGENT_DEFINITIONS: '/api/agent-definitions',
  FLOWS: '/api/flows',
} as const;

export const sessionPath = (sessionId: string, subPath?: string) =>
  `${API_PATHS.SESSIONS}/${sessionId}${subPath ? `/${subPath}` : ''}`;

export const entityPath = (basePath: string, id: string, subPath?: string) =>
  `${basePath}/${id}${subPath ? `/${subPath}` : ''}`;


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
 * Spec - The primary tracking unit (story-sized work)
 */
export interface Spec {
  id: string;
  title: string;
  content: string;              // Markdown specification
  workflowStatus: SpecStatus;   // Workflow state: READY, IN_PROGRESS, etc.
  priority: Priority;
  tags: string[];
  workspaceId?: string;           // Which repo this spec is for
  agentConfigId?: string;         // Agent config template (EC2-like)
  parentId?: string;              // For sub-specs
  promptPipelineId?: string;      // Optional linked pipeline
  issueNumber?: number;           // GitHub issue number if linked
  issueUrl?: string;              // GitHub issue URL if linked
  githubPrNumber?: number;        // GitHub PR number if linked
  githubPrUrl?: string;           // GitHub PR URL if linked
  status: EntityStatus;           // Draft/published status
  sessionId?: string;             // Originating chat session
  createdBy: string | null;       // User ID who created this entity
  author?: Author;                // Display details for createdBy
  createdAt: number;
  updatedAt: number;
}

/**
 * Technique - Workflow definition for task execution
 * 
 * Defines phases, prompts, and verification for autonomous execution.
 * 'ralph' and 'raw' are system techniques seeded on startup.
 */
export interface Technique {
  id: string;
  name: string;
  slug: string;                     // Unique identifier (e.g., 'ralph', 'raw')
  description?: string;
  version: string;
  variablesSchema: Record<string, unknown>;  // JSON Schema for form generation
  phases: TechniquePhase[];
  verification: TechniqueVerification;
  isSystem: boolean;                // true for built-in techniques
  createdAt: number;
  updatedAt: number;
}

/**
 * TechniquePhase - A phase within a technique execution
 */
export interface TechniquePhase {
  id: string;
  name: string;
  prompt: string;                   // Handlebars template name or content
  loop: boolean;                    // Whether to loop until exit condition
  maxIterations: number;            // Maximum iterations if loop=true
  exitCondition: string;            // Promise marker to check (e.g., 'PLANNED', 'COMPLETE')
}

/**
 * TechniqueVerification - Verification commands for technique execution
 */
export interface TechniqueVerification {
  commands: string[];               // Commands to run (e.g., 'pnpm build', 'pnpm test')
  allMustPass: boolean;             // All commands must pass
}

/**
 * WorkerTask - Persisted task in the worker queue
 * 
 * Represents a spec implementation task executed by a worker.
 * Survives server restarts and supports resume.
 */
export interface WorkerTask {
  id: string;
  name?: string;                        // Human-readable task name
  specId: string;
  workspaceId: string;
  techniqueId: string;
  agentDefinitionId?: string;         // Agent definition for context/model config
  /** Model override for agent executing this task (sonnet/opus/haiku/inherit) */
  modelOverride?: AgentModel;
  /** Subagent-specific model overrides, keyed by subagent name */
  subagentModelOverrides?: Record<string, AgentModel>;
  variables: Record<string, unknown>;  // Form values from variablesSchema
  state: WorkerTaskState;
  currentPhaseId?: string;
  iteration: number;
  artifactPath?: string;              // .huddle/ralph/<slug>/ path
  worktreePath?: string;              // Git worktree directory
  branchName?: string;                // Git branch for this task
  headCommit?: string;                // Short git commit hash (7 chars) of branch HEAD
  implementationPlan?: string;        // Final IMPLEMENTATION_PLAN.md content
  prNumber?: number;                  // GitHub PR number if created
  prUrl?: string;                     // GitHub PR URL
  error?: string;                     // Error message if failed
  attempt: number;
  maxAttempts: number;
  queuedAt: number;
  startedAt?: number;
  completedAt?: number;

  // Activity-based progress tracking (053-task-ui-streaming)
  sessionId?: string;                 // Link to associated session for streaming
  sessionTotalCost?: number;          // Denormalized from session.totalCost for display
  lastProgressMessage?: string;       // "Running pytest" - what Claude is doing
  lastMessage?: string;               // Last Claude response (133-task-card-enhancements) - fallback when no progress msg
  position?: number;                  // Manual ordering within state column (134-kanban-reorder)
  currentPhase?: string;              // "analyzing" | "implementing" | "testing" | "finalizing"
  lastProgressAt?: number;            // Last progress update timestamp (for stuck detection)
  executorId?: string;                // Which executor claimed this task

  // PR Resolution State (055-task-pr-resolution)
  prState?: GitHubPRState;                    // Track PR lifecycle: 'open' | 'closed' | 'merged'
  prMergeable?: boolean;                       // Can PR be merged?
  prMergeableState?: PRMergeableState;         // 'clean' | 'dirty' | 'blocked' | 'behind' | 'unknown'
  prChecksStatus?: PRChecksStatus;             // 'pending' | 'success' | 'failure' | 'neutral' | 'none'
  prReviewDecision?: PRReviewDecision;         // 'approved' | 'changes_requested' | 'review_required' | 'none'
  prLastSyncedAt?: number;                     // Last time we fetched PR data from GitHub
  prChangedFiles?: number;                     // Number of files changed in PR
  prAdditions?: number;                        // Lines added
  prDeletions?: number;                        // Lines deleted

  // Resolution Tracking (055-task-pr-resolution)
  resolution?: TaskResolution;                 // How task was closed
  resolvedAt?: number;                         // When task was resolved
  resolvedBy?: string;                         // Who merged/closed the PR

  createdBy: string | null;                    // User ID who submitted this task
}

/**
 * Task - A step within a spec (child of Spec)
 */
export interface Task {
  id: string;
  specId: string;
  title: string;
  description?: string;
  status: TaskStatus;
  order: number;                // Ordering within spec
  createdAt: number;
  completedAt?: number;
  /** Model override for the agent executing this task (sonnet/opus/haiku/inherit) */
  modelOverride?: AgentModel;
  /** Subagent-specific model overrides, keyed by subagent name */
  subagentModelOverrides?: Record<string, AgentModel>;
}

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
  color: SegmentColor;          // Visual color for pipeline rendering
  status: EntityStatus;         // Draft/published status
  sessionId?: string;           // Originating chat session
  outputType?: PromptOutputType; // What type of output this prompt generates
  createdBy: string | null;     // User ID who created this segment
  author?: Author;              // Display details for createdBy
  createdAt: number;
  updatedAt: number;
}

/**
 * PipelineStep - A segment in a pipeline with optional variable overrides
 */
export interface PipelineStep {
  segmentId: string;
  order: number;
  overrides?: Record<string, string>;  // Override variables for this step
}

/**
 * PromptPipeline - Ordered segments with variable bindings
 *
 * For assistants, set deliverableType to specify the expected output schema.
 * The pipeline renderer will append the appropriate schema instructions.
 */
export interface PromptPipeline {
  id: string;
  name: string;
  description?: string;

  // Pipeline composition
  steps: PipelineStep[];            // Ordered segments with overrides

  // Variable definitions (shell-like DSL: "name=value & other=val")
  variables: string;

  // Claude SDK options - reference segments by ID
  systemPromptSegmentId?: string;   // Segment to use as system prompt
  prefill?: string;                 // Assistant prefill text

  // Assistant mode: specifies expected structured output
  deliverableType: DeliverableType;

  // Chat integration fields
  status: EntityStatus;             // Draft/published status
  sessionId?: string;               // Originating chat session

  createdBy: string | null;         // User ID who created this pipeline
  createdAt: number;
  updatedAt: number;
}

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
 * HumanInputRequest - Request for human input during task execution
 */
export interface HumanInputRequest {
  id: string;
  taskId: string;
  sessionId?: string;
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
 * AgentConfig - Template for agent capabilities
 */
export interface AgentConfig {
  id: string;
  name: string;
  description?: string;
  skills: string[];
  mcpServers: Array<{
    name: string;
    config?: Record<string, unknown>;
  }>;
  env?: Record<string, string>;
  resources?: {
    memoryMB?: number;
    cpuCores?: number;
    timeoutMinutes?: number;
  };
  claudeConfig?: {
    model?: string;
    systemPrompt?: string;
    maxTokens?: number;
  };
  createdAt: number;
  updatedAt: number;
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
  // Entity-editing mode (for MCP Forms)
  mode?: SessionMode;                   // Session mode (default: 'chat')
  editingEntityType?: FormEntityType;   // Type of entity being edited
  editingEntityId?: string;             // ID of entity being edited
  formContextInjected?: boolean;        // Whether form schema was injected into agent context
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
  installationId?: number;        // GitHub App installation ID for auth
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
  systemPromptSegmentId?: string | null;  // FK to prompt_segments for editable prompts
  role: AgentDefinitionRole;             // Determines where this agent appears in pickers
  prefilledConversation?: PrefilledMessage[];
  skills?: string[];  // Skill slugs to enable (inherited by subagents)
  tags: string[];
  status: EntityStatus;           // Draft/published status
  sessionId?: string;
  isSystem?: boolean;
  isDefault?: boolean;  // True for the default chat assistant
  createdBy: string | null;       // User ID who created this definition
  author?: Author;                // Display details for createdBy
  createdAt: number;
  updatedAt: number;
  /** Agent configuration - systemPrompt, allowedTools, mcpServers, model, subagents */
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
  skills: string;  // Comma-separated skill slugs (matches tags pattern)
  tags: string;  // Comma-separated string (matches existing pattern)
  /** Agent configuration - systemPrompt, allowedTools, mcpServers, model, subagents */
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

/**
 * Task - A step within a spec (child of Spec)
 */
export interface Task {
  id: string;
  specId: string;
  title: string;
  description?: string;
  status: TaskStatus;
  order: number;                // Ordering within spec
  createdAt: number;
  completedAt?: number;
  /** Model override for the agent executing this task (sonnet/opus/haiku/inherit) */
  modelOverride?: AgentModel;
  /** Subagent-specific model overrides, keyed by subagent name */
  subagentModelOverrides?: Record<string, AgentModel>;
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
  /** Whether to inject MCP tool documentation into system prompt (defaults to true) */
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
  sessionId: string;                            // REQUIRED - identity flows from server
  specId?: string;
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
  headCommit?: string;
}

// SocketEvent type alias for backward compatibility
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
    // Entity editing context - passed from UI to bridge
    editingContext?: {
      mode: typeof SessionMode.ENTITY_EDITING;
      entityType: FormEntityType;
      entityId?: string;  // Optional for new/unsaved entities
      formContextInjected: boolean;
    };
  };
  [SOCKET_EVENTS.SESSION_MESSAGE]: {
    sessionId: string;
    messageId?: string;
    content?: string;
    type?: string;
    // Entity editing context - forwarded from UI through server to bridge
    editingContext?: {
      mode: typeof SessionMode.ENTITY_EDITING;
      entityType: FormEntityType;
      entityId?: string;  // Optional for new/unsaved entities
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
  // 135-assistant-model-switch: Model switch event payload
  [SOCKET_EVENTS.SESSION_MODEL_SWITCH]: {
    sessionId: string;
    model: AgentModel;
  };
  // 168-right-bar-elimination: Stop session generation
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
    messageId?: string;  // User message that had context injected
    entityType: FormEntityType;
    entityId?: string;  // undefined for new entities
    contextType: 'full' | 'minimal';  // Whether full context or minimal prefix was used
    contextPreview?: string;  // Truncated preview of injected context for UI display
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
  // 193-phase-4: Pipeline observability
  [SOCKET_EVENTS.SESSION_LOG]: {
    sessionId: string;
    level: 'debug' | 'info' | 'warn' | 'error';
    message: string;
    context?: Record<string, unknown>;
    timestamp: number;
    source?: 'pipeline' | 'stage' | 'adapter';
  };
  // 199-2.1: Pipeline state persistence for crash recovery
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
      toolUseId?: string;  // For timeout tracking
      elapsedMs?: number;  // For timeout reporting
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
    parentToolUseId?: string | null;  // For subagent context tracking
    elapsedMs?: number;
    timestamp: number;
    messageId?: string;  // Links tool to parent assistant message for embedding
  };
  // Context visibility events
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
    specs: any[]; // Placeholder if Spec not fully defined or circular
    sessions: Session[];
    agents: Agent[];
    workspaces: Workspace[];
    prompts: PromptSegment[];
    agentStatus: 'online' | 'offline';
    /** 193-session-reconnect-debug: Session IDs with messages currently being processed */
    processingSessions: string[];
  };
  [SOCKET_EVENTS.EVENT]: import('./events.js').CapybaraEvent;

  // Workspace status reporting
  [SOCKET_EVENTS.WORKSPACE_STATUS_REPORT]: {
    reports: WorkspaceStatusReport[];
  };
  [SOCKET_EVENTS.WORKSPACE_STATUS_UPDATED]: {
    workspaceId: string;
    cloneStatus: CloneStatus;
    hasLocalChanges?: boolean;
    ahead?: number;
    behind?: number;
    currentBranch?: string;
    error?: string;
  };

  // Worker Task Event Payloads
  [SOCKET_EVENTS.TASK_CREATED]: {
    taskId: string;
    specId: string;
    workspaceId: string;
    techniqueId: string;
  };
  [SOCKET_EVENTS.TASK_ASSIGNED]: {
    taskId: string;
    workerId?: string;
  };
  [SOCKET_EVENTS.TASK_PROGRESS]: {
    taskId: string;
    message: string;
    phase?: string;
    timestamp: number;
  };
  [SOCKET_EVENTS.TASK_PHASE_CHANGED]: {
    taskId: string;
    previousPhaseId?: string;
    newPhaseId: string;
  };
  [SOCKET_EVENTS.TASK_COMPLETE]: {
    taskId: string;
    sessionId?: string;  // 196-session-status-sanity: Include sessionId to clear processingSessions
    prNumber?: number;
    prUrl?: string;
  };
  [SOCKET_EVENTS.TASK_FAILED]: {
    taskId: string;
    sessionId?: string;  // 196-session-status-sanity: Include sessionId to clear processingSessions
    error: string;
  };
  [SOCKET_EVENTS.TASK_BLOCKED]: {
    taskId: string;
    reason: string;
  };
  [SOCKET_EVENTS.TASK_OUTPUT]: {
    taskId: string;
    sessionId?: string;
    content: string;  // Streaming output text (delta or complete)
    type: 'delta' | 'complete';
    timestamp: number;
  };
  [SOCKET_EVENTS.TASK_CANCELLED]: {
    taskId: string;
    sessionId?: string;  // 196-session-status-sanity: Include sessionId to clear processingSessions
    cancelledBy?: string;  // Who cancelled the task
    reason?: string;
  };
  [SOCKET_EVENTS.TASK_CANCEL]: {
    taskId: string;  // Server -> Bridge: request to cancel a running task
  };
  [SOCKET_EVENTS.TASK_COST_UPDATE]: {
    taskId: string;
    cost: number;
    timestamp: number;
  };

  // Task PR Lifecycle Event Payloads (055-task-pr-resolution)
  [SOCKET_EVENTS.TASK_PR_CREATED]: {
    taskId: string;
    prNumber: number;
    prUrl: string;
  };
  [SOCKET_EVENTS.TASK_PR_SYNCED]: {
    taskId: string;
    prNumber: number;
    prState: GitHubPRState;
    prMergeable?: boolean;
    prChecksStatus?: PRChecksStatus;
    prReviewDecision?: PRReviewDecision;
  };
  [SOCKET_EVENTS.TASK_PR_MERGED]: {
    taskId: string;
    prNumber: number;
    sha: string;
    mergedBy?: string;
  };
  [SOCKET_EVENTS.TASK_PR_CLOSED]: {
    taskId: string;
    prNumber: number;
    reason?: string;
  };
  [SOCKET_EVENTS.TASK_PR_CHECKS_UPDATED]: {
    taskId: string;
    prNumber: number;
    previousStatus?: PRChecksStatus;
    newStatus: PRChecksStatus;
  };
  [SOCKET_EVENTS.TASK_PR_REVIEW_UPDATED]: {
    taskId: string;
    prNumber: number;
    previousDecision?: PRReviewDecision;
    newDecision: PRReviewDecision;
  };
  [SOCKET_EVENTS.TASK_RESOLVED]: {
    taskId: string;
    resolution: TaskResolution;
    resolvedAt: number;
    resolvedBy?: string;
  };

  // Agent Definition Event Payloads
  [SOCKET_EVENTS.AGENT_DEFINITION_CREATED]: { agentDefinition: AgentDefinition };
  [SOCKET_EVENTS.AGENT_DEFINITION_UPDATED]: { agentDefinition: AgentDefinition };
  [SOCKET_EVENTS.AGENT_DEFINITION_DELETED]: { id: string };

  // Entity CRUD Event Payloads (used for UI refresh after huddle-mcp operations)
  [SOCKET_EVENTS.SPEC_CREATED]: { spec: any }; // Placeholder
  [SOCKET_EVENTS.SPEC_UPDATED]: { spec: any }; // Placeholder
  [SOCKET_EVENTS.SPEC_DELETED]: { specId: string };
  [SOCKET_EVENTS.DOCUMENT_CREATED]: { document: Document };
  [SOCKET_EVENTS.DOCUMENT_UPDATED]: { document: Document };
  [SOCKET_EVENTS.DOCUMENT_DELETED]: { documentId: string; soft?: boolean };
  // Memory Events (124-agent-memory-system)
  [SOCKET_EVENTS.MEMORY_CREATED]: { document: Document };
  [SOCKET_EVENTS.MEMORY_DELETED]: { documentId: string };
  [SOCKET_EVENTS.PROMPT_CREATED]: { segment: PromptSegment };
  [SOCKET_EVENTS.PROMPT_UPDATED]: { segment: PromptSegment };
  [SOCKET_EVENTS.PROMPT_DELETED]: { segmentId: string };

  // Task Resume & Message Queue Event Payloads (090-task-resume)
  [SOCKET_EVENTS.SESSION_MESSAGE_QUEUED]: {
    sessionId: string;
    messageId: string;
    position: number;
    queueSize: number;
  };
  [SOCKET_EVENTS.SESSION_MESSAGE_DEQUEUED]: {
    sessionId: string;
    messageId: string;
    remaining: number;
  };
  [SOCKET_EVENTS.TASK_RESUMED]: {
    taskId: string;
    sessionId: string;
    resumedFrom: 'complete' | 'failed';
    triggeredBy: 'user_message' | 'retry';
  };
  [SOCKET_EVENTS.TASK_RESUME_FAILED]: {
    taskId: string;
    sessionId: string;
    reason: 'session_expired' | 'task_locked' | 'unknown';
    canRetry: boolean;
  };

  // Worktree Operations Event Payloads (092-worktree-design)
  [SOCKET_EVENTS.WORKTREE_TOKEN_REQUEST]: WorktreeTokenRequest;
  [SOCKET_EVENTS.WORKTREE_TOKEN_RESPONSE]: WorktreeTokenResponse;
  [SOCKET_EVENTS.WORKTREE_OPERATION_RESULT]: WorktreeOperationResult;
  // 150-task-ui-git-actions: Manual push from UI
  [SOCKET_EVENTS.WORKTREE_PUSH_REQUEST]: WorktreePushRequest;
  [SOCKET_EVENTS.WORKTREE_PUSH_RESPONSE]: WorktreePushResponse;

  // Flow Events (208-event-driven-agentic-layer)
  [SOCKET_EVENTS.FLOW_TRIGGERED]: {
    flowId: string;
    flowName: string;
    taskId: string;
    triggerEventType: string;
  };
  [SOCKET_EVENTS.FLOW_TRIGGER_FAILED]: {
    flowId: string;
    flowName: string;
    triggerEventType: string;
    error: string;
  };
  [SOCKET_EVENTS.FLOW_CREATED]: { flow: any }; // Placeholder
  [SOCKET_EVENTS.FLOW_UPDATED]: { flow: any }; // Placeholder
  [SOCKET_EVENTS.FLOW_DELETED]: { flowId: string };
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
