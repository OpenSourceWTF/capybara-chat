import { io, Socket } from 'socket.io-client';
import {
  type ChatMessage,
  type MessageStatus,
  SocketEventPayloads,
  SOCKET_EVENTS,
  SessionType,
  Session,
  TimelineResponse,
  MessageStatusResponse,
  SessionListResponse,
  SessionDetailResponse,
  ApiError
} from './types';

/**
 * ChatTransport Interface
 * Defines how the chat core communicates with the backend.
 * Abstraction allows swapping implementations (e.g., Socket.io vs separate WebSocket vs polling).
 */
export interface ChatTransport {
  // Event subscription
  on<E extends string>(event: E, handler: (data: any) => void): void;
  off<E extends string>(event: E, handler: (data: any) => void): void;
  emit<E extends string>(event: E, data: any): void;

  // Connection state
  connected: boolean;
  onConnectionChange(handler: (connected: boolean) => void): () => void;
  disconnect(): void;

  // Data access
  fetchTimeline(sessionId: string, options?: { before?: number }): Promise<TimelineResponse>;
  fetchMessageStatus(sessionId: string): Promise<MessageStatusResponse>;

  // Session CRUD
  fetchSessions(): Promise<SessionListResponse>;
  createSession(options?: { agentDefinitionId?: string }): Promise<{ id: string }>;
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
export class SocketChatTransport implements ChatTransport {
  private socket: Socket;
  private serverUrl: string;
  private authTokenOption?: string | (() => string | null);
  private apiKey?: string;
  private connectionListeners: Set<(connected: boolean) => void> = new Set();

  // Track forced disconnects vs temporary drops
  private intentionallyDisconnected = false;

  constructor(options: SocketChatTransportOptions) {
    this.serverUrl = options.serverUrl;
    this.authTokenOption = options.authToken;
    this.apiKey = options.apiKey;

    // Initialize socket
    // When serverUrl is empty, connect to same origin (for proxy setups)
    const socketTarget = this.serverUrl || undefined;
    this.socket = io(socketTarget, {
      autoConnect: true,
      auth: (cb) => {
        const token = this.getToken();
        cb({ token, apiKey: this.apiKey });
      },
      transports: ['websocket', 'polling'], // Prefer websocket
      path: '/socket.io/', // Standard path
    });

    this.setupSocketListeners();
  }

  private getToken(): string | null {
    if (typeof this.authTokenOption === 'function') {
      return this.authTokenOption();
    }
    return this.authTokenOption || null;
  }

  private setupSocketListeners() {
    this.socket.on('connect', () => {
      this.intentionallyDisconnected = false;
      this.notifyConnectionChange(true);
    });

    this.socket.on('disconnect', (reason) => {
      this.notifyConnectionChange(false);
      // Logic for handling implicit reconnects is built into Socket.io
    });

    this.socket.on('connect_error', (err) => {
      console.warn('Socket connect error', err);
      this.notifyConnectionChange(false);
    });
  }

  private notifyConnectionChange(connected: boolean) {
    this.connectionListeners.forEach(listener => listener(connected));
  }

  // --- Interface Implementation ---

  get connected(): boolean {
    return this.socket.connected;
  }

  onConnectionChange(handler: (connected: boolean) => void): () => void {
    this.connectionListeners.add(handler);
    // Initial call
    handler(this.connected);
    return () => {
      this.connectionListeners.delete(handler);
    };
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
    }
  }

  on<E extends string>(event: E, handler: (data: any) => void): void {
    this.socket.on(event, handler as any);
  }

  off<E extends string>(event: E, handler: (data: any) => void): void {
    this.socket.off(event, handler as any);
  }

  emit<E extends string>(event: E, data: any): void {
    this.socket.emit(event, data);
  }

  // --- REST API Helpers ---

  private async fetch<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.serverUrl}${path}`;
    const token = this.getToken();

    const headers = new Headers(options.headers || {});
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    if (this.apiKey) {
      headers.set('X-Api-Key', this.apiKey);
    }
    if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
      headers.set('Content-Type', 'application/json');
    }

    try {
      const res = await fetch(url, {
        ...options,
        headers,
      });

      if (!res.ok) {
        let errorMessage = res.statusText;
        try {
          const body = await res.text();
          // Try parsing JSON error
          try {
            const json = JSON.parse(body);
            errorMessage = json.message || json.error || body;
          } catch {
            errorMessage = body || res.statusText;
          }
        } catch { }

        throw new ApiError(res.status, errorMessage);
      }

      // Handle 204 No Content
      if (res.status === 204) {
        return {} as T;
      }

      return res.json() as Promise<T>;
    } catch (err: unknown) {
      if (err instanceof ApiError) throw err;
      throw new Error(`Fetch failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // --- Data Access Methods ---

  async fetchTimeline(sessionId: string, options?: { before?: number }): Promise<TimelineResponse> {
    const query = options?.before ? `?before=${options.before}` : '';
    return this.fetch<TimelineResponse>(`/api/sessions/${sessionId}/timeline${query}`);
  }

  async fetchMessageStatus(sessionId: string): Promise<MessageStatusResponse> {
    return this.fetch<MessageStatusResponse>(`/api/sessions/${sessionId}/messages/status`);
  }

  // --- Session CRUD ---

  async fetchSessions(): Promise<SessionListResponse> {
    const response = await this.fetch<{ sessions: any[]; total: number }>('/api/sessions');
    // Map backend response to SessionListResponse
    return {
      sessions: (response.sessions || []).map(s => ({
        id: s.id,
        description: s.description || s.name,
        createdAt: new Date(s.createdAt).getTime(),
        updatedAt: new Date(s.updatedAt).getTime(),
        sessionType: s.sessionType,
      }))
    };
  }

  async createSession(options?: { agentDefinitionId?: string }): Promise<{ id: string }> {
    return this.fetch<{ id: string }>('/api/sessions', {
      method: 'POST',
      body: JSON.stringify(options || {}),
    });
  }

  async fetchSession(sessionId: string): Promise<SessionDetailResponse> {
    return this.fetch<SessionDetailResponse>(`/api/sessions/${sessionId}`);
  }

  async deleteSession(sessionId: string): Promise<void> {
    return this.fetch<void>(`/api/sessions/${sessionId}`, {
      method: 'DELETE',
    });
  }
}
