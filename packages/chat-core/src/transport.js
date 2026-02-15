import { io } from 'socket.io-client';
import { ApiError } from './types';
/**
 * Socket.io implementation of ChatTransport.
 * Compatible with existing Capybara Server.
 */
export class SocketChatTransport {
    socket;
    serverUrl;
    authTokenOption;
    apiKey;
    connectionListeners = new Set();
    // Track forced disconnects vs temporary drops
    intentionallyDisconnected = false;
    constructor(options) {
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
    getToken() {
        if (typeof this.authTokenOption === 'function') {
            return this.authTokenOption();
        }
        return this.authTokenOption || null;
    }
    setupSocketListeners() {
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
    notifyConnectionChange(connected) {
        this.connectionListeners.forEach(listener => listener(connected));
    }
    // --- Interface Implementation ---
    get connected() {
        return this.socket.connected;
    }
    onConnectionChange(handler) {
        this.connectionListeners.add(handler);
        // Initial call
        handler(this.connected);
        return () => {
            this.connectionListeners.delete(handler);
        };
    }
    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
        }
    }
    on(event, handler) {
        this.socket.on(event, handler);
    }
    off(event, handler) {
        this.socket.off(event, handler);
    }
    emit(event, data) {
        this.socket.emit(event, data);
    }
    // --- REST API Helpers ---
    async fetch(path, options = {}) {
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
                    }
                    catch {
                        errorMessage = body || res.statusText;
                    }
                }
                catch { }
                throw new ApiError(res.status, errorMessage);
            }
            // Handle 204 No Content
            if (res.status === 204) {
                return {};
            }
            return res.json();
        }
        catch (err) {
            if (err instanceof ApiError)
                throw err;
            throw new Error(`Fetch failed: ${err instanceof Error ? err.message : String(err)}`);
        }
    }
    // --- Data Access Methods ---
    async fetchTimeline(sessionId, options) {
        const query = options?.before ? `?before=${options.before}` : '';
        return this.fetch(`/api/sessions/${sessionId}/timeline${query}`);
    }
    async fetchMessageStatus(sessionId) {
        return this.fetch(`/api/sessions/${sessionId}/messages/status`);
    }
    // --- Session CRUD ---
    async fetchSessions() {
        const response = await this.fetch('/api/sessions');
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
    async createSession(options) {
        return this.fetch('/api/sessions', {
            method: 'POST',
            body: JSON.stringify(options || {}),
        });
    }
    async fetchSession(sessionId) {
        return this.fetch(`/api/sessions/${sessionId}`);
    }
    async deleteSession(sessionId) {
        return this.fetch(`/api/sessions/${sessionId}`, {
            method: 'DELETE',
        });
    }
}
//# sourceMappingURL=transport.js.map