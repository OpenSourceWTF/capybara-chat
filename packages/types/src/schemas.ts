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
