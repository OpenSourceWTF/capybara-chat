/**
 * Zod Validation Schemas
 *
 * Runtime validation schemas for Capybara entities.
 * Use these for API request/response validation.
 */
import { z } from 'zod';
export declare const SessionStatusSchema: z.ZodEnum<[string, ...string[]]>;
export declare const AgentStatusSchema: z.ZodEnum<[string, ...string[]]>;
export declare const MessageStatusSchema: z.ZodEnum<[string, ...string[]]>;
export declare const CloneStatusSchema: z.ZodEnum<[string, ...string[]]>;
export declare const MessageRoleSchema: z.ZodEnum<[string, ...string[]]>;
export declare const PrioritySchema: z.ZodEnum<[string, ...string[]]>;
export declare const AttachmentTypeSchema: z.ZodEnum<[string, ...string[]]>;
export declare const EntityStatusSchema: z.ZodEnum<[string, ...string[]]>;
export declare const SessionTypeSchema: z.ZodEnum<[string, ...string[]]>;
export declare const AssistantPhaseSchema: z.ZodEnum<[string, ...string[]]>;
export declare const AssistantTypeSchema: z.ZodEnum<[string, ...string[]]>;
export declare const OrderDirSchema: z.ZodEnum<[string, ...string[]]>;
export declare const ThemeSchema: z.ZodEnum<[string, ...string[]]>;
export declare const SessionModeSchema: z.ZodEnum<[string, ...string[]]>;
export declare const SessionHistoryEventTypeSchema: z.ZodEnum<[string, ...string[]]>;
export declare const AgentModelSchema: z.ZodEnum<[string, ...string[]]>;
export declare const MCPServerConfigSchema: z.ZodObject<{
    name: z.ZodString;
    config: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    config?: Record<string, unknown> | undefined;
}, {
    name: string;
    config?: Record<string, unknown> | undefined;
}>;
export declare const ResourceLimitsSchema: z.ZodObject<{
    memoryMB: z.ZodOptional<z.ZodNumber>;
    cpuCores: z.ZodOptional<z.ZodNumber>;
    timeoutMinutes: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    memoryMB?: number | undefined;
    cpuCores?: number | undefined;
    timeoutMinutes?: number | undefined;
}, {
    memoryMB?: number | undefined;
    cpuCores?: number | undefined;
    timeoutMinutes?: number | undefined;
}>;
export declare const ClaudeConfigSchema: z.ZodObject<{
    model: z.ZodOptional<z.ZodString>;
    systemPrompt: z.ZodOptional<z.ZodString>;
    maxTokens: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    model?: string | undefined;
    systemPrompt?: string | undefined;
    maxTokens?: number | undefined;
}, {
    model?: string | undefined;
    systemPrompt?: string | undefined;
    maxTokens?: number | undefined;
}>;
export declare const UserRoleSchema: z.ZodEnum<["admin", "member"]>;
export declare const UserSchema: z.ZodObject<{
    id: z.ZodString;
    githubId: z.ZodNumber;
    githubLogin: z.ZodString;
    name: z.ZodNullable<z.ZodString>;
    email: z.ZodNullable<z.ZodString>;
    avatarUrl: z.ZodNullable<z.ZodString>;
    role: z.ZodEnum<["admin", "member"]>;
    lastLoginAt: z.ZodNullable<z.ZodNumber>;
    createdAt: z.ZodNumber;
    updatedAt: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    id: string;
    name: string | null;
    githubId: number;
    githubLogin: string;
    email: string | null;
    avatarUrl: string | null;
    role: "admin" | "member";
    lastLoginAt: number | null;
    createdAt: number;
    updatedAt: number;
}, {
    id: string;
    name: string | null;
    githubId: number;
    githubLogin: string;
    email: string | null;
    avatarUrl: string | null;
    role: "admin" | "member";
    lastLoginAt: number | null;
    createdAt: number;
    updatedAt: number;
}>;
export declare const CreateUserSchema: z.ZodObject<{
    githubId: z.ZodNumber;
    githubLogin: z.ZodString;
    name: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    email: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    avatarUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    role: z.ZodDefault<z.ZodEnum<["admin", "member"]>>;
}, "strip", z.ZodTypeAny, {
    githubId: number;
    githubLogin: string;
    role: "admin" | "member";
    name?: string | null | undefined;
    email?: string | null | undefined;
    avatarUrl?: string | null | undefined;
}, {
    githubId: number;
    githubLogin: string;
    name?: string | null | undefined;
    email?: string | null | undefined;
    avatarUrl?: string | null | undefined;
    role?: "admin" | "member" | undefined;
}>;
export type CreateUserInput = z.infer<typeof CreateUserSchema>;
/**
 * Session schema - Execution instance
 */
