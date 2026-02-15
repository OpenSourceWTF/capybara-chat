/**
 * GeneralConversation - Chat view component
 *
 * Uses API for all message persistence (no localStorage).
 * Uses shared SocketContext for real-time updates.
 * Displays messages with timestamps and inline timeline events.
 *
 * Performance: Message rendering extracted to memoized MessageList component.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Syringe } from 'lucide-react';
import { useSessionMessages, type UIChatMessage } from '../../hooks/useSessionMessages';
import { useSessionResponseEvents, useSessionToolUseEvents, type SessionResponseData, type MessageStatusData, type SessionErrorData, type SessionContextInjectedData, type SessionToolUseData } from '../../hooks/useSessionSocketEvents';
import { useSessionActivityState } from '../../hooks/useSessionActivityState';
import { useSessionMemories } from '../../hooks/useSessionMemories';
import { useSessionCreatedEntities } from '../../hooks/useSessionCreatedEntities';
// Note: SessionActivityPanel moved to SessionDetailView in left pane (124-continuation)
import { MessageInputBar, type InputContextAction } from './MessageInputBar';
import { MessageList } from './MessageList';
import { ChatSettingsDialog } from '../modals/ChatSettingsDialog';
import { NewChatModal } from '../modals/NewChatModal';
import { ChatSearchBar, type SearchMatch } from './ChatSearchBar';
import { ChatStatusHeader } from './ChatStatusHeader';
import { ActivityStatusBar } from './ActivityStatusBar';
import { HumanInputModal } from './HumanInputModal';
import { ContextUsageMeter } from './ContextUsageMeter';
import { StatusBanner, type BannerVariant } from './StatusBanner';
import { SessionDropdown } from '../session/SessionDropdown';
import { createLogger } from '../../lib/logger';
import { useServer } from '../../context/ServerContext';
import { useSocket } from '../../context/SocketContext';
import { SessionType, MessageStatus, SOCKET_EVENTS, sessionPath, API_PATHS, WorkerTaskState, type AgentModel, type ContextUsage, type SocketEventPayloads } from '@capybara-chat/types';
import { api } from '../../lib/api';
import { useLayoutMode } from '../../context/LayoutModeContext';
import { useChatPreferences } from '../../hooks/useChatPreferences';

const log = createLogger('GeneralConversation');

interface SessionDetails {
  claudeSessionId?: string;
  totalCost?: number;
  agentDefinitionId?: string;
  model?: AgentModel;  // 135-assistant-model-switch
  sessionType?: string; // Session type from API (matches Session.sessionType)
}

// 143-chat-system-prompt-display: AgentDefinition response shape
interface AgentDefinitionResponse {
  id: string;
  name: string;
  resolvedSystemPrompt?: string;
}

// 168-right-bar-elimination: Task info for context-sensitive actions
interface TaskInfo {
  id: string;
  state: WorkerTaskState;
}

/** Task states where reinject is not useful (task is done or explicitly cancelled) */
const REINJECT_EXCLUDED_STATES: WorkerTaskState[] = [
  WorkerTaskState.COMPLETE,
  WorkerTaskState.CANCELLED,
];

interface GeneralConversationProps {
  sessionId: string | null;
  onSlashCommand?: (command: import('../../lib/slash-command-parser').ParsedCommand) => void;
  /** Navigate to session detail view in left pane */
  onViewSession?: (sessionId: string) => void;
  /** Create a new chat session (168-right-bar-elimination) */
  onNewChat?: (agentDefinitionId?: string, workspaceId?: string) => void;
  /** Spawn a new task (168-right-bar-elimination) */
  onNewTask?: () => void;
  /** Switch to a different session (168-right-bar-elimination) */
  onSessionSelect?: (sessionId: string) => void;
  /** Delete a session (168-right-bar-elimination) */
  onSessionDelete?: (sessionId: string) => void;
}


// Cute random thinking phrases for levity
const THINKING_PHRASES = [
  'Claude is thinking...',
  'Claude is pondering...',
  'Claude is contemplating...',
  'Claude is mulling it over...',
  'Claude is daydreaming productively...',
  'Claude is connecting the dots...',
  'Claude is brewing ideas...',
  'Claude is consulting the vibes...',
  'Claude is doing brain things...',
  'Claude is noodling on this...',
  'Claude is having a lightbulb moment...',
  'Claude is in the idea kitchen...',
  'Claude is summoning wisdom...',
  'Claude is processing pixels...',
  'Claude is vibing with the problem...',
];

function getRandomThinkingPhrase() {
  return THINKING_PHRASES[Math.floor(Math.random() * THINKING_PHRASES.length)];
}

