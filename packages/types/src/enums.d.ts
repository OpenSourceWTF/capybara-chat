/**
 * Capybara Enumerations & Constants
 *
 * Shared constants used across the application.
 * Extracted from index.ts to avoid circular dependencies with schemas.ts.
 */
export declare const SpecStatus: {
    readonly DRAFT: "DRAFT";
    readonly READY: "READY";
    readonly IN_PROGRESS: "IN_PROGRESS";
    readonly BLOCKED: "BLOCKED";
    readonly COMPLETE: "COMPLETE";
    readonly ARCHIVED: "ARCHIVED";
};
export type SpecStatus = (typeof SpecStatus)[keyof typeof SpecStatus];
export declare const TaskStatus: {
    readonly PENDING: "PENDING";
    readonly IN_PROGRESS: "IN_PROGRESS";
    readonly COMPLETE: "COMPLETE";
    readonly SKIPPED: "SKIPPED";
};
export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];
export declare const SessionStatus: {
    readonly PENDING: "PENDING";
    readonly RUNNING: "RUNNING";
    readonly PAUSED: "PAUSED";
    readonly WAITING_HUMAN: "WAITING_HUMAN";
    readonly WAITING_FOR_PR: "WAITING_FOR_PR";
    readonly COMPLETE: "COMPLETE";
    readonly FAILED: "FAILED";
    readonly CANCELLED: "CANCELLED";
};
export type SessionStatus = (typeof SessionStatus)[keyof typeof SessionStatus];
export declare const AgentStatus: {
    readonly IDLE: "IDLE";
    readonly BUSY: "BUSY";
    readonly OFFLINE: "OFFLINE";
};
export type AgentStatus = (typeof AgentStatus)[keyof typeof AgentStatus];
export declare const MessageStatus: {
    readonly SENT: "sent";
    readonly PENDING: "pending";
    readonly QUEUED: "queued";
    readonly PROCESSING: "processing";
    readonly STREAMING: "streaming";
    readonly COMPLETED: "completed";
    readonly FAILED: "failed";
};
export type MessageStatus = (typeof MessageStatus)[keyof typeof MessageStatus];
export declare const CloneStatus: {
    readonly PENDING: "pending";
    readonly CLONING: "cloning";
    readonly READY: "ready";
    readonly FAILED: "failed";
};
export type CloneStatus = (typeof CloneStatus)[keyof typeof CloneStatus];
export declare const WorkerTaskState: {
    readonly QUEUED: "queued";
    readonly ASSIGNED: "assigned";
    readonly RUNNING: "running";
    readonly PAUSED: "paused";
    readonly WAITING_FOR_PR: "waiting_for_pr";
    readonly COMPLETE: "complete";
    readonly FAILED: "failed";
    readonly CANCELLED: "cancelled";
};
export type WorkerTaskState = (typeof WorkerTaskState)[keyof typeof WorkerTaskState];
/**
 * Worktree lifecycle status
 */
export declare const WorktreeStatus: {
    readonly CREATING: "creating";
    readonly READY: "ready";
    readonly PUSHING: "pushing";
    readonly PR_PENDING: "pr_pending";
    readonly PR_CREATED: "pr_created";
    readonly CLEANING: "cleaning";
    readonly CLEANED: "cleaned";
    readonly FAILED: "failed";
};
export type WorktreeStatus = (typeof WorktreeStatus)[keyof typeof WorktreeStatus];
export declare const SessionHistoryEventType: {
    readonly OPENED: "opened";
    readonly CLOSED: "closed";
    readonly RESUMED: "resumed";
    readonly AGENT_ASSIGNED: "agent_assigned";
    readonly CONTEXT_INJECTED: "context_injected";
    readonly ERROR: "error";
    readonly TOOL_USE: "tool_use";
    readonly CLI_HALTED: "cli_halted";
    readonly CLI_RESUMING: "cli_resuming";
    readonly CLI_CONTEXT_RESET: "cli_context_reset";
};
export type SessionHistoryEventType = (typeof SessionHistoryEventType)[keyof typeof SessionHistoryEventType];
export declare const MessageRole: {
    readonly USER: "user";
    readonly ASSISTANT: "assistant";
    readonly SYSTEM: "system";
};
export type MessageRole = (typeof MessageRole)[keyof typeof MessageRole];
export declare const Priority: {
    readonly LOW: "low";
    readonly NORMAL: "normal";
    readonly HIGH: "high";
    readonly CRITICAL: "critical";
};
export type Priority = (typeof Priority)[keyof typeof Priority];
export declare const AttachmentType: {
    readonly FILE: "file";
    readonly DIFF: "diff";
    readonly LOG: "log";
    readonly SCREENSHOT: "screenshot";
    readonly OTHER: "other";
};
export type AttachmentType = (typeof AttachmentType)[keyof typeof AttachmentType];
export declare const SecretScope: {
    readonly GLOBAL: "global";
    readonly AGENT: "agent";
    readonly SESSION: "session";
};
export type SecretScope = (typeof SecretScope)[keyof typeof SecretScope];
export declare const EventEntityType: {
    readonly SPEC: "spec";
    readonly TASK: "task";
    readonly SESSION: "session";
    readonly AGENT: "agent";
    readonly CHECKPOINT: "checkpoint";
    readonly ARTIFACT: "artifact";
};
export type EventEntityType = (typeof EventEntityType)[keyof typeof EventEntityType];
/**
 * Entity types for MCP Forms editing
 * Used for entity editors, context injection, and form state management
 */
