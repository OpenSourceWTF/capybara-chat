/**
 * Capybara Enumerations & Constants
 *
 * Shared constants used across the application.
 * Extracted from index.ts to avoid circular dependencies with schemas.ts.
 */
// ===== Status Enums =====
export const SpecStatus = {
    DRAFT: 'DRAFT', // Being written
    READY: 'READY', // Ready to start
    IN_PROGRESS: 'IN_PROGRESS', // Active session running
    BLOCKED: 'BLOCKED', // Waiting on human
    COMPLETE: 'COMPLETE', // All tasks done
    ARCHIVED: 'ARCHIVED', // Hidden from main view
};
export const TaskStatus = {
    PENDING: 'PENDING',
    IN_PROGRESS: 'IN_PROGRESS',
    COMPLETE: 'COMPLETE',
    SKIPPED: 'SKIPPED',
};
export const SessionStatus = {
    PENDING: 'PENDING', // Not started
    RUNNING: 'RUNNING', // Agent actively working
    PAUSED: 'PAUSED', // Manually paused
    WAITING_HUMAN: 'WAITING_HUMAN', // Blocked on human input
    WAITING_FOR_PR: 'WAITING_FOR_PR', // 182: Task session done, awaiting PR review/merge
    COMPLETE: 'COMPLETE', // Finished successfully
    FAILED: 'FAILED', // Error occurred
    CANCELLED: 'CANCELLED', // Task session cancelled
};
export const AgentStatus = {
    IDLE: 'IDLE',
    BUSY: 'BUSY',
    OFFLINE: 'OFFLINE',
};
export const MessageStatus = {
    SENT: 'sent',
    PENDING: 'pending', // In queue, waiting for bridge
    QUEUED: 'queued', // Forwarded to bridge, waiting for processing
    PROCESSING: 'processing',
    STREAMING: 'streaming', // GAP-008 FIX: Message is being streamed (persisted incrementally)
    COMPLETED: 'completed',
    FAILED: 'failed',
};
export const CloneStatus = {
    PENDING: 'pending',
    CLONING: 'cloning',
    READY: 'ready',
    FAILED: 'failed',
};
export const WorkerTaskState = {
    QUEUED: 'queued',
    ASSIGNED: 'assigned',
    RUNNING: 'running',
    PAUSED: 'paused',
    WAITING_FOR_PR: 'waiting_for_pr', // 147: Agent done, PR created, awaiting human review/merge
    COMPLETE: 'complete',
    FAILED: 'failed',
    CANCELLED: 'cancelled',
};
/**
 * Worktree lifecycle status
 */
export const WorktreeStatus = {
    CREATING: 'creating', // git worktree add in progress
    READY: 'ready', // Worktree ready for agent
    PUSHING: 'pushing', // Pushing branch to remote
    PR_PENDING: 'pr_pending', // Waiting for PR creation
    PR_CREATED: 'pr_created', // PR exists, worktree can be cleaned
    CLEANING: 'cleaning', // git worktree remove in progress
    CLEANED: 'cleaned', // Worktree removed
    FAILED: 'failed', // Error state
};
export const SessionHistoryEventType = {
    OPENED: 'opened',
    CLOSED: 'closed',
    RESUMED: 'resumed',
    AGENT_ASSIGNED: 'agent_assigned',
    CONTEXT_INJECTED: 'context_injected',
    ERROR: 'error',
    TOOL_USE: 'tool_use', // Tool invocation event (086-task-session-issues)
    // 189-session-failure-ui: CLI lifecycle events for timeline
    CLI_HALTED: 'cli_halted', // CLI timed out, crashed, or errored (can be resumed)
    CLI_RESUMING: 'cli_resuming', // Attempting to resume CLI session
    CLI_CONTEXT_RESET: 'cli_context_reset', // CLI resume failed, starting fresh session
};
export const MessageRole = {
    USER: 'user',
    ASSISTANT: 'assistant',
    SYSTEM: 'system',
};
export const Priority = {
    LOW: 'low',
    NORMAL: 'normal',
    HIGH: 'high',
    CRITICAL: 'critical',
};
export const AttachmentType = {
    FILE: 'file',
    DIFF: 'diff',
    LOG: 'log',
    SCREENSHOT: 'screenshot',
    OTHER: 'other',
};
export const SecretScope = {
    GLOBAL: 'global',
    AGENT: 'agent',
    SESSION: 'session',
};
export const EventEntityType = {
    SPEC: 'spec',
    TASK: 'task',
    SESSION: 'session',
    AGENT: 'agent',
    CHECKPOINT: 'checkpoint',
    ARTIFACT: 'artifact',
};
/**
 * Entity types for MCP Forms editing
 * Used for entity editors, context injection, and form state management
 */
