/**
 * Zod Validation Schemas
 *
 * Runtime validation schemas for Capybara entities.
 * Use these for API request/response validation.
 */

import { z } from 'zod';
import {
  SessionStatus,
  AgentStatus,
  MessageStatus,
  CloneStatus,
  MessageRole,
  Priority,
  AttachmentType,
  EntityStatus,
  SessionType,
  AssistantPhase,
  AssistantType,
  SessionMode,
  SessionHistoryEventType,
  AgentModel,
  OrderDir,
  Theme,
  SpecStatus,
  TaskStatus,
  WorkerTaskState,
  GitHubIssueState,
  GitHubPRState,
  PRMergeableState,
  PRChecksStatus,
  PRReviewDecision,
  TaskResolution,
  PromptOutputType,
  DeliverableType,
  DocumentType,
  DocumentCreatedBy,
  FormEntityType,
} from './enums.js';

// ===== Helper to create Zod enum from const object =====
function zEnumFromObj<T extends Record<string, string>>(obj: T) {
  return z.enum(Object.values(obj) as [string, ...string[]]);
}

// ===== Enum Schemas =====

export const SessionStatusSchema = zEnumFromObj(SessionStatus);
export const AgentStatusSchema = zEnumFromObj(AgentStatus);
export const MessageStatusSchema = zEnumFromObj(MessageStatus);
export const CloneStatusSchema = zEnumFromObj(CloneStatus);
export const MessageRoleSchema = zEnumFromObj(MessageRole);
export const PrioritySchema = zEnumFromObj(Priority);
export const AttachmentTypeSchema = zEnumFromObj(AttachmentType);
export const EntityStatusSchema = zEnumFromObj(EntityStatus);
export const SessionTypeSchema = zEnumFromObj(SessionType);
export const AssistantPhaseSchema = zEnumFromObj(AssistantPhase);
export const AssistantTypeSchema = zEnumFromObj(AssistantType);
export const OrderDirSchema = zEnumFromObj(OrderDir);
export const ThemeSchema = zEnumFromObj(Theme);
export const SessionModeSchema = zEnumFromObj(SessionMode);
export const SessionHistoryEventTypeSchema = zEnumFromObj(SessionHistoryEventType);
export const AgentModelSchema = zEnumFromObj(AgentModel);

export const SpecStatusSchema = zEnumFromObj(SpecStatus);
export const TaskStatusSchema = zEnumFromObj(TaskStatus);
export const WorkerTaskStateSchema = zEnumFromObj(WorkerTaskState);
export const GitHubIssueStateSchema = zEnumFromObj(GitHubIssueState);
export const GitHubPRStateSchema = zEnumFromObj(GitHubPRState);
export const PRMergeableStateSchema = zEnumFromObj(PRMergeableState);
export const PRChecksStatusSchema = zEnumFromObj(PRChecksStatus);
export const PRReviewDecisionSchema = zEnumFromObj(PRReviewDecision);
export const TaskResolutionSchema = zEnumFromObj(TaskResolution);
export const PromptOutputTypeSchema = zEnumFromObj(PromptOutputType);
export const DeliverableTypeSchema = zEnumFromObj(DeliverableType);
export const DocumentTypeSchema = zEnumFromObj(DocumentType);
export const DocumentCreatedBySchema = zEnumFromObj(DocumentCreatedBy);

// ===== Helper Schemas =====

export const MCPServerConfigSchema = z.object({
  name: z.string(),
  config: z.record(z.string(), z.unknown()).optional(),
});

export const ResourceLimitsSchema = z.object({
  memoryMB: z.number().int().positive().optional(),
  cpuCores: z.number().positive().optional(),
  timeoutMinutes: z.number().int().positive().optional(),
});

export const ClaudeConfigSchema = z.object({
  model: z.string().optional(),
  systemPrompt: z.string().optional(),
  maxTokens: z.number().int().positive().optional(),
});

