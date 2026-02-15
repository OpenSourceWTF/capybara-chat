import { TimelineItem, LastMessageStatus, UIChatMessage, MessageStatus, FormEntityType } from '../types';
interface UseSessionMessagesOptions {
}
/**
 * Hook for managing session messages via ChatTransport
 */
export declare function useSessionMessages(sessionId: string | null, options?: UseSessionMessagesOptions): {
    timeline: TimelineItem[];
    loading: boolean;
    error: string | null;
    hasMore: boolean;
    nextCursor: number | null;
    loadingMore: boolean;
    loadMore: () => Promise<void>;
    sendMessage: (content: string, options?: {
        type?: string;
        metadata?: any;
    }) => Promise<UIChatMessage | null>;
    resendLastMessage: () => Promise<boolean>;
    addAssistantMessage: (message: UIChatMessage) => Promise<void>;
    addContextInjectedEvent: (data: {
        entityType: FormEntityType;
        entityId?: string;
        contextType: "full" | "minimal";
        contextPreview?: string;
        timestamp?: number;
    }) => void;
    addThinkingBlock: (data: {
        content: string;
        timestamp: number;
    }) => void;
    addToolUse: (data: {
        toolUseId: string;
        toolName: string;
        input: unknown;
        output?: unknown;
        error?: string;
        parentToolUseId?: string | null;
        elapsedMs?: number;
        timestamp: number;
        messageId?: string;
    }) => void;
    updateMessageStatus: (messageId: string, status: MessageStatus) => void;
    refresh: () => Promise<void>;
    lastMessageStatus: LastMessageStatus;
};
export {};
//# sourceMappingURL=useSessionMessages.d.ts.map