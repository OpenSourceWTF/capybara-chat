/**
 * CollapsedSidebar - Discord-like icon sidebar for sessions
 *
 * Extracted from SessionSidebar for better separation of concerns.
 * Shows session initials as icons when sidebar is collapsed.
 */

import { ChevronLeft } from 'lucide-react';
import { NewChatMenu } from '../main/NewChatMenu';
import type { SessionListItem } from './SessionCard';

export interface CollapsedSidebarProps {
  sessions: SessionListItem[];
  currentSessionId: string | null;
  processingSessions: Set<string>;
  onSessionSelect: (sessionId: string) => void;
  onToggleCollapse: () => void;
  onNewChat: (agentDefinitionId?: string) => void;
}

export function CollapsedSidebar({
  sessions,
  currentSessionId,
  processingSessions,
  onSessionSelect,
  onToggleCollapse,
  onNewChat,
}: CollapsedSidebarProps) {
  return (
    <div className="sidebar-collapsed">
      {/* Expand/Pin button at top */}
      <button
        onClick={onToggleCollapse}
        className="sidebar-collapsed-icon sidebar-collapsed-expand"
        title="Expand sidebar"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      {/* Divider */}
      <div className="sidebar-collapsed-divider" />

      {/* Session Icons */}
      <div className="sidebar-collapsed-sessions">
        {sessions.slice(0, 8).map((session) => {
          const isActive = session.id === currentSessionId;
          const isProcessing = processingSessions.has(session.id);
          const initial = (session.name || 'C')[0].toUpperCase();
          const showUnread = session.hasUnread && !isActive;

          return (
            <button
              key={session.id}
              onClick={() => onSessionSelect(session.id)}
              className={`sidebar-collapsed-icon ${isActive ? 'active' : ''} ${isProcessing ? 'processing' : ''} ${showUnread ? 'has-unread' : ''}`}
              title={session.name || 'Chat'}
            >
              <span className="sidebar-collapsed-icon-text">{initial}</span>
              {isActive && <span className="sidebar-collapsed-indicator" />}
            </button>
          );
        })}
      </div>

      {/* New chat at bottom */}
      <div className="sidebar-collapsed-footer">
        <div className="sidebar-collapsed-divider" />
        <NewChatMenu onSelect={onNewChat} iconOnly />
      </div>
    </div>
  );
}
