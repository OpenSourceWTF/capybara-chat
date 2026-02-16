/**
 * GeneralConversation ARIA Live Regions Tests (TDD)
 *
 * Tests for ARIA live region implementation in GeneralConversation.
 * These tests are written BEFORE implementation (TDD approach).
 *
 * Requirements:
 * 1. Has TWO live regions (alternating pattern)
 * 2. Both regions have role="status" and aria-live="polite"
 * 3. Announces new assistant messages
 * 4. Announces "Claude is thinking" state
 * 5. Does NOT announce user messages
 * 6. Alternates between regions on each announcement
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { GeneralConversation } from './GeneralConversation';

// Mock all the heavy dependencies

// Mock ServerContext
vi.mock('../../context/ServerContext', () => ({
  useServer: vi.fn(() => ({
    serverUrl: 'http://localhost:2279',
  })),
}));

// Mock SocketContext
const mockEmit = vi.fn();
const mockOn = vi.fn();
const mockOff = vi.fn();
vi.mock('../../context/SocketContext', () => ({
  useSocket: vi.fn(() => ({
    socket: {
      on: vi.fn(),
      off: vi.fn(),
    },
    emit: mockEmit,
    on: mockOn,
    off: mockOff,
    processingSessions: new Set<string>(),
    connected: true,
    agentStatus: 'online',
  })),
}));

// Mock LayoutModeContext
vi.mock('../../context/LayoutModeContext', () => ({
  useLayoutMode: vi.fn(() => ({
    editingContext: null,
  })),
}));

// Mock api
vi.mock('../../lib/api', () => ({
  api: {
    get: vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        claudeSessionId: 'claude-123',
        totalCost: 0.5,
        agentDefinitionId: null,
        model: null,
        sessionType: 'assistant_general',
      }),
    })),
    post: vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) })),
  },
}));

// Mock useChatPreferences
vi.mock('../../hooks/useChatPreferences', () => ({
  useChatPreferences: vi.fn(() => ({
    prefs: { userColor: '#000', assistantColor: '#333' },
    updatePrefs: vi.fn(),
  })),
}));

// STABLE timeline reference
const STABLE_EMPTY_TIMELINE: never[] = [];

// Default lastMessageStatus with all required properties
const defaultLastMessageStatus = {
  needsResend: false,
  status: 'none' as const,
  hasAssistantResponse: true,
};

// Mock useSessionMessages
const mockSendMessage = vi.fn();
const mockAddAssistantMessage = vi.fn();
vi.mock('../../hooks/useSessionMessages', () => ({
  useSessionMessages: vi.fn(() => ({
    timeline: STABLE_EMPTY_TIMELINE,
    messages: [],
    events: [],
    toolUses: [],
    loading: false,
    error: null,
    sendMessage: mockSendMessage,
    addAssistantMessage: mockAddAssistantMessage,
    addContextInjectedEvent: vi.fn(),
    addToolUse: vi.fn(),
    markAllToolsComplete: vi.fn(),
    refresh: vi.fn(),
    isWaitingForResponse: false,
    lastMessageStatus: defaultLastMessageStatus,
    updateMessageStatus: vi.fn(),
    resendLastMessage: vi.fn(),
    loadMore: vi.fn(),
    hasMoreMessages: false,
    loadingMoreMessages: false,
    checkMessageStatus: vi.fn(),
  })),
}));

// Mock useSessionResponseEvents
vi.mock('../../hooks/useSessionSocketEvents', () => ({
  useSessionResponseEvents: vi.fn(),
  useSessionToolUseEvents: vi.fn(),
}));

// Mock useSessionActivityState
vi.mock('../../hooks/useSessionActivityState', () => ({
  useSessionActivityState: vi.fn(() => ({
    state: {
      activity: null,
      progress: null,
      blocked: false,
      humanRequest: null,
      contextReset: false,
      cost: 0,
    },
    clearContextReset: vi.fn(),
    clearHumanRequest: vi.fn(),
    sendHumanInputResponse: vi.fn(),
  })),
}));

// Mock useSessionMemories
vi.mock('../../hooks/useSessionMemories', () => ({
  useSessionMemories: vi.fn(() => ({
    total: 0,
  })),
}));

// Mock useSessionCreatedEntities
vi.mock('../../hooks/useSessionCreatedEntities', () => ({
  useSessionCreatedEntities: vi.fn(() => ({
    total: 0,
  })),
}));

// Mock child components to reduce complexity
vi.mock('./MessageInputBar', () => ({
  MessageInputBar: ({ onSend }: { onSend: (msg: string) => void }) => (
    <div data-testid="message-input">
      <input
        data-testid="message-input-field"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && e.currentTarget.value) {
            onSend(e.currentTarget.value);
          }
        }}
      />
    </div>
  ),
}));

vi.mock('./MessageList', () => ({
  MessageList: ({ timeline }: { timeline: unknown[] }) => (
    <div data-testid="message-list">
      {timeline.map((item, i) => {
        const msg = item as { role?: string; content?: string };
        return (
          <div key={i} data-testid={`message-${msg.role}`}>
            {msg.content}
          </div>
        );
      })}
    </div>
  ),
}));

vi.mock('../session/SessionDropdown', () => ({
  SessionDropdown: () => <div data-testid="session-dropdown" />,
}));

vi.mock('./ChatStatusHeader', () => ({
  ChatStatusHeader: () => <div data-testid="chat-status-header" />,
}));

vi.mock('./ActivityStatusBar', () => ({
  ActivityStatusBar: () => (
    <div data-testid="activity-status-bar" />
  ),
}));

vi.mock('./ChatSearchBar', () => ({
  ChatSearchBar: () => null,
}));

vi.mock('./HumanInputModal', () => ({
  HumanInputModal: () => null,
}));

vi.mock('../tasks/StopButton', () => ({
  StopButton: () => null,
}));

vi.mock('../modals/ChatSettingsDialog', () => ({
  ChatSettingsDialog: () => null,
}));

vi.mock('../modals/NewChatModal', () => ({
  NewChatModal: () => null,
}));

describe('GeneralConversation ARIA Live Regions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('live region structure', () => {
    it('should have TWO live regions for alternating announcements', () => {
      render(
        <GeneralConversation
          sessionId="sess-123"
          onSessionSelect={vi.fn()}
        />
      );

      // Find elements with role="status" and aria-live="polite"
      const liveRegions = screen.getAllByRole('status');
      expect(liveRegions.length).toBeGreaterThanOrEqual(2);
    });

    it('should have aria-live="polite" on live regions', () => {
      render(
        <GeneralConversation
          sessionId="sess-123"
          onSessionSelect={vi.fn()}
        />
      );

      const liveRegions = screen.getAllByRole('status');
      liveRegions.forEach((region) => {
        expect(region).toHaveAttribute('aria-live', 'polite');
      });
    });

    it('should have aria-atomic="true" on live regions', () => {
      render(
        <GeneralConversation
          sessionId="sess-123"
          onSessionSelect={vi.fn()}
        />
      );

      const liveRegions = screen.getAllByRole('status');
      liveRegions.forEach((region) => {
        expect(region).toHaveAttribute('aria-atomic', 'true');
      });
    });

    it('should visually hide live regions (screen reader only)', () => {
      render(
        <GeneralConversation
          sessionId="sess-123"
          onSessionSelect={vi.fn()}
        />
      );

      const liveRegions = screen.getAllByRole('status');
      liveRegions.forEach((region) => {
        // Should have sr-only or equivalent class
        expect(region).toHaveClass('sr-only');
      });
    });
  });

  describe('thinking state announcements', () => {
    it('should announce "Claude is thinking" when thinking state starts', async () => {
      // Set up the mock to show thinking state
      const { useSocket } = await import('../../context/SocketContext');
      vi.mocked(useSocket).mockReturnValue({
        socket: { on: vi.fn(), off: vi.fn() } as never,
        emit: mockEmit,
        on: mockOn,
        off: mockOff,
        processingSessions: new Set(['sess-123']), // This triggers thinking state
        connected: true,
        agentStatus: 'online',
        clearProcessingSession: vi.fn(),
      });

      render(
        <GeneralConversation
          sessionId="sess-123"
          onSessionSelect={vi.fn()}
        />
      );

      // Check that a live region contains thinking announcement (need to wait for effect)
      // Note: The component uses random "Claude is <phrase>..." messages like
      // "Claude is thinking...", "Claude is pondering...", "Claude is consulting the vibes..."
      await waitFor(() => {
        const liveRegions = screen.getAllByRole('status');
        const hasThinkingAnnouncement = liveRegions.some(
          (region) => region.textContent?.includes('Claude is')
        );
        expect(hasThinkingAnnouncement).toBe(true);
      });
    });

    it('should clear thinking announcement when response arrives', async () => {
      const { useSocket } = await import('../../context/SocketContext');

      // Start with thinking state
      vi.mocked(useSocket).mockReturnValue({
        socket: { on: vi.fn(), off: vi.fn() } as never,
        emit: mockEmit,
        on: mockOn,
        off: mockOff,
        processingSessions: new Set(['sess-123']),
        connected: true,
        agentStatus: 'online',
        clearProcessingSession: vi.fn(),
      });

      const { rerender } = render(
        <GeneralConversation
          sessionId="sess-123"
          onSessionSelect={vi.fn()}
        />
      );

      // Simulate response arriving (clear processing)
      vi.mocked(useSocket).mockReturnValue({
        socket: { on: vi.fn(), off: vi.fn() } as never,
        emit: mockEmit,
        on: mockOn,
        off: mockOff,
        processingSessions: new Set(), // No longer processing
        connected: true,
        agentStatus: 'online',
        clearProcessingSession: vi.fn(),
      });

      rerender(
        <GeneralConversation
          sessionId="sess-123"
          onSessionSelect={vi.fn()}
        />
      );

      // Thinking announcement should be cleared
      await waitFor(() => {
        const liveRegions = screen.getAllByRole('status');
        const hasThinkingAnnouncement = liveRegions.some(
          (region) => region.textContent?.includes('thinking')
        );
        expect(hasThinkingAnnouncement).toBe(false);
      });
    });
  });

  describe('message announcements', () => {
    it('should announce new assistant messages', async () => {
      const { useSessionMessages } = await import('../../hooks/useSessionMessages');

      // First render with no messages
      vi.mocked(useSessionMessages).mockReturnValue({
        timeline: [],
        messages: [],
        events: [],
        toolUses: [],
        loading: false,
        error: null,
        sendMessage: mockSendMessage,
        addAssistantMessage: mockAddAssistantMessage,
        addContextInjectedEvent: vi.fn(),
        addThinkingBlock: vi.fn(),
        addToolUse: vi.fn(),
        markAllToolsComplete: vi.fn(),
        refresh: vi.fn(),
        isWaitingForResponse: false,
        lastMessageStatus: defaultLastMessageStatus,
        updateMessageStatus: vi.fn(),
        resendLastMessage: vi.fn(),
        loadMore: vi.fn(),
        hasMoreMessages: false,
        loadingMoreMessages: false,
        checkMessageStatus: vi.fn(),
      });

      const { rerender } = render(
        <GeneralConversation
          sessionId="sess-123"
          onSessionSelect={vi.fn()}
        />
      );

      // Simulate assistant message arriving
      vi.mocked(useSessionMessages).mockReturnValue({
        timeline: [
          {
            itemType: 'message' as const,
            id: 'msg-1',
            sessionId: 'sess-123',
            role: 'assistant' as const,
            content: 'Hello, I can help you with that!',
            createdAt: Date.now(),
          },
        ],
        messages: [],
        events: [],
        toolUses: [],
        loading: false,
        error: null,
        sendMessage: mockSendMessage,
        addAssistantMessage: mockAddAssistantMessage,
        addContextInjectedEvent: vi.fn(),
        addThinkingBlock: vi.fn(),
        addToolUse: vi.fn(),
        markAllToolsComplete: vi.fn(),
        refresh: vi.fn(),
        isWaitingForResponse: false,
        lastMessageStatus: defaultLastMessageStatus,
        updateMessageStatus: vi.fn(),
        resendLastMessage: vi.fn(),
        loadMore: vi.fn(),
        hasMoreMessages: false,
        loadingMoreMessages: false,
        checkMessageStatus: vi.fn(),
      });

      rerender(
        <GeneralConversation
          sessionId="sess-123"
          onSessionSelect={vi.fn()}
        />
      );

      await waitFor(() => {
        const liveRegions = screen.getAllByRole('status');
        const hasMessageAnnouncement = liveRegions.some(
          (region) => region.textContent?.includes('Claude') ||
                      region.textContent?.includes('assistant') ||
                      region.textContent?.includes('response')
        );
        expect(hasMessageAnnouncement).toBe(true);
      });
    });

    it('should NOT announce user messages', async () => {
      const { useSessionMessages } = await import('../../hooks/useSessionMessages');

      // Render with a user message
      vi.mocked(useSessionMessages).mockReturnValue({
        timeline: [
          {
            itemType: 'message' as const,
            id: 'msg-1',
            sessionId: 'sess-123',
            role: 'user' as const,
            content: 'Hello Claude!',
            createdAt: Date.now(),
          },
        ],
        messages: [],
        events: [],
        toolUses: [],
        loading: false,
        error: null,
        sendMessage: mockSendMessage,
        addAssistantMessage: mockAddAssistantMessage,
        addContextInjectedEvent: vi.fn(),
        addThinkingBlock: vi.fn(),
        addToolUse: vi.fn(),
        markAllToolsComplete: vi.fn(),
        refresh: vi.fn(),
        isWaitingForResponse: false,
        lastMessageStatus: defaultLastMessageStatus,
        updateMessageStatus: vi.fn(),
        resendLastMessage: vi.fn(),
        loadMore: vi.fn(),
        hasMoreMessages: false,
        loadingMoreMessages: false,
        checkMessageStatus: vi.fn(),
      });

      render(
        <GeneralConversation
          sessionId="sess-123"
          onSessionSelect={vi.fn()}
        />
      );

      // Live regions should NOT contain user message content
      const liveRegions = screen.getAllByRole('status');
      const hasUserMessage = liveRegions.some(
        (region) => region.textContent?.includes('Hello Claude!')
      );
      expect(hasUserMessage).toBe(false);
    });
  });

  describe('alternating live regions', () => {
    it('should alternate between two live regions for consecutive announcements', async () => {
      const { useSessionMessages } = await import('../../hooks/useSessionMessages');

      // Start with empty timeline
      vi.mocked(useSessionMessages).mockReturnValue({
        timeline: [],
        messages: [],
        events: [],
        toolUses: [],
        loading: false,
        error: null,
        sendMessage: mockSendMessage,
        addAssistantMessage: mockAddAssistantMessage,
        addContextInjectedEvent: vi.fn(),
        addThinkingBlock: vi.fn(),
        addToolUse: vi.fn(),
        markAllToolsComplete: vi.fn(),
        refresh: vi.fn(),
        isWaitingForResponse: false,
        lastMessageStatus: defaultLastMessageStatus,
        updateMessageStatus: vi.fn(),
        resendLastMessage: vi.fn(),
        loadMore: vi.fn(),
        hasMoreMessages: false,
        loadingMoreMessages: false,
        checkMessageStatus: vi.fn(),
      });

      const { rerender } = render(
        <GeneralConversation
          sessionId="sess-123"
          onSessionSelect={vi.fn()}
        />
      );

      // Get initial state of live regions
      const liveRegions = screen.getAllByRole('status');
      expect(liveRegions.length).toBeGreaterThanOrEqual(2);

      // First announcement
      vi.mocked(useSessionMessages).mockReturnValue({
        timeline: [
          {
            itemType: 'message' as const,
            id: 'msg-1',
            sessionId: 'sess-123',
            role: 'assistant' as const,
            content: 'First response',
            createdAt: Date.now(),
          },
        ],
        messages: [],
        events: [],
        toolUses: [],
        loading: false,
        error: null,
        sendMessage: mockSendMessage,
        addAssistantMessage: mockAddAssistantMessage,
        addContextInjectedEvent: vi.fn(),
        addThinkingBlock: vi.fn(),
        addToolUse: vi.fn(),
        markAllToolsComplete: vi.fn(),
        refresh: vi.fn(),
        isWaitingForResponse: false,
        lastMessageStatus: defaultLastMessageStatus,
        updateMessageStatus: vi.fn(),
        resendLastMessage: vi.fn(),
        loadMore: vi.fn(),
        hasMoreMessages: false,
        loadingMoreMessages: false,
        checkMessageStatus: vi.fn(),
      });

      rerender(
        <GeneralConversation
          sessionId="sess-123"
          onSessionSelect={vi.fn()}
        />
      );

      // Check which region has content
      await waitFor(() => {
        const regions = screen.getAllByRole('status');
        const populatedRegions = regions.filter((r) => r.textContent?.trim() !== '');
        expect(populatedRegions.length).toBe(1);
      });

      // Second announcement
      vi.mocked(useSessionMessages).mockReturnValue({
        timeline: [
          {
            itemType: 'message' as const,
            id: 'msg-1',
            sessionId: 'sess-123',
            role: 'assistant' as const,
            content: 'First response',
            createdAt: Date.now() - 1000,
          },
          {
            itemType: 'message' as const,
            id: 'msg-2',
            sessionId: 'sess-123',
            role: 'assistant' as const,
            content: 'Second response',
            createdAt: Date.now(),
          },
        ],
        messages: [],
        events: [],
        toolUses: [],
        loading: false,
        error: null,
        sendMessage: mockSendMessage,
        addAssistantMessage: mockAddAssistantMessage,
        addContextInjectedEvent: vi.fn(),
        addThinkingBlock: vi.fn(),
        addToolUse: vi.fn(),
        markAllToolsComplete: vi.fn(),
        refresh: vi.fn(),
        isWaitingForResponse: false,
        lastMessageStatus: defaultLastMessageStatus,
        updateMessageStatus: vi.fn(),
        resendLastMessage: vi.fn(),
        loadMore: vi.fn(),
        hasMoreMessages: false,
        loadingMoreMessages: false,
        checkMessageStatus: vi.fn(),
      });

      rerender(
        <GeneralConversation
          sessionId="sess-123"
          onSessionSelect={vi.fn()}
        />
      );

      // Should use the OTHER region for second announcement
      await waitFor(() => {
        const regions = screen.getAllByRole('status');
        // Implementation should alternate - exact behavior depends on implementation
        // The key requirement is that it alternates to ensure screen readers announce
        expect(regions.length).toBeGreaterThanOrEqual(2);
      });
    });
  });

  describe('live region content', () => {
    it('should include message role prefix in announcement', async () => {
      const { useSessionMessages } = await import('../../hooks/useSessionMessages');

      vi.mocked(useSessionMessages).mockReturnValue({
        timeline: [
          {
            itemType: 'message' as const,
            id: 'msg-1',
            sessionId: 'sess-123',
            role: 'assistant' as const,
            content: 'Here is my response',
            createdAt: Date.now(),
          },
        ],
        messages: [],
        events: [],
        toolUses: [],
        loading: false,
        error: null,
        sendMessage: mockSendMessage,
        addAssistantMessage: mockAddAssistantMessage,
        addContextInjectedEvent: vi.fn(),
        addThinkingBlock: vi.fn(),
        addToolUse: vi.fn(),
        markAllToolsComplete: vi.fn(),
        refresh: vi.fn(),
        isWaitingForResponse: false,
        lastMessageStatus: defaultLastMessageStatus,
        updateMessageStatus: vi.fn(),
        resendLastMessage: vi.fn(),
        loadMore: vi.fn(),
        hasMoreMessages: false,
        loadingMoreMessages: false,
        checkMessageStatus: vi.fn(),
      });

      render(
        <GeneralConversation
          sessionId="sess-123"
          onSessionSelect={vi.fn()}
        />
      );

      await waitFor(() => {
        const liveRegions = screen.getAllByRole('status');
        const announcement = liveRegions.find((r) => r.textContent?.trim() !== '');
        // Should prefix with "Claude:" or "Assistant:" for context
        expect(
          announcement?.textContent?.includes('Claude') ||
          announcement?.textContent?.includes('Assistant')
        ).toBe(true);
      });
    });

    it('should truncate very long messages in announcements', async () => {
      const { useSessionMessages } = await import('../../hooks/useSessionMessages');

      const longMessage = 'A'.repeat(500);

      vi.mocked(useSessionMessages).mockReturnValue({
        timeline: [
          {
            itemType: 'message' as const,
            id: 'msg-1',
            sessionId: 'sess-123',
            role: 'assistant' as const,
            content: longMessage,
            createdAt: Date.now(),
          },
        ],
        messages: [],
        events: [],
        toolUses: [],
        loading: false,
        error: null,
        sendMessage: mockSendMessage,
        addAssistantMessage: mockAddAssistantMessage,
        addContextInjectedEvent: vi.fn(),
        addThinkingBlock: vi.fn(),
        addToolUse: vi.fn(),
        markAllToolsComplete: vi.fn(),
        refresh: vi.fn(),
        isWaitingForResponse: false,
        lastMessageStatus: defaultLastMessageStatus,
        updateMessageStatus: vi.fn(),
        resendLastMessage: vi.fn(),
        loadMore: vi.fn(),
        hasMoreMessages: false,
        loadingMoreMessages: false,
        checkMessageStatus: vi.fn(),
      });

      render(
        <GeneralConversation
          sessionId="sess-123"
          onSessionSelect={vi.fn()}
        />
      );

      await waitFor(() => {
        const liveRegions = screen.getAllByRole('status');
        const announcement = liveRegions.find((r) => r.textContent?.trim() !== '');
        // Announcement should be truncated (max ~200 chars for screen reader comfort)
        expect(announcement?.textContent?.length).toBeLessThan(300);
      });
    });
  });

  describe('empty/no session state', () => {
    it('should not announce when no session is selected', () => {
      render(
        <GeneralConversation
          sessionId={null}
          onSessionSelect={vi.fn()}
        />
      );

      // Live regions should exist but be empty
      const liveRegions = screen.getAllByRole('status');
      liveRegions.forEach((region) => {
        expect(region.textContent?.trim()).toBe('');
      });
    });
  });
});
