/**
 * Capybara Chat Enumerations & Constants
 *
 * Shared constants used across the application.
 * Extracted from index.ts to avoid circular dependencies with schemas.ts.
 */

// ===== Status Enums =====

export const SessionStatus = {
  PENDING: 'PENDING',       // Not started
  RUNNING: 'RUNNING',       // Agent actively working
  PAUSED: 'PAUSED',         // Manually paused
  WAITING_HUMAN: 'WAITING_HUMAN', // Blocked on human input
  COMPLETE: 'COMPLETE',     // Finished successfully
  FAILED: 'FAILED',         // Error occurred
  CANCELLED: 'CANCELLED',   // Session cancelled
} as const;
export type SessionStatus = (typeof SessionStatus)[keyof typeof SessionStatus];

export const AgentStatus = {
  IDLE: 'IDLE',
  BUSY: 'BUSY',
  OFFLINE: 'OFFLINE',
} as const;
export type AgentStatus = (typeof AgentStatus)[keyof typeof AgentStatus];

export const MessageStatus = {
  SENT: 'sent',
  PENDING: 'pending', // In queue, waiting for bridge
  QUEUED: 'queued',   // Forwarded to bridge, waiting for processing
  PROCESSING: 'processing',
  STREAMING: 'streaming', // Message is being streamed (persisted incrementally)
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;
export type MessageStatus = (typeof MessageStatus)[keyof typeof MessageStatus];

export const SessionHistoryEventType = {
  OPENED: 'opened',
  CLOSED: 'closed',
  RESUMED: 'resumed',
  AGENT_ASSIGNED: 'agent_assigned',
  CONTEXT_INJECTED: 'context_injected',
  ERROR: 'error',
  TOOL_USE: 'tool_use',
  CLI_HALTED: 'cli_halted',
  CLI_RESUMING: 'cli_resuming',
  CLI_CONTEXT_RESET: 'cli_context_reset',
} as const;
export type SessionHistoryEventType = (typeof SessionHistoryEventType)[keyof typeof SessionHistoryEventType];

export const MessageRole = {
  USER: 'user',
  ASSISTANT: 'assistant',
  SYSTEM: 'system',
} as const;
export type MessageRole = (typeof MessageRole)[keyof typeof MessageRole];

export const Priority = {
  LOW: 'low',
  NORMAL: 'normal',
  HIGH: 'high',
  CRITICAL: 'critical',
} as const;
export type Priority = (typeof Priority)[keyof typeof Priority];

export const ProviderType = {
  CLI: 'cli',
  SDK: 'sdk',
} as const;
export type ProviderType = (typeof ProviderType)[keyof typeof ProviderType];

export const AttachmentType = {
  FILE: 'file',
  DIFF: 'diff',
  LOG: 'log',
  SCREENSHOT: 'screenshot',
  OTHER: 'other',
} as const;
export type AttachmentType = (typeof AttachmentType)[keyof typeof AttachmentType];

export const SecretScope = {
  GLOBAL: 'global',
  AGENT: 'agent',
  SESSION: 'session',
} as const;
export type SecretScope = (typeof SecretScope)[keyof typeof SecretScope];

export const EventEntityType = {
  SESSION: 'session',
  AGENT: 'agent',
  ARTIFACT: 'artifact',
  DOCUMENT: 'document',
  PROMPT: 'prompt',
  AGENT_DEFINITION: 'agentDefinition',
} as const;
export type EventEntityType = (typeof EventEntityType)[keyof typeof EventEntityType];

/**
 * Entity types for MCP Forms editing
 * Used for entity editors, context injection, and form state management
 */
export const FormEntityType = {
  PROMPT: 'prompt',
  DOCUMENT: 'document',
  AGENT_DEFINITION: 'agentDefinition',
} as const;
export type FormEntityType = (typeof FormEntityType)[keyof typeof FormEntityType];

/**
 * Session operation modes
 */
export const SessionMode = {
  CHAT: 'chat',
  ENTITY_EDITING: 'entity-editing',
} as const;
export type SessionMode = (typeof SessionMode)[keyof typeof SessionMode];

export const ActorType = {
  USER: 'user',
  AGENT: 'agent',
  SYSTEM: 'system',
} as const;
export type ActorType = (typeof ActorType)[keyof typeof ActorType];

export const Theme = {
  COZY: 'cozy',
  MIDNIGHT: 'midnight',
} as const;
export type Theme = (typeof Theme)[keyof typeof Theme];

export const OrderDir = {
  ASC: 'asc',
  DESC: 'desc',
} as const;
export type OrderDir = (typeof OrderDir)[keyof typeof OrderDir];

export const ProcessStatus = {
  STARTING: 'starting',
  RUNNING: 'running',
  PAUSED: 'paused',
  STOPPED: 'stopped',
  FAILED: 'failed',
} as const;
export type ProcessStatus = (typeof ProcessStatus)[keyof typeof ProcessStatus];

/**
 * EntityStatus - Draft/published status for entities created via chat
 */
export const EntityStatus = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
} as const;
export type EntityStatus = (typeof EntityStatus)[keyof typeof EntityStatus];