export const FormEntityType = {
    PROMPT: 'prompt',
    PIPELINE: 'pipeline',
    SPEC: 'spec',
    DOCUMENT: 'document',
    AGENT_DEFINITION: 'agentDefinition',
};
/**
 * Session operation modes
 */
export const SessionMode = {
    CHAT: 'chat',
    ENTITY_EDITING: 'entity-editing',
};
export const ActorType = {
    USER: 'user',
    AGENT: 'agent',
    SYSTEM: 'system',
};
export const GitHubConfigSource = {
    DATABASE: 'database',
    ENVIRONMENT: 'environment',
};
export const GitHubIssueState = {
    OPEN: 'open',
    CLOSED: 'closed',
};
export const GitHubPRState = {
    OPEN: 'open',
    CLOSED: 'closed',
    MERGED: 'merged',
};
/**
 * PR mergeable state from GitHub API
 */
export const PRMergeableState = {
    CLEAN: 'clean', // Can be merged cleanly
    DIRTY: 'dirty', // Has conflicts
    BLOCKED: 'blocked', // Blocked by branch protection
    BEHIND: 'behind', // Base branch is ahead
    UNSTABLE: 'unstable', // Failing required checks
    UNKNOWN: 'unknown', // Not yet determined
};
/**
 * Aggregated CI checks status for a PR
 */
export const PRChecksStatus = {
    PENDING: 'pending', // Checks still running
    SUCCESS: 'success', // All checks passed
    FAILURE: 'failure', // One or more checks failed
    NEUTRAL: 'neutral', // Checks completed with neutral status
    NONE: 'none', // No checks configured
};
/**
 * Review decision for a PR
 */
export const PRReviewDecision = {
    APPROVED: 'approved', // Approved for merge
    CHANGES_REQUESTED: 'changes_requested', // Changes required
    REVIEW_REQUIRED: 'review_required', // Waiting for review
    NONE: 'none', // No reviews yet / not required
};
/**
 * Task resolution - how a task was closed
 */
export const TaskResolution = {
    MERGED: 'merged', // PR merged successfully
    CLOSED_WITHOUT_MERGE: 'closed_without_merge', // PR closed without merging
    SUPERSEDED: 'superseded', // Replaced by another task/PR
    CANCELLED: 'cancelled', // Task cancelled before completion
};
export const Theme = {
    COZY: 'cozy',
    MIDNIGHT: 'midnight',
};
export const OrderDir = {
    ASC: 'asc',
    DESC: 'desc',
};
export const ProcessStatus = {
    STARTING: 'starting',
    RUNNING: 'running',
    PAUSED: 'paused',
    STOPPED: 'stopped',
    FAILED: 'failed',
};
/**
 * EntityStatus - Draft/published status for entities created via chat
 *
 * Entities start as 'draft' (validation bypassed, not usable by system)
 * and transition to 'published' after validation passes.
 */
export const EntityStatus = {
    DRAFT: 'draft',
    PUBLISHED: 'published',
};
/**
 * PromptOutputType - What type of output a prompt generates
 *
 * Used to categorize prompts by their intended output type.
 */
export const PromptOutputType = {
    SPEC: 'spec', // Creates a Spec entity
    PROMPT: 'prompt', // Creates another Prompt (meta-prompts)
    PIPELINE: 'pipeline', // Creates a Pipeline
    DOCUMENT: 'document', // Creates a Markdown Document
    CODE: 'code', // Generates code (no DB entity)
    ANALYSIS: 'analysis', // Creates Document with tag "analysis"
};
/**
 * DocumentCreatedBy - Who created a document version
 */
export const DocumentCreatedBy = {
    USER: 'user',
    AGENT: 'agent',
};
/**
 * DocumentType - Discriminates between regular documents and agent memories
 *
 * - document: Standard markdown documents (library, knowledge base)
 * - memory: Agent session memories (timestamped, session-bound, timeline view)
 */