export declare const FormEntityType: {
    readonly PROMPT: "prompt";
    readonly PIPELINE: "pipeline";
    readonly SPEC: "spec";
    readonly DOCUMENT: "document";
    readonly AGENT_DEFINITION: "agentDefinition";
};
export type FormEntityType = (typeof FormEntityType)[keyof typeof FormEntityType];
/**
 * Session operation modes
 */
export declare const SessionMode: {
    readonly CHAT: "chat";
    readonly ENTITY_EDITING: "entity-editing";
};
export type SessionMode = (typeof SessionMode)[keyof typeof SessionMode];
export declare const ActorType: {
    readonly USER: "user";
    readonly AGENT: "agent";
    readonly SYSTEM: "system";
};
export type ActorType = (typeof ActorType)[keyof typeof ActorType];
export declare const GitHubConfigSource: {
    readonly DATABASE: "database";
    readonly ENVIRONMENT: "environment";
};
export type GitHubConfigSource = (typeof GitHubConfigSource)[keyof typeof GitHubConfigSource];
export declare const GitHubIssueState: {
    readonly OPEN: "open";
    readonly CLOSED: "closed";
};
export type GitHubIssueState = (typeof GitHubIssueState)[keyof typeof GitHubIssueState];
export declare const GitHubPRState: {
    readonly OPEN: "open";
    readonly CLOSED: "closed";
    readonly MERGED: "merged";
};
export type GitHubPRState = (typeof GitHubPRState)[keyof typeof GitHubPRState];
/**
 * PR mergeable state from GitHub API
 */
export declare const PRMergeableState: {
    readonly CLEAN: "clean";
    readonly DIRTY: "dirty";
    readonly BLOCKED: "blocked";
    readonly BEHIND: "behind";
    readonly UNSTABLE: "unstable";
    readonly UNKNOWN: "unknown";
};
export type PRMergeableState = (typeof PRMergeableState)[keyof typeof PRMergeableState];
/**
 * Aggregated CI checks status for a PR
 */
export declare const PRChecksStatus: {
    readonly PENDING: "pending";
    readonly SUCCESS: "success";
    readonly FAILURE: "failure";
    readonly NEUTRAL: "neutral";
    readonly NONE: "none";
};
export type PRChecksStatus = (typeof PRChecksStatus)[keyof typeof PRChecksStatus];
/**
 * Review decision for a PR
 */
export declare const PRReviewDecision: {
    readonly APPROVED: "approved";
    readonly CHANGES_REQUESTED: "changes_requested";
    readonly REVIEW_REQUIRED: "review_required";
    readonly NONE: "none";
};
export type PRReviewDecision = (typeof PRReviewDecision)[keyof typeof PRReviewDecision];
/**
 * Task resolution - how a task was closed
 */
export declare const TaskResolution: {
    readonly MERGED: "merged";
    readonly CLOSED_WITHOUT_MERGE: "closed_without_merge";
    readonly SUPERSEDED: "superseded";
    readonly CANCELLED: "cancelled";
};
export type TaskResolution = (typeof TaskResolution)[keyof typeof TaskResolution];
export declare const Theme: {
    readonly COZY: "cozy";
    readonly MIDNIGHT: "midnight";
};
export type Theme = (typeof Theme)[keyof typeof Theme];
export declare const OrderDir: {
    readonly ASC: "asc";
    readonly DESC: "desc";
};
export type OrderDir = (typeof OrderDir)[keyof typeof OrderDir];
export declare const ProcessStatus: {
    readonly STARTING: "starting";
    readonly RUNNING: "running";
    readonly PAUSED: "paused";
    readonly STOPPED: "stopped";
    readonly FAILED: "failed";
};
export type ProcessStatus = (typeof ProcessStatus)[keyof typeof ProcessStatus];
/**
 * EntityStatus - Draft/published status for entities created via chat
 *
 * Entities start as 'draft' (validation bypassed, not usable by system)
 * and transition to 'published' after validation passes.
 */
