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
export declare const CORS_DEFAULTS: {
    readonly methods: readonly ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"];
    readonly allowedHeaders: readonly ["Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin", "x-api-key", "x-user-id", "x-user-role", "x-workspace-id"];
    readonly exposedHeaders: readonly ["x-user-id", "x-user-role", "x-workspace-id"];
    readonly credentials: true;
    readonly maxAge: 86400;
    readonly DEVELOPMENT_ORIGINS: readonly ["http://localhost:5173", "http://localhost:2279", "http://localhost:2281"];
    readonly PRODUCTION_ORIGINS: readonly string[];
};
import { SessionStatus, SessionType, AgentStatus, MessageStatus, CloneStatus, WorktreeStatus, MessageRole, AttachmentType, SecretScope, EventEntityType, ActorType, GitHubConfigSource, AgentModel, SEGMENT_COLORS } from './enums.js';
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
    prUrl?: string;
    prNumber?: number;
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
    localCommit: string;
    ahead: number;
    behind: number;
    hasConflicts: boolean;
    lastCheckedAt: number;
}
/**
 * Result of a workspace sync operation.
 */
export interface SyncResult {
    success: boolean;
    strategy: 'merge' | 'rebase' | 'reset';
    commitsMerged: number;
    pulled?: boolean;
    pushed?: boolean;
    commitsPulled?: number;
    commitsPushed?: number;
    conflicts?: string[];
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
    blockedBySessions?: string[];
    error?: string;
}
/**
 * Progress payload for long-running workspace operations
 */
export interface WorkspaceProgressPayload {
    workspaceId: string;
    operation: 'clone' | 'sync' | 'delete' | 'merge';
    phase: string;
    progress: number;
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
    source?: GitHubConfigSource;
    username?: string;
    scopes?: string[];
}
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
    owner: {
        login: string;
    };
}
export interface GitHubIssue {
    id: number;
    number: number;
    title: string;
    html_url: string;
    state: 'open' | 'closed';
    user: {
        login: string;
    };
}
export interface GitHubInstallation {
    id: number;
    account: {
        login: string;
        type: string;
    };
}
/**
 * User roles: admin has full access, member sees own + published assets
 */
export declare const UserRoleConst: {
    readonly ADMIN: "admin";
    readonly MEMBER: "member";
};
export type UserRole = (typeof UserRoleConst)[keyof typeof UserRoleConst];
/**
 * User - A GitHub-authenticated account
 */