export const DocumentType = {
    DOCUMENT: 'document',
    MEMORY: 'memory',
};
// ===== Assistant Types =====
export const AssistantPhase = {
    INIT: 'INIT',
    COLLECT: 'COLLECT',
    INTERVIEW: 'INTERVIEW',
    FINALIZE: 'FINALIZE',
    COMPLETE: 'COMPLETE',
};
export const AssistantType = {
    SPEC: 'spec',
    PROMPT: 'prompt',
    GENERAL: 'general',
};
/**
 * Session - An execution instance of a spec OR a assistant conversation
 *
 * Sessions can be paused, resumed, and forked. A fork creates a new session
 * at a "checkpoint" - the forkedFromId points to the parent session.
 *
 * For assistants, sessionType indicates the target entity being built.
 */
export const SessionType = {
    AGENT: 'agent',
    ASSISTANT_SPEC: 'assistant:spec',
    ASSISTANT_PROMPT: 'assistant:prompt',
    ASSISTANT_GENERAL: 'assistant:general',
    TASK: 'task', // Background worker task session
};
/**
 * Cozy color palette for segment visualization
 * Warm, low-pressure colors that work in both light and dark themes
 */
export const SEGMENT_COLORS = [
    '#E8B4B8', // Dusty Rose
    '#A8D5BA', // Sage Green
    '#B8D4E8', // Powder Blue
    '#F5D6A8', // Warm Sand
    '#D4B8E8', // Lavender
    '#E8D4B8', // Latte
    '#B8E8E0', // Seafoam
    '#E8E4B8', // Buttercream
    '#C8B8E8', // Periwinkle
    '#E8C8B8', // Peach
    '#B8E8C8', // Mint
    '#D8E8B8', // Pistachio
];
export const DeliverableType = {
    SPEC: 'spec',
    PROMPT_SEGMENT: 'prompt_segment',
    PROMPT_PIPELINE: 'prompt_pipeline',
    TASK: 'task',
    NONE: 'none',
};
export const AgentModel = {
    SONNET: 'sonnet',
    OPUS: 'opus',
    HAIKU: 'haiku',
    OPUS_LATEST: 'opus-latest',
    INHERIT: 'inherit',
};
/**
 * AgentDefinitionRole - Determines where an agent definition appears in pickers
 *
 * - assistant: Shows in "New Chat" agent picker
 * - subagent: Only shows in agent definition subagent pickers (delegation)
 * - task_agent: Shows for task assignment (long-running independent work)
 */
