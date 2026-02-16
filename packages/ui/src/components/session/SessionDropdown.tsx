/**
 * SessionDropdown - Compact session picker for the chat pane header
 *
 * 168-right-bar-elimination: Replaces the right sidebar with a dropdown
 * at the top of the chat pane. Shows current session name, expands to
 * reveal the full session list with search.
 *
 * Accessibility Features:
 * - ARIA listbox pattern (combobox trigger, listbox container, option items)
 * - ID-based focus tracking (stable across list changes)
 * - Full keyboard navigation (Arrow keys, Home/End, Enter, Escape)
 * - Pagination for scalability
 *
 * Reuses useSessionList hook and SessionCard for consistency.
 */

import React, { useState, useRef, useEffect, useMemo, useCallback, useId } from 'react';
import { ChevronDown, Plus, Pencil, Trash2, Check, X, Loader2, DollarSign } from 'lucide-react';
import { Button, TerminalSearchBar } from '../ui';
import { useSocket } from '../../context/SocketContext';
import { useSessionList } from '../../hooks/useSessionList';
import { formatRelativeTime, formatCost, cn } from '../../lib/utils';
import type { SessionListItem } from './SessionCard';

interface SessionDropdownProps {
  currentSessionId: string | null;
  onSessionSelect: (sessionId: string) => void;
  onSessionDelete?: (sessionId: string) => void;
  onNewChat?: (agentDefinitionId?: string) => void;
}

const SESSIONS_PER_PAGE = 20;