export declare const EntityStatus: {
    readonly DRAFT: "draft";
    readonly PUBLISHED: "published";
};
export type EntityStatus = (typeof EntityStatus)[keyof typeof EntityStatus];
/**
 * PromptOutputType - What type of output a prompt generates
 *
 * Used to categorize prompts by their intended output type.
 */
export declare const PromptOutputType: {
    readonly SPEC: "spec";
    readonly PROMPT: "prompt";
    readonly PIPELINE: "pipeline";
    readonly DOCUMENT: "document";
    readonly CODE: "code";
    readonly ANALYSIS: "analysis";
};
export type PromptOutputType = (typeof PromptOutputType)[keyof typeof PromptOutputType];
/**
 * DocumentCreatedBy - Who created a document version
 */
export declare const DocumentCreatedBy: {
    readonly USER: "user";
    readonly AGENT: "agent";
};
export type DocumentCreatedBy = (typeof DocumentCreatedBy)[keyof typeof DocumentCreatedBy];
/**
 * DocumentType - Discriminates between regular documents and agent memories
 *
 * - document: Standard markdown documents (library, knowledge base)
 * - memory: Agent session memories (timestamped, session-bound, timeline view)
 */
export declare const DocumentType: {
    readonly DOCUMENT: "document";
    readonly MEMORY: "memory";
};
export type DocumentType = (typeof DocumentType)[keyof typeof DocumentType];
export declare const AssistantPhase: {
    readonly INIT: "INIT";
    readonly COLLECT: "COLLECT";
    readonly INTERVIEW: "INTERVIEW";
    readonly FINALIZE: "FINALIZE";
    readonly COMPLETE: "COMPLETE";
};
export type AssistantPhase = (typeof AssistantPhase)[keyof typeof AssistantPhase];
export declare const AssistantType: {
    readonly SPEC: "spec";
    readonly PROMPT: "prompt";
    readonly GENERAL: "general";
};
export type AssistantType = (typeof AssistantType)[keyof typeof AssistantType];
/**
 * Session - An execution instance of a spec OR a assistant conversation
 *
 * Sessions can be paused, resumed, and forked. A fork creates a new session
 * at a "checkpoint" - the forkedFromId points to the parent session.
 *
 * For assistants, sessionType indicates the target entity being built.
 */
export declare const SessionType: {
    readonly AGENT: "agent";
    readonly ASSISTANT_SPEC: "assistant:spec";
    readonly ASSISTANT_PROMPT: "assistant:prompt";
    readonly ASSISTANT_GENERAL: "assistant:general";
    readonly TASK: "task";
};
export type SessionType = (typeof SessionType)[keyof typeof SessionType];
/**
 * Cozy color palette for segment visualization
 * Warm, low-pressure colors that work in both light and dark themes
 */
export declare const SEGMENT_COLORS: readonly ["#E8B4B8", "#A8D5BA", "#B8D4E8", "#F5D6A8", "#D4B8E8", "#E8D4B8", "#B8E8E0", "#E8E4B8", "#C8B8E8", "#E8C8B8", "#B8E8C8", "#D8E8B8"];
export declare const DeliverableType: {
    readonly SPEC: "spec";
    readonly PROMPT_SEGMENT: "prompt_segment";
    readonly PROMPT_PIPELINE: "prompt_pipeline";
    readonly TASK: "task";
    readonly NONE: "none";
};
export type DeliverableType = (typeof DeliverableType)[keyof typeof DeliverableType];
export declare const AgentModel: {
    readonly SONNET: "sonnet";
    readonly OPUS: "opus";
    readonly HAIKU: "haiku";
    readonly OPUS_LATEST: "opus-latest";
    readonly INHERIT: "inherit";
};
export type AgentModel = (typeof AgentModel)[keyof typeof AgentModel];
/**
 * AgentDefinitionRole - Determines where an agent definition appears in pickers
 *
 * - assistant: Shows in "New Chat" agent picker
 * - subagent: Only shows in agent definition subagent pickers (delegation)
 * - task_agent: Shows for task assignment (long-running independent work)
 */