export const AgentDefinitionRole = {
    ASSISTANT: 'assistant',
    SUBAGENT: 'subagent',
    TASK_AGENT: 'task_agent',
};
export const SOCKET_EVENTS = {
    // Session
    SESSION_SEND: 'session:send',
    SESSION_RESPONSE: 'session:response',
    SESSION_UPDATED: 'session:updated',
    SESSION_MESSAGE: 'session:message',
    SESSION_CONTEXT_INJECTED: 'session:context_injected', // Server -> Client (notification)
    SESSION_CONTEXT_RESET: 'session:context_reset',
    SESSION_CLAUDE_ID: 'session:claude_id',
    SESSION_ERROR: 'session:error',
    // Session lifecycle
    SESSION_CREATED: 'session:created',
    SESSION_HIDDEN: 'session:hidden',
    SESSION_MODEL_SWITCH: 'session:model_switch', // 135: Client -> Server -> Bridge: switch model
    SESSION_STOP: 'session:stop', // 168: Client -> Server -> Bridge: stop current generation
    // Human-in-the-loop events
    SESSION_HUMAN_INPUT_REQUESTED: 'session:human_input_requested',
    SESSION_HUMAN_INPUT_RESPONSE: 'session:human_input_response', // UI -> Server -> Bridge
    SESSION_PROGRESS: 'session:progress',
    SESSION_BLOCKED: 'session:blocked',
    SESSION_HALTED: 'session:halted', // 189: Session halted due to timeout/error (can be resumed)
    SESSION_ARTIFACT: 'session:artifact',
    // Pipeline observability (193: Phase 4)
    SESSION_LOG: 'session:log', // Pipeline logs streamed to UI
    SESSION_PIPELINE_EVENT: 'session:pipeline_event', // Stage transitions and events
    SESSION_PIPELINE_STATE: 'session:pipeline_state', // 199-2.1: Pipeline state persistence (Bridge -> Server)
    // Activity tracking (tool execution, subagent delegation)
    SESSION_ACTIVITY: 'session:activity',
    SESSION_COST: 'session:cost',
    SESSION_TOOL_USE: 'session:tool_use', // Tool execution with input/output details
    SESSION_THINKING: 'session:thinking', // Extended thinking/reasoning content from Claude
    // Context visibility (real-time context usage tracking)
    SESSION_CONTEXT_USAGE: 'session:context_usage', // Bridge -> Server -> Client: context usage update
    SESSION_COMPACTED: 'session:compacted', // Bridge -> Server -> Client: auto-compaction completed
    // System
    BRIDGE_REGISTER: 'bridge:register',
    BRIDGE_HEARTBEAT: 'bridge:heartbeat',
    AGENT_STATUS: 'agent:status',
    WORKSPACE_STATUS_REPORT: 'workspace:status_report',
    WORKSPACE_STATUS_UPDATED: 'workspace:status_updated',
    SYNC_FULL: 'sync:full', // Initial sync of all data
    EVENT: 'event', // Generic event bus forwarding
    COMMAND_RESULT: 'command:result', // Slash command results like /clear
    MESSAGE_STATUS: 'message:status', // Updates to message status (queued, etc)
    // Worker Task Events
    TASK_CREATED: 'task:created',
    TASK_ASSIGNED: 'task:assigned',
    TASK_PROGRESS: 'task:progress',
    TASK_PHASE_CHANGED: 'task:phase_changed',
    TASK_COMPLETE: 'task:complete',
    TASK_FAILED: 'task:failed',
    TASK_BLOCKED: 'task:blocked',
    TASK_OUTPUT: 'task:output', // Streaming output chunks
    TASK_CANCEL: 'task:cancel', // Server -> Bridge: cancel running task
    TASK_CANCELLED: 'task:cancelled', // Broadcast: Task was cancelled
    TASK_UPDATED: 'task:updated', // Broadcast: Task state updated (for real-time UI)
    TASK_COST_UPDATE: 'task:cost_update', // Cost tracking update
    // Task PR Lifecycle Events (055-task-pr-resolution)
    TASK_PR_CREATED: 'task:pr_created', // PR created for task
    TASK_PR_SYNCED: 'task:pr_synced', // PR status refreshed from GitHub
    TASK_PR_MERGED: 'task:pr_merged', // PR merged successfully
    TASK_PR_CLOSED: 'task:pr_closed', // PR closed without merge
    TASK_PR_CHECKS_UPDATED: 'task:pr_checks_updated', // CI checks status changed
    TASK_PR_REVIEW_UPDATED: 'task:pr_review_updated', // Review decision changed
    TASK_RESOLVED: 'task:resolved', // Task reached terminal resolution
    TASK_WAITING_FOR_PR: 'task:waiting_for_pr', // 147: Agent done, awaiting PR review/merge
    // Task Resume & Message Queue Events (090-task-resume)
    SESSION_MESSAGE_QUEUED: 'session:message_queued', // Message queued for running task
    SESSION_MESSAGE_DEQUEUED: 'session:message_dequeued', // Message dequeued for processing
    TASK_RESUMED: 'task:resumed', // Completed/failed task resumed
    TASK_RESUME_FAILED: 'task:resume_failed', // Task resume attempt failed
    // Agent Definition Events
    AGENT_DEFINITION_CREATED: 'agentDefinition:created',
    AGENT_DEFINITION_UPDATED: 'agentDefinition:updated',
    AGENT_DEFINITION_DELETED: 'agentDefinition:deleted',
    // Entity CRUD Events (for UI refetch)
    // These events trigger data refresh in library views and entity viewers
    SPEC_CREATED: 'spec:created',
    SPEC_UPDATED: 'spec:updated',
    SPEC_DELETED: 'spec:deleted',
    DOCUMENT_CREATED: 'document:created',
    DOCUMENT_UPDATED: 'document:updated',
    DOCUMENT_DELETED: 'document:deleted',
    // Agent Memory Events (124-agent-memory-system)
    MEMORY_CREATED: 'memory:created',
    MEMORY_DELETED: 'memory:deleted',
    PROMPT_CREATED: 'prompt:created',
    PROMPT_UPDATED: 'prompt:updated',
    PROMPT_DELETED: 'prompt:deleted',
    // Flow Events (208-event-driven-agentic-layer)
    FLOW_TRIGGERED: 'flow:triggered', // Flow created a task
    FLOW_TRIGGER_FAILED: 'flow:trigger_failed', // Flow failed to create a task
    FLOW_CREATED: 'flow:created',
    FLOW_UPDATED: 'flow:updated',
    FLOW_DELETED: 'flow:deleted',
    // Worktree Operations (092-worktree-design)
    // Bridge → Server: Request fresh token for git operation
    WORKTREE_TOKEN_REQUEST: 'worktree:token:request',
    // Server → Bridge: Return fresh token
    WORKTREE_TOKEN_RESPONSE: 'worktree:token:response',
    // Bridge → Server: Report worktree operation result
    WORKTREE_OPERATION_RESULT: 'worktree:operation:result',
    // Server → Bridge: Request branch push (150-task-ui-git-actions)
    WORKTREE_PUSH_REQUEST: 'worktree:push:request',
    // Bridge → Server: Push result
    WORKTREE_PUSH_RESPONSE: 'worktree:push:response',
};
export const PAGINATION = {
    DEFAULT_LIMIT: 100,
    DEFAULT_OFFSET: 0,
    SESSION_LIST_LIMIT: 50,
    MAX_LIMIT: 1000,
    MESSAGE_FETCH_LIMIT: 100,
    SYNC_FULL_LIMIT: 50,
    /** 139-timeline-pagination: Lower limit for timeline to enable infinite scroll */
    TIMELINE_LIMIT: 40,
};
export const SECRET_NAMES = {
    GITHUB_TOKEN: 'GITHUB_TOKEN',
    GITHUB_OAUTH_TOKEN: 'GITHUB_OAUTH_TOKEN',
    GITHUB_INSTALLATION_PREFIX: 'GITHUB_INSTALLATION_',
    GITHUB_APP_CLIENT_ID: 'GITHUB_APP_CLIENT_ID',
    GITHUB_APP_PRIVATE_KEY: 'GITHUB_APP_PRIVATE_KEY',
    GITHUB_WEBHOOK_SECRET: 'GITHUB_WEBHOOK_SECRET',
    OPENAI_API_KEY: 'OPENAI_API_KEY',
    ANTHROPIC_API_KEY: 'ANTHROPIC_API_KEY',
};
export const MODEL_REGISTRY = {
    'opus-latest': {
        apiModel: 'claude-opus-4-6',
        label: 'Claude Opus 4.6',
        description: 'Latest and most intelligent, best for agents and coding',
        generation: '4.6',
    },
    opus: {
        apiModel: 'claude-opus-4-5-20251101',
        label: 'Claude Opus 4.5',
        description: 'Powerful reasoning, good for complex tasks',
        generation: '4.5',
    },
    sonnet: {
        apiModel: 'claude-sonnet-4-5-20250929',
        label: 'Claude Sonnet 4.5',
        description: 'Fast and capable, good default',
        generation: '4.5',
        isDefault: true,
    },
    haiku: {
        apiModel: 'claude-haiku-4-5-20251001',
        label: 'Claude Haiku 4.5',
        description: 'Fastest response times, near-frontier intelligence',
        generation: '4.5',
    },
};
export function resolveModelToApiString(model) {
    if (!model || model === 'inherit') {
        return MODEL_REGISTRY.sonnet.apiModel;
    }
    const key = model;
    return MODEL_REGISTRY[key]?.apiModel ?? model;
}
export function resolveModelLabel(model) {
    if (!model)
        return MODEL_REGISTRY.sonnet.label;
    if (model === 'inherit')
        return 'Inherit';
    const key = model;
    return MODEL_REGISTRY[key]?.label ?? model;
}
export const MODEL_DEFAULTS = {
    CLAUDE_SONNET: MODEL_REGISTRY.sonnet.apiModel,
    CLAUDE_OPUS: MODEL_REGISTRY['opus-latest'].apiModel,
    CLAUDE_OPUS_45: MODEL_REGISTRY.opus.apiModel,
};
//# sourceMappingURL=enums.js.map