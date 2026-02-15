import { useEffect } from 'react';
import { useChatTransport } from '../ChatTransportContext';
import { SocketEventPayloads, SOCKET_EVENTS } from '../types';

/**
 * Listen for tool use events
 */
export type SessionToolUseData = SocketEventPayloads[typeof SOCKET_EVENTS.SESSION_TOOL_USE];
export function useSessionToolUseEvents(
  callback: (data: SessionToolUseData) => void
) {
  const transport = useChatTransport();

  useEffect(() => {
    transport.on(SOCKET_EVENTS.SESSION_TOOL_USE, callback);
    return () => {
      transport.off(SOCKET_EVENTS.SESSION_TOOL_USE, callback);
    };
  }, [transport, callback]);
}

/**
 * Listen for response/message events (tokens, complete, thinking)
 */
export type SessionResponseData = SocketEventPayloads[typeof SOCKET_EVENTS.SESSION_RESPONSE];
export function useSessionResponseEvents(
  callback: (data: SessionResponseData) => void
) {
  const transport = useChatTransport();

  useEffect(() => {
    transport.on(SOCKET_EVENTS.SESSION_RESPONSE, callback);
    return () => {
      transport.off(SOCKET_EVENTS.SESSION_RESPONSE, callback);
    };
  }, [transport, callback]);
}

/**
 * Listen for session error events
 */
export type SessionErrorData = SocketEventPayloads[typeof SOCKET_EVENTS.SESSION_ERROR];
export function useSessionErrorEvents(
  callback: (data: SessionErrorData) => void
) {
  const transport = useChatTransport();

  useEffect(() => {
    transport.on(SOCKET_EVENTS.SESSION_ERROR, callback);
    return () => {
      transport.off(SOCKET_EVENTS.SESSION_ERROR, callback);
    };
  }, [transport, callback]);
}

/**
 * Listen for context injection events
 */
export type SessionContextInjectedData = SocketEventPayloads[typeof SOCKET_EVENTS.SESSION_CONTEXT_INJECTED];
export function useSessionContextEvents(
  callback: (data: SessionContextInjectedData) => void
) {
  const transport = useChatTransport();

  useEffect(() => {
    transport.on(SOCKET_EVENTS.SESSION_CONTEXT_INJECTED, callback);
    return () => {
      transport.off(SOCKET_EVENTS.SESSION_CONTEXT_INJECTED, callback);
    };
  }, [transport, callback]);
}

// ... existing code ...

/**
 * Listen for message status updates
 */
export type MessageStatusData = SocketEventPayloads[typeof SOCKET_EVENTS.MESSAGE_STATUS];
export function useSessionMessageStatusEvents(
  callback: (data: MessageStatusData) => void
) {
  const transport = useChatTransport();

  useEffect(() => {
    transport.on(SOCKET_EVENTS.MESSAGE_STATUS, callback);
    return () => {
      transport.off(SOCKET_EVENTS.MESSAGE_STATUS, callback);
    };
  }, [transport, callback]);
}

/**
 * Listen for thinking events
 */
export type SessionThinkingData = SocketEventPayloads[typeof SOCKET_EVENTS.SESSION_THINKING];
export function useSessionThinkingEvents(
  callback: (data: SessionThinkingData) => void
) {
  const transport = useChatTransport();

  useEffect(() => {
    transport.on(SOCKET_EVENTS.SESSION_THINKING, callback);
    return () => {
      transport.off(SOCKET_EVENTS.SESSION_THINKING, callback);
    };
  }, [transport, callback]);
}