export declare const SessionSchema: z.ZodObject<{
    id: z.ZodString;
    sessionType: z.ZodEnum<[string, ...string[]]>;
    agentId: z.ZodOptional<z.ZodString>;
    claudeSessionId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    status: z.ZodEnum<[string, ...string[]]>;
    forkedFromId: z.ZodOptional<z.ZodString>;
    containerId: z.ZodOptional<z.ZodString>;
    name: z.ZodOptional<z.ZodString>;
    hidden: z.ZodOptional<z.ZodBoolean>;
    hasUnread: z.ZodOptional<z.ZodBoolean>;
    workspaceId: z.ZodOptional<z.ZodString>;
    worktreePath: z.ZodOptional<z.ZodString>;
    startedAt: z.ZodNumber;
    lastActivityAt: z.ZodNumber;
    endedAt: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    id: string;
    status: string;
    sessionType: string;
    startedAt: number;
    lastActivityAt: number;
    name?: string | undefined;
    agentId?: string | undefined;
    claudeSessionId?: string | null | undefined;
    forkedFromId?: string | undefined;
    containerId?: string | undefined;
    hidden?: boolean | undefined;
    hasUnread?: boolean | undefined;
    workspaceId?: string | undefined;
    worktreePath?: string | undefined;
    endedAt?: number | undefined;
}, {
    id: string;
    status: string;
    sessionType: string;
    startedAt: number;
    lastActivityAt: number;
    name?: string | undefined;
    agentId?: string | undefined;
    claudeSessionId?: string | null | undefined;
    forkedFromId?: string | undefined;
    containerId?: string | undefined;
    hidden?: boolean | undefined;
    hasUnread?: boolean | undefined;
    workspaceId?: string | undefined;
    worktreePath?: string | undefined;
    endedAt?: number | undefined;
}>;
export declare const CreateSessionSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodEnum<[string, ...string[]]>>;
    sessionType: z.ZodOptional<z.ZodEnum<[string, ...string[]]>>;
    agentId: z.ZodOptional<z.ZodString>;
    claudeSessionId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    forkedFromId: z.ZodOptional<z.ZodString>;
    containerId: z.ZodOptional<z.ZodString>;
    hidden: z.ZodOptional<z.ZodBoolean>;
    hasUnread: z.ZodOptional<z.ZodBoolean>;
    workspaceId: z.ZodOptional<z.ZodString>;
    worktreePath: z.ZodOptional<z.ZodString>;
    endedAt: z.ZodOptional<z.ZodNumber>;
} & {
    type: z.ZodOptional<z.ZodEnum<[string, ...string[]]>>;
}, "strip", z.ZodTypeAny, {
    type?: string | undefined;
    name?: string | undefined;
    status?: string | undefined;
    sessionType?: string | undefined;
    agentId?: string | undefined;
    claudeSessionId?: string | null | undefined;
    forkedFromId?: string | undefined;
    containerId?: string | undefined;
    hidden?: boolean | undefined;
    hasUnread?: boolean | undefined;
    workspaceId?: string | undefined;
    worktreePath?: string | undefined;
    endedAt?: number | undefined;
}, {
    type?: string | undefined;
    name?: string | undefined;
    status?: string | undefined;
    sessionType?: string | undefined;
    agentId?: string | undefined;
    claudeSessionId?: string | null | undefined;
    forkedFromId?: string | undefined;
    containerId?: string | undefined;
    hidden?: boolean | undefined;
    hasUnread?: boolean | undefined;
    workspaceId?: string | undefined;
    worktreePath?: string | undefined;
    endedAt?: number | undefined;
}>;
export declare const UpdateSessionSchema: z.ZodObject<Omit<{
    id: z.ZodOptional<z.ZodString>;
    sessionType: z.ZodOptional<z.ZodEnum<[string, ...string[]]>>;
    agentId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    claudeSessionId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    status: z.ZodOptional<z.ZodEnum<[string, ...string[]]>>;
    forkedFromId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    containerId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    hidden: z.ZodOptional<z.ZodOptional<z.ZodBoolean>>;
    hasUnread: z.ZodOptional<z.ZodOptional<z.ZodBoolean>>;
    workspaceId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    worktreePath: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    startedAt: z.ZodOptional<z.ZodNumber>;
    lastActivityAt: z.ZodOptional<z.ZodNumber>;
    endedAt: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
}, "id" | "startedAt">, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    status?: string | undefined;
    sessionType?: string | undefined;
    agentId?: string | undefined;
    claudeSessionId?: string | null | undefined;
    forkedFromId?: string | undefined;
    containerId?: string | undefined;
    hidden?: boolean | undefined;
    hasUnread?: boolean | undefined;
    workspaceId?: string | undefined;
    worktreePath?: string | undefined;
    lastActivityAt?: number | undefined;
    endedAt?: number | undefined;
}, {
    name?: string | undefined;
    status?: string | undefined;
    sessionType?: string | undefined;
    agentId?: string | undefined;
    claudeSessionId?: string | null | undefined;
    forkedFromId?: string | undefined;
    containerId?: string | undefined;
    hidden?: boolean | undefined;
    hasUnread?: boolean | undefined;
    workspaceId?: string | undefined;
    worktreePath?: string | undefined;
    lastActivityAt?: number | undefined;
    endedAt?: number | undefined;
}>;
/**
 * Agent schema - Running agent instance
 */
