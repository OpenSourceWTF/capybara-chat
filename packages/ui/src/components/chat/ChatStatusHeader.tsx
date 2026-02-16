/**
 * ChatStatusHeader - Vim-style status line for chat interface
 *
 * UI Refresh: Redesigned from a cluttered footer into a compact, single-line
 * status bar inspired by vim/neovim status lines. Information is segmented
 * into logical groups with clear visual hierarchy.
 *
 * Layout: [MODE] session_id | claude_id | editing | cost   [brain] [settings]
 *
 * Displays persistent session information:
 * - Mode indicator (primary color block like vim mode)
 * - Session IDs (server + Claude) - click to copy
 * - Editing context indicator
 * - Running total cost
 * - Settings button
 * - Context reset notifications
 */

import { Copy, Check, Settings, Info, X, DollarSign, Brain } from 'lucide-react';
import { cn } from '../../lib/utils';
import { truncateId } from '../../lib/utils';
import type { SessionContextResetData } from '../../hooks/useSessionSocketEvents';

export interface EditingContextInfo {
  entityType: string;
  entityId?: string;
}

export interface ChatStatusHeaderProps {
  /** Server session ID */
  sessionId: string;
  /** Claude/SDK session ID (optional) */
  claudeSessionId?: string | null;
  /** Entity being edited (optional) */
  editingContext?: EditingContextInfo | null;
  /** Running total API cost for session (from database) */
  totalCost?: number;
  /** Loading state */
  loading?: boolean;
  /** Context reset notification */
  contextReset?: SessionContextResetData | null;
  /** Copy handlers */
  onCopySessionId?: () => void;
  onCopyClaudeId?: () => void;
  /** Which ID was just copied (for visual feedback) */
  copiedId?: 'session' | 'claude' | null;
  /** Settings button handler */
  onOpenSettings?: () => void;
  /** Dismiss context reset */
  onDismissContextReset?: () => void;
  /** View session activity handler - navigates to session detail view (124-agent-memory-system) */
  onViewSession?: () => void;
  /** Total activity count (memories + created entities) for badge display */
  activityCount?: number;
  className?: string;
}

/**
 * Format cost as USD
 */
function formatCost(cost: number): string {
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  if (cost < 1) return `$${cost.toFixed(3)}`;
  return `$${cost.toFixed(2)}`;
}

/**
 * Get mode label based on session context
 */
function getModeLabel(editingContext?: EditingContextInfo | null): string {
  if (editingContext) return 'EDIT';
  return 'CHAT';
}

export function ChatStatusHeader({
  sessionId,
  claudeSessionId,
  editingContext,
  totalCost = 0,
  loading = false,
  contextReset,
  onCopySessionId,
  onCopyClaudeId,
  copiedId,
  onOpenSettings,
  onDismissContextReset,
  onViewSession,
  activityCount = 0,
  className,
}: ChatStatusHeaderProps) {
  const modeLabel = getModeLabel(editingContext);

  return (
    <footer className={cn('flex-shrink-0 flex flex-col', className)}>
      {/* Context reset notification (above status line when present) */}
      {contextReset && (
        <div className="h-6 px-3 flex items-center gap-3 border-t border-border/50 bg-sky-500/5 text-xs font-mono">
          <span className="text-2xs text-sky-600 uppercase tracking-wider flex items-center gap-1 font-bold">
            <Info className="w-3 h-3" />
            [CONTEXT RESET]
          </span>
          <span className="text-2xs text-muted-foreground truncate flex-1" title={contextReset.reason}>
            {contextReset.reason}
          </span>
          {onDismissContextReset && (
            <button
              onClick={onDismissContextReset}
              className="text-muted-foreground/40 hover:text-foreground p-0.5 transition-colors"
              title="Dismiss"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      )}

      {/* Status line - vim-style */}
      <div className="chat-status-line">
        {/* Mode indicator - colored block */}
        <div className={cn(
          'chat-status-line-primary',
          editingContext ? 'bg-progress text-white' : ''
        )}>
          {modeLabel}
        </div>

        {/* Session ID - click to copy */}
        <button
          onClick={onCopySessionId}
          className="chat-status-line-segment hover:text-foreground transition-colors group cursor-pointer"
          title={`Click to copy: ${sessionId}`}
        >
          {truncateId(sessionId)}
          {copiedId === 'session' ? (
            <Check className="w-2.5 h-2.5 text-success" />
          ) : (
            <Copy className="w-2.5 h-2.5 opacity-0 group-hover:opacity-60 transition-opacity" />
          )}
        </button>

        {/* Claude session ID */}
        {claudeSessionId && (
          <button
            onClick={onCopyClaudeId}
            className="chat-status-line-segment hover:text-foreground transition-colors group cursor-pointer"
            title={`Claude: ${claudeSessionId}`}
          >
            <span className="opacity-40">claude:</span>{truncateId(claudeSessionId)}
            {copiedId === 'claude' ? (
              <Check className="w-2.5 h-2.5 text-success" />
            ) : (
              <Copy className="w-2.5 h-2.5 opacity-0 group-hover:opacity-60 transition-opacity" />
            )}
          </button>
        )}

        {/* Editing context */}
        {editingContext && (
          <span
            className="chat-status-line-segment text-progress"
            title={`Editing ${editingContext.entityType}: ${editingContext.entityId || 'new'}`}
          >
            <span className="w-1.5 h-1.5 bg-progress animate-pulse flex-shrink-0" />
            {editingContext.entityType}
          </span>
        )}

        {/* Loading indicator */}
        {loading && (
          <span className="chat-status-line-segment text-progress animate-pulse">loading...</span>
        )}

        {/* Spacer */}
        <div className="chat-status-line-spacer" />

        {/* Cost */}
        {totalCost > 0 && (
          <span className="chat-status-line-segment opacity-60" title="Session total cost">
            <DollarSign className="w-2.5 h-2.5" />
            {formatCost(totalCost)}
          </span>
        )}

        {/* Action buttons */}
        {onViewSession && (
          <button
            onClick={onViewSession}
            className="chat-status-line-segment hover:text-foreground transition-colors relative cursor-pointer"
            title="View session activity (memories, created entities)"
            aria-label={`View session activity${activityCount > 0 ? ` (${activityCount} items)` : ''}`}
          >
            <Brain className="w-3 h-3" />
            {activityCount > 0 && (
              <span className="text-primary font-bold">{activityCount}</span>
            )}
          </button>
        )}
        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            className="chat-status-line-segment hover:text-foreground transition-colors cursor-pointer"
            title="Terminal Config"
            aria-label="Open terminal configuration"
          >
            <Settings className="w-3 h-3" />
          </button>
        )}
      </div>
    </footer>
  );
}