/**
 * AgentMCPServerConfig - Full MCP server config for agent definitions
 * (Different from MCPServerConfigSchema which is a simpler format for AgentConfig)
 */
export const AgentMCPServerConfigSchema = z.object({
  name: z.string().min(1),
  command: z.string().min(1),
  args: z.array(z.string()).optional(),
  env: z.record(z.string(), z.string()).optional(),
  enabled: z.boolean(),
  /** Whether to inject MCP tool documentation into system prompt (defaults to true) */
  injectDocs: z.boolean().optional(),
});

/**
 * SubagentLink - Link to a sub-agent with optional description override.
 * If descriptionOverride is empty/missing, the auto-composition system
 * uses the subagent's own `description` field from its agent definition.
 */
export const SubagentLinkSchema = z.object({
  agentDefinitionId: z.string().min(1),
  alias: z.string().optional(),
  descriptionOverride: z.string().optional(),
});

// ===== Core Entity Schemas (Spec/Task) =====

/**
 * Spec schema - Story-sized work unit
 */
export const SpecSchema = z.object({
  id: z.string(),
  title: z.string().min(1).max(500),
  content: z.string().max(500_000),
  workflowStatus: SpecStatusSchema,
  priority: PrioritySchema,
  tags: z.array(z.string()),
  workspaceId: z.string().optional(),
  agentConfigId: z.string().optional(),
  parentId: z.string().optional(),
  promptPipelineId: z.string().optional(),
  issueNumber: z.number().int().positive().optional(),
  issueUrl: z.string().url().optional(),
  githubPrNumber: z.number().int().positive().optional(),
  githubPrUrl: z.string().url().optional(),
  status: EntityStatusSchema,
  sessionId: z.string().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const CreateSpecSchema = SpecSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).partial({
  workflowStatus: true,
  priority: true,
  tags: true,
  status: true,
}).extend({
  workflowStatus: SpecStatusSchema.optional().default('READY'),
  status: EntityStatusSchema.optional().default('draft'),
});

export const UpdateSpecSchema = SpecSchema.partial().omit({
  id: true,
  createdAt: true,
}).extend({
  // Allow null to clear the workspace association
  workspaceId: z.string().nullable().optional(),
});

/**
 * Task schema - Step within a spec
 */
export const TaskSchema = z.object({
  id: z.string(),
  specId: z.string(),
  title: z.string().min(1).max(500),
  description: z.string().max(10_000).optional(),
  status: TaskStatusSchema,
  order: z.number().int().min(0),
  createdAt: z.number(),
  completedAt: z.number().optional(),
  /** Model override for agent executing this task */
  modelOverride: AgentModelSchema.optional(),
  /** Subagent-specific model overrides, keyed by subagent name */
  subagentModelOverrides: z.record(z.string(), AgentModelSchema).optional(),
});

export const CreateTaskSchema = TaskSchema.omit({
  id: true,
  createdAt: true,
  completedAt: true,
}).partial({
  status: true,
  order: true,
});

export const UpdateTaskSchema = TaskSchema.partial().omit({
  id: true,
  specId: true,
  createdAt: true,
});

/**
 * PromptSegment schema - Prompt template
 */
export const PromptSegmentSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(200),
  content: z.string().max(100_000),
  summary: z.string().max(1000),
  tags: z.array(z.string()),
  variables: z.array(z.string()),
  color: z.string(),
  status: EntityStatusSchema,
  sessionId: z.string().optional(),
  outputType: PromptOutputTypeSchema.optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const CreatePromptSegmentSchema = PromptSegmentSchema.omit({
  id: true,
  variables: true, // Auto-extracted
  createdAt: true,
  updatedAt: true,
}).partial({
  summary: true,
  tags: true,
  color: true,
  status: true,
}).extend({
  status: EntityStatusSchema.optional().default('draft'),
});

export const UpdatePromptSegmentSchema = PromptSegmentSchema.partial().omit({
  id: true,
  createdAt: true,
});

/**
 * PipelineStep schema
 */
export const PipelineStepSchema = z.object({
  segmentId: z.string(),
  order: z.number().int().min(0),
  overrides: z.record(z.string(), z.string()).optional(),
});

/**
 * PromptPipeline schema - Workflow of prompts
 */
export const PromptPipelineSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  steps: z.array(PipelineStepSchema),
  variables: z.string(),
  systemPromptSegmentId: z.string().optional(),
  prefill: z.string().optional(),
  deliverableType: DeliverableTypeSchema,
  status: EntityStatusSchema,
  sessionId: z.string().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const CreatePromptPipelineSchema = PromptPipelineSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).partial({
  steps: true,
  variables: true,
  deliverableType: true,
  status: true,
});

