/**
 * AdaptiveLayout - Mode-aware 2-pane layout
 *
 * 168-right-bar-elimination: Simplified from 3-pane to 2-pane.
 * Session management moved to SessionDropdown in the chat pane.
 *
 * Layout: [Content] | [Chat]
 *
 * Modes:
 * - NORMAL: Standard 2-pane layout
 * - FOCUS: Expanded content, hidden chat
 * - IMMERSIVE: Full-screen content (chat hidden)
 */

import { useState, useCallback, ReactNode } from 'react';
import { PaneResizer } from './PaneResizer';
import { useLayoutMode } from '../../context/LayoutModeContext';
import { PANES, STORAGE_KEYS } from '../../constants';

interface AdaptiveLayoutProps {
  contentPane: ReactNode;
  contentHeader?: ReactNode;
  chatPane: ReactNode;
}

export function AdaptiveLayout({
  contentPane,
  contentHeader,
  chatPane,
}: AdaptiveLayoutProps) {
  const { mode } = useLayoutMode();

  // Chat pane width state
  const [chatWidth, setChatWidth] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.CHAT_PANE_WIDTH);
    return saved ? Number(saved) : PANES.CHAT.DEFAULT_WIDTH;
  });

  // Handle chat pane resize (resizer between content and chat)
  const handleChatResize = useCallback((delta: number) => {
    setChatWidth(prev => {
      const newWidth = Math.min(
        PANES.CHAT.MAX_WIDTH,
        Math.max(PANES.CHAT.MIN_WIDTH, prev - delta)
      );
      return newWidth;
    });
  }, []);

  const handleChatResizeEnd = useCallback(() => {
    localStorage.setItem(STORAGE_KEYS.CHAT_PANE_WIDTH, String(chatWidth));
  }, [chatWidth]);

  // Reset chat pane to default on double-click
  const resetChatPane = useCallback(() => {
    setChatWidth(PANES.CHAT.DEFAULT_WIDTH);
    localStorage.setItem(STORAGE_KEYS.CHAT_PANE_WIDTH, String(PANES.CHAT.DEFAULT_WIDTH));
  }, []);

  // Determine effective widths based on mode
  const isNormal = mode === 'normal';

  // Hide chat pane in FOCUS and IMMERSIVE modes
  const showChatPane = isNormal;

  // Only show resizer in NORMAL mode when chat pane is visible
  const showChatResizer = isNormal && showChatPane;

  return (
    <div
      className="adaptive-layout"
      data-mode={mode}
      data-testid="adaptive-layout"
    >
      {/* Content Pane (visual left, expanded in FOCUS, full in IMMERSIVE) */}
      <main
        className="pane-content"
        style={{ flex: 1 }}
        data-mode={mode}
      >
        {contentHeader && (
          <header className="pane-content-header">
            {contentHeader}
          </header>
        )}
        <div className="pane-content-body">
          {contentPane}
        </div>
      </main>

      {/* Resizer between Content and Chat */}
      {showChatResizer && (
        <PaneResizer
          onResize={handleChatResize}
          onResizeEnd={handleChatResizeEnd}
          onDoubleClick={resetChatPane}
          direction="horizontal"
        />
      )}

      {/* Chat Pane (visual right, hidden in FOCUS and IMMERSIVE) */}
      {showChatPane && (
        <section
          className="pane-chat"
          style={{ width: chatWidth, flex: 'none' }}
          data-mode={mode}
        >
          {chatPane}
        </section>
      )}
    </div>
  );
}