export function SessionDropdown({
  currentSessionId,
  onSessionSelect,
  onSessionDelete,
  onNewChat,
}: SessionDropdownProps) {
  const { processingSessions } = useSocket();
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [focusedSessionId, setFocusedSessionId] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Unique IDs for ARIA
  const baseId = useId();
  const listboxId = `${baseId}-listbox`;

  const { sessions, loading, handleDelete, handleRename, hasMore, loadMore } = useSessionList({
    currentSessionId,
    onSessionDelete,
  });

  // Current session display
  const currentSession = useMemo(
    () => sessions.find(s => s.id === currentSessionId),
    [sessions, currentSessionId]
  );

  // Filter sessions
  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return sessions;
    const lower = searchQuery.toLowerCase();
    return sessions.filter(
      (s) =>
        s.name?.toLowerCase().includes(lower) ||
        s.lastMessagePreview?.toLowerCase().includes(lower)
    );
  }, [sessions, searchQuery]);

  // Paginated sessions for display
  const paginatedSessions = useMemo(
    () => filteredSessions.slice(0, page * SESSIONS_PER_PAGE),
    [filteredSessions, page]
  );

  // Track ALL session IDs (not filtered) to detect deletion vs filtering
  const allSessionIds = useMemo(() => new Set(sessions.map(s => s.id)), [sessions]);

  // Compute focused index from focusedSessionId
  const focusedIndex = useMemo(() => {
    if (!focusedSessionId) return 0;
    const index = paginatedSessions.findIndex(s => s.id === focusedSessionId);
    return index >= 0 ? index : 0;
  }, [focusedSessionId, paginatedSessions]);

  // Only reset focus when session is DELETED, not when filtered
  useEffect(() => {
    if (focusedSessionId && !allSessionIds.has(focusedSessionId)) {
      // Session was deleted - reset to first available
      const firstSession = paginatedSessions[0];
      setFocusedSessionId(firstSession?.id || null);
      // Focus the first option element
      if (open && firstSession) {
        const optionEl = optionRefs.current.get(firstSession.id);
        optionEl?.focus();
      }
    }
  }, [focusedSessionId, allSessionIds, paginatedSessions, open]);

  // Unread count for badge
  const unreadCount = useMemo(
    () => sessions.filter(s => s.hasUnread && s.id !== currentSessionId).length,
    [sessions, currentSessionId]
  );

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Focus first session (or current session) when opened
  useEffect(() => {
    if (open && paginatedSessions.length > 0) {
      // Focus current session if it exists in the list, otherwise first
      const targetSessionId = currentSessionId && paginatedSessions.some(s => s.id === currentSessionId)
        ? currentSessionId
        : paginatedSessions[0].id;

      setFocusedSessionId(targetSessionId);

      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(() => {
        const optionEl = optionRefs.current.get(targetSessionId);
        optionEl?.focus();
      });
    }
  }, [open, paginatedSessions.length > 0, currentSessionId]);

  // Scroll focused item into view
  useEffect(() => {
    if (!open || !focusedSessionId) return;
    const optionEl = optionRefs.current.get(focusedSessionId);
    optionEl?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [focusedSessionId, open]);

  const handleSelect = useCallback((sessionId: string) => {
    onSessionSelect(sessionId);
    setOpen(false);
    // Return focus to trigger
    triggerRef.current?.focus();
  }, [onSessionSelect]);

  const handleClose = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!open || paginatedSessions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault();
        const nextIndex = (focusedIndex + 1) % paginatedSessions.length;
        const nextSession = paginatedSessions[nextIndex];
        setFocusedSessionId(nextSession.id);
        const optionEl = optionRefs.current.get(nextSession.id);
        optionEl?.focus();
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        const prevIndex = (focusedIndex - 1 + paginatedSessions.length) % paginatedSessions.length;
        const prevSession = paginatedSessions[prevIndex];
        setFocusedSessionId(prevSession.id);
        const optionEl = optionRefs.current.get(prevSession.id);
        optionEl?.focus();
        break;
      }
      case 'Home': {
        e.preventDefault();
        const firstSession = paginatedSessions[0];
        setFocusedSessionId(firstSession.id);
        const optionEl = optionRefs.current.get(firstSession.id);
        optionEl?.focus();
        break;
      }
      case 'End': {
        e.preventDefault();
        const lastSession = paginatedSessions[paginatedSessions.length - 1];
        setFocusedSessionId(lastSession.id);
        const optionEl = optionRefs.current.get(lastSession.id);
        optionEl?.focus();
        break;
      }
      case 'Enter':
      case ' ': {
        // Only handle if we're on an option (not in search input)
        if ((e.target as HTMLElement).getAttribute('role') === 'option') {
          e.preventDefault();
          if (focusedSessionId) {
            handleSelect(focusedSessionId);
          }
        }
        break;
      }
      case 'Escape': {
        e.preventDefault();
        handleClose();
        break;
      }
    }
  }, [open, paginatedSessions, focusedIndex, focusedSessionId, handleSelect, handleClose]);

  // Handle trigger keyboard events
  const handleTriggerKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setOpen(!open);
    } else if (e.key === 'Escape' && open) {
      e.preventDefault();
      handleClose();
    }
  }, [open, handleClose]);

  // Get the option ID for a session
  const getOptionId = useCallback((sessionId: string) => `${baseId}-option-${sessionId}`, [baseId]);

  // Register option ref
  const setOptionRef = useCallback((sessionId: string, el: HTMLDivElement | null) => {
    if (el) {
      optionRefs.current.set(sessionId, el);
    } else {
      optionRefs.current.delete(sessionId);
    }
  }, []);

  // Check if there are more sessions to load (either from pagination or server)
  const showLoadMore = hasMore || paginatedSessions.length < filteredSessions.length;

  const handleLoadMore = useCallback(() => {
    if (paginatedSessions.length < filteredSessions.length) {
      // Load more from local pagination
      setPage(p => p + 1);
    } else if (loadMore) {
      // Load more from server
      loadMore();
    }
  }, [paginatedSessions.length, filteredSessions.length, loadMore]);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger: Current session name */}
      <button
        ref={triggerRef}
        onClick={() => setOpen(!open)}
        onKeyDown={handleTriggerKeyDown}
        aria-label={`Session: ${currentSession?.name || 'No session selected'}`}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? listboxId : undefined}
        className="flex items-center gap-2 w-full px-3 py-1.5 text-left font-mono text-xs
          border-b border-border bg-card hover:bg-muted/50 transition-colors"
      >
        <span className="text-2xs font-bold uppercase tracking-wider text-muted-foreground/60">
          SESSION
        </span>
        <span className="flex-1 truncate text-foreground font-medium">
          {currentSession?.name || (currentSessionId ? '...' : 'No session')}
        </span>
        {unreadCount > 0 && (
          <span className="text-2xs font-bold text-primary">
            [{unreadCount}]
          </span>
        )}
        <span className="text-2xs text-muted-foreground/50">
          [{sessions.length}]
        </span>
        <ChevronDown className={`w-3 h-3 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          className="absolute left-0 right-0 top-full z-50 bg-card border border-border border-t-0 shadow-lg
            animate-in fade-in slide-in-from-top-1 duration-150 max-h-[60vh] flex flex-col"
          onKeyDown={handleKeyDown}
        >
          {/* Search - show when there are sessions (>= 1) for filtering */}
          {sessions.length >= 1 && (
            <div className="px-3 py-2 border-b border-border/40">
              <TerminalSearchBar
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="filter sessions..."
              />
            </div>
          )}

          {/* Session list */}
          <div
            ref={listboxRef}
            id={listboxId}
            role="listbox"
            aria-label="Chat sessions"
            aria-activedescendant={focusedSessionId ? getOptionId(focusedSessionId) : undefined}
            className="flex-1 overflow-y-auto min-h-0"
          >
            {loading ? (
              <div className="px-3 py-4 text-center text-muted-foreground text-xs font-mono">
                Loading sessions...
              </div>
            ) : filteredSessions.length === 0 ? (
              <div className="px-3 py-4 text-center text-muted-foreground text-xs font-mono">
                {searchQuery ? '// NO_MATCHES' : '// NO_SESSIONS'}
              </div>
            ) : (
              <div className="flex flex-col">
                {paginatedSessions.map((session) => (
                  <SessionOption
                    key={session.id}
                    session={session}
                    isSelected={session.id === currentSessionId}
                    isFocused={session.id === focusedSessionId}
                    isProcessing={processingSessions.has(session.id)}
                    optionId={getOptionId(session.id)}
                    onSelect={() => handleSelect(session.id)}
                    onRename={(newName) => handleRename(session.id, newName)}
                    onDelete={() => handleDelete(session.id)}
                    ref={(el) => setOptionRef(session.id, el)}
                  />
                ))}
                {showLoadMore && (
                  <button
                    onClick={handleLoadMore}
                    className="px-3 py-2 text-center text-xs font-mono text-primary hover:bg-muted/50 transition-colors"
                  >
                    Load more...
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Footer: New Chat */}
          {onNewChat && (
            <div className="flex-shrink-0 px-3 py-2 border-t border-border/40 flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setOpen(false); onNewChat(); }}
                className="flex-1 h-8 px-3 font-mono text-xs uppercase"
                title="Create new chat session"
              >
                <Plus className="w-3 h-3 mr-1" />
                NEW_CHAT
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * SessionOption - Accessible option within the session listbox
 */
interface SessionOptionProps {
  session: SessionListItem;
  isSelected: boolean;
  isFocused: boolean;
  isProcessing: boolean;
  optionId: string;
  onSelect: () => void;
  onRename: (newName: string) => void;
  onDelete: () => void;
}

const SessionOption = React.forwardRef<HTMLDivElement, SessionOptionProps>(
  function SessionOption(
    { session, isSelected, isFocused, isProcessing, optionId, onSelect, onRename, onDelete },
    ref
  ) {
    const [isEditing, setIsEditing] = React.useState(false);
    const [editName, setEditName] = React.useState(session.name);
    const [isHovered, setIsHovered] = React.useState(false);
    const [showConfirmDelete, setShowConfirmDelete] = React.useState(false);

    // Status Tag Logic
    let statusTag = "IDLE";
    let statusColor = "text-muted-foreground";

    const showProcessingSpinner = isProcessing;

    if (isSelected) {
      statusTag = isProcessing ? "WORKING" : "ACTIVE";
      statusColor = isProcessing ? "text-progress" : "text-primary";
    } else if (isProcessing) {
      statusTag = "BUSY";
      statusColor = "text-progress";
    } else if (session.hasUnread) {
      statusTag = "UNREAD";
      statusColor = "text-primary font-bold";
    }

    // Session Type Indicator
    const isAgentSession = session.sessionType === 'agent';
    const showTypeIndicator = isAgentSession;

    const handleStartRename = (e: React.MouseEvent) => {
      e.stopPropagation();
      setIsEditing(true);
      setEditName(session.name || '');
    };

    const handleSaveRename = () => {
      if (editName.trim() && editName !== session.name) {
        onRename(editName.trim());
      }
      setIsEditing(false);
    };

    const handleInputKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleSaveRename();
      if (e.key === 'Escape') setIsEditing(false);
      // Prevent listbox navigation while editing
      e.stopPropagation();
    };

    const handleDeleteClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      setShowConfirmDelete(true);
    };

    const handleConfirmDelete = (e: React.MouseEvent) => {
      e.stopPropagation();
      onDelete();
      setShowConfirmDelete(false);
    };

    const handleOptionKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onSelect();
      }
    };

    return (
      <div
        ref={ref}
        id={optionId}
        role="option"
        aria-selected={isSelected}
        tabIndex={isFocused ? 0 : -1}
        className={cn(
          "group flex items-center gap-3 px-3 py-1.5 cursor-pointer font-mono text-xs transition-colors border-l-2 outline-none",
          isSelected ? "bg-muted border-primary" : "border-transparent hover:bg-muted/50",
          isFocused && "ring-1 ring-inset ring-primary"
        )}
        onClick={onSelect}
        onKeyDown={handleOptionKeyDown}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Type + Status Tags: Fixed width for alignment */}
        <div className="flex items-center gap-1 shrink-0">
          {showTypeIndicator && (
            <span className="text-[10px] font-bold text-blue-500">
              [AGENT]
            </span>
          )}
          <span className={cn("font-bold flex items-center gap-1", statusColor)}>
            {showProcessingSpinner && (
              <Loader2 className="w-3 h-3 animate-spin text-progress flex-shrink-0" />
            )}
            <span className="w-[4.5rem]">[{statusTag}]</span>
          </span>
        </div>

        {/* Name / Edit Input */}
        <div className="flex-1 min-w-0 truncate">
          {isEditing ? (
            <input
              autoFocus
              className="w-full bg-background border border-primary px-1 outline-none text-foreground"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={handleSaveRename}
              onKeyDown={handleInputKeyDown}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className={cn(isSelected ? "text-foreground font-bold" : "text-muted-foreground group-hover:text-foreground")}>
              {session.name || 'Untitled Session'}
            </span>
          )}
        </div>

        {/* Meta / Actions */}
        {(isHovered || isSelected || showConfirmDelete || isFocused) && (
          <div className="flex items-center gap-2 shrink-0">
            {showConfirmDelete ? (
              <div className="flex items-center gap-2 bg-destructive/10 px-1">
                <span className="text-destructive font-bold">DELETE?</span>
                <button onClick={handleConfirmDelete} className="hover:text-destructive" aria-label="Confirm delete"><Check className="w-3 h-3" /></button>
                <button onClick={(e) => { e.stopPropagation(); setShowConfirmDelete(false); }} className="hover:text-foreground" aria-label="Cancel delete"><X className="w-3 h-3" /></button>
              </div>
            ) : (
              <>
                {formatCost(session.totalCost) && (
                  <span className="text-muted-foreground/70 hidden sm:inline-flex items-center gap-0.5">
                    <DollarSign className="w-3 h-3" />
                    {formatCost(session.totalCost, { showDollarSign: false })}
                  </span>
                )}
                <span className="text-muted-foreground/50 hidden sm:inline-block">
                  {formatRelativeTime(session.lastMessageAt)}
                </span>
                {!isEditing && (
                  <>
                    <button onClick={handleStartRename} className="text-muted-foreground hover:text-primary opacity-50 hover:opacity-100 px-1" aria-label="Rename session">
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button onClick={handleDeleteClick} className="text-muted-foreground hover:text-destructive opacity-50 hover:opacity-100 px-1" aria-label="Delete session">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>
    );
  }
);