export declare const AgentSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    status: z.ZodEnum<[string, ...string[]]>;
    currentSessionId: z.ZodOptional<z.ZodString>;
    containerId: z.ZodOptional<z.ZodString>;
    workspaceIds: z.ZodArray<z.ZodString, "many">;
    iconSeed: z.ZodNumber;
    lastSeenAt: z.ZodNumber;
    createdAt: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    id: string;
    name: string;
    status: string;
    createdAt: number;
    workspaceIds: string[];
    iconSeed: number;
    lastSeenAt: number;
    containerId?: string | undefined;
    currentSessionId?: string | undefined;
}, {
    id: string;
    name: string;
    status: string;
    createdAt: number;
    workspaceIds: string[];
    iconSeed: number;
    lastSeenAt: number;
    containerId?: string | undefined;
    currentSessionId?: string | undefined;
}>;
export declare const CreateAgentSchema: z.ZodObject<{
    name: z.ZodString;
    status: z.ZodOptional<z.ZodEnum<[string, ...string[]]>>;
    containerId: z.ZodOptional<z.ZodString>;
    currentSessionId: z.ZodOptional<z.ZodString>;
    workspaceIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    iconSeed: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    name: string;
    status?: string | undefined;
    containerId?: string | undefined;
    currentSessionId?: string | undefined;
    workspaceIds?: string[] | undefined;
    iconSeed?: number | undefined;
}, {
    name: string;
    status?: string | undefined;
    containerId?: string | undefined;
    currentSessionId?: string | undefined;
    workspaceIds?: string[] | undefined;
    iconSeed?: number | undefined;
}>;
export declare const UpdateAgentSchema: z.ZodObject<Omit<{
    id: z.ZodOptional<z.ZodString>;
    name: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodEnum<[string, ...string[]]>>;
    currentSessionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    containerId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    workspaceIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    iconSeed: z.ZodOptional<z.ZodNumber>;
    lastSeenAt: z.ZodOptional<z.ZodNumber>;
    createdAt: z.ZodOptional<z.ZodNumber>;
}, "id" | "createdAt">, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    status?: string | undefined;
    containerId?: string | undefined;
    currentSessionId?: string | undefined;
    workspaceIds?: string[] | undefined;
    iconSeed?: number | undefined;
    lastSeenAt?: number | undefined;
}, {
    name?: string | undefined;
    status?: string | undefined;
    containerId?: string | undefined;
    currentSessionId?: string | undefined;
    workspaceIds?: string[] | undefined;
    iconSeed?: number | undefined;
    lastSeenAt?: number | undefined;
}>;
/**
 * Workspace schema - GitHub repository
 */
export declare const WorkspaceSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    repoUrl: z.ZodString;
    repoOwner: z.ZodString;
    repoName: z.ZodString;
    defaultBranch: z.ZodString;
    localPath: z.ZodString;
    worktreesPath: z.ZodString;
    installationId: z.ZodOptional<z.ZodNumber>;
    cloneStatus: z.ZodOptional<z.ZodEnum<[string, ...string[]]>>;
    cloneError: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodNumber;
    lastSyncedAt: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    id: string;
    name: string;
    createdAt: number;
    repoUrl: string;
    repoOwner: string;
    repoName: string;
    defaultBranch: string;
    localPath: string;
    worktreesPath: string;
    installationId?: number | undefined;
    cloneStatus?: string | undefined;
    cloneError?: string | undefined;
    lastSyncedAt?: number | undefined;
}, {
    id: string;
    name: string;
    createdAt: number;
    repoUrl: string;
    repoOwner: string;
    repoName: string;
    defaultBranch: string;
    localPath: string;
    worktreesPath: string;
    installationId?: number | undefined;
    cloneStatus?: string | undefined;
    cloneError?: string | undefined;
    lastSyncedAt?: number | undefined;
}>;
/**
 * Artifact schema - Session output
 */
