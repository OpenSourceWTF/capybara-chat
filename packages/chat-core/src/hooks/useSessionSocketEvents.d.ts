import { SocketEventPayloads, SOCKET_EVENTS } from '../types';
/**
 * Listen for tool use events
 */
export type SessionToolUseData = SocketEventPayloads[typeof SOCKET_EVENTS.SESSION_TOOL_USE];
export declare function useSessionToolUseEvents(callback: (data: SessionToolUseData) => void): void;
/**
 * Listen for response/message events (tokens, complete, thinking)
 */
export type SessionResponseData = SocketEventPayloads[typeof SOCKET_EVENTS.SESSION_RESPONSE];
export declare function useSessionResponseEvents(callback: (data: SessionResponseData) => void): void;
/**
 * Listen for session error events
 */
export type SessionErrorData = SocketEventPayloads[typeof SOCKET_EVENTS.SESSION_ERROR];
export declare function useSessionErrorEvents(callback: (data: SessionErrorData) => void): void;
/**
 * Listen for context injection events
 */
export type SessionContextInjectedData = SocketEventPayloads[typeof SOCKET_EVENTS.SESSION_CONTEXT_INJECTED];
export declare function useSessionContextEvents(callback: (data: SessionContextInjectedData) => void): void;
/**
 * Listen for message status updates
 */
export type MessageStatusData = SocketEventPayloads[typeof SOCKET_EVENTS.MESSAGE_STATUS];
export declare function useSessionMessageStatusEvents(callback: (data: MessageStatusData) => void): void;
/**
 * Listen for thinking events
 */
export type SessionThinkingData = SocketEventPayloads[typeof SOCKET_EVENTS.SESSION_THINKING];
export declare function useSessionThinkingEvents(callback: (data: SessionThinkingData) => void): void;
//# sourceMappingURL=useSessionSocketEvents.d.ts.map