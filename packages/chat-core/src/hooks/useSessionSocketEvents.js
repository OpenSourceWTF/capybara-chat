import { useEffect } from 'react';
import { useChatTransport } from '../ChatTransportContext';
import { SOCKET_EVENTS } from '../types';
export function useSessionToolUseEvents(callback) {
    const transport = useChatTransport();
    useEffect(() => {
        transport.on(SOCKET_EVENTS.SESSION_TOOL_USE, callback);
        return () => {
            transport.off(SOCKET_EVENTS.SESSION_TOOL_USE, callback);
        };
    }, [transport, callback]);
}
export function useSessionResponseEvents(callback) {
    const transport = useChatTransport();
    useEffect(() => {
        transport.on(SOCKET_EVENTS.SESSION_RESPONSE, callback);
        return () => {
            transport.off(SOCKET_EVENTS.SESSION_RESPONSE, callback);
        };
    }, [transport, callback]);
}
export function useSessionErrorEvents(callback) {
    const transport = useChatTransport();
    useEffect(() => {
        transport.on(SOCKET_EVENTS.SESSION_ERROR, callback);
        return () => {
            transport.off(SOCKET_EVENTS.SESSION_ERROR, callback);
        };
    }, [transport, callback]);
}
export function useSessionContextEvents(callback) {
    const transport = useChatTransport();
    useEffect(() => {
        transport.on(SOCKET_EVENTS.SESSION_CONTEXT_INJECTED, callback);
        return () => {
            transport.off(SOCKET_EVENTS.SESSION_CONTEXT_INJECTED, callback);
        };
    }, [transport, callback]);
}
export function useSessionMessageStatusEvents(callback) {
    const transport = useChatTransport();
    useEffect(() => {
        transport.on(SOCKET_EVENTS.MESSAGE_STATUS, callback);
        return () => {
            transport.off(SOCKET_EVENTS.MESSAGE_STATUS, callback);
        };
    }, [transport, callback]);
}
export function useSessionThinkingEvents(callback) {
    const transport = useChatTransport();
    useEffect(() => {
        transport.on(SOCKET_EVENTS.SESSION_THINKING, callback);
        return () => {
            transport.off(SOCKET_EVENTS.SESSION_THINKING, callback);
        };
    }, [transport, callback]);
}
//# sourceMappingURL=useSessionSocketEvents.js.map