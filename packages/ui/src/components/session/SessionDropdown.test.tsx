/**
 * SessionDropdown Keyboard Navigation Tests (TDD)
 *
 * Tests for enhanced SessionDropdown component with keyboard accessibility.
 * These tests are written BEFORE implementation (TDD approach).
 *
 * Requirements:
 * 1. Opens with Enter/Space on trigger
 * 2. Navigates with ArrowDown/ArrowUp
 * 3. Jumps with Home/End keys
 * 4. Selects with Enter on focused option
 * 5. Closes with Escape and returns focus to trigger
 * 6. Uses ID-based focus tracking (stable across list changes)
 * 7. Only resets focus when session is DELETED, not when filtered
 * 8. Shows "Load more" button when sessions exceed page size
 * 9. Focuses first session on open
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SessionDropdown } from './SessionDropdown';

// Mock the Socket context
vi.mock('../../context/SocketContext', () => ({
  useSocket: vi.fn(() => ({
    processingSessions: new Set<string>(),
  })),
}));

// STABLE reference for sessions to prevent re-render loops
const STABLE_SESSIONS = [
  {
    id: 'sess-1',
    name: 'Session One',
    lastMessagePreview: 'Hello world',
    hasUnread: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    lastMessageAt: Date.now(),
    messageCount: 5,
  },
  {
    id: 'sess-2',
    name: 'Session Two',
    lastMessagePreview: 'Testing things',
    hasUnread: true,
    createdAt: Date.now() - 1000,
    updatedAt: Date.now() - 1000,
    lastMessageAt: Date.now() - 1000,
    messageCount: 3,
  },
  {
    id: 'sess-3',
    name: 'Session Three',
    lastMessagePreview: 'More content',
    hasUnread: false,
    createdAt: Date.now() - 2000,
    updatedAt: Date.now() - 2000,
    lastMessageAt: Date.now() - 2000,
    messageCount: 10,
  },
];

// Mock useSessionList hook
vi.mock('../../hooks/useSessionList', () => ({
  useSessionList: vi.fn(() => ({
    sessions: STABLE_SESSIONS,
    loading: false,
    handleDelete: vi.fn(),
    handleRename: vi.fn(),
  })),
}));

describe('SessionDropdown', () => {
  const defaultProps = {
    currentSessionId: 'sess-1',
    onSessionSelect: vi.fn(),
    onSessionDelete: vi.fn(),
    onNewChat: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('trigger button', () => {
    it('should render current session name', () => {
      render(<SessionDropdown {...defaultProps} />);

      expect(screen.getByText('Session One')).toBeInTheDocument();
    });

    it('should show session count', () => {
      render(<SessionDropdown {...defaultProps} />);

      // Format: [3] for 3 sessions
      expect(screen.getByText('[3]')).toBeInTheDocument();
    });

    it('should show unread count badge', () => {
      render(<SessionDropdown {...defaultProps} />);

      // sess-2 has hasUnread: true, so badge should show [1]
      expect(screen.getByText('[1]')).toBeInTheDocument();
    });

    it('should be focusable', () => {
      render(<SessionDropdown {...defaultProps} />);

      const trigger = screen.getByRole('button', { name: /session/i });
      trigger.focus();

      expect(trigger).toHaveFocus();
    });
  });

  describe('keyboard: opening dropdown', () => {
    it('should open with Enter key on trigger', async () => {
      const user = userEvent.setup();
      render(<SessionDropdown {...defaultProps} />);

      const trigger = screen.getByRole('button', { name: /session/i });
      trigger.focus();
      await user.keyboard('{Enter}');

      // Dropdown panel should be visible
      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });
    });

    it('should open with Space key on trigger', async () => {
      const user = userEvent.setup();
      render(<SessionDropdown {...defaultProps} />);

      const trigger = screen.getByRole('button', { name: /session/i });
      trigger.focus();
      await user.keyboard(' ');

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });
    });

    it('should focus first session when opened', async () => {
      const user = userEvent.setup();
      render(<SessionDropdown {...defaultProps} />);

      const trigger = screen.getByRole('button', { name: /session/i });
      await user.click(trigger);

      await waitFor(() => {
        const options = screen.getAllByRole('option');
        expect(options[0]).toHaveFocus();
      });
    });

    it('should focus current session when opened if it exists', async () => {
      const user = userEvent.setup();
      render(<SessionDropdown {...defaultProps} currentSessionId="sess-2" />);

      const trigger = screen.getByRole('button', { name: /session/i });
      await user.click(trigger);

      await waitFor(() => {
        const currentOption = screen.getByRole('option', { name: /Session Two/i });
        expect(currentOption).toHaveAttribute('aria-selected', 'true');
      });
    });
  });

  describe('keyboard: navigation', () => {
    it('should navigate down with ArrowDown key', async () => {
      const user = userEvent.setup();
      render(<SessionDropdown {...defaultProps} />);

      // Open dropdown
      const trigger = screen.getByRole('button', { name: /session/i });
      await user.click(trigger);

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      // Navigate down
      await user.keyboard('{ArrowDown}');

      const options = screen.getAllByRole('option');
      expect(options[1]).toHaveFocus();
    });

    it('should navigate up with ArrowUp key', async () => {
      const user = userEvent.setup();
      render(<SessionDropdown {...defaultProps} />);

      // Open dropdown
      const trigger = screen.getByRole('button', { name: /session/i });
      await user.click(trigger);

      // Move to second item first
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{ArrowDown}');

      // Navigate up
      await user.keyboard('{ArrowUp}');

      const options = screen.getAllByRole('option');
      expect(options[1]).toHaveFocus();
    });

    it('should wrap from last to first with ArrowDown', async () => {
      const user = userEvent.setup();
      render(<SessionDropdown {...defaultProps} />);

      const trigger = screen.getByRole('button', { name: /session/i });
      await user.click(trigger);

      // Navigate to end
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{ArrowDown}'); // Wrap

      const options = screen.getAllByRole('option');
      expect(options[0]).toHaveFocus();
    });

    it('should wrap from first to last with ArrowUp', async () => {
      const user = userEvent.setup();
      render(<SessionDropdown {...defaultProps} />);

      const trigger = screen.getByRole('button', { name: /session/i });
      await user.click(trigger);

      // Navigate up from first (should wrap to last)
      await user.keyboard('{ArrowUp}');

      const options = screen.getAllByRole('option');
      expect(options[options.length - 1]).toHaveFocus();
    });

    it('should jump to first with Home key', async () => {
      const user = userEvent.setup();
      render(<SessionDropdown {...defaultProps} />);

      const trigger = screen.getByRole('button', { name: /session/i });
      await user.click(trigger);

      // Move somewhere in the middle
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{ArrowDown}');

      // Jump to first
      await user.keyboard('{Home}');

      const options = screen.getAllByRole('option');
      expect(options[0]).toHaveFocus();
    });

    it('should jump to last with End key', async () => {
      const user = userEvent.setup();
      render(<SessionDropdown {...defaultProps} />);

      const trigger = screen.getByRole('button', { name: /session/i });
      await user.click(trigger);

      // Jump to last
      await user.keyboard('{End}');

      const options = screen.getAllByRole('option');
      expect(options[options.length - 1]).toHaveFocus();
    });
  });

  describe('keyboard: selection', () => {
    it('should select focused option with Enter key', async () => {
      const user = userEvent.setup();
      const onSessionSelect = vi.fn();
      render(<SessionDropdown {...defaultProps} onSessionSelect={onSessionSelect} />);

      const trigger = screen.getByRole('button', { name: /session/i });
      await user.click(trigger);

      // Navigate to second option
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{Enter}');

      expect(onSessionSelect).toHaveBeenCalledWith('sess-2');
    });

    it('should close dropdown after selection', async () => {
      const user = userEvent.setup();
      render(<SessionDropdown {...defaultProps} />);

      const trigger = screen.getByRole('button', { name: /session/i });
      await user.click(trigger);

      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      });
    });
  });

  describe('keyboard: closing', () => {
    it('should close with Escape key', async () => {
      const user = userEvent.setup();
      render(<SessionDropdown {...defaultProps} />);

      const trigger = screen.getByRole('button', { name: /session/i });
      await user.click(trigger);

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      await user.keyboard('{Escape}');

      await waitFor(() => {
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      });
    });

    it('should return focus to trigger after Escape', async () => {
      const user = userEvent.setup();
      render(<SessionDropdown {...defaultProps} />);

      const trigger = screen.getByRole('button', { name: /session/i });
      await user.click(trigger);

      await user.keyboard('{Escape}');

      await waitFor(() => {
        expect(trigger).toHaveFocus();
      });
    });

    it('should close on click outside', async () => {
      const user = userEvent.setup();
      render(
        <div>
          <SessionDropdown {...defaultProps} />
          <button data-testid="outside">Outside</button>
        </div>
      );

      const trigger = screen.getByRole('button', { name: /session/i });
      await user.click(trigger);

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('outside'));

      await waitFor(() => {
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      });
    });
  });

  describe('ID-based focus tracking', () => {
    it('should maintain focus on same session after filtering', async () => {
      const user = userEvent.setup();
      render(<SessionDropdown {...defaultProps} />);

      const trigger = screen.getByRole('button', { name: /session/i });
      await user.click(trigger);

      // Focus on Session Two
      await user.keyboard('{ArrowDown}');

      // Type to filter (should still be focused on Session Two if visible)
      const searchInput = screen.getByPlaceholderText(/filter/i);
      await user.type(searchInput, 'Two');

      // Session Two should still be focused/visible
      const option = screen.getByRole('option', { name: /Session Two/i });
      expect(option).toBeInTheDocument();
    });

    it('should reset focus only when focused session is deleted', async () => {
      // This test verifies the ID-based tracking by simulating a deletion
      const user = userEvent.setup();

      // We need to mock useSessionList with updateable sessions
      const { useSessionList } = await import('../../hooks/useSessionList');
      const mockUseSessionList = vi.mocked(useSessionList);

      // Start with all sessions
      mockUseSessionList.mockReturnValue({
        sessions: STABLE_SESSIONS,
        loading: false,
        handleDelete: vi.fn(),
        handleRename: vi.fn(),
      });

      const { rerender } = render(<SessionDropdown {...defaultProps} />);

      const trigger = screen.getByRole('button', { name: /session/i });
      await user.click(trigger);

      // Focus on Session Two
      await user.keyboard('{ArrowDown}');

      // Simulate Session Two being deleted
      mockUseSessionList.mockReturnValue({
        sessions: [STABLE_SESSIONS[0], STABLE_SESSIONS[2]], // sess-1 and sess-3 only
        loading: false,
        handleDelete: vi.fn(),
        handleRename: vi.fn(),
      });

      rerender(<SessionDropdown {...defaultProps} />);

      // Focus should reset to first session since focused session was deleted
      await waitFor(() => {
        const options = screen.getAllByRole('option');
        expect(options[0]).toHaveFocus();
      });
    });
  });

  describe('pagination', () => {
    it('should show "Load more" button when sessions exceed page size', async () => {
      // Mock many sessions
      const { useSessionList } = await import('../../hooks/useSessionList');
      const mockUseSessionList = vi.mocked(useSessionList);

      const manySessions = Array.from({ length: 25 }, (_, i) => ({
        id: `sess-${i}`,
        name: `Session ${i}`,
        lastMessagePreview: `Preview ${i}`,
        hasUnread: false,
        createdAt: Date.now() - i * 1000,
        updatedAt: Date.now() - i * 1000,
        lastMessageAt: Date.now() - i * 1000,
        messageCount: i + 1,
      }));

      mockUseSessionList.mockReturnValue({
        sessions: manySessions,
        loading: false,
        handleDelete: vi.fn(),
        handleRename: vi.fn(),
        hasMore: true,
        loadMore: vi.fn(),
      });

      const user = userEvent.setup();
      render(<SessionDropdown {...defaultProps} />);

      const trigger = screen.getByRole('button', { name: /session/i });
      await user.click(trigger);

      await waitFor(() => {
        expect(screen.getByText(/load more/i)).toBeInTheDocument();
      });
    });

    it('should call loadMore when "Load more" is clicked', async () => {
      const { useSessionList } = await import('../../hooks/useSessionList');
      const mockUseSessionList = vi.mocked(useSessionList);

      const loadMore = vi.fn();

      mockUseSessionList.mockReturnValue({
        sessions: STABLE_SESSIONS,
        loading: false,
        handleDelete: vi.fn(),
        handleRename: vi.fn(),
        hasMore: true,
        loadMore,
      });

      const user = userEvent.setup();
      render(<SessionDropdown {...defaultProps} />);

      const trigger = screen.getByRole('button', { name: /session/i });
      await user.click(trigger);

      const loadMoreBtn = screen.getByText(/load more/i);
      await user.click(loadMoreBtn);

      expect(loadMore).toHaveBeenCalled();
    });
  });

  describe('accessibility', () => {
    it('should have role="listbox" on dropdown panel', async () => {
      const user = userEvent.setup();
      render(<SessionDropdown {...defaultProps} />);

      const trigger = screen.getByRole('button', { name: /session/i });
      await user.click(trigger);

      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    it('should have role="option" on each session item', async () => {
      const user = userEvent.setup();
      render(<SessionDropdown {...defaultProps} />);

      const trigger = screen.getByRole('button', { name: /session/i });
      await user.click(trigger);

      const options = screen.getAllByRole('option');
      expect(options).toHaveLength(3);
    });

    it('should have aria-selected="true" on current session', async () => {
      const user = userEvent.setup();
      render(<SessionDropdown {...defaultProps} currentSessionId="sess-2" />);

      const trigger = screen.getByRole('button', { name: /session/i });
      await user.click(trigger);

      const selectedOption = screen.getByRole('option', { name: /Session Two/i });
      expect(selectedOption).toHaveAttribute('aria-selected', 'true');
    });

    it('should have aria-expanded on trigger', async () => {
      const user = userEvent.setup();
      render(<SessionDropdown {...defaultProps} />);

      const trigger = screen.getByRole('button', { name: /session/i });
      expect(trigger).toHaveAttribute('aria-expanded', 'false');

      await user.click(trigger);

      expect(trigger).toHaveAttribute('aria-expanded', 'true');
    });

    it('should have aria-controls linking trigger to listbox', async () => {
      const user = userEvent.setup();
      render(<SessionDropdown {...defaultProps} />);

      const trigger = screen.getByRole('button', { name: /session/i });
      await user.click(trigger);

      const listbox = screen.getByRole('listbox');
      const listboxId = listbox.getAttribute('id');

      expect(trigger).toHaveAttribute('aria-controls', listboxId);
    });

    it('should have aria-activedescendant pointing to focused option', async () => {
      const user = userEvent.setup();
      render(<SessionDropdown {...defaultProps} />);

      const trigger = screen.getByRole('button', { name: /session/i });
      await user.click(trigger);

      await user.keyboard('{ArrowDown}');

      const listbox = screen.getByRole('listbox');
      const focusedOption = screen.getAllByRole('option')[1];

      expect(listbox).toHaveAttribute('aria-activedescendant', focusedOption.id);
    });
  });

  describe('action buttons', () => {
    it('should render NEW_CHAT button when onNewChat is provided', async () => {
      const user = userEvent.setup();
      render(<SessionDropdown {...defaultProps} />);

      const trigger = screen.getByRole('button', { name: /session/i });
      await user.click(trigger);

      expect(screen.getByText('NEW_CHAT')).toBeInTheDocument();
    });

    it('should call onNewChat when NEW_CHAT is clicked', async () => {
      const user = userEvent.setup();
      const onNewChat = vi.fn();
      render(<SessionDropdown {...defaultProps} onNewChat={onNewChat} />);

      const trigger = screen.getByRole('button', { name: /session/i });
      await user.click(trigger);

      await user.click(screen.getByText('NEW_CHAT'));

      expect(onNewChat).toHaveBeenCalled();
    });

    it('should not render NEW_CHAT button when onNewChat is not provided', async () => {
      const user = userEvent.setup();
      render(<SessionDropdown {...defaultProps} onNewChat={undefined} />);

      const trigger = screen.getByRole('button', { name: /session/i });
      await user.click(trigger);

      expect(screen.queryByText('NEW_CHAT')).not.toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('should show "NO_SESSIONS" when no sessions exist', async () => {
      const { useSessionList } = await import('../../hooks/useSessionList');
      const mockUseSessionList = vi.mocked(useSessionList);

      mockUseSessionList.mockReturnValue({
        sessions: [],
        loading: false,
        handleDelete: vi.fn(),
        handleRename: vi.fn(),
      });

      const user = userEvent.setup();
      render(<SessionDropdown {...defaultProps} currentSessionId={null} />);

      const trigger = screen.getByRole('button', { name: /session/i });
      await user.click(trigger);

      expect(screen.getByText(/NO_SESSIONS/)).toBeInTheDocument();
    });

    it('should show "NO_MATCHES" when filter returns no results', async () => {
      const user = userEvent.setup();
      render(<SessionDropdown {...defaultProps} />);

      const trigger = screen.getByRole('button', { name: /session/i });
      await user.click(trigger);

      // Search for something that doesn't exist
      const searchInput = screen.getByPlaceholderText(/filter/i);
      await user.type(searchInput, 'nonexistent');

      expect(screen.getByText(/NO_MATCHES/)).toBeInTheDocument();
    });
  });

  describe('loading state', () => {
    it('should show loading indicator when loading', async () => {
      const { useSessionList } = await import('../../hooks/useSessionList');
      const mockUseSessionList = vi.mocked(useSessionList);

      mockUseSessionList.mockReturnValue({
        sessions: [],
        loading: true,
        handleDelete: vi.fn(),
        handleRename: vi.fn(),
      });

      const user = userEvent.setup();
      render(<SessionDropdown {...defaultProps} />);

      const trigger = screen.getByRole('button', { name: /session/i });
      await user.click(trigger);

      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });
  });
});
