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
    ],
    PRODUCTION_ORIGINS: [],
};
/**
 * User roles: admin has full access, member sees own + published assets
 */
export const UserRoleConst = {
    ADMIN: 'admin',
    MEMBER: 'member',
};
/**
 * Generate unique ID for users
 */
export function generateUserId() {
    return `user_${crypto.randomUUID()}`;
}
/**
 * Generate a secure random refresh token
 */
export function generateRefreshToken() {
    // 32 bytes = 256 bits of entropy, base64url encoded
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
export const SessionHandleStatus = {
    RUNNING: 'running',
    STOPPED: 'stopped',
    ERROR: 'error',
};
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
};
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
};
/**
 * GitHub API headers
 */
export const GITHUB_HEADERS = {
    ACCEPT: 'application/vnd.github.v3+json',
    CONTENT_TYPE: 'application/json',
};
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
};
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
};
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
};
// ===== Workspace Path Helpers =====
/**
 * Build flattened workspace directory name: owner--repo
 */
export function buildWorkspaceDirName(owner, repo) {
    return `${owner}${WORKSPACE.SEPARATOR}${repo}`;
}
/**
 * Parse flattened workspace directory name back to owner and repo
 */
export function parseWorkspaceDirName(dirName) {
    const idx = dirName.indexOf(WORKSPACE.SEPARATOR);
    if (idx === -1)
        return null;
    return {
        owner: dirName.substring(0, idx),
        repo: dirName.substring(idx + WORKSPACE.SEPARATOR.length),
    };
}
/**
 * Get the worktrees directory path for a workspace
 */
export function getWorktreesPath(repoOwner, repoName) {
    return `${WORKSPACE.WORKTREES_BASE}/${buildWorkspaceDirName(repoOwner, repoName)}`;
}
/**
 * Generate a branch name from task information
 */
export function generateBranchName(task) {
    // Map task types to conventional prefixes
    const typeMap = {
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
        .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
        .trim()
        .replace(/\s+/g, '-') // Spaces to dashes
        .replace(/-+/g, '-') // Collapse multiple dashes
        .substring(0, 40); // Max 40 chars for description
    return `${WORKSPACE.BRANCH_PREFIX}${prefix}/${slug}`;
}
/**
 * Agent-related constants
 */
export const AGENT = {
    /** Maximum icon seed value for random capybara generation */
    MAX_ICON_SEED: 1_000_000,
};
/**
 * Git defaults
 */
export const GIT = {
    /** Default branch name */
    DEFAULT_BRANCH: 'main',
};
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
};
export * from './logger.js';
//# sourceMappingURL=index.js.map