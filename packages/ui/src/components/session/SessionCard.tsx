/**
 * SessionRow - Terminal-style list item for sessions
 * 
 * Design: CLI-style dense row
 * - [STATUS] Name ... LastActivity
 * - Monospace typography
 * - No padding/margin excess
 * - Hover state: Terminal cursor/inverse block
 */

import React, { useState } from 'react';
import { Pencil, Trash2, Check, X, Loader2, DollarSign } from 'lucide-react';
import { formatRelativeTime, formatCost, cn } from '../../lib/utils';
import type { SessionType } from '@capybara-chat/types';

export interface SessionListItem {
  id: string;
  name: string;
  lastMessageAt: number;
  createdAt?: number;
  lastMessagePreview: string;
  messageCount: number;
  hidden?: boolean;
  contentSnippet?: string;
  hasUnread?: boolean;
  isProcessing?: boolean;
  /** Session type - used to show type indicator for task/agent sessions */
  sessionType?: SessionType;
  /** Total API cost in USD */
  totalCost?: number;
}

interface SessionCardProps {
  session: SessionListItem;
  isActive: boolean;
  isDeleting?: boolean;
  /** Keyboard navigation highlight (different from active) */
  isKeyboardHighlighted?: boolean;
  onSelect: () => void;
  onRename?: (newName: string) => void;
  onDelete?: () => void;
}

export const SessionCard = React.memo(
  function SessionCard({ session, isActive, isDeleting, isKeyboardHighlighted, onSelect, onRename, onDelete }: SessionCardProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState(session.name);
    const [isHovered, setIsHovered] = useState(false);
    const [showConfirmDelete, setShowConfirmDelete] = useState(false);

    // Status Tag Logic: [ACTIVE], [IDLE], [READ], [NEW]
    let statusTag = "IDLE";
    let statusColor = "text-muted-foreground";

    // Processing takes visual priority with spinner
    const showProcessingSpinner = session.isProcessing;

    if (isActive) {
      statusTag = session.isProcessing ? "WORKING" : "ACTIVE";
      statusColor = session.isProcessing ? "text-progress" : "text-primary";
    } else if (session.isProcessing) {
      statusTag = "BUSY";
      statusColor = "text-progress"; // Use progress color for active processing
    } else if (session.hasUnread) {
      statusTag = "UNREAD";
      statusColor = "text-primary font-bold";
    }

    // Session Type Indicator: [AGENT] or [TASK] for long-running sessions
    // Assistant sessions (assistant:*, undefined) show no type indicator
    const isAgentSession = session.sessionType === 'agent';
    const isTaskSession = session.sessionType === 'task';
    const showTypeIndicator = isAgentSession || isTaskSession;
    const typeTag = isAgentSession ? 'AGENT' : 'TASK';

    const handleStartRename = (e: React.MouseEvent) => {
      e.stopPropagation();
      setIsEditing(true);
      setEditName(session.name || '');
    };

    const handleSaveRename = () => {
      if (editName.trim() && editName !== session.name) {
        onRename?.(editName.trim());
      }
      setIsEditing(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleSaveRename();
      if (e.key === 'Escape') setIsEditing(false);
    };

    const handleDeleteClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      setShowConfirmDelete(true);
    };

    const handleConfirmDelete = (e: React.MouseEvent) => {
      e.stopPropagation();
      onDelete?.();
      setShowConfirmDelete(false);
    };

    return (
      <div
        className={cn(
          "group flex items-center gap-3 px-3 py-1.5 cursor-pointer font-mono text-xs transition-colors border-l-2",
          isActive ? "bg-muted border-primary" : "border-transparent hover:bg-muted/50",
          isKeyboardHighlighted && !isActive && "bg-primary/5 border-primary/50",
          isDeleting && "opacity-50 pointer-events-none"
        )}
        onClick={onSelect}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Type + Status Tags: Fixed width for alignment */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Type indicator for long-running sessions (agent or task) */}
          {showTypeIndicator && (
            <span className={cn(
              "text-[10px] font-bold",
              isAgentSession ? "text-blue-500" : "text-purple-600"
            )}>
              [{typeTag}]
            </span>
          )}
          {/* Status tag with spinner for processing */}
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
              onKeyDown={handleKeyDown}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className={cn(isActive ? "text-foreground font-bold" : "text-muted-foreground group-hover:text-foreground")}>
              {session.name || 'Untitled Session'}
            </span>
          )}
        </div>

        {/* Meta / Actions (Visible on hover or active) */}
        {(isHovered || isActive || showConfirmDelete) && (
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
  },
  // Custom memo comparison
  (prev, next) =>
    prev.session.id === next.session.id &&
    prev.session.name === next.session.name &&
    prev.session.lastMessageAt === next.session.lastMessageAt &&
    prev.session.hasUnread === next.session.hasUnread &&
    prev.session.isProcessing === next.session.isProcessing &&
    prev.session.sessionType === next.session.sessionType &&
    prev.session.totalCost === next.session.totalCost &&
    prev.isActive === next.isActive &&
    prev.isDeleting === next.isDeleting &&
    prev.isKeyboardHighlighted === next.isKeyboardHighlighted
);
