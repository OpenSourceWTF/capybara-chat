/**
 * Capybara Event Bus Types
 *
 * Event-driven architecture from day 1 - no retrofitting.
 * All state changes emit events; UI and services subscribe.
 */
export type EventCategory = 'spec' | 'task' | 'session' | 'checkpoint' | 'agent' | 'artifact' | 'prompt' | 'document' | 'memory' | 'agentDefinition' | 'worker_task' | 'human_input_request' | 'system';
export type SpecEventType = 'spec:created' | 'spec:updated' | 'spec:deleted' | 'spec:status_changed';
export type TaskEventType = 'task:created' | 'task:updated' | 'task:completed' | 'task:skipped';
export type SessionEventType = 'session:created' | 'session:started' | 'session:paused' | 'session:resumed' | 'session:forked' | 'session:waiting_for_pr' | 'session:completed' | 'session:failed' | 'session:hidden' | 'session:updated' | 'session:human_input_requested' | 'session:human_input_received' | 'session:progress' | 'session:cleanup_started' | 'session:cleanup_completed';
export type AgentEventType = 'agent:registered' | 'agent:unregistered' | 'agent:status_changed' | 'agent:assigned' | 'agent:released';
export type ArtifactEventType = 'artifact:created' | 'artifact:updated' | 'artifact:deleted';
export type PromptEventType = 'prompt:created' | 'prompt:updated' | 'prompt:deleted';
export type DocumentEventType = 'document:created' | 'document:updated' | 'document:deleted' | 'document:published';
export type MemoryEventType = 'memory:created' | 'memory:deleted';
export type AgentDefinitionEventType = 'agentDefinition:created' | 'agentDefinition:updated' | 'agentDefinition:deleted';
export type WorktreeEventType = 'worktree:created' | 'worktree:cleaned' | 'worktree:cleanup:started' | 'worktree:cleanup:complete' | 'worktree:cleanup:failed';
export type JobEventType = 'job:started' | 'job:stopped' | 'job:run_complete' | 'job:error';
export type WorkerTaskEventType = 'worker_task:created' | 'worker_task:state_changed' | 'worker_task:claimed' | 'worker_task:pr_created' | 'worker_task:pr_synced' | 'worker_task:pr_merged' | 'worker_task:pr_closed' | 'worker_task:pr_checks_updated' | 'worker_task:pr_review_updated' | 'worker_task:resolved';
export type HumanInputEventType = 'human_input:requested' | 'human_input:responded' | 'human_input:cancelled' | 'human_input:timeout';
export type SystemEventType = 'system:startup' | 'system:shutdown' | 'system:error' | 'workspace:created' | 'workspace:updated' | 'workspace:deleted' | 'workspace:synced' | 'workspace:clone_status_changed' | 'workspace:status_reconciled' | WorktreeEventType | JobEventType;
export type AllEventTypes = SessionEventType | AgentEventType | ArtifactEventType | MemoryEventType | HumanInputEventType | SystemEventType;
export declare const EventSource: {
    readonly SERVER: "server";
    readonly AGENT_BRIDGE: "agent-bridge";
    readonly AGENT: "agent";
    readonly UI: "ui";
    readonly WORKSPACE_CLONE_SERVICE: "workspace-clone-service";
    readonly WORKSPACE_LIFECYCLE_MANAGER: "workspace-lifecycle-manager";
    readonly WORKSPACE_SERVICE: "workspace-service";
    readonly WORKTREE_SERVICE: "worktree-service";
    readonly GIT_SERVICE: "git-service";
    readonly WORKSPACE_SYNC_JOB: "workspace-sync-job";
    readonly WORKTREE_CLEANUP_JOB: "worktree-cleanup-job";
    readonly TASK_PR_SYNC_JOB: "task-pr-sync-job";
};
export type EventSource = (typeof EventSource)[keyof typeof EventSource];
export interface CapybaraEvent<T = unknown> {
    id: string;
    type: AllEventTypes;
    category: EventCategory;
    timestamp: number;
    source: EventSource;
    payload: T;
    metadata?: {
        correlationId?: string;
        causedBy?: string;
        userId?: string;
        agentId?: string;
        sessionId?: string;
        specId?: string;
        workspaceId?: string;
        worktreeId?: string;
    };
}
export interface SessionProgressPayload {
    sessionId: string;
    message: string;
    phase?: 'analyzing' | 'implementing' | 'testing' | 'finalizing';
}
export interface AgentStatusChangedPayload {
    agentId: string;
    previousStatus: import('./index.js').AgentStatus;
    newStatus: import('./index.js').AgentStatus;
}
export type EventHandler<T = unknown> = (event: CapybaraEvent<T>) => void | Promise<void>;
export type Unsubscribe = () => void;
export interface EventBus {
    /** Emit an event to all subscribers */
    emit<T>(event: Omit<CapybaraEvent<T>, 'id' | 'timestamp'>): void;
    /** Subscribe to all events of a type */
    on<T>(type: AllEventTypes, handler: EventHandler<T>): Unsubscribe;
    /** Subscribe to all events in a category */
    onCategory(category: EventCategory, handler: EventHandler): Unsubscribe;
    /** Subscribe to all events */
    onAny(handler: EventHandler): Unsubscribe;
    /** One-time subscription */
    once<T>(type: AllEventTypes, handler: EventHandler<T>): Unsubscribe;
    /** Wait for a specific event */
    waitFor<T>(type: AllEventTypes, timeout?: number): Promise<CapybaraEvent<T>>;
}
export interface PersistedEvent extends CapybaraEvent {
    persistedAt: number;
}
//# sourceMappingURL=events.d.ts.map