export function GeneralConversation({
  sessionId,
  onSlashCommand,
  onViewSession,
  onNewChat,
  onNewTask,
  onSessionSelect,
  onSessionDelete,
}: GeneralConversationProps) {
  const { serverUrl } = useServer();
  const { emit, processingSessions, clearProcessingSession, on, off } = useSocket();
  const { editingContext } = useLayoutMode();
  const { prefs, updatePrefs } = useChatPreferences();

  // NOTE: useSessionActivityState moved below useSessionMessages for 102-tool-end-race-fix
  // This allows passing onToolEnd: markAllToolsComplete callback

  // ARIA live regions for screen reader announcements (W3C two-region pattern)
  const [announcement1, setAnnouncement1] = useState('');
  const [announcement2, setAnnouncement2] = useState('');
  // Use ref for activeRegion to avoid circular dependency in announce callback
  const activeRegionRef = useRef<1 | 2>(1);

  // Announce function that alternates between regions to ensure screen readers detect changes
  // Uses ref to avoid recreating callback and causing effect loops
  const announce = useCallback((message: string) => {
    if (activeRegionRef.current === 1) {
      setAnnouncement2(message);
      activeRegionRef.current = 2;
    } else {
      setAnnouncement1(message);
      activeRegionRef.current = 1;
    }
  }, []);

  const [sending, setSending] = useState(false);
  const [thinkingPhrase, setThinkingPhrase] = useState(getRandomThinkingPhrase);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);  // For scoping Ctrl+F search

  // Search state
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMatchMessageId, setActiveMatchMessageId] = useState<string | null>(null);

  // Session details state for display
  const [claudeSessionId, setClaudeSessionId] = useState<string | null>(null);
  const [sessionTotalCost, setSessionTotalCost] = useState<number>(0);
  const [agentDefinitionId, setAgentDefinitionId] = useState<string | null>(null);
  const [sessionModel, setSessionModel] = useState<AgentModel | null>(null);  // 135-assistant-model-switch
  // 143-chat-system-prompt-display: System prompt from agent definition
  const [systemPrompt, setSystemPrompt] = useState<string | null>(null);
  const [agentName, setAgentName] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<'session' | 'claude' | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // 168-right-bar-elimination: NewChatModal and task detection state
  const [newChatModalOpen, setNewChatModalOpen] = useState(false);
  const [taskInfo, setTaskInfo] = useState<TaskInfo | null>(null);

  // Context visibility feature: session type for filtering context meter visibility
  const [sessionType, setSessionType] = useState<string | null>(null);

  // Context usage state (context visibility feature)
  const [contextUsage, setContextUsage] = useState<ContextUsage | null>(null);
  const [isContextStale, setIsContextStale] = useState(false);
  const [contextBanner, setContextBanner] = useState<{ variant: BannerVariant; message: string; detail?: string } | null>(null);
  const warnedThresholds = useRef<Set<number>>(new Set());
  const prevPercentRef = useRef<number>(0);
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Activity count for brain icon badge - fetched for badge only (124-agent-memory-system)

  // Fetch session details to get claudeSessionId, totalCost, agentDefinitionId, model, and type
  useEffect(() => {
    if (!sessionId) {
      setClaudeSessionId(null);
      setSessionTotalCost(0);
      setAgentDefinitionId(null);
      setSessionModel(null);
      // 143-chat-system-prompt-display: Reset prompt state
      setSystemPrompt(null);
      setAgentName(null);
      setTaskInfo(null);
      setSessionType(null);
      return;
    }

    const fetchSessionDetails = async () => {
      // GAP-002 fix: Clear stale taskInfo before fetch to prevent wrong-session reinject
      setTaskInfo(null);

      try {
        const response = await api.get(`${serverUrl}${sessionPath(sessionId)}`);
        if (response.ok) {
          const data = await response.json() as SessionDetails;
          setClaudeSessionId(data.claudeSessionId || null);
          setSessionTotalCost(data.totalCost || 0);
          setAgentDefinitionId(data.agentDefinitionId || null);
          setSessionModel(data.model || null);  // 135-assistant-model-switch
          setSessionType(data.sessionType || null);  // Context visibility feature

          // 168-right-bar-elimination: Detect task sessions for reinject action
          if (data.sessionType === SessionType.TASK) {
            fetchTaskInfo(sessionId);
          } else {
            setTaskInfo(null);
          }
        }
      } catch (error) {
        log.debug('Failed to fetch session details', { error });
      }
    };

    const fetchTaskInfo = async (sid: string) => {
      try {
        const res = await api.get(`${serverUrl}${API_PATHS.TASKS}/by-session/${sid}`);
        if (res.ok) {
          const task = await res.json() as TaskInfo;
          setTaskInfo(task);
        } else {
          setTaskInfo(null);
        }
      } catch {
        setTaskInfo(null);
      }
    };

    fetchSessionDetails();
  }, [sessionId, serverUrl]);

  // 143-chat-system-prompt-display: Fetch AgentDefinition to get system prompt
  useEffect(() => {
    if (!agentDefinitionId) {
      setSystemPrompt(null);
      setAgentName(null);
      return;
    }

    const fetchAgentDefinition = async () => {
      try {
        const response = await api.get(`${serverUrl}/api/agent-definitions/${agentDefinitionId}`);
        if (response.ok) {
          const data = await response.json() as AgentDefinitionResponse;
          setSystemPrompt(data.resolvedSystemPrompt || null);
          setAgentName(data.name || null);
        }
      } catch (error) {
        log.debug('Failed to fetch agent definition', { error, agentDefinitionId });
      }
    };

    fetchAgentDefinition();
  }, [agentDefinitionId, serverUrl]);

  // Copy to clipboard helper
  const copyToClipboard = useCallback(async (text: string, type: 'session' | 'claude') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(type);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      log.error('Failed to copy to clipboard', { error });
    }
  }, []);

  // 135-assistant-model-switch: Handle model switching
  const handleModelSwitch = useCallback((newModel: AgentModel) => {
    if (!sessionId) return;
    log.info('Switching model', { sessionId, newModel });

    // Optimistically update local state
    setSessionModel(newModel);

    // Emit socket event to switch model (server persists and forwards to bridge)
    emit(SOCKET_EVENTS.SESSION_MODEL_SWITCH, {
      sessionId,
      model: newModel,
    });
  }, [sessionId, emit]);

  // Context visibility feature: Check if this is an assistant/agent session
  const isAssistantSession = sessionType?.startsWith('assistant:') || sessionType === 'agent';

  // Context visibility feature: Warning threshold checker
  // Uses independent if statements (not else if) so that when usage jumps
  // (e.g., 70% -> 95%), higher thresholds override lower ones
  const checkWarnings = useCallback((percent: number, prevPercent: number) => {
    let newBanner: { variant: BannerVariant; message: string } | null = null;

    if (percent >= 70 && prevPercent < 70 && !warnedThresholds.current.has(70)) {
      warnedThresholds.current.add(70);
      newBanner = { variant: 'info', message: `Context usage at ${percent}%. Consider wrapping up or starting a new session.` };
    }
    if (percent >= 80 && prevPercent < 80 && !warnedThresholds.current.has(80)) {
      warnedThresholds.current.add(80);
      newBanner = { variant: 'warning', message: `Context at ${percent}%. Auto-compaction will run soon to free space.` };
    }
    if (percent >= 90 && prevPercent < 90 && !warnedThresholds.current.has(90)) {
      warnedThresholds.current.add(90);
      newBanner = { variant: 'error', message: `Context at ${percent}%. Approaching token limit. Consider starting a new session.` };
    }

    if (newBanner) {
      setContextBanner(newBanner);
    }

    // Clear thresholds when usage drops below them (allows re-triggering)
    if (percent < 90) warnedThresholds.current.delete(90);
    if (percent < 80) warnedThresholds.current.delete(80);
    if (percent < 70) warnedThresholds.current.delete(70);
  }, []);

  // Context visibility feature: Socket event listeners
  useEffect(() => {
    if (!sessionId || !isAssistantSession) return;

    const handleContextUsage = (data: SocketEventPayloads[typeof SOCKET_EVENTS.SESSION_CONTEXT_USAGE]) => {
      if (data.sessionId !== sessionId) return;
      // Validate data
      if (!data.usage || typeof data.usage.percent !== 'number' || !isFinite(data.usage.percent) || data.usage.percent < 0 || data.usage.percent > 100) {
        log.warn('Invalid context usage data', { data });
        return;
      }
      const prev = prevPercentRef.current;
      setContextUsage(data.usage);
      prevPercentRef.current = data.usage.percent;
      checkWarnings(data.usage.percent, prev);
    };

    const handleCompacted = (data: SocketEventPayloads[typeof SOCKET_EVENTS.SESSION_COMPACTED]) => {
      if (data.sessionId !== sessionId) return;
      if (!data.beforeUsage || typeof data.beforeUsage.percent !== 'number') {
        log.warn('Invalid compaction data received', { data });
        return;
      }
      setContextBanner({
        variant: 'info',
        message: 'Context compacted',
        detail: `${data.beforeUsage.percent}% → ${data.afterUsage?.percent ?? '?'}%`,
      });
      // Auto-dismiss after 5 seconds (clear previous timer to prevent leaks)
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
      bannerTimerRef.current = setTimeout(() => setContextBanner(null), 5000);
    };

    on(SOCKET_EVENTS.SESSION_CONTEXT_USAGE, handleContextUsage);
    on(SOCKET_EVENTS.SESSION_COMPACTED, handleCompacted);

    return () => {
      off(SOCKET_EVENTS.SESSION_CONTEXT_USAGE, handleContextUsage);
      off(SOCKET_EVENTS.SESSION_COMPACTED, handleCompacted);
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    };
  }, [sessionId, isAssistantSession, on, off, checkWarnings]);

  // Context visibility feature: Stale data detection (60 seconds without update)
  useEffect(() => {
    if (!contextUsage) return;
    const timer = setTimeout(() => setIsContextStale(true), 60000);
    setIsContextStale(false); // Reset on each new event
    return () => clearTimeout(timer);
  }, [contextUsage]);

  // Context visibility feature: Reset context state on session change
  useEffect(() => {
    setContextUsage(null);
    setIsContextStale(false);
    setContextBanner(null);
    warnedThresholds.current.clear();
    prevPercentRef.current = 0;
  }, [sessionId]);

  // Reset sending state when switching sessions
  useEffect(() => {
    setSending(false);
  }, [sessionId]);

  // Use API-based message hook (no localStorage)
  const {
    timeline,
    loading,
    sendMessage,
    addAssistantMessage,
    addContextInjectedEvent,
    addThinkingBlock,
    addToolUse,
    markAllToolsComplete,
    refresh,
    isWaitingForResponse,
    lastMessageStatus,
    updateMessageStatus,
    resendLastMessage,
    // 139-timeline-pagination: Infinite scroll support
    loadMore,
    hasMoreMessages,
    loadingMoreMessages,
  } = useSessionMessages(sessionId, { serverUrl });

  // 139-timeline-pagination: Scroll container ref for detecting scroll-to-top
  const scrollContainerRef = useRef<HTMLElement>(null);

  // Activity state for displaying tool use, blocked status, human input, etc.
  // Moved after useSessionMessages so markAllToolsComplete is available (102-tool-end-race-fix)
  const {
    state: activityState,
    clearContextReset,
    clearHumanRequest,
    sendHumanInputResponse,
  } = useSessionActivityState({
    sessionId,
    onToolEnd: markAllToolsComplete, // Fixes race condition - called synchronously before activity cleared
    onThinking: useCallback((data: { content: string; timestamp: number }) => {
      addThinkingBlock({ content: data.content, timestamp: data.timestamp });
    }, [addThinkingBlock]),
  });

  // Session activity counts for brain icon badge (124-agent-memory-system)
  // Full activity data displayed in SessionDetailView in left pane
  const { total: memoryCount } = useSessionMemories(sessionId ?? undefined);
  const { total: entityCount } = useSessionCreatedEntities(sessionId ?? undefined);
  const activityCount = memoryCount + entityCount;

  // Extract messages for search (must be after useSessionMessages)
  const searchableMessages = useMemo(() =>
    timeline
      .filter((item): item is UIChatMessage & { itemType: 'message' } => item.itemType === 'message')
      .map(msg => ({ id: msg.id, content: msg.content })),
    [timeline]
  );

  // Handle search match changes - scroll to active match and track for highlighting
  const handleMatchChange = useCallback((activeMatch: SearchMatch | null, _allMatches: SearchMatch[], query: string) => {
    if (activeMatch) {
      setActiveMatchMessageId(activeMatch.messageId);
      // Scroll to the matched message
      const messageEl = messageRefs.current.get(activeMatch.messageId);
      if (messageEl) {
        messageEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } else {
      setActiveMatchMessageId(null);
    }
    // Store the search query for highlighting (comes directly from ChatSearchBar)
    setSearchQuery(query);
  }, []);

  // 140-thinking-ui-fix: Compute isSessionProcessing from authoritative processingSessions
  const isSessionProcessing = sessionId ? processingSessions.has(sessionId) : false;

  // The actual "is thinking" state:
  // - `sending` is local immediate feedback - always trust it (user just clicked send)
  // - `isWaitingForResponse` is true when MESSAGE_STATUS is 'queued' or 'processing'
  // - `isSessionProcessing` is the server-authoritative flag from processingSessions
  //
  // 156-thinking-spinner-fix: Include isSessionProcessing as a thinking trigger.
  // Previously, `sending` was cleared on the first streaming chunk (setSending(false)),
  // and `isWaitingForResponse` was ALWAYS false due to a messageId mismatch:
  // sendMessage() uses a temp ID (temp-XXX) but server creates a real ID (msg_XXX),
  // so MESSAGE_STATUS updates never matched lastMessageStatus.messageId.
  // This left isThinking=false during the entire processing window.
  //
  // isSessionProcessing is set when SESSION_MESSAGE arrives (server confirmed processing)
  // and cleared when MESSAGE_STATUS:completed arrives. This is the most reliable signal.
  //
  // 195-ui-usability-pass: Don't show thinking for complete/cancelled tasks
  // Sometimes processingSessions isn't cleared properly for finished tasks
  const isTaskFinished = taskInfo && REINJECT_EXCLUDED_STATES.includes(taskInfo.state);
  const isThinking = !isTaskFinished && (sending || isWaitingForResponse || isSessionProcessing);

  // 195-ui-usability-pass: Clear stale processingSessions when task is finished
  // This is a defensive measure - if MESSAGE_STATUS:completed wasn't received, clear it here
  useEffect(() => {
    if (isTaskFinished && isSessionProcessing && sessionId) {
      clearProcessingSession(sessionId);
    }
  }, [isTaskFinished, isSessionProcessing, sessionId, clearProcessingSession]);

  // Pick a new random phrase when we start thinking
  useEffect(() => {
    if (isThinking) {
      setThinkingPhrase(getRandomThinkingPhrase());
    }
  }, [isThinking]);

  // Track the last announced message ID to avoid duplicate announcements
  const lastAnnouncedMessageIdRef = useRef<string | null>(null);

  // ARIA announcement: Announce "Claude is thinking" when thinking state starts
  useEffect(() => {
    if (isThinking && sessionId) {
      announce(thinkingPhrase);
    }
    // Only trigger on isThinking changes, not thinkingPhrase (phrase changes are visual only)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isThinking, sessionId, announce]);

  // Track previous session ID to detect session changes
  const prevSessionIdRef = useRef<string | null>(null);

  // Clear announcements when session changes (must run before announcement effects)
  useEffect(() => {
    // Only clear if sessionId actually changed (not on initial mount)
    if (prevSessionIdRef.current !== null && prevSessionIdRef.current !== sessionId) {
      setAnnouncement1('');
      setAnnouncement2('');
      activeRegionRef.current = 1;
      lastAnnouncedMessageIdRef.current = null;
    }
    prevSessionIdRef.current = sessionId;
  }, [sessionId]);

  // ARIA announcement: Announce new assistant messages
  useEffect(() => {
    // Skip if no session or empty timeline
    if (!sessionId || !timeline || timeline.length === 0) return;

    const lastItem = timeline[timeline.length - 1];

    // Type-safe checks: must be a message with assistant role and string content
    if (!lastItem || lastItem.itemType !== 'message') return;
    if (lastItem.role !== 'assistant') return;
    if (!lastItem.content || typeof lastItem.content !== 'string') return;

    // Skip if we already announced this message
    if (lastAnnouncedMessageIdRef.current === lastItem.id) return;

    // Truncate long messages for screen reader comfort (max ~200 chars)
    const preview = lastItem.content.length > 200
      ? lastItem.content.slice(0, 197) + '...'
      : lastItem.content;

    announce(`Claude says: ${preview}`);
    lastAnnouncedMessageIdRef.current = lastItem.id;
  }, [sessionId, timeline, announce]);

  // 141-infinite-scroll-fix: Track whether we're loading older messages (prepending)
  // When loadMore is called, we set this flag. The next timeline update should NOT scroll.
  const skipScrollRef = useRef(false);

  // Wrap loadMore to set the skip flag
  const handleLoadMore = useCallback(() => {
    skipScrollRef.current = true;
    loadMore();
  }, [loadMore]);

  // 139-timeline-pagination: Load more messages when user scrolls near top
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      // Trigger loadMore when scrolled within 100px of the top
      if (container.scrollTop < 100 && hasMoreMessages && !loadingMoreMessages) {
        log.info('Loading more messages (scroll near top)', {
          scrollTop: container.scrollTop,
          hasMoreMessages,
        });
        handleLoadMore();
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [hasMoreMessages, loadingMoreMessages, handleLoadMore]);

  // NOTE: markAllToolsComplete is now called via onToolEnd callback in useSessionActivityState
  // This fixes the race condition where useEffect missed tool_end events (102-tool-end-race-fix)

  // Socket event handlers for real-time responses (user messages from Option C, assistant responses)
  // Uses useSessionResponseEvents hook which handles sessionId filtering internally
  const handleResponse = useCallback((data: SessionResponseData) => {
    // Convert the response message to UIChatMessage format
    // CRITICAL FIX: Include streaming field for proper message updates
    const message: UIChatMessage = {
      id: data.message.id,
      sessionId: data.sessionId,
      role: data.message.role as 'user' | 'assistant' | 'system',
      content: data.message.content,
      streaming: data.message.streaming,  // Required for proper message lifecycle
      createdAt: data.message.createdAt,
    };
    addAssistantMessage(message);

    // Only clear sending state for non-user messages (Option C: user messages come back too)
    // For user messages, keep sending=true until assistant responds or status updates
    if (data.message.role !== 'user') {
      setSending(false);
    }

    // 136-timeout-spinner-issues: Mark all tools with appropriate status when we receive
    // a system error or when streaming completes. This prevents tools from spinning
    // indefinitely after timeout errors like CLITimeoutError.
    if (data.message.role === 'system') {
      // System messages indicate errors - mark tools as errored so they show error state
      markAllToolsComplete('error');
    } else if (data.message.streaming === false) {
      // Normal completion - mark as complete
      markAllToolsComplete();
    }
  }, [addAssistantMessage, markAllToolsComplete]);

  const handleMessageStatus = useCallback((data: MessageStatusData) => {
    updateMessageStatus(data.messageId, data.status);
    if (data.status === MessageStatus.COMPLETED || data.status === MessageStatus.FAILED) {
      setSending(false);
    }
  }, [updateMessageStatus]);

  const handleSessionError = useCallback((data: SessionErrorData) => {
    log.error('Session error', { error: data.error });
    setSending(false);
    // 136-timeout-spinner-issues: Mark all tools as errored on session error to stop spinners
    markAllToolsComplete('error');

    // 152-session-resume-fix: Show error message to user as a system message
    // Previously errors were silently swallowed and only logged
    if (data.error) {
      addAssistantMessage({
        id: `error-${Date.now()}`,
        sessionId: data.sessionId,
        role: 'system',
        content: `⚠️ ${data.error}`,
        createdAt: Date.now(),
      });
    }

    refresh();
  }, [refresh, markAllToolsComplete, addAssistantMessage]);

  const handleContextInjected = useCallback((data: SessionContextInjectedData) => {
    log.info('Context injected', {
      entityType: data.entityType,
      entityId: data.entityId,
      contextType: data.contextType,
    });
    addContextInjectedEvent({
      entityType: data.entityType,
      entityId: data.entityId,
      contextType: data.contextType,
      contextPreview: data.contextPreview,
      timestamp: data.timestamp,  // 137-context-timing: Pass server timestamp for correct ordering
    });
  }, [addContextInjectedEvent]);

  // Use centralized socket event hook - handles sessionId filtering and cleanup
  useSessionResponseEvents({
    sessionId,
    onResponse: handleResponse,
    onMessageStatus: handleMessageStatus,
    onError: handleSessionError,
    onContextInjected: handleContextInjected,
  });

  // Handle tool use events for inline display (Task 084, 131-tool-embedding)
  // Now passes messageId to embed tools in their parent message
  const handleToolUse = useCallback((data: SessionToolUseData) => {
    log.debug('Tool use event', {
      toolName: data.toolName,
      toolUseId: data.toolUseId,
      parentToolUseId: data.parentToolUseId,
      messageId: data.messageId,
    });
    addToolUse({
      toolUseId: data.toolUseId,
      toolName: data.toolName,
      input: data.input,
      output: data.output,
      error: data.error,
      parentToolUseId: data.parentToolUseId,
      elapsedMs: data.elapsedMs,
      timestamp: data.timestamp,
      messageId: data.messageId,  // Links tool to parent message (131-tool-embedding)
    });
  }, [addToolUse]);

  // Use tool use events hook for inline tool display (Task 084)
  useSessionToolUseEvents({
    sessionId,
    onToolUse: handleToolUse,
  });


  // Auto-scroll to bottom for new messages, but skip when loading older messages
  useEffect(() => {
    // Skip scroll if we just loaded older messages
    if (skipScrollRef.current) {
      skipScrollRef.current = false;
      return;
    }

    // Skip if timeline is empty
    if (timeline.length === 0) {
      return;
    }

    const timer = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 100); // Small delay lets message entrance animation start before scroll
    return () => clearTimeout(timer);
  }, [timeline]);

  const handleSend = async (content: string) => {
    if (!sessionId) return;

    // 136-timeout-spinner-issues: Complete any running tools when user sends a new message
    // This ensures previous turn's tools are marked complete before starting new turn
    markAllToolsComplete();

    setSending(true);

    // Option C: Socket persists AND forwards - single call handles everything
    log.info('Sending message (Option C)', {
      sessionId,
      hasEditingContext: !!editingContext,
      editingContext: editingContext ? {
        mode: editingContext.mode,
        entityType: editingContext.entityType,
        entityId: editingContext.entityId,
        formContextInjected: editingContext.formContextInjected,
      } : null,
    });

    const message = await sendMessage(content, {
      emit,
      type: SessionType.ASSISTANT_GENERAL,
      editingContext: editingContext ?? undefined,
    });

    if (!message) {
      setSending(false);
    }
    // Note: setSending(false) is called by handleResponse or handleMessageStatus when response arrives
  };

  // Handle resend of last failed/unprocessed message
  const handleResend = async () => {
    if (!lastMessageStatus.messageId || !sessionId || !lastMessageStatus.content) return;

    setSending(true);
    await resendLastMessage();

    // Re-emit to socket with the existing message
    emit(SOCKET_EVENTS.SESSION_SEND, {
      sessionId,
      messageId: lastMessageStatus.messageId,
      content: lastMessageStatus.content,
      type: SessionType.ASSISTANT_GENERAL,
      editingContext: editingContext ?? undefined,
    });
  };

  // 168-right-bar-elimination: Handle stop generation
  const handleStop = useCallback(async () => {
    if (!sessionId) return;

    // For task sessions, cancel the task
    if (taskInfo) {
      if (REINJECT_EXCLUDED_STATES.includes(taskInfo.state)) return;

      try {
        await api.post(`${serverUrl}${API_PATHS.TASKS}/${taskInfo.id}/cancel`, {
          reason: 'Stopped by user',
        });
        log.info('Task cancelled via stop button', { taskId: taskInfo.id });
      } catch (err) {
        log.error('Failed to cancel task', { error: err });
      }
      return;
    }

    // For regular sessions, emit stop event
    log.info('Stopping session generation', { sessionId });
    emit(SOCKET_EVENTS.SESSION_STOP, { sessionId });
    setSending(false);
  }, [sessionId, taskInfo, serverUrl, emit]);

  // 168-right-bar-elimination: Handle reinject prompt for task sessions
  const handleReinject = useCallback(async () => {
    if (!taskInfo || !sessionId) return;

    try {
      const res = await api.post(`${serverUrl}${API_PATHS.TASKS}/${taskInfo.id}/reinject-prompt`);
      if (res.ok) {
        log.info('Reinjected prompt for task', { taskId: taskInfo.id });
        refresh();
      }
    } catch (err) {
      log.error('Failed to reinject prompt', { error: err });
    }
  }, [taskInfo, sessionId, serverUrl, refresh]);

  // 168-right-bar-elimination: Handle new chat via modal
  const handleNewChatFromModal = useCallback((agentDefinitionId?: string, workspaceId?: string) => {
    onNewChat?.(agentDefinitionId, workspaceId);
  }, [onNewChat]);

  // 168-right-bar-elimination: Build context-sensitive actions for compose menu
  const contextActions = useMemo<InputContextAction[]>(() => {
    const actions: InputContextAction[] = [];

    // Reinject for task sessions
    if (taskInfo) {
      if (!REINJECT_EXCLUDED_STATES.includes(taskInfo.state)) {
        actions.push({
          label: 'REINJECT_PROMPT',
          icon: <Syringe className="w-3.5 h-3.5" />,
          onClick: handleReinject,
        });
      }
    }

    return actions;
  }, [taskInfo, handleReinject]);

  // Empty state when no session - but still show input for slash commands
  if (!sessionId) {
    return (
      <div className="h-full w-full flex flex-col bg-background">
        {/* ARIA live regions for screen reader announcements */}
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="sr-only"
        >
          {announcement1}
        </div>
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="sr-only"
        >
          {announcement2}
        </div>
        {/* 168-right-bar-elimination: Session dropdown even without active session */}
        {onSessionSelect && (
          <SessionDropdown
            currentSessionId={null}
            onSessionSelect={onSessionSelect}
            onSessionDelete={onSessionDelete}
            onNewChat={() => setNewChatModalOpen(true)}
            onNewTask={onNewTask}
          />
        )}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center select-none">
            <div className="font-mono text-muted-foreground/15 text-sm mb-6 tracking-widest">&gt;_</div>
            <h3 className="text-2xl font-black text-foreground/15 uppercase tracking-wider">No Active Session</h3>
            <p className="font-mono text-xs text-muted-foreground/30 mt-3">
              Select a chat or use <span className="text-primary/40">/</span> for commands
            </p>
          </div>
        </div>
        {/* Input bar for slash commands even without a session */}
        <MessageInputBar
          onSend={() => { }}
          onSlashCommand={onSlashCommand}
          onNewChat={() => setNewChatModalOpen(true)}
          onNewTask={onNewTask}
          placeholder="Type /help for commands, or select a chat to send messages"
        />
        {/* 168-right-bar-elimination: New chat modal */}
        <NewChatModal
          open={newChatModalOpen}
          onClose={() => setNewChatModalOpen(false)}
          onSelect={handleNewChatFromModal}
        />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="h-full w-full flex flex-col bg-background text-foreground">
      {/* ARIA live regions for screen reader announcements */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {announcement1}
      </div>
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {announcement2}
      </div>
      {/* 168-right-bar-elimination: Session dropdown replaces right sidebar */}
      {onSessionSelect && (
        <SessionDropdown
          currentSessionId={sessionId}
          onSessionSelect={onSessionSelect}
          onSessionDelete={onSessionDelete}
          onNewChat={() => setNewChatModalOpen(true)}
          onNewTask={onNewTask}
        />
      )}

      <ChatSettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        prefs={prefs}
        onUpdate={updatePrefs}
        model={sessionModel}
        onModelSwitch={handleModelSwitch}
      />

      {/* Search bar */}
      <ChatSearchBar
        messages={searchableMessages}
        isOpen={searchOpen}
        onOpenChange={setSearchOpen}
        onMatchChange={handleMatchChange}
        onClose={() => setSearchQuery('')}
        containerRef={containerRef}
      />

      {/* Human input modal - blocks everything else */}
      <HumanInputModal
        request={activityState.humanRequest}
        onSubmit={sendHumanInputResponse}
        onCancel={clearHumanRequest}
      />

      {/* Messages area with timeline */}
      <main ref={scrollContainerRef} className="flex-1 min-h-0 overflow-y-auto">
        {/* 139-timeline-pagination: Loading more indicator */}
        {loadingMoreMessages && (
          <div className="flex justify-center py-2 text-muted-foreground text-xs font-mono">
            Loading older messages...
          </div>
        )}
        {hasMoreMessages && !loadingMoreMessages && timeline.length > 0 && (
          <div className="flex justify-center py-2">
            <button
              onClick={handleLoadMore}
              className="text-muted-foreground hover:text-foreground text-xs font-mono px-2 py-1 border border-border hover:border-foreground/30 transition-colors"
            >
              Load older messages
            </button>
          </div>
        )}
        {timeline.length === 0 && !loading ? (
          /* Empty state - terminal ready prompt */
          <div className="h-full flex items-center justify-center">
            <div className="text-center select-none group">
              <div className="font-mono text-6xl font-black text-foreground/8 tracking-tight mb-2 group-hover:text-foreground/12 transition-colors duration-700">
                &gt;_
              </div>
              <p className="font-mono text-xs text-muted-foreground/25 uppercase tracking-widest group-hover:text-muted-foreground/40 transition-colors duration-700">
                Ready for input
              </p>
            </div>
          </div>
        ) : (
          /* Timeline with memoized MessageList */
          <MessageList
            timeline={timeline}
            messageRefs={messageRefs}
            searchOpen={searchOpen}
            searchQuery={searchQuery}
            activeMatchMessageId={activeMatchMessageId}
            isThinking={false}  // Thinking state now shown in ActivityStatusBar
            thinkingPhrase=""
            needsResend={lastMessageStatus.needsResend}
            onResend={handleResend}
            messagesEndRef={messagesEndRef}
            colors={prefs}
            isSessionProcessing={isSessionProcessing}
            // 143-chat-system-prompt-display: Show system prompt at top of chat
            systemPrompt={systemPrompt}
            agentName={agentName}
          />
        )}
      </main>

      {/* Context visibility feature: Usage meter and warning banner */}
      {isAssistantSession && <ContextUsageMeter usage={contextUsage} isStale={isContextStale} className="px-3 py-1" />}
      {contextBanner && <StatusBanner variant={contextBanner.variant} message={contextBanner.message} detail={contextBanner.detail} onDismiss={() => setContextBanner(null)} />}

      {/* Activity status bar - thinking, tool use, progress (above input) */}
      <ActivityStatusBar
        isThinking={isThinking}
        thinkingPhrase={thinkingPhrase}
        activity={activityState.activity}
        progress={activityState.progress}
        blocked={activityState.blocked}
        halted={activityState.halted}
        isSessionProcessing={isSessionProcessing}
      />

      {/* Input bar - 168-right-bar-elimination: compose menu + stop button */}
      <MessageInputBar
        onSend={handleSend}
        onSlashCommand={onSlashCommand}
        onNewChat={() => setNewChatModalOpen(true)}
        onNewTask={onNewTask}
        contextActions={contextActions}
        isProcessing={isThinking}
        onStop={handleStop}
      />

      {/* Session status footer - IDs, cost, settings (model moved to ChatSettingsDialog) */}
      <ChatStatusHeader
        sessionId={sessionId}
        claudeSessionId={claudeSessionId}
        editingContext={editingContext ? {
          entityType: editingContext.entityType,
          entityId: editingContext.entityId,
        } : null}
        totalCost={Math.max(sessionTotalCost, activityState.cost)}
        loading={loading}
        contextReset={activityState.contextReset}
        onCopySessionId={() => copyToClipboard(sessionId, 'session')}
        onCopyClaudeId={() => claudeSessionId && copyToClipboard(claudeSessionId, 'claude')}
        copiedId={copiedId}
        onOpenSettings={() => setSettingsOpen(true)}
        onDismissContextReset={clearContextReset}
        onViewSession={onViewSession ? () => onViewSession(sessionId) : undefined}
        activityCount={activityCount}
        taskInfo={taskInfo}
      />

      {/* 168-right-bar-elimination: New chat modal */}
      <NewChatModal
        open={newChatModalOpen}
        onClose={() => setNewChatModalOpen(false)}
        onSelect={handleNewChatFromModal}
      />
    </div>
  );
}
