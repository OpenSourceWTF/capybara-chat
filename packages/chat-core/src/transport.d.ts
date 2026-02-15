import { TimelineResponse, MessageStatusResponse, SessionListResponse, SessionDetailResponse } from './types';
/**
 * ChatTransport Interface
 * Defines how the chat core communicates with the backend.
 * Abstraction allows swapping implementations (e.g., Socket.io vs separate WebSocket vs polling).
 */
export interface ChatTransport {
    on<E extends string>(event: E, handler: (data: any) => void): void;
    off<E extends string>(event: E, handler: (data: any) => void): void;
    emit<E extends string>(event: E, data: any): void;
    connected: boolean;
    onConnectionChange(handler: (connected: boolean) => void): () => void;
    disconnect(): void;
    fetchTimeline(sessionId: string, options?: {
        before?: number;
    }): Promise<TimelineResponse>;
    fetchMessageStatus(sessionId: string): Promise<MessageStatusResponse>;
    fetchSessions(): Promise<SessionListResponse>;
    createSession(options?: {
        agentDefinitionId?: string;
    }): Promise<{
        id: string;
    }>;
    fetchSession(sessionId: string): Promise<SessionDetailResponse>;
    deleteSession(sessionId: string): Promise<void>;
}
export interface SocketChatTransportOptions {
    serverUrl: string;
    authToken?: string | (() => string | null);
    apiKey?: string;
}
/**
 * Socket.io implementation of ChatTransport.
 * Compatible with existing Capybara Server.
 */
export declare class SocketChatTransport implements ChatTransport {
    private socket;
    private serverUrl;
    private authTokenOption?;
    private apiKey?;
    private connectionListeners;
    private intentionallyDisconnected;
    constructor(options: SocketChatTransportOptions);
    private getToken;
    private setupSocketListeners;
    private notifyConnectionChange;
    get connected(): boolean;
    onConnectionChange(handler: (connected: boolean) => void): () => void;
    disconnect(): void;
    on<E extends string>(event: E, handler: (data: any) => void): void;
    off<E extends string>(event: E, handler: (data: any) => void): void;
    emit<E extends string>(event: E, data: any): void;
    private fetch;
    fetchTimeline(sessionId: string, options?: {
        before?: number;
    }): Promise<TimelineResponse>;
    fetchMessageStatus(sessionId: string): Promise<MessageStatusResponse>;
    fetchSessions(): Promise<SessionListResponse>;
    createSession(options?: {
        agentDefinitionId?: string;
    }): Promise<{
        id: string;
    }>;
    fetchSession(sessionId: string): Promise<SessionDetailResponse>;
    deleteSession(sessionId: string): Promise<void>;
}
//# sourceMappingURL=transport.d.ts.map