export const UpdatePromptPipelineSchema = PromptPipelineSchema.partial().omit({
  id: true,
  createdAt: true,
});

/**
 * AgentConfig schema - Agent capability template
 */
export const AgentConfigSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  skills: z.array(z.string()),
  mcpServers: z.array(MCPServerConfigSchema),
  env: z.record(z.string(), z.string()).optional(),
  resources: ResourceLimitsSchema.optional(),
  claudeConfig: ClaudeConfigSchema.optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const CreateAgentConfigSchema = AgentConfigSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).partial({
  skills: true,
  mcpServers: true,
});

export const UpdateAgentConfigSchema = AgentConfigSchema.partial().omit({
  id: true,
  createdAt: true,
});

/**
 * AgentContext Schema - Centralized agent configuration
 */
export const AgentContextSchema = z.object({
  systemPrompt: z.string().optional(),
  allowedTools: z.array(z.string()).optional(),
  mcpServers: z.array(AgentMCPServerConfigSchema).optional(),
  model: AgentModelSchema.optional(),
  subagents: z.record(z.string(), z.object({
    description: z.string(),
    prompt: z.string(),
    tools: z.array(z.string()).optional(),
    model: AgentModelSchema.optional(),
  })).optional(),
});

/**
 * AgentDefinition Schema
 */
export const AgentDefinitionRoleSchema = z.enum(['assistant', 'subagent', 'task_agent']);

export const AgentDefinitionSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/),
  description: z.string().min(1).max(1000),
  systemPromptSegmentId: z.string().nullable().optional(),
  role: AgentDefinitionRoleSchema.default('subagent'),
  prefilledConversation: z.array(z.object({
    role: MessageRoleSchema,
    content: z.string().min(1),
  })).optional(),
  skills: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  sessionId: z.string().optional(),
  status: EntityStatusSchema,
  isDefault: z.boolean().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
  agentContext: AgentContextSchema,
});

export const CreateAgentDefinitionSchema = AgentDefinitionSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).partial({
  agentContext: true,
}).extend({
  role: AgentDefinitionRoleSchema.optional().default('subagent'),
  status: EntityStatusSchema.optional().default('draft'),
  agentContext: AgentContextSchema.optional().default({}),
}).refine(
  (data) => (data.agentContext?.systemPrompt && data.agentContext.systemPrompt.length > 0) || data.systemPromptSegmentId,
  { message: 'Either agentContext.systemPrompt or systemPromptSegmentId is required' }
);

export const UpdateAgentDefinitionSchema = AgentDefinitionSchema.partial().omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});



// ===== User & Auth Schemas =====

export const UserRoleSchema = z.enum(['admin', 'member']);