export declare const AgentDefinitionRole: {
    readonly ASSISTANT: "assistant";
    readonly SUBAGENT: "subagent";
    readonly TASK_AGENT: "task_agent";
};
export type AgentDefinitionRole = (typeof AgentDefinitionRole)[keyof typeof AgentDefinitionRole];
export declare const SOCKET_EVENTS: {
    readonly SESSION_SEND: "session:send";
    readonly SESSION_RESPONSE: "session:response";
    readonly SESSION_UPDATED: "session:updated";
    readonly SESSION_MESSAGE: "session:message";
    readonly SESSION_CONTEXT_INJECTED: "session:context_injected";
    readonly SESSION_CONTEXT_RESET: "session:context_reset";
    readonly SESSION_CLAUDE_ID: "session:claude_id";
    readonly SESSION_ERROR: "session:error";
    readonly SESSION_CREATED: "session:created";
    readonly SESSION_HIDDEN: "session:hidden";
    readonly SESSION_MODEL_SWITCH: "session:model_switch";
    readonly SESSION_STOP: "session:stop";
    readonly SESSION_HUMAN_INPUT_REQUESTED: "session:human_input_requested";
    readonly SESSION_HUMAN_INPUT_RESPONSE: "session:human_input_response";
    readonly SESSION_PROGRESS: "session:progress";
    readonly SESSION_BLOCKED: "session:blocked";
    readonly SESSION_HALTED: "session:halted";
    readonly SESSION_ARTIFACT: "session:artifact";
    readonly SESSION_LOG: "session:log";
    readonly SESSION_PIPELINE_EVENT: "session:pipeline_event";
    readonly SESSION_PIPELINE_STATE: "session:pipeline_state";
    readonly SESSION_ACTIVITY: "session:activity";
    readonly SESSION_COST: "session:cost";
    readonly SESSION_TOOL_USE: "session:tool_use";
    readonly SESSION_THINKING: "session:thinking";
    readonly SESSION_CONTEXT_USAGE: "session:context_usage";
    readonly SESSION_COMPACTED: "session:compacted";
    readonly BRIDGE_REGISTER: "bridge:register";
    readonly BRIDGE_HEARTBEAT: "bridge:heartbeat";
    readonly AGENT_STATUS: "agent:status";
    readonly WORKSPACE_STATUS_REPORT: "workspace:status_report";
    readonly WORKSPACE_STATUS_UPDATED: "workspace:status_updated";
    readonly SYNC_FULL: "sync:full";
    readonly EVENT: "event";
    readonly COMMAND_RESULT: "command:result";
    readonly MESSAGE_STATUS: "message:status";
    readonly TASK_CREATED: "task:created";
    readonly TASK_ASSIGNED: "task:assigned";
    readonly TASK_PROGRESS: "task:progress";
    readonly TASK_PHASE_CHANGED: "task:phase_changed";
    readonly TASK_COMPLETE: "task:complete";
    readonly TASK_FAILED: "task:failed";
    readonly TASK_BLOCKED: "task:blocked";
    readonly TASK_OUTPUT: "task:output";
    readonly TASK_CANCEL: "task:cancel";
    readonly TASK_CANCELLED: "task:cancelled";
    readonly TASK_UPDATED: "task:updated";
    readonly TASK_COST_UPDATE: "task:cost_update";
    readonly TASK_PR_CREATED: "task:pr_created";
    readonly TASK_PR_SYNCED: "task:pr_synced";
    readonly TASK_PR_MERGED: "task:pr_merged";
    readonly TASK_PR_CLOSED: "task:pr_closed";
    readonly TASK_PR_CHECKS_UPDATED: "task:pr_checks_updated";
    readonly TASK_PR_REVIEW_UPDATED: "task:pr_review_updated";
    readonly TASK_RESOLVED: "task:resolved";
    readonly TASK_WAITING_FOR_PR: "task:waiting_for_pr";
    readonly SESSION_MESSAGE_QUEUED: "session:message_queued";
    readonly SESSION_MESSAGE_DEQUEUED: "session:message_dequeued";
    readonly TASK_RESUMED: "task:resumed";
    readonly TASK_RESUME_FAILED: "task:resume_failed";
    readonly AGENT_DEFINITION_CREATED: "agentDefinition:created";
    readonly AGENT_DEFINITION_UPDATED: "agentDefinition:updated";
    readonly AGENT_DEFINITION_DELETED: "agentDefinition:deleted";
    readonly SPEC_CREATED: "spec:created";
    readonly SPEC_UPDATED: "spec:updated";
    readonly SPEC_DELETED: "spec:deleted";
    readonly DOCUMENT_CREATED: "document:created";
    readonly DOCUMENT_UPDATED: "document:updated";
    readonly DOCUMENT_DELETED: "document:deleted";
    readonly MEMORY_CREATED: "memory:created";
    readonly MEMORY_DELETED: "memory:deleted";
    readonly PROMPT_CREATED: "prompt:created";
    readonly PROMPT_UPDATED: "prompt:updated";
    readonly PROMPT_DELETED: "prompt:deleted";
    readonly FLOW_TRIGGERED: "flow:triggered";
    readonly FLOW_TRIGGER_FAILED: "flow:trigger_failed";
    readonly FLOW_CREATED: "flow:created";
    readonly FLOW_UPDATED: "flow:updated";
    readonly FLOW_DELETED: "flow:deleted";
    readonly WORKTREE_TOKEN_REQUEST: "worktree:token:request";
    readonly WORKTREE_TOKEN_RESPONSE: "worktree:token:response";
    readonly WORKTREE_OPERATION_RESULT: "worktree:operation:result";
    readonly WORKTREE_PUSH_REQUEST: "worktree:push:request";
    readonly WORKTREE_PUSH_RESPONSE: "worktree:push:response";
};
export type SocketEvents = typeof SOCKET_EVENTS;
export declare const PAGINATION: {
    readonly DEFAULT_LIMIT: 100;
    readonly DEFAULT_OFFSET: 0;
    readonly SESSION_LIST_LIMIT: 50;
    readonly MAX_LIMIT: 1000;
    readonly MESSAGE_FETCH_LIMIT: 100;
    readonly SYNC_FULL_LIMIT: 50;
    /** 139-timeline-pagination: Lower limit for timeline to enable infinite scroll */
    readonly TIMELINE_LIMIT: 40;
};
export declare const SECRET_NAMES: {
    readonly GITHUB_TOKEN: "GITHUB_TOKEN";
    readonly GITHUB_OAUTH_TOKEN: "GITHUB_OAUTH_TOKEN";
    readonly GITHUB_INSTALLATION_PREFIX: "GITHUB_INSTALLATION_";
    readonly GITHUB_APP_CLIENT_ID: "GITHUB_APP_CLIENT_ID";
    readonly GITHUB_APP_PRIVATE_KEY: "GITHUB_APP_PRIVATE_KEY";
    readonly GITHUB_WEBHOOK_SECRET: "GITHUB_WEBHOOK_SECRET";
    readonly OPENAI_API_KEY: "OPENAI_API_KEY";
    readonly ANTHROPIC_API_KEY: "ANTHROPIC_API_KEY";
};
export type SecretName = (typeof SECRET_NAMES)[keyof typeof SECRET_NAMES];
/**
 * Unified model registry — single source of truth for all Claude model metadata.
 */
