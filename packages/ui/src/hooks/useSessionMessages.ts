/**
 * useSessionMessages Hook
 * 
 * Fetches and manages messages from the database via API.
 * Includes message status tracking for processing indicators.
 * NO localStorage - all data from server.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { api } from '../lib/api';
import { createLogger } from '../lib/logger';
import { getErrorMessage } from '../lib/errors';
import { MessageStatus, MessageRole, SessionHistoryEventType, SERVER_DEFAULTS, sessionPath, FormEntityType, SessionMode, SOCKET_EVENTS, type SocketEventPayloads } from '@capybara-chat/types';

const log = createLogger('useSessionMessages');

export type { MessageStatus, MessageRole, SessionHistoryEventType };

/**
 * Tool use embedded in a message (131-tool-embedding)
 * Tools are now sub-objects of their parent message, not separate timeline items.
 */
export interface EmbeddedToolUse {
  id: string;              // toolUseId
  toolName: string;
  input: unknown;
  output?: unknown;
  error?: string;
  parentToolUseId?: string | null;  // For subagent nesting
  elapsedMs?: number;
  status: 'running' | 'complete' | 'error';
  timestamp: number;
}

/**
 * UI-specific chat message with additional display fields.
 * Extends the canonical UIChatMessage from @capybara-chat/types with:
 * - streaming: Whether the message is still streaming
 * - itemType: Used for timeline rendering
 * - toolUses: Embedded tool invocations (131-tool-embedding)
 */
export interface UIChatMessage {
  id: string;
  sessionId: string;
  role: MessageRole;
  content: string;
  toolUses?: EmbeddedToolUse[];  // Tools are embedded in message, not separate timeline items
  status?: MessageStatus;
  streaming?: boolean;
  createdAt: number;
  itemType?: 'message';
}

export interface SessionEvent {
  id: string;
  sessionId: string;
  type: SessionHistoryEventType;
  metadata?: Record<string, unknown>;
  createdAt: number;
  itemType?: 'event';
}

/**
 * Tool use item for inline display in timeline (Task 084)
 * @deprecated Use EmbeddedToolUse instead - tools are now embedded in messages (131-tool-embedding)
 * Kept for backwards compatibility with existing timeline API data
 */
export interface ToolUseItem {
  itemType: 'tool_use';
  id: string;              // toolUseId
  sessionId: string;
  toolName: string;
  input: unknown;
  output?: unknown;
  error?: string;
  parentToolUseId?: string | null;  // For subagent nesting
  elapsedMs?: number;
  status: 'running' | 'complete' | 'error';
  timestamp: number;
  createdAt: number;       // For timeline ordering
}

// Thinking block - extracted from Claude's extended thinking content
export interface ThinkingItem {
  itemType: 'thinking';
  id: string;
  sessionId: string;
  content: string;
  createdAt: number;
  _seq?: number;
}

// Timeline now only contains messages, events, and thinking blocks (131-tool-embedding)
// Tools are embedded in their parent message's toolUses[] array
// ToolUseItem kept for backwards compat with timeline API data migration
// 141-timeline-ordering: _seq is an optional insertion sequence for stable sort during streaming
export type TimelineItem =
  | (UIChatMessage & { itemType: 'message'; _seq?: number })
  | (SessionEvent & { itemType: 'event'; _seq?: number })
  | (ToolUseItem & { _seq?: number })  // Legacy: for existing API data
  | ThinkingItem;

export interface LastMessageStatus {
  status: MessageStatus | 'none' | 'unknown';
  messageId?: string;
  content?: string;
  needsResend: boolean;
  hasAssistantResponse: boolean;
}

interface UseSessionMessagesOptions {
  serverUrl?: string;
}

/**
 * Embed tools in their parent messages based on messageId.
 * 132-tool-splits-messages: Tools have a messageId that links them to their parent message.
 * This function processes API timeline data to embed tools consistently with streaming behavior.
 *
 * @param rawTimeline - Raw timeline from API with tools as separate items
 * @returns Processed timeline with tools embedded in messages
 */