export const UserSchema = z.object({
  id: z.string(),
  githubId: z.number().int().positive(),
  githubLogin: z.string().min(1),
  name: z.string().nullable(),
  email: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  role: UserRoleSchema,
  lastLoginAt: z.number().nullable(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const CreateUserSchema = z.object({
  githubId: z.number().int().positive(),
  githubLogin: z.string().min(1),
  name: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  avatarUrl: z.string().nullable().optional(),
  role: UserRoleSchema.default('member'),
});

export type CreateUserInput = z.infer<typeof CreateUserSchema>;

// ===== Core Entity Schemas =====

/**
 * Session schema - Execution instance
 */
export const SessionSchema = z.object({
  id: z.string(),
  sessionType: SessionTypeSchema,
  agentId: z.string().optional(),
  claudeSessionId: z.string().nullable().optional(),
  status: SessionStatusSchema,
  forkedFromId: z.string().optional(),
  containerId: z.string().optional(),
  name: z.string().max(200).optional(),
  hidden: z.boolean().optional(),
  hasUnread: z.boolean().optional(),
  workspaceId: z.string().optional(),
  worktreePath: z.string().optional(),
  startedAt: z.number(),
  lastActivityAt: z.number(),
  endedAt: z.number().optional(),
});

export const CreateSessionSchema = SessionSchema.omit({
  id: true,
  startedAt: true,
  lastActivityAt: true,
}).partial({
  sessionType: true,
  status: true,
}).extend({
  // Accept 'type' as alias for sessionType (used by frontend)
  type: SessionTypeSchema.optional(),
});

export const UpdateSessionSchema = SessionSchema.partial().omit({
  id: true,
  startedAt: true,
});

/**
 * Agent schema - Running agent instance
 */
export const AgentSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(200),
  status: AgentStatusSchema,
  currentSessionId: z.string().optional(),
  containerId: z.string().optional(),
  workspaceIds: z.array(z.string()),
  iconSeed: z.number().int().min(0).max(1_000_000),
  lastSeenAt: z.number(),
  createdAt: z.number(),
});

export const CreateAgentSchema = AgentSchema.omit({
  id: true,
  lastSeenAt: true,
  createdAt: true,
}).partial({
  status: true,
  workspaceIds: true,
  iconSeed: true,
});

export const UpdateAgentSchema = AgentSchema.partial().omit({
  id: true,
  createdAt: true,
});

export const DocumentSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(500),
  content: z.string().max(500_000),
  type: DocumentTypeSchema,
  tags: z.array(z.string()),
  sessionId: z.string().optional(),
  status: EntityStatusSchema,
  createdBy: z.string().nullable(),
  createdAt: z.number(),
  updatedAt: z.number(),
  deletedAt: z.number().optional(),
});

export const CreateDocumentSchema = DocumentSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
}).partial({
  tags: true,
  status: true,
  type: true,
}).extend({
  type: DocumentTypeSchema.optional().default('document'),
  status: EntityStatusSchema.optional().default('draft'),
});

export const UpdateDocumentSchema = DocumentSchema.partial().omit({
  id: true,
  createdAt: true,
});

export const DocumentVersionSchema = z.object({
  id: z.string(),
  documentId: z.string(),
  content: z.string().max(500_000),
  createdAt: z.number(),
  createdBy: DocumentCreatedBySchema,
});

/**
 * Workspace schema - GitHub repository
 */
export const WorkspaceSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(200),
  repoUrl: z.string().url(),
  repoOwner: z.string().min(1),
  repoName: z.string().min(1),
  defaultBranch: z.string(),
  localPath: z.string(),
  worktreesPath: z.string(),
  installationId: z.number().int().positive().optional(),
  cloneStatus: CloneStatusSchema.optional(),
  cloneError: z.string().optional(),
  createdAt: z.number(),
  lastSyncedAt: z.number().optional(),
});

/**
 * Artifact schema - Session output
 */
export const ArtifactSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  name: z.string().min(1).max(500),
  type: AttachmentTypeSchema,
  content: z.string().max(1_000_000),
  mimeType: z.string().optional(),
  createdAt: z.number(),
});

export const CreateArtifactSchema = ArtifactSchema.omit({
  id: true,
  createdAt: true,
});

/**
 * ChatMessage schema
 */
export const ToolUseSchema = z.object({
  name: z.string(),
  input: z.unknown(), // Using unknown instead of record because input can be anything
  result: z.unknown().optional(),
});

