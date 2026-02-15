import { useState, useEffect, useCallback, useRef } from 'react';
import { useChatTransport } from '../ChatTransportContext';
import { embedToolsInMessages } from '../utils/embed-tools';
import { getErrorMessage } from '../utils/errors';
import {
  TimelineItem,
  LastMessageStatus,
  UIChatMessage,
  MessageStatus,
  SessionHistoryEventType,
  SessionEvent,
  ToolUseItem,
  EmbeddedToolUse,
  SOCKET_EVENTS,
  FormEntityType,
  ThinkingItem,
} from '../types';

interface UseSessionMessagesOptions {
  // No serverUrl needed, handled by transport
}

interface PaginationState {
  nextCursor: number | null;
  hasMore: boolean;
  loadingMore: boolean;
}

/**
 * Hook for managing session messages via ChatTransport
 */
export function useSessionMessages(sessionId: string | null, options: UseSessionMessagesOptions = {}) {
  const transport = useChatTransport();

  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastMessageStatus, setLastMessageStatus] = useState<LastMessageStatus>({
    status: 'none',
    needsResend: false,
    hasAssistantResponse: true,
  });

  const lastSessionRef = useRef<string | null>(null);
  const insertionSeqRef = useRef(0);

  const [pagination, setPagination] = useState<PaginationState>({
    nextCursor: null,
    hasMore: false,
    loadingMore: false,
  });

  // Load timeline when session changes
  useEffect(() => {
    if (!sessionId) {
      setTimeline([]);
      setLastMessageStatus({ status: 'none', needsResend: false, hasAssistantResponse: true });
      lastSessionRef.current = null;
      return;
    }

    if (sessionId === lastSessionRef.current) return;

    // Reset state
    setTimeline([]);
    setLastMessageStatus({ status: 'none', needsResend: false, hasAssistantResponse: true });
    setPagination({ nextCursor: null, hasMore: false, loadingMore: false });
    insertionSeqRef.current = 0;
    lastSessionRef.current = sessionId;

    const loadTimeline = async () => {
      setLoading(true);
      setError(null);

      try {
        const data = await transport.fetchTimeline(sessionId);
        const rawTimeline = data.timeline || [];
        const hasMore = data.hasMore;

        const paginationData = (data as any).pagination || { nextCursor: null, hasMore };

        setPagination({
          nextCursor: paginationData.nextCursor,
          hasMore: paginationData.hasMore,
          loadingMore: false,
        });

        const processedTimeline = embedToolsInMessages(rawTimeline);

        // Assign sequence numbers
        const timelineWithSeq = processedTimeline.map((item, index) => ({
          ...item,
          _seq: index,
        }));
        insertionSeqRef.current = timelineWithSeq.length;

        setTimeline(timelineWithSeq);
      } catch (err) {
        console.error('Failed to load timeline', err);
        setError(getErrorMessage(err, 'Failed to load messages'));
        setTimeline([]);
      } finally {
        setLoading(false);
      }
    };

    loadTimeline();
  }, [sessionId, transport]);

  // Load more messages
  const loadMore = useCallback(async () => {
    if (!sessionId || !pagination.hasMore || pagination.loadingMore || !pagination.nextCursor) {
      return;
    }

    setPagination(prev => ({ ...prev, loadingMore: true }));

    try {
      const data = await transport.fetchTimeline(sessionId, { before: pagination.nextCursor });
      const rawTimeline = data.timeline || [];
      const hasMore = data.hasMore;
      const paginationData = (data as any).pagination || { nextCursor: null, hasMore };

      const processedTimeline = embedToolsInMessages(rawTimeline);

      setTimeline(prev => {
        const existingIds = new Set(prev.map(item => item.id));
        const newItems = processedTimeline.filter(item => !existingIds.has(item.id));

        // Assign negative sequences
        const newItemsWithSeq = newItems.map((item, index) => ({
          ...item,
          _seq: -(newItems.length - index),
        }));

        const combined = [...newItemsWithSeq, ...prev];
        // Sort by seq if present, else createdAt
        return combined.sort((a: any, b: any) => {
          if (a._seq != null && b._seq != null) return a._seq - b._seq;
          return a.createdAt - b.createdAt;
        });
      });

      setPagination({
        nextCursor: paginationData.nextCursor,
        hasMore: paginationData.hasMore,
        loadingMore: false,
      });
    } catch (err) {
      console.error('Failed to load more messages', err);
      setPagination(prev => ({ ...prev, loadingMore: false }));
    }
  }, [sessionId, transport, pagination]);

  // Check status
  const checkMessageStatus = useCallback(async () => {
    if (!sessionId) return;
    try {
      const data = await transport.fetchMessageStatus(sessionId);
      setLastMessageStatus(prev => ({
        ...prev,
        status: data.status,
      }));
    } catch (err) {
      console.error('Failed to check message status', err);
    }
  }, [sessionId, transport]);

  useEffect(() => {
    checkMessageStatus();
  }, [checkMessageStatus]);

  // Update status from socket
  const updateMessageStatus = useCallback((messageId: string, status: MessageStatus) => {
    setTimeline(prev => prev.map(item => {
      if (item.type === 'message' && item.id === messageId) {
        return { ...item, status };
      }
      return item;
    }));

    setLastMessageStatus(prev => {
      const isComplete = status === 'completed';
      return {
        ...prev,
        status,
        needsResend: status === 'failed',
        hasAssistantResponse: isComplete ? true : prev.hasAssistantResponse,
      };
    });
  }, []);

  // Send message
  const sendMessage = useCallback(async (
    content: string,
    options?: {
      type?: string;
      metadata?: any;
    }
  ): Promise<UIChatMessage | null> => {
    if (!sessionId || !content.trim()) return null;

    try {
      const tempId = `temp-${Date.now()}`;
      const createdAt = Date.now();

      const optimisticMessage: UIChatMessage = {
        id: tempId,
        sessionId,
        role: 'user',
        content,
        status: 'sent', // MessageStatus
        createdAt,
        type: 'message',
        toolUses: [],
      };

      const seq = insertionSeqRef.current++;
      setTimeline(prev => [...prev, { ...optimisticMessage, _seq: seq } as any]);

      // Emit via transport
      transport.emit(SOCKET_EVENTS.SESSION_SEND, {
        sessionId,
        content,
        type: options?.type,
        ...options?.metadata
      });

      setLastMessageStatus({
        status: 'sent',
        needsResend: false,
        hasAssistantResponse: false,
      });

      return optimisticMessage;
    } catch (err) {
      console.error('Failed to send message', err);
      setError(getErrorMessage(err, 'Failed to send message'));
      return null;
    }
  }, [sessionId, transport]);

  // Resend
  const resendLastMessage = useCallback(async (): Promise<boolean> => {
    // Placeholder for resend logic if needed
    return true;
  }, []);

  // Add assistant message (streaming)
  const addAssistantMessage = useCallback(async (message: UIChatMessage) => {
    const isStreaming = (message as any).streaming === true;

    setTimeline(prev => {
      const existingIndex = prev.findIndex(
        item => item.type === 'message' && item.id === message.id
      );

      if (existingIndex >= 0) {
        const existing = prev[existingIndex] as UIChatMessage & { _seq?: number };
        const updated = [...prev];
        updated[existingIndex] = {
          ...existing,
          ...message,
          type: 'message',
          toolUses: existing.toolUses, // Preserve tools if any
          _seq: existing._seq,
        } as any;
        return updated;
      } else {
        const seq = insertionSeqRef.current++;
        return [...prev, { ...message, type: 'message', toolUses: [], _seq: seq } as any];
      }
    });

    if (!isStreaming) {
      setLastMessageStatus(prev => ({
        ...prev,
        status: 'completed',
        needsResend: false,
        hasAssistantResponse: true,
      }));
    }
  }, []);

  // Context Event
  const addContextInjectedEvent = useCallback((data: {
    entityType: FormEntityType;
    entityId?: string;
    contextType: 'full' | 'minimal';
    contextPreview?: string;
    timestamp?: number;
  }) => {
    if (!sessionId) return;
    if (data.contextType !== 'full') return;

    const eventTime = data.timestamp ?? Date.now();
    const event: SessionEvent = {
      id: `ctx-${eventTime}`,
      eventType: SessionHistoryEventType.CONTEXT_INJECTED,
      type: 'event',
      payload: {
        entityType: data.entityType,
        entityId: data.entityId,
        contextType: data.contextType,
        contextPreview: data.contextPreview,
      },
      timestamp: eventTime,
      createdAt: eventTime,
    };

    setTimeline(prev => {
      const nowForDedup = Date.now();
      const recentDuplicate = prev.find(item =>
        item.type === 'event' &&
        item.eventType === SessionHistoryEventType.CONTEXT_INJECTED &&
        item.payload?.entityType === data.entityType &&
        item.payload?.entityId === data.entityId &&
        nowForDedup - item.createdAt < 2000
      );
      if (recentDuplicate) return prev;

      const seq = insertionSeqRef.current++;
      return [...prev, { ...event, _seq: seq } as any];
    });
  }, [sessionId]);

  // Thinking block
  const addThinkingBlock = useCallback((data: { content: string; timestamp: number }) => {
    if (!sessionId) return;
    setTimeline(prev => {
      const seq = insertionSeqRef.current++;
      const thinking: ThinkingItem & { _seq: number } = {
        type: 'thinking',
        id: `thinking-${data.timestamp}`,
        content: data.content,
        timestamp: data.timestamp,
        createdAt: data.timestamp,
        _seq: seq,
      } as any;
      return [...prev, thinking];
    });
  }, [sessionId]);

  // Tool use
  const addToolUse = useCallback((data: {
    toolUseId: string;
    toolName: string;
    input: unknown;
    output?: unknown;
    error?: string;
    parentToolUseId?: string | null;
    elapsedMs?: number;
    timestamp: number;
    messageId?: string;
  }) => {
    if (!sessionId) return;

    const status: EmbeddedToolUse['status'] = data.error
      ? 'failed'
      : data.output !== undefined
        ? 'completed'
        : 'running';

    const embeddedTool: EmbeddedToolUse = {
      type: 'tool_use',
      id: data.toolUseId,
      toolUseId: data.toolUseId,
      name: data.toolName,
      input: data.input,
      output: data.output,
      isError: !!data.error,
      status,
    };

    setTimeline(prev => {
      if (data.messageId) {
        const messageIndex = prev.findIndex(
          item => item.type === 'message' && item.id === data.messageId
        );

        if (messageIndex >= 0) {
          const message = prev[messageIndex] as UIChatMessage;
          const existingTools = message.toolUses || [];
          const existingToolIndex = existingTools.findIndex(t => t.id === data.toolUseId);

          let updatedTools: ToolUseItem[];

          const toolItemPartial = {
            ...embeddedTool,
            timestamp: data.timestamp,
            createdAt: data.timestamp,
            elapsedMs: data.elapsedMs,
            error: data.error,
          };

          if (existingToolIndex >= 0) {
            updatedTools = [...existingTools];
            updatedTools[existingToolIndex] = {
              ...existingTools[existingToolIndex],
              ...toolItemPartial,
              input: data.input !== undefined ? data.input : existingTools[existingToolIndex].input,
            } as ToolUseItem;
          } else {
            updatedTools = [...existingTools, toolItemPartial as ToolUseItem];
          }

          const updated = [...prev];
          updated[messageIndex] = { ...message, toolUses: updatedTools };
          return updated;
        }
      }

      // Fallback: standalone tool
      const existingIndex = prev.findIndex(
        item => item.type === 'tool_use' && item.id === data.toolUseId
      );

      // Warn for standalone tool
      console.warn('Orphan tool use received', data);
      return prev;
    });
  }, [sessionId]);

  const refresh = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    try {
      const data = await transport.fetchTimeline(sessionId);
      const processedTimeline = embedToolsInMessages(data.timeline || []);
      const timelineWithSeq = processedTimeline.map((item, index) => ({
        ...item,
        _seq: index,
      }));
      insertionSeqRef.current = timelineWithSeq.length;
      setTimeline(timelineWithSeq);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [sessionId, transport]);

  return {
    timeline,
    loading,
    error,
    hasMore: pagination.hasMore,
    nextCursor: pagination.nextCursor,
    loadingMore: pagination.loadingMore,
    loadMore,
    sendMessage,
    resendLastMessage,
    addAssistantMessage,
    addContextInjectedEvent,
    addThinkingBlock,
    addToolUse,
    updateMessageStatus,
    refresh,
    lastMessageStatus
  };
}