export function embedToolsInMessages(rawTimeline: TimelineItem[]): TimelineItem[] {
  // Separate messages and tools
  const messages: (UIChatMessage & { itemType: 'message' })[] = [];
  const toolsWithMessageId: (ToolUseItem & { messageId: string })[] = [];
  const toolsWithoutMessageId: ToolUseItem[] = [];
  const events: (SessionEvent & { itemType: 'event' })[] = [];

  for (const item of rawTimeline) {
    if (item.itemType === 'message') {
      messages.push(item);
    } else if (item.itemType === 'tool_use') {
      const toolItem = item as ToolUseItem & { messageId?: string };
      if (toolItem.messageId) {
        toolsWithMessageId.push(toolItem as ToolUseItem & { messageId: string });
      } else {
        toolsWithoutMessageId.push(item);
      }
    } else if (item.itemType === 'event') {
      events.push(item);
    }
  }

  // Build messageId -> tools map
  const messageToolsMap = new Map<string, EmbeddedToolUse[]>();
  for (const tool of toolsWithMessageId) {
    const existing = messageToolsMap.get(tool.messageId) || [];
    existing.push({
      id: tool.id,
      toolName: tool.toolName,
      input: tool.input,
      output: tool.output,
      error: tool.error,
      status: tool.status,
      elapsedMs: tool.elapsedMs,
      timestamp: tool.timestamp,
      parentToolUseId: tool.parentToolUseId,
    });
    messageToolsMap.set(tool.messageId, existing);
  }

  // Embed tools in messages
  const embeddedMessageIds = new Set<string>();
  const processedMessages = messages.map(msg => {
    const tools = messageToolsMap.get(msg.id);
    if (tools && tools.length > 0) {
      embeddedMessageIds.add(msg.id);
      return { ...msg, toolUses: tools };
    }
    return msg;
  });

  // CRITICAL FIX (132-tool-splits-messages audit): Tools with messageId but missing parent message
  // should NOT disappear. If a tool's parent message doesn't exist (e.g., message wasn't persisted),
  // treat the tool as a standalone item so it still appears in the timeline.
  const orphanedTools: ToolUseItem[] = [];
  for (const tool of toolsWithMessageId) {
    if (!embeddedMessageIds.has(tool.messageId)) {
      // Parent message doesn't exist - show tool as standalone item
      log.warn('ORPHAN TOOL detected', {
        toolId: tool.id,
        toolName: tool.toolName,
        messageId: tool.messageId,
        availableMessageIds: Array.from(embeddedMessageIds),
      });
      orphanedTools.push({
        ...tool,
        // Note: keep messageId for debugging, but tool will render standalone
      });
    }
  }

  // DEBUG: Log summary of timeline processing
  if (orphanedTools.length > 0 || toolsWithoutMessageId.length > 0) {
    log.warn('Timeline processing summary', {
      messagesWithTools: processedMessages.filter(m => m.toolUses?.length).length,
      orphanedTools: orphanedTools.length,
      legacyTools: toolsWithoutMessageId.length,
      totalToolsFromApi: toolsWithMessageId.length + toolsWithoutMessageId.length,
    });
  }

  // Rebuild timeline: messages (with embedded tools), orphaned tools, legacy tools, events
  const result: TimelineItem[] = [
    ...processedMessages,
    ...orphanedTools,           // Tools whose parent message is missing
    ...toolsWithoutMessageId,   // Tools without messageId (legacy)
    ...events,
  ];

  // Sort by createdAt to maintain timeline order
  result.sort((a, b) => a.createdAt - b.createdAt);

  return result;
}

/**
 * 139-timeline-pagination: Pagination state for infinite scroll
 */
interface PaginationState {
  nextCursor: number | null;
  hasMore: boolean;
  loadingMore: boolean;
}

/**
 * Hook for managing session messages via API
 */
