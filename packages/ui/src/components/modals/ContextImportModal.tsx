/**
 * ContextImportModal - Import context from previous editing sessions
 *
 * Wide discovery modal with filtering and preview for importing
 * conversation history into entity-editing sessions.
 */

import { useState, useMemo } from 'react';
import { Search, FileText, MessageSquare, Filter, ArrowRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { Session } from '@capybara-chat/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '../ui/Dialog';

export interface ContextImportModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Called when the modal should close */
  onClose: () => void;
  /** Available sessions to import from */
  sessions: Session[];
  /** Called when sessions are selected for import */
  onImport: (sessionIds: string[]) => void;
  /** Current entity being edited */
  entityType: string;
  entityId: string;
}

type FilterType = 'all' | 'same-entity' | 'recent';

/**
 * Context Import Modal
 */
export function ContextImportModal({
  open,
  onClose,
  sessions,
  onImport,
  entityType,
  entityId,
}: ContextImportModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [previewSession, setPreviewSession] = useState<Session | null>(null);

  // Filter sessions based on search and filter type
  const filteredSessions = useMemo(() => {
    let result = sessions;

    // Apply filter type
    if (filterType === 'same-entity') {
      result = result.filter(
        (s) => s.editingEntityType === entityType && s.editingEntityId === entityId
      );
    } else if (filterType === 'recent') {
      const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      result = result.filter((s) => s.lastActivityAt > oneWeekAgo);
    }

    // Apply search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.name?.toLowerCase().includes(query) ||
          s.id.toLowerCase().includes(query)
      );
    }

    // Sort by most recent first
    return result.sort((a, b) => b.lastActivityAt - a.lastActivityAt);
  }, [sessions, filterType, searchQuery, entityType, entityId]);

  // Toggle session selection
  const toggleSelection = (sessionId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(sessionId)) {
        next.delete(sessionId);
      } else {
        next.add(sessionId);
      }
      return next;
    });
  };

  // Handle import action
  const handleImport = () => {
    onImport(Array.from(selectedIds));
    onClose();
  };

  if (!open) return null;

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogContent className="max-w-5xl h-[80vh] p-0 flex flex-col">
        <DialogHeader onClose={onClose}>
          <DialogTitle className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-warning" />
            <span className="uppercase tracking-wide">IMPORT_CONTEXT</span>
          </DialogTitle>
        </DialogHeader>

        {/* Search and Filter Bar */}
        <div className="flex items-center gap-4 px-6 py-3 border-b border-border bg-muted/20 shrink-0">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search sessions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-none text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary font-mono"
            />
          </div>

          {/* Filter Dropdown */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as FilterType)}
              className="bg-background border border-border rounded-none px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary font-mono cursor-pointer hover:border-foreground transition-colors"
            >
              <option value="all">All Sessions</option>
              <option value="same-entity">Same Entity</option>
              <option value="recent">Last 7 Days</option>
            </select>
          </div>
        </div>

        {/* Content Area */}
        <DialogBody className="flex-1 flex overflow-hidden p-0">
          {/* Session List */}
          <div className="w-1/2 border-r border-border overflow-y-auto">
            {filteredSessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <MessageSquare className="w-8 h-8 mb-2 opacity-50" />
                <p className="text-sm font-mono uppercase tracking-wide">No sessions found</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filteredSessions.map((session) => (
                  <div
                    key={session.id}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors group',
                      selectedIds.has(session.id)
                        ? 'bg-primary/5'
                        : 'hover:bg-muted/50',
                      previewSession?.id === session.id && 'bg-muted'
                    )}
                    onClick={() => setPreviewSession(session)}
                  >
                    {/* Selection Checkbox */}
                    <input
                      type="checkbox"
                      checked={selectedIds.has(session.id)}
                      onChange={() => toggleSelection(session.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-4 h-4 rounded-none border-border bg-background text-primary focus:ring-primary/20 cursor-pointer"
                    />

                    {/* Session Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                          {session.name || `Session ${session.id.slice(0, 8)}`}
                        </span>
                        {session.editingEntityType && (
                          <span className="px-1.5 py-0.5 text-2xs bg-muted text-muted-foreground rounded-none uppercase font-mono border border-border">
                            {session.editingEntityType}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 font-mono">
                        {new Date(session.lastActivityAt).toLocaleDateString()}
                      </div>
                    </div>

                    {/* Arrow */}
                    <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Preview Panel */}
          <div className="w-1/2 overflow-y-auto bg-muted/10">
            {previewSession ? (
              <div className="p-6">
                <h3 className="text-sm font-bold uppercase tracking-wider text-foreground mb-4 border-b border-border pb-2">
                  Preview: {previewSession.name || previewSession.id.slice(0, 8)}
                </h3>
                <div className="space-y-3 font-mono">
                  <div className="text-xs text-muted-foreground">
                    <span className="text-foreground/70 mr-2">TYPE:</span>
                    {previewSession.sessionType}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <span className="text-foreground/70 mr-2">STATUS:</span>
                    {previewSession.status}
                  </div>
                  {previewSession.editingEntityType && (
                    <div className="text-xs text-muted-foreground">
                      <span className="text-foreground/70 mr-2">EDITING:</span>
                      {previewSession.editingEntityType}:{previewSession.editingEntityId}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground mt-6 p-4 bg-background border border-border border-dashed">
                    Context summary will be generated from session messages during import.
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <MessageSquare className="w-8 h-8 mb-2 opacity-50" />
                <p className="text-sm font-mono uppercase tracking-wide">Select to preview</p>
              </div>
            )}
          </div>
        </DialogBody>

        <DialogFooter className="justify-between bg-muted/20 border-t border-border">
          <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
            {selectedIds.size} session{selectedIds.size !== 1 ? 's' : ''} selected
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={selectedIds.size === 0}
              className={cn(
                'px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all border border-transparent hover:border-border',
                selectedIds.size > 0
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                  : 'bg-muted text-muted-foreground cursor-not-allowed'
              )}
            >
              Import Context
            </button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
