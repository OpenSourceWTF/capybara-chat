import { type ChatMessage, type MessageStatus, SocketEventPayloads, SOCKET_EVENTS, SessionType, Session, ContextUsage, SessionHistoryEventType, FormEntityType, SessionMode } from '@capybara-chat/types';
export { type SocketEventPayloads, SOCKET_EVENTS, SessionType, type Session, SessionHistoryEventType, FormEntityType, SessionMode, type ContextUsage, type ChatMessage, type MessageStatus, };
export declare class ApiError extends Error {
    status: number;
    constructor(status: number, message: string);
}
export interface ToolUseItem {
    id: string;
    excludeFromHistory?: boolean;
    type: 'tool_use';
    name: string;
    input: any;
    output?: any;
    error?: any;
    isError?: boolean;
    status: 'running' | 'completed' | 'failed';
    timestamp: number;
    createdAt: number;
    elapsedMs?: number;
}
export interface ThinkingItem {
    id: string;
    type: 'thinking';
    content: string;
    timestamp: number;
    createdAt: number;
}
export interface SessionEvent {
    id: string;
    type: 'event';
    eventType: string;
    payload?: any;
    timestamp: number;
    createdAt: number;
}
export interface UIChatMessage extends ChatMessage {
    type: 'message';
    toolUses?: ToolUseItem[];
}
export interface DateSeparatorItem {
    type: 'date-separator';
    id: string;
    date: number;
    createdAt: number;
}
export type TimelineItem = UIChatMessage | SessionEvent | ThinkingItem | ToolUseItem | DateSeparatorItem;
export interface EmbeddedToolUse {
    type: 'tool_use';
    id: string;
    toolUseId: string;
    name: string;
    input: any;
    output?: any;
    isError?: boolean;
    status: 'running' | 'completed' | 'failed';
}
export interface LastMessageStatus {
    status: MessageStatus | 'none';
    messageId?: string;
    content?: string;
    needsResend?: boolean;
    hasAssistantResponse?: boolean;
}
export interface TimelineResponse {
    timeline: TimelineItem[];
    hasMore: boolean;
}
export interface MessageStatusResponse {
    status: MessageStatus;
    messageId?: string;
    content?: string;
    needsResend?: boolean;
    hasAssistantResponse?: boolean;
}
export interface SessionListResponse {
    sessions: {
        id: string;
        description?: string;
        createdAt: number;
        updatedAt: number;
        sessionType: SessionType;
    }[];
}
export interface SessionDetailResponse {
    id: string;
    claudeSessionId?: string;
    totalCost?: number;
    agentDefinitionId?: string;
    sessionType?: string;
    model?: any;
}
export type SessionActivityData = SocketEventPayloads[typeof SOCKET_EVENTS.SESSION_ACTIVITY];
export type SessionProgressData = SocketEventPayloads[typeof SOCKET_EVENTS.SESSION_PROGRESS];
export type SessionBlockedData = SocketEventPayloads[typeof SOCKET_EVENTS.SESSION_BLOCKED];
export type SessionHaltedData = SocketEventPayloads[typeof SOCKET_EVENTS.SESSION_HALTED];
export type SessionHumanInputData = SocketEventPayloads[typeof SOCKET_EVENTS.SESSION_HUMAN_INPUT_REQUESTED];
export type SessionContextResetData = SocketEventPayloads[typeof SOCKET_EVENTS.SESSION_CONTEXT_RESET];
export type SessionCostData = SocketEventPayloads[typeof SOCKET_EVENTS.SESSION_COST];
//# sourceMappingURL=types.d.ts.map