/**
 * PromptOutputType - What type of output a prompt generates
 */
export const PromptOutputType = {
  PROMPT: 'prompt',       // Creates another Prompt (meta-prompts)
  DOCUMENT: 'document',   // Creates a Markdown Document
  CODE: 'code',           // Generates code (no DB entity)
  ANALYSIS: 'analysis',   // Creates Document with tag "analysis"
} as const;
export type PromptOutputType = (typeof PromptOutputType)[keyof typeof PromptOutputType];

/**
 * DocumentCreatedBy - Who created a document version
 */
export const DocumentCreatedBy = {
  USER: 'user',
  AGENT: 'agent',
} as const;
export type DocumentCreatedBy = (typeof DocumentCreatedBy)[keyof typeof DocumentCreatedBy];

/**
 * DocumentType - Discriminates between regular documents and agent memories
 */
export const DocumentType = {
  DOCUMENT: 'document',
  MEMORY: 'memory',
} as const;
export type DocumentType = (typeof DocumentType)[keyof typeof DocumentType];

// ===== Assistant Types =====

export const AssistantPhase = {
  INIT: 'INIT',
  COLLECT: 'COLLECT',
  INTERVIEW: 'INTERVIEW',
  FINALIZE: 'FINALIZE',
  COMPLETE: 'COMPLETE',
} as const;
export type AssistantPhase = (typeof AssistantPhase)[keyof typeof AssistantPhase];

export const AssistantType = {
  SPEC: 'spec',
  PROMPT: 'prompt',
  GENERAL: 'general',
} as const;
export type AssistantType = (typeof AssistantType)[keyof typeof AssistantType];

/**
 * Session types for chat conversations
 */
export const SessionType = {
  AGENT: 'agent',
  ASSISTANT_SPEC: 'assistant:spec',
  ASSISTANT_PROMPT: 'assistant:prompt',
  ASSISTANT_GENERAL: 'assistant:general',
} as const;
export type SessionType = (typeof SessionType)[keyof typeof SessionType];

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
] as const;

export const AgentModel = {
  SONNET: 'sonnet',
  OPUS: 'opus',
  HAIKU: 'haiku',
  OPUS_LATEST: 'opus-latest',
  INHERIT: 'inherit',
} as const;
export type AgentModel = (typeof AgentModel)[keyof typeof AgentModel];

/**
 * AgentDefinitionRole - Determines where an agent definition appears in pickers
 */
export const AgentDefinitionRole = {
  ASSISTANT: 'assistant',
  SUBAGENT: 'subagent',
} as const;
export type AgentDefinitionRole = (typeof AgentDefinitionRole)[keyof typeof AgentDefinitionRole];


