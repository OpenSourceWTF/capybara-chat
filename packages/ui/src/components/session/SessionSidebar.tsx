/**
 * SessionSidebar - Collapsible sidebar with session list
 *
 * Uses WEBSOCKET PUSH for real-time updates - NO POLLING.
 * Uses shared SocketContext for connection state and processing tracking.
 * Session list logic extracted to useSessionList hook.
 */

import { useState, useCallback, useMemo } from 'react';
import { Plus, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import { SessionCard } from './SessionCard';
import { CollapsedSidebar } from './CollapsedSidebar';
import { Button, SessionCardSkeleton, TerminalSearchBar } from '../ui';
import { createNewSession } from '../../lib/entity-events';
import { useSocket } from '../../context/SocketContext';
import { useSessionList } from '../../hooks/useSessionList';
import { NewChatMenu } from '../main/NewChatMenu';

interface SessionSidebarProps {
  currentSessionId: string | null;
  onSessionSelect: (sessionId: string) => void;
  onSessionDelete?: (sessionId: string) => void;
  onNewChat?: (agentDefinitionId?: string) => void;
  onNewTask?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  isPinned?: boolean;
}

export function SessionSidebar({
  currentSessionId,
  onSessionSelect,
  onSessionDelete,
  onNewChat,
  onNewTask,
  isCollapsed = false,
  onToggleCollapse,
  isPinned = false,
}: SessionSidebarProps) {
  const { processingSessions } = useSocket();
  const [searchQuery, setSearchQuery] = useState('');

  // Use extracted session list hook
  const { sessions, loading, handleDelete, handleRename } = useSessionList({
    currentSessionId,
    onSessionDelete,
  });

  // Use event bus if no callback provided
  const handleNewChat = useCallback((agentDefinitionId?: string) => {
    if (onNewChat) {
      onNewChat(agentDefinitionId);
    } else {
      createNewSession(agentDefinitionId);
    }
  }, [onNewChat]);

  // Filter sessions based on search query
  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return sessions;
    const lower = searchQuery.toLowerCase();
    return sessions.filter(
      (s) =>
        s.name?.toLowerCase().includes(lower) ||
        s.lastMessagePreview?.toLowerCase().includes(lower)
    );
  }, [sessions, searchQuery]);

  // Collapsed state - Discord-like icon sidebar
  if (isCollapsed) {
    return (
      <CollapsedSidebar
        sessions={sessions}
        currentSessionId={currentSessionId}
        processingSessions={processingSessions}
        onSessionSelect={onSessionSelect}
        onToggleCollapse={onToggleCollapse ?? (() => {})}
        onNewChat={handleNewChat}
      />
    );
  }

  return (
    <div className="session-sidebar">
      {/* Header with integrated search */}
      <div className="flex-shrink-0 px-3 py-2 border-b border-border flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <span>TERMINAL_SESSIONS</span>
            <span className="text-2xs opacity-50">[{sessions.length}]</span>
          </h2>
          <div className="flex items-center gap-1">
            <button
              onClick={onToggleCollapse}
              className={`p-1 text-2xs font-bold transition-colors ${isPinned ? 'text-primary' : 'text-muted-foreground/50 hover:text-foreground'}`}
              title={isPinned ? "Unpin" : "Pin"}
            >
              PIN
            </button>
          </div>
        </div>

        {/* Integrated Search */}
        {sessions.length > 0 && (
          <div className="px-1 mt-1">
            <TerminalSearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="sessions..."
            />
          </div>
        )}
      </div>

      {/* List Container - No Padding, Strict Vertical List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 space-y-2">
            <SessionCardSkeleton />
            <SessionCardSkeleton />
            <SessionCardSkeleton />
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground text-center p-4">
            <p className="text-xs font-mono mb-2">// NO_ACTIVE_SESSIONS</p>
            <Button variant="ghost" size="sm" onClick={() => handleNewChat()} className="h-6 text-xs uppercase border border-border/50">
              <Plus className="w-3 h-3 mr-1" />
              INIT_SESSION
            </Button>
          </div>
        ) : (
          <div className="flex flex-col">
            {filteredSessions.map((session) => (
              <motion.div
                key={session.id}
                layout
                transition={{
                  layout: { type: 'spring', stiffness: 500, damping: 40 },
                }}
              >
                <SessionCard
                  session={{
                    ...session,
                    isProcessing: processingSessions.has(session.id),
                  }}
                  isActive={session.id === currentSessionId}
                  onSelect={() => onSessionSelect(session.id)}
                  onRename={(newName) => handleRename(session.id, newName)}
                  onDelete={() => handleDelete(session.id)}
                />
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Footer - New Chat & New Task */}
      <div className="session-sidebar-footer">
        <div className="flex gap-2">
          <div className="flex-1">
            <NewChatMenu onSelect={handleNewChat} />
          </div>
          {onNewTask && (
            <Button
              variant="outline"
              size="sm"
              onClick={onNewTask}
              className="h-8 px-3 font-mono text-xs uppercase"
              title="Spawn new worker task"
            >
              <Zap className="w-3 h-3 mr-1" />
              TASK
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
