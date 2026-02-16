/**
 * Capybara Chat Event Bus Types
 *
 * Event-driven architecture from day 1 - no retrofitting.
 * All state changes emit events; UI and services subscribe.
 */

// ===== Event Categories =====

export type EventCategory =
  | 'session'
  | 'agent'
  | 'artifact'
  | 'prompt'
  | 'document'
  | 'memory'
  | 'agentDefinition'
  | 'human_input_request'
  | 'system';

// ===== Event Types =====

export type SessionEventType =
  | 'session:created'
  | 'session:started'
  | 'session:paused'
  | 'session:resumed'
  | 'session:forked'
  | 'session:completed'
  | 'session:failed'
  | 'session:hidden'
  | 'session:updated'
  | 'session:human_input_requested'
  | 'session:human_input_received'
  | 'session:progress';

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

export type MemoryEventType =
  | 'memory:created'
  | 'memory:deleted';

export type AgentDefinitionEventType =
  | 'agentDefinition:created'
  | 'agentDefinition:updated'
  | 'agentDefinition:deleted';

export type HumanInputEventType =
  | 'human_input:requested'
  | 'human_input:responded'
  | 'human_input:cancelled'
  | 'human_input:timeout';

export type SystemEventType =
  | 'system:startup'
  | 'system:shutdown'
  | 'system:error';

export type AllEventTypes =
  | SessionEventType
  | AgentEventType
  | ArtifactEventType
  | PromptEventType
  | DocumentEventType
  | MemoryEventType
  | AgentDefinitionEventType
  | HumanInputEventType
  | SystemEventType;

// ===== Event Source =====

export const EventSource = {
  SERVER: 'server',
  AGENT_BRIDGE: 'agent-bridge',
  AGENT: 'agent',
  UI: 'ui',
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