export const SOCKET_EVENTS = {
  // Session
  SESSION_SEND: 'session:send',
  SESSION_RESPONSE: 'session:response',
  SESSION_UPDATED: 'session:updated',
  SESSION_MESSAGE: 'session:message',
  SESSION_CONTEXT_INJECTED: 'session:context_injected',
  SESSION_CONTEXT_RESET: 'session:context_reset',
  SESSION_CLAUDE_ID: 'session:claude_id',
  SESSION_ERROR: 'session:error',

  // Session lifecycle
  SESSION_CREATED: 'session:created',
  SESSION_HIDDEN: 'session:hidden',
  SESSION_MODEL_SWITCH: 'session:model_switch',
  SESSION_STOP: 'session:stop',

  // Human-in-the-loop events
  SESSION_HUMAN_INPUT_REQUESTED: 'session:human_input_requested',
  SESSION_HUMAN_INPUT_RESPONSE: 'session:human_input_response',
  SESSION_PROGRESS: 'session:progress',
  SESSION_BLOCKED: 'session:blocked',
  SESSION_HALTED: 'session:halted',
  SESSION_ARTIFACT: 'session:artifact',

  // Pipeline observability
  SESSION_LOG: 'session:log',
  SESSION_PIPELINE_EVENT: 'session:pipeline_event',
  SESSION_PIPELINE_STATE: 'session:pipeline_state',

  // Activity tracking (tool execution, subagent delegation)
  SESSION_ACTIVITY: 'session:activity',
  SESSION_COST: 'session:cost',
  SESSION_TOOL_USE: 'session:tool_use',
  SESSION_THINKING: 'session:thinking',

  // Context visibility (real-time context usage tracking)
  SESSION_CONTEXT_USAGE: 'session:context_usage',
  SESSION_COMPACTED: 'session:compacted',

  // System
  BRIDGE_REGISTER: 'bridge:register',
  BRIDGE_HEARTBEAT: 'bridge:heartbeat',
  AGENT_STATUS: 'agent:status',
  SYNC_FULL: 'sync:full',
  EVENT: 'event',
  COMMAND_RESULT: 'command:result',
  MESSAGE_STATUS: 'message:status',

  // Agent Definition Events
  AGENT_DEFINITION_CREATED: 'agentDefinition:created',
  AGENT_DEFINITION_UPDATED: 'agentDefinition:updated',
  AGENT_DEFINITION_DELETED: 'agentDefinition:deleted',

  // Entity CRUD Events (for UI refetch)
  DOCUMENT_CREATED: 'document:created',
  DOCUMENT_UPDATED: 'document:updated',
  DOCUMENT_DELETED: 'document:deleted',
  MEMORY_CREATED: 'memory:created',
  MEMORY_DELETED: 'memory:deleted',
  PROMPT_CREATED: 'prompt:created',
  PROMPT_UPDATED: 'prompt:updated',
  PROMPT_DELETED: 'prompt:deleted',
} as const;
export type SocketEvents = typeof SOCKET_EVENTS;

export const PAGINATION = {
  DEFAULT_LIMIT: 100,
  DEFAULT_OFFSET: 0,
  SESSION_LIST_LIMIT: 50,
  MAX_LIMIT: 1000,
  MESSAGE_FETCH_LIMIT: 100,
  SYNC_FULL_LIMIT: 50,
  TIMELINE_LIMIT: 40,
} as const;

export const SECRET_NAMES = {
  OPENAI_API_KEY: 'OPENAI_API_KEY',
  ANTHROPIC_API_KEY: 'ANTHROPIC_API_KEY',
} as const;
export type SecretName = (typeof SECRET_NAMES)[keyof typeof SECRET_NAMES];


// ===== Model Registry =====

export interface ModelRegistryEntry {
  apiModel: string;
  label: string;
  description: string;
  generation: string;
  isDefault?: boolean;
}

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
} as const;

export function resolveModelToApiString(model: AgentModel | string | undefined): string {
  if (!model || model === 'inherit') {
    return MODEL_REGISTRY.sonnet.apiModel;
  }
  const key = model as keyof typeof MODEL_REGISTRY;
  return MODEL_REGISTRY[key]?.apiModel ?? model;
}

export function resolveModelLabel(model: AgentModel | string | undefined): string {
  if (!model) return MODEL_REGISTRY.sonnet.label;
  if (model === 'inherit') return 'Inherit';
  const key = model as keyof typeof MODEL_REGISTRY;
  return MODEL_REGISTRY[key]?.label ?? model;
}

export const MODEL_DEFAULTS = {
  CLAUDE_SONNET: MODEL_REGISTRY.sonnet.apiModel,
  CLAUDE_OPUS: MODEL_REGISTRY['opus-latest'].apiModel,
  CLAUDE_OPUS_45: MODEL_REGISTRY.opus.apiModel,
} as const;