export const ChatMessageSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  role: MessageRoleSchema,
  content: z.string().max(100_000),
  toolUse: ToolUseSchema.optional(),
  createdAt: z.number(),
});

export const CreateChatMessageSchema = ChatMessageSchema.omit({
  id: true,
  sessionId: true,
  createdAt: true,
});

// ===== API Request/Response Schemas =====

export const PaginationParamsSchema = z.object({
  limit: z.number().int().min(1).max(1000).optional(),
  offset: z.number().int().min(0).optional(),
});

export const ApiSuccessResponseSchema = <T extends z.ZodType>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
  });

export const ApiErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  details: z.record(z.string(), z.unknown()).optional(),
});

export const ApiListResponseSchema = <T extends z.ZodType>(itemSchema: T) =>
  z.object({
    success: z.literal(true),
    data: z.array(itemSchema),
    total: z.number().int().min(0).optional(),
    limit: z.number().int().min(0).optional(),
    offset: z.number().int().min(0).optional(),
  });

// ===== Type Exports =====

export type SessionSchemaType = z.infer<typeof SessionSchema>;
export type CreateSessionInput = z.infer<typeof CreateSessionSchema>;
export type UpdateSessionInput = z.infer<typeof UpdateSessionSchema>;

export type AgentSchemaType = z.infer<typeof AgentSchema>;
export type CreateAgentInput = z.infer<typeof CreateAgentSchema>;
export type UpdateAgentInput = z.infer<typeof UpdateAgentSchema>;

export type WorkspaceSchemaType = z.infer<typeof WorkspaceSchema>;

export type ArtifactSchemaType = z.infer<typeof ArtifactSchema>;
export type CreateArtifactInput = z.infer<typeof CreateArtifactSchema>;

export type ChatMessageSchemaType = z.infer<typeof ChatMessageSchema>;
export type CreateChatMessageInput = z.infer<typeof CreateChatMessageSchema>;

// ===== Session Schemas (Additional) =====

export const ListSessionsQuerySchema = z.object({
  agentId: z.string().optional(),
  status: SessionStatusSchema.optional(),
  type: SessionTypeSchema.optional(),
  active: z.string().transform((v: string) => v === 'true').optional(),
  limit: z.string().transform(Number).pipe(z.number().int().positive().max(100)).optional(),
  offset: z.string().transform(Number).pipe(z.number().int().nonnegative()).optional(),
});

export const ForkSessionSchema = z.object({
  agentId: z.string().optional(),
});