export function useSessionMessages(sessionId: string | null, options: UseSessionMessagesOptions = {}) {
  const { serverUrl = SERVER_DEFAULTS.SERVER_URL } = options;

  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastMessageStatus, setLastMessageStatus] = useState<LastMessageStatus>({
    status: 'none',
    needsResend: false,
    hasAssistantResponse: true,
  });
  const lastSessionRef = useRef<string | null>(null);

  // 141-timeline-ordering: Sequence counter for stable insertion order during streaming
  // Items arriving in real-time get a sequence number to preserve order when timestamps are equal
  const insertionSeqRef = useRef(0);

  // 139-timeline-pagination: Track pagination state for infinite scroll
  const [pagination, setPagination] = useState<PaginationState>({
    nextCursor: null,
    hasMore: false,
    loadingMore: false,
  });

  // Load timeline (messages + events) when session changes
  useEffect(() => {
    if (!sessionId) {
      setTimeline([]);
      setLastMessageStatus({ status: 'none', needsResend: false, hasAssistantResponse: true });
      lastSessionRef.current = null;
      return;
    }

    // Check if session actually changed
    if (sessionId === lastSessionRef.current) {
      return;
    }

    // Clear timeline and status immediately when switching sessions
    setTimeline([]);
    setLastMessageStatus({ status: 'none', needsResend: false, hasAssistantResponse: true });
    setPagination({ nextCursor: null, hasMore: false, loadingMore: false });
    insertionSeqRef.current = 0;  // 141-timeline-ordering: Reset sequence counter
    lastSessionRef.current = sessionId;

    const loadTimeline = async () => {
      setLoading(true);
      setError(null);

      try {
        const res = await api.get(`${serverUrl}${sessionPath(sessionId, 'timeline')}`);

        if (!res.ok) {
          throw new Error(`Failed to load timeline: ${res.status}`);
        }

        const data = await res.json();
        const rawTimeline = data.timeline || [];

        // 139-timeline-pagination: Store pagination metadata
        const paginationData = data.pagination || { nextCursor: null, hasMore: false };
        setPagination({
          nextCursor: paginationData.nextCursor,
          hasMore: paginationData.hasMore,
          loadingMore: false,
        });

        // DEBUG: Log what the API returns
        const toolUseItems = rawTimeline.filter((item: TimelineItem) => item.itemType === 'tool_use');
        log.info('Timeline API response', {
          totalItems: rawTimeline.length,
          toolUseItems: toolUseItems.length,
          pagination: paginationData,
          toolDetails: toolUseItems.slice(0, 10).map((t: ToolUseItem & { messageId?: string }) => ({
            id: t.id,
            toolName: t.toolName,
            messageId: t.messageId || 'NONE',
            parentToolUseId: t.parentToolUseId || 'NONE',
          })),
        });

        // 132-tool-splits-messages: Embed tools in their parent messages
        const processedTimeline = embedToolsInMessages(rawTimeline);

        // 141-timeline-ordering: Assign sequence numbers to API-loaded items
        // API data is already sorted by createdAt, so assign sequences in order
        // to preserve that ordering. Real-time items will get higher sequences.
        const timelineWithSeq = processedTimeline.map((item, index) => ({
          ...item,
          _seq: index,
        }));
        // Set the counter to continue from the last item
        insertionSeqRef.current = timelineWithSeq.length;

        // DEBUG: Log what embedToolsInMessages produces
        const messagesWithTools = processedTimeline.filter(
          (item: TimelineItem): item is UIChatMessage & { itemType: 'message' } =>
            item.itemType === 'message' && !!(item as UIChatMessage).toolUses?.length
        );
        log.info('After embedToolsInMessages', {
          messagesWithTools: messagesWithTools.length,
          embeddedToolCounts: messagesWithTools.slice(0, 10).map((m) => ({
            msgId: m.id,
            toolCount: m.toolUses?.length,
          })),
        });

        setTimeline(timelineWithSeq);
      } catch (err) {
        log.error('Failed to load timeline', { error: err });
        setError(getErrorMessage(err, 'Failed to load messages'));
        setTimeline([]);
      } finally {
        setLoading(false);
      }
    };

    loadTimeline();
  }, [sessionId, serverUrl]);

  // 139-timeline-pagination: Load older messages (scroll up)
  const loadMore = useCallback(async () => {
    if (!sessionId || !pagination.hasMore || pagination.loadingMore || !pagination.nextCursor) {
      return;
    }

    setPagination(prev => ({ ...prev, loadingMore: true }));

    try {
      const url = `${serverUrl}${sessionPath(sessionId, 'timeline')}?before=${pagination.nextCursor}`;
      const res = await api.get(url);

      if (!res.ok) {
        throw new Error(`Failed to load more: ${res.status}`);
      }

      const data = await res.json();
      const rawTimeline = data.timeline || [];
      const paginationData = data.pagination || { nextCursor: null, hasMore: false };

      log.info('Loaded more timeline items', {
        count: rawTimeline.length,
        cursor: pagination.nextCursor,
        pagination: paginationData,
      });

      // Process and embed tools
      const processedTimeline = embedToolsInMessages(rawTimeline);

      // Prepend older items to existing timeline (they're older, so go at start)
      // 141-timeline-ordering: Assign negative sequences to older items (they should sort before existing)
      setTimeline(prev => {
        // Deduplicate by ID
        const existingIds = new Set(prev.map(item => item.id));
        const newItems = processedTimeline.filter(item => !existingIds.has(item.id));
        // Assign negative sequences to older items so they sort before existing timeline
        // Start from -(newItems.length) and increment to -1
        const newItemsWithSeq = newItems.map((item, index) => ({
          ...item,
          _seq: -(newItems.length - index),
        }));
        // 173-optimistic-ui-ordering: Sort by _seq (primary), createdAt (fallback)
        return [...newItemsWithSeq, ...prev].sort((a, b) => {
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
      log.error('Failed to load more messages', { error: err });
      setPagination(prev => ({ ...prev, loadingMore: false }));
    }
  }, [sessionId, serverUrl, pagination]);

  // Check last message status on session change (for resend detection)
  const checkMessageStatus = useCallback(async () => {
    if (!sessionId) return;

    try {
      const res = await api.get(`${serverUrl}${sessionPath(sessionId, 'messages/status')}`);

      if (res.ok) {
        const data = await res.json();
        setLastMessageStatus({
          status: data.status || 'none',
          messageId: data.messageId,
          content: data.content,
          needsResend: data.needsResend || false,
          hasAssistantResponse: data.hasAssistantResponse ?? true,
        });
      }
    } catch (err) {
      log.error('Failed to check message status', { error: err });
    }
  }, [sessionId, serverUrl]);

  // Check status when session changes
  useEffect(() => {
    checkMessageStatus();
  }, [checkMessageStatus]);

  // Update message status in timeline (called from socket event)
  const updateMessageStatus = useCallback((messageId: string, status: MessageStatus) => {
    setTimeline(prev => prev.map(item => {
      if (item.itemType === 'message' && item.id === messageId) {
        return { ...item, status };
      }
      return item;
    }));

    // Update lastMessageStatus if this is the last user message
    setLastMessageStatus(prev => {
      if (prev.messageId === messageId) {
        const isComplete = status === 'completed';
        return {
          ...prev,
          status,
          needsResend: status === 'failed' || (status === 'sent' && !prev.hasAssistantResponse),
          hasAssistantResponse: isComplete ? true : prev.hasAssistantResponse,
        };
      }
      return prev;
    });
  }, []);

  // Send a message - Option C architecture: socket persists AND forwards
  // Frontend adds message optimistically, server persists to DB and forwards to bridge.
  // Returns the optimistic message on success, null on failure.
  const sendMessage = useCallback(async (
    content: string,
    options?: {
      emit: <E extends keyof SocketEventPayloads>(event: E, data: SocketEventPayloads[E]) => void;
      editingContext?: {
        mode: typeof SessionMode.ENTITY_EDITING;
        entityType: FormEntityType;
        entityId?: string;
        formContextInjected: boolean;
      };
      type?: string;
    }
  ): Promise<UIChatMessage | null> => {
    if (!sessionId || !content.trim()) return null;
    if (!options?.emit) {
      log.error('sendMessage requires emit function in Option C architecture');
      return null;
    }

    try {
      // Generate temporary ID for optimistic update
      // Server will create real ID, but we need something for immediate display
      const tempId = `temp-${Date.now()}`;
      const createdAt = Date.now();

      const optimisticMessage: UIChatMessage = {
        id: tempId,
        sessionId,
        role: 'user',
        content,
        status: MessageStatus.SENT,
        createdAt,
        itemType: 'message',
      };

      // Optimistically add to timeline immediately for instant feedback
      // 141-timeline-ordering: Assign sequence number for stable sort
      const seq = insertionSeqRef.current++;
      setTimeline(prev => [...prev, { ...optimisticMessage, itemType: 'message', _seq: seq }]);

      // Option C: Socket persists AND forwards to bridge
      // Server will create message in DB and forward to bridge
      options.emit(SOCKET_EVENTS.SESSION_SEND, {
        sessionId,
        content,
        type: options.type,
        editingContext: options.editingContext,
      });

      // Update last message status
      setLastMessageStatus({
        status: 'sent',
        messageId: tempId,
        content: content.slice(0, 50),
        needsResend: false,
        hasAssistantResponse: false,
      });

      return optimisticMessage;
    } catch (err) {
      log.error('Failed to send message', { error: err });
      setError(getErrorMessage(err, 'Failed to send message'));
      return null;
    }
  }, [sessionId]);

  // Resend the last user message (for failed/timed-out messages)
  const resendLastMessage = useCallback(async (): Promise<boolean> => {
    if (!lastMessageStatus.messageId || !lastMessageStatus.content) {
      return false;
    }

    // Just need to emit to socket again - message already in DB
    // Return the message ID so caller can include it in socket event
    setLastMessageStatus(prev => ({
      ...prev,
      status: 'sent',
      needsResend: false,
    }));

    return true;
  }, [lastMessageStatus]);

  // Add or update an assistant message (received from socket)
  // Handles streaming: updates existing message if ID matches, only persists when streaming=false
  const addAssistantMessage = useCallback(async (message: UIChatMessage) => {
    const isStreaming = message.streaming === true;

    // Update timeline: either update existing message or add new one
    setTimeline(prev => {
      const existingIndex = prev.findIndex(
        item => item.itemType === 'message' && item.id === message.id
      );

      if (existingIndex >= 0) {
        // Update existing message (streaming update)
        // Preserve toolUses and _seq that were assigned during initial add (131-tool-embedding, 141-timeline-ordering)
        const existing = prev[existingIndex] as UIChatMessage & { itemType: 'message'; _seq?: number };
        const updated = [...prev];
        updated[existingIndex] = {
          ...message,
          itemType: 'message',
          toolUses: existing.toolUses,  // Preserve embedded tools
          _seq: existing._seq,          // Preserve insertion sequence
        };
        return updated;
      } else {
        // Add new message - assign sequence for stable ordering
        // 141-timeline-ordering: New messages get next sequence number
        const seq = insertionSeqRef.current++;
        return [...prev, { ...message, itemType: 'message', _seq: seq }];
      }
    });

    // Only update status when streaming is complete
    // Note: Message persistence is now handled server-side to ensure messages are saved
    // even if user switches sessions before response arrives
    if (!isStreaming) {
      // Mark last user message as completed
      setLastMessageStatus(prev => ({
        ...prev,
        status: 'completed',
        needsResend: false,
        hasAssistantResponse: true,
      }));
    }
  }, []);

  // Add a context injected event to the timeline (from socket notification)
  // Only shows full context injections, not reminders (to reduce noise)
  // Includes deduplication to prevent duplicate events within 2 seconds
  // 137-context-timing: Uses server timestamp for correct ordering
  const addContextInjectedEvent = useCallback((data: {
    entityType: FormEntityType;
    entityId?: string;
    contextType: 'full' | 'minimal';
    contextPreview?: string;
    timestamp?: number;  // 137-context-timing: Server timestamp for correct ordering
  }) => {
    if (!sessionId) return;

    // Only show full context injections, not reminders
    if (data.contextType !== 'full') {
      return;
    }

    // 137-context-timing: Use server timestamp if available, fallback to client time
    const eventTime = data.timestamp ?? Date.now();
    const event: SessionEvent & { itemType: 'event' } = {
      id: `ctx-${eventTime}`,
      sessionId,
      type: SessionHistoryEventType.CONTEXT_INJECTED,
      metadata: {
        entityType: data.entityType,
        entityId: data.entityId,
        contextType: data.contextType,
        contextPreview: data.contextPreview,
      },
      createdAt: eventTime,
      itemType: 'event',
    };

    setTimeline(prev => {
      // Deduplicate: check if similar event was added in last 2 seconds
      const nowForDedup = Date.now();  // Use current time for dedup check
      const recentDuplicate = prev.find(item =>
        item.itemType === 'event' &&
        item.type === SessionHistoryEventType.CONTEXT_INJECTED &&
        item.metadata?.entityType === data.entityType &&
        item.metadata?.entityId === data.entityId &&
        nowForDedup - item.createdAt < 2000
      );
      if (recentDuplicate) {
        return prev; // Skip duplicate
      }
      // 141-timeline-ordering: Assign sequence for stable ordering
      const seq = insertionSeqRef.current++;
      return [...prev, { ...event, _seq: seq }];
    });
  }, [sessionId]);

  // Add thinking block to timeline (extended thinking content from Claude)
  const addThinkingBlock = useCallback((data: { content: string; timestamp: number }) => {
    if (!sessionId) return;

    setTimeline(prev => {
      const seq = insertionSeqRef.current++;
      return [...prev, {
        itemType: 'thinking' as const,
        id: `thinking-${data.timestamp}`,
        sessionId,
        content: data.content,
        createdAt: data.timestamp,
        _seq: seq,
      }];
    });
  }, [sessionId]);

  // Add or update a tool use embedded in its parent message (131-tool-embedding)
  // Tools are now sub-objects of messages, not separate timeline items.
  // This fixes ordering issues where tools appeared after messages due to timestamp sorting.
  const addToolUse = useCallback((data: {
    toolUseId: string;
    toolName: string;
    input: unknown;
    output?: unknown;
    error?: string;
    parentToolUseId?: string | null;
    elapsedMs?: number;
    timestamp: number;
    messageId?: string;  // Links tool to parent message (131-tool-embedding)
  }) => {
    if (!sessionId) return;

    // Determine status based on data (086-task-session-issues: fixed status logic)
    const status: EmbeddedToolUse['status'] = data.error
      ? 'error'
      : data.output !== undefined
        ? 'complete'
        : 'running';

    const embeddedTool: EmbeddedToolUse = {
      id: data.toolUseId,
      toolName: data.toolName,
      input: data.input,
      output: data.output,
      error: data.error,
      parentToolUseId: data.parentToolUseId,
      elapsedMs: data.elapsedMs,
      status,
      timestamp: data.timestamp,
    };

    setTimeline(prev => {
      // If messageId provided, embed tool in that message (131-tool-embedding)
      if (data.messageId) {
        const messageIndex = prev.findIndex(
          item => item.itemType === 'message' && item.id === data.messageId
        );

        if (messageIndex >= 0) {
          const message = prev[messageIndex] as UIChatMessage & { itemType: 'message' };
          const existingTools = message.toolUses || [];
          const existingToolIndex = existingTools.findIndex(t => t.id === data.toolUseId);

          let updatedTools: EmbeddedToolUse[];
          if (existingToolIndex >= 0) {
            // Update existing tool
            updatedTools = [...existingTools];
            updatedTools[existingToolIndex] = {
              ...existingTools[existingToolIndex],
              toolName: data.toolName || existingTools[existingToolIndex].toolName,
              input: data.input !== undefined ? data.input : existingTools[existingToolIndex].input,
              output: data.output,
              error: data.error,
              elapsedMs: data.elapsedMs ?? existingTools[existingToolIndex].elapsedMs,
              status,
              timestamp: data.timestamp,
            };
          } else {
            // Add new tool to message
            updatedTools = [...existingTools, embeddedTool];
          }

          const updated = [...prev];
          updated[messageIndex] = { ...message, toolUses: updatedTools };
          return updated;
        }
      }

      // Fallback: no messageId or message not found yet
      // Check if tool exists as legacy separate item and update it
      const existingIndex = prev.findIndex(
        item => item.itemType === 'tool_use' && item.id === data.toolUseId
      );

      if (existingIndex >= 0) {
        const existing = prev[existingIndex] as ToolUseItem;
        const updated = [...prev];
        updated[existingIndex] = {
          ...existing,
          toolName: data.toolName || existing.toolName,
          input: data.input !== undefined ? data.input : existing.input,
          output: data.output,
          error: data.error,
          elapsedMs: data.elapsedMs ?? existing.elapsedMs,
          status,
          timestamp: data.timestamp,
        };
        return updated;
      }

      // Last resort: add as legacy separate item (for backwards compat)
      // This handles cases where message hasn't arrived yet
      // 141-timeline-ordering: Assign sequence for stable ordering
      const seq = insertionSeqRef.current++;
      const legacyItem: ToolUseItem & { _seq: number } = {
        itemType: 'tool_use',
        id: data.toolUseId,
        sessionId,
        toolName: data.toolName,
        input: data.input,
        output: data.output,
        error: data.error,
        parentToolUseId: data.parentToolUseId,
        elapsedMs: data.elapsedMs,
        status,
        timestamp: data.timestamp,
        createdAt: data.timestamp,
        _seq: seq,
      };
      return [...prev, legacyItem];
    });
  }, [sessionId]);

  // Reload timeline from server
  const refresh = useCallback(async () => {
    if (!sessionId) return;

    lastSessionRef.current = null; // Force reload
    setLoading(true);

    try {
      const res = await api.get(`${serverUrl}${sessionPath(sessionId, 'timeline')}`);

      if (res.ok) {
        const data = await res.json();
        // 132-tool-splits-messages: Embed tools in their parent messages
        const processedTimeline = embedToolsInMessages(data.timeline || []);
        // 141-timeline-ordering: Assign sequence numbers on refresh
        const timelineWithSeq = processedTimeline.map((item, index) => ({
          ...item,
          _seq: index,
        }));
        insertionSeqRef.current = timelineWithSeq.length;
        setTimeline(timelineWithSeq);
      }

      // Also refresh message status
      await checkMessageStatus();
    } catch (err) {
      log.error('Failed to refresh timeline', { error: err });
    } finally {
      setLoading(false);
    }
  }, [sessionId, serverUrl, checkMessageStatus]);

  // Get just messages (for components that don't need events)
  const messages = timeline.filter((item): item is UIChatMessage & { itemType: 'message' } =>
    item.itemType === 'message'
  );

  // Get just events
  const events = timeline.filter((item): item is SessionEvent & { itemType: 'event' } =>
    item.itemType === 'event'
  );

  // Computed: is last message actively being processed?
  // Only show thinking indicator for queued/processing states.
  // 'sent' without response should trigger resend, not thinking indicator.
  const isWaitingForResponse = lastMessageStatus.status === 'queued' ||
    lastMessageStatus.status === 'processing';

  // Get all tool uses - both embedded in messages and legacy separate items
  // (131-tool-embedding) Components can use this for unified tool access
  const toolUses = useMemo(() => {
    const tools: (EmbeddedToolUse & { sessionId: string })[] = [];
    for (const item of timeline) {
      if (item.itemType === 'tool_use') {
        // Legacy separate tool item
        tools.push({ ...item, sessionId: item.sessionId });
      } else if (item.itemType === 'message' && item.toolUses) {
        // Embedded tools in message
        for (const tool of item.toolUses) {
          tools.push({ ...tool, sessionId: item.sessionId });
        }
      }
    }
    return tools;
  }, [timeline]);

  // Mark all running tools as complete (called when turn ends)
  // SDK doesn't emit individual tool_result events, so we use this when
  // SESSION_ACTIVITY with type='tool_end' arrives
  // Handles both embedded tools (131-tool-embedding) and legacy separate items
  // 136-timeout-spinner-issues: Added optional status parameter for error scenarios
  const markAllToolsComplete = useCallback((status: 'complete' | 'error' = 'complete') => {
    setTimeline(prev => prev.map(item => {
      // Handle legacy separate tool items
      if (item.itemType === 'tool_use' && item.status === 'running') {
        return { ...item, status };
      }
      // Handle embedded tools in messages (131-tool-embedding)
      if (item.itemType === 'message' && item.toolUses?.some(t => t.status === 'running')) {
        return {
          ...item,
          toolUses: item.toolUses.map(t =>
            t.status === 'running' ? { ...t, status } : t
          ),
        };
      }
      return item;
    }));
  }, []);

  // Sort timeline: insertion sequence is primary, timestamp is fallback.
  // 173-optimistic-ui-ordering: _seq MUST be primary sort key to prevent clock-skew reordering.
  // Problem: optimistic user messages use client timestamps, responses use server timestamps.
  // If server clock is behind client, responses sort ABOVE the user message they reply to.
  // _seq reflects actual insertion order which is always correct (user → response → next).
  const sortedTimeline = useMemo(() => {
    return [...timeline].sort((a, b) => {
      const seqA = a._seq;
      const seqB = b._seq;

      // When both have _seq, use insertion order (always correct for real-time flow)
      if (seqA != null && seqB != null) {
        return seqA - seqB;
      }

      // Fallback to timestamp for items without _seq (legacy data)
      return a.createdAt - b.createdAt;
    });
  }, [timeline]);

  return {
    timeline: sortedTimeline,
    messages,
    events,
    toolUses,
    loading,
    error,
    sendMessage,
    addAssistantMessage,
    addContextInjectedEvent,
    addThinkingBlock,
    addToolUse,
    markAllToolsComplete,
    refresh,
    // Message status tracking
    lastMessageStatus,
    isWaitingForResponse,
    updateMessageStatus,
    resendLastMessage,
    checkMessageStatus,
    // 139-timeline-pagination: Infinite scroll support
    loadMore,
    hasMoreMessages: pagination.hasMore,
    loadingMoreMessages: pagination.loadingMore,
  };
}
