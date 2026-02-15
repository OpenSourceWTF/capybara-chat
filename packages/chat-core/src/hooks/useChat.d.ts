import { ContextUsage, UIChatMessage } from '../types';
export interface UseChatOptions {
    sessionId: string | null;
    onToolEnd?: () => void;
    onThinking?: () => void;
}
export declare function useChat({ sessionId, onToolEnd, onThinking }: UseChatOptions): {
    timeline: import("..").TimelineItem[];
    loading: boolean;
    error: string | null;
    sendMessage: (content: string, options?: {
        type?: string;
        metadata?: any;
    }) => Promise<UIChatMessage | null>;
    resendLastMessage: () => Promise<boolean>;
    loadMore: () => Promise<void>;
    hasMore: boolean;
    loadingMore: boolean;
    refresh: () => Promise<void>;
    lastMessageStatus: import("..").LastMessageStatus;
    activity: {
        sessionId: string;
        activity: {
            type: "tool_start" | "tool_end" | "thinking" | "subagent" | "subagent_timeout" | "resuming" | "starting";
            toolName?: string;
            subagentName?: string;
            toolUseId?: string;
            elapsedMs?: number;
            status: "running" | "complete" | "timeout" | "error";
        };
    } | null;
    progress: {
        sessionId: string;
        message: string;
        phase?: "analyzing" | "implementing" | "testing" | "finalizing";
        timestamp?: number;
    } | null;
    cost: {
        sessionId: string;
        cost: number;
        turnCost?: number;
    } | null;
    humanRequest: import("@capybara-chat/types").SessionHumanInputData | null;
    blocked: {
        sessionId: string;
        reason: string;
        blockedOn: string;
        timestamp?: number;
    } | null;
    halted: {
        sessionId: string;
        reason: "timeout" | "cli_error" | "process_exit" | "cli_disconnected";
        errorMessage: string;
        canResume: boolean;
        timestamp?: number;
    } | null;
    contextReset: {
        sessionId: string;
        reason: string;
        previousClaudeSessionId?: string;
    } | null;
    sendHumanInputResponse: (response: string) => void;
    clearHumanRequest: () => void;
    clearBlocked: () => void;
    clearHalted: () => void;
    clearContextReset: () => void;
    contextUsage: ContextUsage | null;
    isContextStale: boolean;
};
//# sourceMappingURL=useChat.d.ts.map