export declare const ArtifactSchema: z.ZodObject<{
    id: z.ZodString;
    sessionId: z.ZodString;
    name: z.ZodString;
    type: z.ZodEnum<[string, ...string[]]>;
    content: z.ZodString;
    mimeType: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    id: string;
    type: string;
    name: string;
    createdAt: number;
    sessionId: string;
    content: string;
    mimeType?: string | undefined;
}, {
    id: string;
    type: string;
    name: string;
    createdAt: number;
    sessionId: string;
    content: string;
    mimeType?: string | undefined;
}>;
export declare const CreateArtifactSchema: z.ZodObject<Omit<{
    id: z.ZodString;
    sessionId: z.ZodString;
    name: z.ZodString;
    type: z.ZodEnum<[string, ...string[]]>;
    content: z.ZodString;
    mimeType: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodNumber;
}, "id" | "createdAt">, "strip", z.ZodTypeAny, {
    type: string;
    name: string;
    sessionId: string;
    content: string;
    mimeType?: string | undefined;
}, {
    type: string;
    name: string;
    sessionId: string;
    content: string;
    mimeType?: string | undefined;
}>;
/**
 * ChatMessage schema
 */
export declare const ToolUseSchema: z.ZodObject<{
    name: z.ZodString;
    input: z.ZodUnknown;
    result: z.ZodOptional<z.ZodUnknown>;
}, "strip", z.ZodTypeAny, {
    name: string;
    input?: unknown;
    result?: unknown;
}, {
    name: string;
    input?: unknown;
    result?: unknown;
}>;
export declare const ChatMessageSchema: z.ZodObject<{
    id: z.ZodString;
    sessionId: z.ZodString;
    role: z.ZodEnum<[string, ...string[]]>;
    content: z.ZodString;
    toolUse: z.ZodOptional<z.ZodObject<{
        name: z.ZodString;
        input: z.ZodUnknown;
        result: z.ZodOptional<z.ZodUnknown>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        input?: unknown;
        result?: unknown;
    }, {
        name: string;
        input?: unknown;
        result?: unknown;
    }>>;
    createdAt: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    id: string;
    role: string;
    createdAt: number;
    sessionId: string;
    content: string;
    toolUse?: {
        name: string;
        input?: unknown;
        result?: unknown;
    } | undefined;
}, {
    id: string;
    role: string;
    createdAt: number;
    sessionId: string;
    content: string;
    toolUse?: {
        name: string;
        input?: unknown;
        result?: unknown;
    } | undefined;
}>;
export declare const CreateChatMessageSchema: z.ZodObject<Omit<{
    id: z.ZodString;
    sessionId: z.ZodString;
    role: z.ZodEnum<[string, ...string[]]>;
    content: z.ZodString;
    toolUse: z.ZodOptional<z.ZodObject<{
        name: z.ZodString;
        input: z.ZodUnknown;
        result: z.ZodOptional<z.ZodUnknown>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        input?: unknown;
        result?: unknown;
    }, {
        name: string;
        input?: unknown;
        result?: unknown;
    }>>;
    createdAt: z.ZodNumber;
}, "id" | "createdAt" | "sessionId">, "strip", z.ZodTypeAny, {
    role: string;
    content: string;
    toolUse?: {
        name: string;
        input?: unknown;
        result?: unknown;
    } | undefined;
}, {
    role: string;
    content: string;
    toolUse?: {
        name: string;
        input?: unknown;
        result?: unknown;
    } | undefined;
}>;
export declare const PaginationParamsSchema: z.ZodObject<{
    limit: z.ZodOptional<z.ZodNumber>;
    offset: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    limit?: number | undefined;
    offset?: number | undefined;
}, {
    limit?: number | undefined;
    offset?: number | undefined;
}>;
export declare const ApiSuccessResponseSchema: <T extends z.ZodType>(dataSchema: T) => z.ZodObject<{
    success: z.ZodLiteral<true>;
    data: T;
}, "strip", z.ZodTypeAny, z.objectUtil.addQuestionMarks<z.baseObjectOutputType<{
    success: z.ZodLiteral<true>;
    data: T;
}>, any> extends infer T_1 ? { [k in keyof T_1]: T_1[k]; } : never, z.baseObjectInputType<{
    success: z.ZodLiteral<true>;
    data: T;
}> extends infer T_2 ? { [k_1 in keyof T_2]: T_2[k_1]; } : never>;
export declare const ApiErrorResponseSchema: z.ZodObject<{
    success: z.ZodLiteral<false>;
    error: z.ZodString;
    details: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    error: string;
    success: false;
    details?: Record<string, unknown> | undefined;
}, {
    error: string;
    success: false;
    details?: Record<string, unknown> | undefined;
}>;
export declare const ApiListResponseSchema: <T extends z.ZodType>(itemSchema: T) => z.ZodObject<{
    success: z.ZodLiteral<true>;
    data: z.ZodArray<T, "many">;
    total: z.ZodOptional<z.ZodNumber>;
    limit: z.ZodOptional<z.ZodNumber>;
    offset: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    success: true;
    data: T["_output"][];
    limit?: number | undefined;
    offset?: number | undefined;
    total?: number | undefined;
}, {
    success: true;
    data: T["_input"][];
    limit?: number | undefined;
    offset?: number | undefined;
    total?: number | undefined;
}>;
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
export declare const ListSessionsQuerySchema: z.ZodObject<{
    agentId: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodEnum<[string, ...string[]]>>;
    type: z.ZodOptional<z.ZodEnum<[string, ...string[]]>>;
    active: z.ZodOptional<z.ZodEffects<z.ZodString, boolean, string>>;
    limit: z.ZodOptional<z.ZodPipeline<z.ZodEffects<z.ZodString, number, string>, z.ZodNumber>>;
    offset: z.ZodOptional<z.ZodPipeline<z.ZodEffects<z.ZodString, number, string>, z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    limit?: number | undefined;
    offset?: number | undefined;
    type?: string | undefined;
    status?: string | undefined;
    agentId?: string | undefined;
    active?: boolean | undefined;
}, {
    limit?: string | undefined;
    offset?: string | undefined;
    type?: string | undefined;
    status?: string | undefined;
    agentId?: string | undefined;
    active?: string | undefined;
}>;
export declare const ForkSessionSchema: z.ZodObject<{
    agentId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    agentId?: string | undefined;
}, {
    agentId?: string | undefined;
}>;
export declare const CreateSessionEventSchema: z.ZodObject<{
    type: z.ZodEnum<[string, ...string[]]>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    type: string;
    metadata?: Record<string, unknown> | undefined;
}, {
    type: string;
    metadata?: Record<string, unknown> | undefined;
}>;
export declare const UpdateMessageStatusSchema: z.ZodObject<{
    status: z.ZodEnum<[string, ...string[]]>;
}, "strip", z.ZodTypeAny, {
    status: string;
}, {
    status: string;
}>;
export type ListSessionsQuery = z.infer<typeof ListSessionsQuerySchema>;
export type ForkSessionInput = z.infer<typeof ForkSessionSchema>;
export type CreateSessionEventInput = z.infer<typeof CreateSessionEventSchema>;
export type UpdateMessageStatusInput = z.infer<typeof UpdateMessageStatusSchema>;
export declare const SetGitHubTokenSchema: z.ZodObject<{
    token: z.ZodString;
}, "strip", z.ZodTypeAny, {
    token: string;
}, {
    token: string;
}>;
export declare const CreateGitHubIssueSchema: z.ZodObject<{
    owner: z.ZodString;
    repo: z.ZodString;
    title: z.ZodString;
    body: z.ZodOptional<z.ZodString>;
    labels: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    owner: string;
    repo: string;
    title: string;
    body?: string | undefined;
    labels?: string[] | undefined;
}, {
    owner: string;
    repo: string;
    title: string;
    body?: string | undefined;
    labels?: string[] | undefined;
}>;
export type SetGitHubTokenInput = z.infer<typeof SetGitHubTokenSchema>;
export type CreateGitHubIssueInput = z.infer<typeof CreateGitHubIssueSchema>;
export declare const GetMessagesQuerySchema: z.ZodObject<{
    limit: z.ZodOptional<z.ZodPipeline<z.ZodEffects<z.ZodString, number, string>, z.ZodNumber>>;
    offset: z.ZodOptional<z.ZodPipeline<z.ZodEffects<z.ZodString, number, string>, z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    limit?: number | undefined;
    offset?: number | undefined;
}, {
    limit?: string | undefined;
    offset?: string | undefined;
}>;
export type GetMessagesQuery = z.infer<typeof GetMessagesQuerySchema>;
//# sourceMappingURL=schemas.d.ts.map