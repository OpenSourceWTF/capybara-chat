import { useState, useEffect } from 'react';
import { useSessionMessages } from './useSessionMessages';
import { useSessionActivityState } from './useSessionActivityState';
import { useSessionResponseEvents, useSessionToolUseEvents, useSessionMessageStatusEvents, useSessionContextEvents, useSessionThinkingEvents, } from './useSessionSocketEvents';
import { SOCKET_EVENTS } from '../types';
import { useChatTransport } from '../ChatTransportContext';
export function useChat({ sessionId, onToolEnd, onThinking }) {
    const transport = useChatTransport();
    // 1. Timeline & Messages
    const messages = useSessionMessages(sessionId);
    // 2. Activity & HITL State
    const { state: activityState, actions: activityActions } = useSessionActivityState(sessionId);
    // 3. Context Usage State
    const [contextUsage, setContextUsage] = useState(null);
    const [isContextStale, setIsContextStale] = useState(false);
    // --- Socket Event Wiring ---
    useSessionResponseEvents((data) => {
        if (data.sessionId !== sessionId)
            return;
        // data.message contains the full message object
        const { message } = data;
        // Check if it's a message we care about (usually assistant)
        if (message.role === 'assistant') {
            messages.addAssistantMessage({
                id: message.id,
                sessionId: data.sessionId,
                role: 'assistant',
                content: message.content,
                // message.streaming is generic, might be undefined if not streaming
                status: message.streaming ? 'streaming' : 'completed',
                createdAt: message.createdAt,
                type: 'message',
                // Preserve other fields if needed
            });
            // Cast to unknown then UIChatMessage if types are slightly off, 
            // but ideally we map it correctly. 
            // types.ts UIChatMessage extends ChatMessage which has status: MessageStatus.
            // 'streaming' isn't in MessageStatus ('sent', 'received', etc)?
            // Actually standard MessageStatus might not have 'streaming'. 
            // Huddle likely uses 'assistant-pending' or similar?
            // Or maybe we use 'running'?
            // Let's check MessageStatus enum in types usage.
            // But for now, we just pass what we can.
            if (message.streaming) {
                setIsContextStale(false);
            }
        }
    });
    useSessionThinkingEvents((data) => {
        if (data.sessionId !== sessionId)
            return;
        if (onThinking)
            onThinking();
        messages.addThinkingBlock({
            content: data.content,
            timestamp: data.timestamp
        });
    });
    useSessionToolUseEvents((data) => {
        if (data.sessionId !== sessionId)
            return;
        messages.addToolUse(data);
        // Internal wiring: if tool finishes, call onToolEnd
        if ((data.output !== undefined || data.error !== undefined) && onToolEnd) {
            onToolEnd();
        }
    });
    useSessionMessageStatusEvents((data) => {
        if (data.sessionId !== sessionId)
            return;
        messages.updateMessageStatus(data.messageId, data.status);
    });
    useSessionContextEvents((data) => {
        if (data.sessionId !== sessionId)
            return;
        messages.addContextInjectedEvent(data);
    });
    // Context Usage & Compaction Events
    useEffect(() => {
        if (!sessionId)
            return;
        const handleContextUsage = (data) => {
            setContextUsage(data.usage);
        };
        const handleCompacted = (data) => {
            // Handle compaction
        };
        transport.on(SOCKET_EVENTS.SESSION_CONTEXT_USAGE, handleContextUsage);
        transport.on(SOCKET_EVENTS.SESSION_COMPACTED, handleCompacted);
        return () => {
            transport.off(SOCKET_EVENTS.SESSION_CONTEXT_USAGE, handleContextUsage);
            transport.off(SOCKET_EVENTS.SESSION_COMPACTED, handleCompacted);
        };
    }, [sessionId, transport]);
    // Clean up context usage on session switch
    useEffect(() => {
        setContextUsage(null);
        setIsContextStale(false);
    }, [sessionId]);
    return {
        // Message/Timeline API
        timeline: messages.timeline,
        loading: messages.loading,
        error: messages.error,
        sendMessage: messages.sendMessage,
        resendLastMessage: messages.resendLastMessage,
        loadMore: messages.loadMore,
        hasMore: messages.hasMore,
        loadingMore: messages.loadingMore,
        refresh: messages.refresh,
        lastMessageStatus: messages.lastMessageStatus,
        // Activity API
        activity: activityState.activity,
        progress: activityState.progress,
        cost: activityState.cost,
        // HITL & Blocked API
        humanRequest: activityState.humanRequest,
        blocked: activityState.blocked,
        halted: activityState.halted,
        contextReset: activityState.contextReset,
        sendHumanInputResponse: activityActions.sendHumanInputResponse,
        clearHumanRequest: activityActions.clearHumanRequest,
        clearBlocked: activityActions.clearBlocked,
        clearHalted: activityActions.clearHalted,
        clearContextReset: activityActions.clearContextReset,
        // Context API
        contextUsage,
        isContextStale,
    };
}
//# sourceMappingURL=useChat.js.map