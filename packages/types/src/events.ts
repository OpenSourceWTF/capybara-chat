/**
 * Capybara Event Bus Types
 * 
 * Event-driven architecture from day 1 - no retrofitting.
 * All state changes emit events; UI and services subscribe.
 */

// ===== Event Categories =====

export type EventCategory =
  | 'spec'
  | 'task'
  | 'session'
  | 'checkpoint'
  | 'agent'
  | 'artifact'
  | 'prompt'
  | 'document'
  | 'memory'
  | 'agentDefinition'
  | 'worker_task'
  | 'human_input_request'
  | 'system';

// ===== Event Types =====

export type SpecEventType =
  | 'spec:created'
  | 'spec:updated'
  | 'spec:deleted'
  | 'spec:status_changed';

export type TaskEventType =
  | 'task:created'
  | 'task:updated'
  | 'task:completed'
  | 'task:skipped';

export type SessionEventType =
  | 'session:created'
  | 'session:started'
  | 'session:paused'
  | 'session:resumed'
  | 'session:forked'
  | 'session:waiting_for_pr'  // 182: Task session done, awaiting PR resolution
  | 'session:completed'
  | 'session:failed'
  | 'session:hidden'
  | 'session:updated'
  | 'session:human_input_requested'
  | 'session:human_input_received'
  | 'session:progress'
  | 'session:cleanup_started'
  | 'session:cleanup_completed';

export type AgentEventType =
  | 'agent:registered'
  | 'agent:unregistered'
  | 'agent:status_changed'
  | 'agent:assigned'
  | 'agent:released';

export type ArtifactEventType =
  | 'artifact:created'
  | 'artifact:updated'
  | 'artifact:deleted';

export type PromptEventType =
  | 'prompt:created'
  | 'prompt:updated'
  | 'prompt:deleted';

export type DocumentEventType =
  | 'document:created'
  | 'document:updated'
  | 'document:deleted'
  | 'document:published';

// Memory events (124-agent-memory-system)
export type MemoryEventType =
  | 'memory:created'
  | 'memory:deleted';

export type AgentDefinitionEventType =
  | 'agentDefinition:created'
  | 'agentDefinition:updated'
  | 'agentDefinition:deleted';

export type WorktreeEventType =
  | 'worktree:created'
  | 'worktree:cleaned'
  | 'worktree:cleanup:started'
  | 'worktree:cleanup:complete'
  | 'worktree:cleanup:failed';

export type JobEventType =
  | 'job:started'
  | 'job:stopped'
  | 'job:run_complete'
  | 'job:error';

export type WorkerTaskEventType =
  | 'worker_task:created'
  | 'worker_task:state_changed'
  | 'worker_task:claimed'
  | 'worker_task:pr_created'
  | 'worker_task:pr_synced'
  | 'worker_task:pr_merged'
  | 'worker_task:pr_closed'
  | 'worker_task:pr_checks_updated'
  | 'worker_task:pr_review_updated'
  | 'worker_task:resolved';

export type HumanInputEventType =
  | 'human_input:requested'
  | 'human_input:responded'
  | 'human_input:cancelled'
  | 'human_input:timeout';

export type SystemEventType =
  | 'system:startup'
  | 'system:shutdown'
  | 'system:error'
  | 'workspace:created'
  | 'workspace:updated'
  | 'workspace:deleted'
  | 'workspace:synced'
  | 'workspace:clone_status_changed'
  | 'workspace:status_reconciled'
  | WorktreeEventType
  | JobEventType;

export type AllEventTypes =
  | SessionEventType
  | AgentEventType
  | ArtifactEventType
  | MemoryEventType
  | HumanInputEventType
  | SystemEventType;

// ===== Event Source =====

export const EventSource = {
  SERVER: 'server',
  AGENT_BRIDGE: 'agent-bridge',
  AGENT: 'agent',
  UI: 'ui',
  WORKSPACE_CLONE_SERVICE: 'workspace-clone-service',
  WORKSPACE_LIFECYCLE_MANAGER: 'workspace-lifecycle-manager',
  WORKSPACE_SERVICE: 'workspace-service',
  WORKTREE_SERVICE: 'worktree-service',
  GIT_SERVICE: 'git-service',
  WORKSPACE_SYNC_JOB: 'workspace-sync-job',
  WORKTREE_CLEANUP_JOB: 'worktree-cleanup-job',
  TASK_PR_SYNC_JOB: 'task-pr-sync-job',
} as const;
export type EventSource = (typeof EventSource)[keyof typeof EventSource];

// ===== Event Structure =====

export interface CapybaraEvent<T = unknown> {
  id: string;
  type: AllEventTypes;
  category: EventCategory;
  timestamp: number;
  source: EventSource;
  payload: T;
  metadata?: {
    correlationId?: string;  // Track related events
    causedBy?: string;       // ID of event that triggered this
    userId?: string;
    agentId?: string;
    sessionId?: string;
    specId?: string;
    workspaceId?: string;
    worktreeId?: string;
  };
}

// ===== Typed Event Payloads =====

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

// ===== Event Bus Interface =====

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

// ===== Event Persistence =====

export interface PersistedEvent extends CapybaraEvent {
  persistedAt: number;
}