export interface User {
    id: string;
    githubId: number;
    githubLogin: string;
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
export declare function generateUserId(): string;
/**
 * Generate a secure random refresh token
 */
export declare function generateRefreshToken(): string;
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
    pipelineStatus?: SessionStatus;
    pipelineMessageId?: string;
    pipelineMessageContent?: string;
    pipelineContextInjected?: boolean;
    pipelineContextUsage?: ContextUsage;
    pipelineLastActivity?: number;
    createdBy: string | null;
    author?: Author;
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
    workspaceIds: string[];
    iconSeed: number;
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
 * Workspace - A GitHub repo that agents can work in
 *
 * Agents are locked to one or more workspaces. Each workspace
 * corresponds to a checked-out repo with worktrees for sessions.
 */
export interface Workspace {
    id: string;
    name: string;
    repoUrl: string;
    repoOwner: string;
    repoName: string;
    defaultBranch: string;
    localPath: string;
    worktreesPath: string;
    cloneStatus?: CloneStatus;
    cloneError?: string;
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
export interface AgentContext {
    model?: string;
    [key: string]: unknown;
}
export interface SessionConfig {
    sessionId: string;
    initialPrompt?: string;
    workingDirectory?: string;
    environment?: Record<string, string>;
    worktreePath?: string;
    branchName?: string;
    /** Task ID for background tasks (148-prompt-hierarchy: enables task_update_progress MCP tool) */
    taskId?: string;
    agentContext?: AgentContext;
}
export declare const SessionHandleStatus: {
    readonly RUNNING: "running";
    readonly STOPPED: "stopped";
    readonly ERROR: "error";
};
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
export declare const AgentProviderEventType: {
    readonly MESSAGE: "message";
    readonly THINKING: "thinking";
    readonly TOOL_USE: "tool_use";
    readonly TOOL_RESULT: "tool_result";
    readonly PROGRESS: "progress";
    readonly HUMAN_REQUEST: "human_request";
    readonly ERROR: "error";
    readonly COMPLETE: "complete";
};
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
    resumeSession(sessionId: string, claudeSessionId: string, worktreePath?: string): Promise<SessionHandle>;
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
    streamMessages(sessionId: string, message: string): AsyncGenerator<{
        type: string;
        content?: string;
        data?: unknown;
    }>;
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
/**
 * GitHub API and OAuth URLs
 */
export declare const GITHUB_URLS: {
    readonly API_BASE: "https://api.github.com";
    readonly AUTHORIZE: "https://github.com/login/oauth/authorize";
    readonly ACCESS_TOKEN: "https://github.com/login/oauth/access_token";
    readonly USER: "https://api.github.com/user";
    readonly USER_ORGS: "https://api.github.com/user/orgs";
    readonly USER_REPOS: "https://api.github.com/user/repos";
    readonly INSTALLATIONS: "https://api.github.com/user/installations";
};
/**
 * GitHub API headers
 */
export declare const GITHUB_HEADERS: {
    readonly ACCEPT: "application/vnd.github.v3+json";
    readonly CONTENT_TYPE: "application/json";
};
/**
 * Timeout values in milliseconds
 */
export declare const TIMEOUTS: {
    /** Git clone operation (5 minutes) */
    readonly CLONE: 300000;
    /** Git operation like pull, fetch (1 minute) */
    readonly GIT_OPERATION: 60000;
    /** Worktree cleanup delay (1 hour) */
    readonly WORKTREE_CLEANUP: 3600000;
    /** Event bus wait timeout (30 seconds) */
    readonly EVENT_BUS: 30000;
    /** Startup timeout (1 minute) */
    readonly STARTUP: 60000;
};
/**
 * Content preview/truncation lengths
 */
export declare const CONTENT_LENGTHS: {
    /** Short preview (titles, names) */
    readonly PREVIEW_SHORT: 50;
    /** Long preview (message content) */
    readonly PREVIEW_LONG: 100;
    /** Maximum message length */
    readonly MAX_MESSAGE: 100000;
    /** Maximum spec content length */
    readonly MAX_SPEC: 500000;
};
/**
 * Workspace-related paths and constants
 */
export declare const WORKSPACE: {
    /** Base path for workspace repositories */
    readonly BASE_PATH: "/workspaces";
    /** Base path for worktrees (root-level, outside repos) */
    readonly WORKTREES_BASE: "/workspaces/.worktrees";
    /** Worktrees subdirectory name (legacy, inside repo) */
    readonly WORKTREES_DIR: ".worktrees";
    /** Separator for flattened owner--repo directory names */
    readonly SEPARATOR: "--";
    /** Prefix for AI-generated branches */
    readonly BRANCH_PREFIX: "capybara/";
    /** GitHub HTTPS URL prefix */
    readonly GITHUB_HTTPS_PREFIX: "https://github.com";
};
/**
 * Build flattened workspace directory name: owner--repo
 */
export declare function buildWorkspaceDirName(owner: string, repo: string): string;
/**
 * Parse flattened workspace directory name back to owner and repo
 */
export declare function parseWorkspaceDirName(dirName: string): {
    owner: string;
    repo: string;
} | null;
/**
 * Get the worktrees directory path for a workspace
 */
export declare function getWorktreesPath(repoOwner: string, repoName: string): string;
/**
 * Generate a branch name from task information
 */
export declare function generateBranchName(task: {
    name: string;
    type?: string;
}): string;
/**
 * Agent-related constants
 */
export declare const AGENT: {
    /** Maximum icon seed value for random capybara generation */
    readonly MAX_ICON_SEED: 1000000;
};
/**
 * Git defaults
 */
export declare const GIT: {
    /** Default branch name */
    readonly DEFAULT_BRANCH: "main";
};
/**
 * Default server URLs and ports
 */
export declare const SERVER_DEFAULTS: {
    /** Main Capybara server URL */
    readonly SERVER_URL: "http://localhost:2279";
    /** Server port */
    readonly SERVER_PORT: 2279;
    /** Agent bridge URL */
    readonly BRIDGE_URL: "http://localhost:2280";
    /** Bridge port */
    readonly BRIDGE_PORT: 2280;
    /** Huddle frontend URL */
    readonly HUDDLE_URL: "http://localhost:2281";
    /** Huddle frontend port (alias: GATEWAY_PORT for backwards compatibility) */
    readonly HUDDLE_PORT: 2281;
    /** @deprecated Use HUDDLE_PORT instead */
    readonly GATEWAY_PORT: 2281;
};
export * from './logger.js';
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
    owner: {
        login: string;
    };
}
export interface GitHubIssue {
    id: number;
    number: number;
    title: string;
    html_url: string;
    state: 'open' | 'closed';
    user: {
        login: string;
    };
}
export interface GitHubInstallation {
    id: number;
    account: {
        login: string;
        type: string;
    };
}
//# sourceMappingURL=index.d.ts.map