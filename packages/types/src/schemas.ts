/**
 * Zod Validation Schemas
 *
 * Runtime validation schemas for Capybara Chat entities.
 * Use these for API request/response validation.
 */

import { z } from 'zod';
import {
  SessionStatus,
  AgentStatus,
  MessageStatus,
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
  PromptOutputType,
  DocumentType,
  DocumentCreatedBy,
} from './enums.js';

// ===== Helper to create Zod enum from const object =====
function zEnumFromObj<T extends Record<string, string>>(obj: T) {
  return z.enum(Object.values(obj) as [string, ...string[]]);
}

// ===== Enum Schemas =====

export const SessionStatusSchema = zEnumFromObj(SessionStatus);
export const AgentStatusSchema = zEnumFromObj(AgentStatus);
export const MessageStatusSchema = zEnumFromObj(MessageStatus);
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
export const PromptOutputTypeSchema = zEnumFromObj(PromptOutputType);
export const DocumentTypeSchema = zEnumFromObj(DocumentType);
export const DocumentCreatedBySchema = zEnumFromObj(DocumentCreatedBy);

// ===== Helper Schemas =====

/**
 * AgentMCPServerConfig - Full MCP server config for agent definitions
 */
export const AgentMCPServerConfigSchema = z.object({
  name: z.string().min(1),
  command: z.string().min(1),
  args: z.array(z.string()).optional(),
  env: z.record(z.string(), z.string()).optional(),
  enabled: z.boolean(),
  injectDocs: z.boolean().optional(),
});

/**
 * SubagentLink - Link to a sub-agent with optional description override.
 */
export const SubagentLinkSchema = z.object({
  agentDefinitionId: z.string().min(1),
  alias: z.string().optional(),
  descriptionOverride: z.string().optional(),
});

// ===== PromptSegment =====

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

// ===== AgentContext & AgentDefinition =====

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

export const AgentDefinitionRoleSchema = z.enum(['assistant', 'subagent']);

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
  username: z.string().min(1),
  name: z.string().nullable(),
  email: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  role: UserRoleSchema,
  lastLoginAt: z.number().nullable(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const CreateUserSchema = z.object({
  username: z.string().min(1),
  name: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  avatarUrl: z.string().nullable().optional(),
  role: UserRoleSchema.default('member'),
});

export type CreateUserInput = z.infer<typeof CreateUserSchema>;

// ===== Session Schemas =====

export const SessionSchema = z.object({
  id: z.string(),
  sessionType: SessionTypeSchema,
  claudeSessionId: z.string().nullable().optional(),
  status: SessionStatusSchema,
  forkedFromId: z.string().optional(),
  name: z.string().max(200).optional(),
  hidden: z.boolean().optional(),
  hasUnread: z.boolean().optional(),
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

// ===== Document Schemas =====

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

// ===== Artifact Schemas =====

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

// ===== ChatMessage Schemas =====

export const ToolUseSchema = z.object({
  name: z.string(),
  input: z.unknown(),
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

// ===== Session Query Schemas =====

export const ListSessionsQuerySchema = z.object({
  status: SessionStatusSchema.optional(),
  type: SessionTypeSchema.optional(),
  active: z.string().transform((v: string) => v === 'true').optional(),
  limit: z.string().transform(Number).pipe(z.number().int().positive().max(100)).optional(),
  offset: z.string().transform(Number).pipe(z.number().int().nonnegative()).optional(),
});

export const ForkSessionSchema = z.object({});

export const CreateSessionEventSchema = z.object({
  type: SessionHistoryEventTypeSchema,
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const UpdateMessageStatusSchema = z.object({
  status: MessageStatusSchema,
});

// ===== Query Schemas =====

export const GetMessagesQuerySchema = z.object({
  limit: z.string().transform(Number).pipe(z.number().int().positive().max(100)).optional(),
  offset: z.string().transform(Number).pipe(z.number().int().nonnegative()).optional(),
});

/**
 * DiffQuery - For document version comparison
 */
export const DiffQuerySchema = z.object({
  a: z.string(),
  b: z.string(),
});

// ===== Type Exports =====

export type SessionSchemaType = z.infer<typeof SessionSchema>;
export type CreateSessionInput = z.infer<typeof CreateSessionSchema>;
export type UpdateSessionInput = z.infer<typeof UpdateSessionSchema>;

export type ArtifactSchemaType = z.infer<typeof ArtifactSchema>;
export type CreateArtifactInput = z.infer<typeof CreateArtifactSchema>;

export type ChatMessageSchemaType = z.infer<typeof ChatMessageSchema>;
export type CreateChatMessageInput = z.infer<typeof CreateChatMessageSchema>;

export type AgentDefinitionSchemaType = z.infer<typeof AgentDefinitionSchema>;
export type CreateAgentDefinitionInput = z.infer<typeof CreateAgentDefinitionSchema>;
export type UpdateAgentDefinitionInput = z.infer<typeof UpdateAgentDefinitionSchema>;

export type PromptSegmentSchemaType = z.infer<typeof PromptSegmentSchema>;
export type CreatePromptSegmentInput = z.infer<typeof CreatePromptSegmentSchema>;
export type UpdatePromptSegmentInput = z.infer<typeof UpdatePromptSegmentSchema>;

export type SubagentLink = z.infer<typeof SubagentLinkSchema>;
export type AgentMCPServerConfig = z.infer<typeof AgentMCPServerConfigSchema>;

export type ListSessionsQuery = z.infer<typeof ListSessionsQuerySchema>;
export type ForkSessionInput = z.infer<typeof ForkSessionSchema>;
export type CreateSessionEventInput = z.infer<typeof CreateSessionEventSchema>;
export type UpdateMessageStatusInput = z.infer<typeof UpdateMessageStatusSchema>;

export type GetMessagesQuery = z.infer<typeof GetMessagesQuerySchema>;
export type DiffQueryInput = z.infer<typeof DiffQuerySchema>;