export const CreateSessionEventSchema = z.object({
  type: SessionHistoryEventTypeSchema,
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const UpdateMessageStatusSchema = z.object({
  status: MessageStatusSchema,
});

export type ListSessionsQuery = z.infer<typeof ListSessionsQuerySchema>;
export type ForkSessionInput = z.infer<typeof ForkSessionSchema>;
export type CreateSessionEventInput = z.infer<typeof CreateSessionEventSchema>;
export type UpdateMessageStatusInput = z.infer<typeof UpdateMessageStatusSchema>;

// ===== Settings Schemas =====

export const SetGitHubTokenSchema = z.object({
  token: z.string().min(1, 'token is required'),
});

export const CreateGitHubIssueSchema = z.object({
  owner: z.string().min(1, 'owner is required'),
  repo: z.string().min(1, 'repo is required'),
  title: z.string().min(1, 'title is required').max(256),
  body: z.string().max(65536).optional(),
  labels: z.array(z.string()).max(20).optional(),
});

export type SetGitHubTokenInput = z.infer<typeof SetGitHubTokenSchema>;
export type CreateGitHubIssueInput = z.infer<typeof CreateGitHubIssueSchema>;

// ===== Query Schemas =====

export const GetMessagesQuerySchema = z.object({
  limit: z.string().transform(Number).pipe(z.number().int().positive().max(100)).optional(),
  offset: z.string().transform(Number).pipe(z.number().int().nonnegative()).optional(),
});

export type GetMessagesQuery = z.infer<typeof GetMessagesQuerySchema>;

// ===== Generic API Schemas =====

export const DiffQuerySchema = z.object({
  workspaceId: z.string(),
  path: z.string(),
});

export const SyncWorkspaceSchema = z.object({
  workspaceId: z.string(),
});

export const BranchStatsResponseSchema = z.object({
  ahead: z.number(),
  behind: z.number(),
  name: z.string(),
  commit: z.string(),
});

export const DeleteWorkspaceSchema = z.object({
  workspaceId: z.string(),
});

export const CreatePRSchema = z.object({
  workspaceId: z.string(),
  title: z.string().min(1),
  body: z.string().optional(),
  head: z.string().min(1),
  base: z.string().optional(),
});

export const MergePRSchema = z.object({
  workspaceId: z.string(),
  prNumber: z.number().int().positive(),
  method: z.enum(['merge', 'squash', 'rebase']).optional(),
});

export const GitHubPRDetailsSchema = z.object({
  number: z.number(),
  title: z.string(),
  url: z.string(),
  state: GitHubPRStateSchema,
  body: z.string(),
  author: z.object({
    login: z.string(),
    avatarUrl: z.string(),
  }),
  createdAt: z.string(),
  updatedAt: z.string(),
});

// ===== Type Exports for New Schemas =====

export type SpecSchemaType = z.infer<typeof SpecSchema>;
export type CreateSpecInput = z.infer<typeof CreateSpecSchema>;
export type UpdateSpecInput = z.infer<typeof UpdateSpecSchema>;

export type TaskSchemaType = z.infer<typeof TaskSchema>;
export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;
export type UpdateTaskInput = z.infer<typeof UpdateTaskSchema>;

export type AgentConfigSchemaType = z.infer<typeof AgentConfigSchema>;
export type CreateAgentConfigInput = z.infer<typeof CreateAgentConfigSchema>;
export type UpdateAgentConfigInput = z.infer<typeof UpdateAgentConfigSchema>;

export type AgentDefinitionSchemaType = z.infer<typeof AgentDefinitionSchema>;
export type CreateAgentDefinitionInput = z.infer<typeof CreateAgentDefinitionSchema>;
export type UpdateAgentDefinitionInput = z.infer<typeof UpdateAgentDefinitionSchema>;

export type PromptSegmentSchemaType = z.infer<typeof PromptSegmentSchema>;
export type CreatePromptSegmentInput = z.infer<typeof CreatePromptSegmentSchema>;
export type UpdatePromptSegmentInput = z.infer<typeof UpdatePromptSegmentSchema>;

export type PromptPipelineSchemaType = z.infer<typeof PromptPipelineSchema>;
export type CreatePromptPipelineInput = z.infer<typeof CreatePromptPipelineSchema>;
export type UpdatePromptPipelineInput = z.infer<typeof UpdatePromptPipelineSchema>;

export type SubagentLink = z.infer<typeof SubagentLinkSchema>;
export type AgentMCPServerConfig = z.infer<typeof AgentMCPServerConfigSchema>;
export type ResourceLimits = z.infer<typeof ResourceLimitsSchema>;
export type ClaudeConfig = z.infer<typeof ClaudeConfigSchema>;

export type DiffQueryInput = z.infer<typeof DiffQuerySchema>;
export type SyncWorkspaceInput = z.infer<typeof SyncWorkspaceSchema>;
export type DeleteWorkspaceInput = z.infer<typeof DeleteWorkspaceSchema>;
export type CreatePRInput = z.infer<typeof CreatePRSchema>;
export type MergePRInput = z.infer<typeof MergePRSchema>;
export type BranchStats = z.infer<typeof BranchStatsResponseSchema>;
export type GitHubPRDetails = z.infer<typeof GitHubPRDetailsSchema>;