export interface ModelRegistryEntry {
    apiModel: string;
    label: string;
    description: string;
    generation: string;
    isDefault?: boolean;
}
export declare const MODEL_REGISTRY: {
    readonly 'opus-latest': {
        readonly apiModel: "claude-opus-4-6";
        readonly label: "Claude Opus 4.6";
        readonly description: "Latest and most intelligent, best for agents and coding";
        readonly generation: "4.6";
    };
    readonly opus: {
        readonly apiModel: "claude-opus-4-5-20251101";
        readonly label: "Claude Opus 4.5";
        readonly description: "Powerful reasoning, good for complex tasks";
        readonly generation: "4.5";
    };
    readonly sonnet: {
        readonly apiModel: "claude-sonnet-4-5-20250929";
        readonly label: "Claude Sonnet 4.5";
        readonly description: "Fast and capable, good default";
        readonly generation: "4.5";
        readonly isDefault: true;
    };
    readonly haiku: {
        readonly apiModel: "claude-haiku-4-5-20251001";
        readonly label: "Claude Haiku 4.5";
        readonly description: "Fastest response times, near-frontier intelligence";
        readonly generation: "4.5";
    };
};
export declare function resolveModelToApiString(model: AgentModel | string | undefined): string;
export declare function resolveModelLabel(model: AgentModel | string | undefined): string;
export declare const MODEL_DEFAULTS: {
    readonly CLAUDE_SONNET: "claude-sonnet-4-5-20250929";
    readonly CLAUDE_OPUS: "claude-opus-4-6";
    readonly CLAUDE_OPUS_45: "claude-opus-4-5-20251101";
};
//# sourceMappingURL=enums.d.ts.map