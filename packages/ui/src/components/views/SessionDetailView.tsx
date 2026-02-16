/**
 * SessionDetailView - Full session activity view
 *
 * Displays comprehensive session information in the left content pane:
 * - Session metadata (name, timestamps, cost)
 * - Memories created by the agent
 * - Entities created during the session (docs, prompts, agents, etc.)
 * - Visual timeline graph of all session activity
 *
 * Follows "Cozy Terminal" design: monospace, warm colors, zero radius
 */

import { useCallback, useState } from 'react';
import { ArrowLeft, Clock, DollarSign, MessageSquare } from 'lucide-react';
import { SessionActivityPanel } from '../session/SessionActivityPanel';
import { Button, CopyableId } from '../ui';
import { formatRelativeTime } from '../../lib/utils';
import { useSessionMemories } from '../../hooks/useSessionMemories';
import { useSessionCreatedEntities, type SessionCreatedEntity } from '../../hooks/useSessionCreatedEntities';
import { useFetch } from '../../hooks/useFetch';
import type { Session } from '@capybara-chat/types';
import type { TimelineItem } from '../../hooks/useSessionMessages';

export interface SessionDetailViewProps {
  sessionId: string;
  serverUrl: string;
  onBack?: () => void;
  /** Navigate to an entity created by this session */
  onEntityNavigate?: (entityType: SessionCreatedEntity['entityType'], entityId: string) => void;
}

export function SessionDetailView({
  sessionId,
  serverUrl,
  onBack,
  onEntityNavigate,
}: SessionDetailViewProps) {
  const [memorySearchQuery, setMemorySearchQuery] = useState('');

  // Fetch session details
  const { data: session, loading: sessionLoading } = useFetch<Session>(
    `${serverUrl}/api/sessions/${sessionId}`
  );

  // Fetch session memories
  const {
    memories,
    loading: memoriesLoading,
    error: memoriesError,
    total: memoryCount,
  } = useSessionMemories(sessionId, { search: memorySearchQuery });

  // Fetch created entities
  const {
    entities,
    loading: entitiesLoading,
    error: entitiesError,
    counts: entityCounts,
  } = useSessionCreatedEntities(sessionId);

  // Fetch session timeline (messages, tool uses, events)
  const { data: timelineData, loading: timelineLoading } = useFetch<{ timeline: TimelineItem[] }>(
    `${serverUrl}/api/sessions/${sessionId}/timeline`
  );

  // Handle entity click - navigate to the entity
  const handleEntityClick = useCallback((entity: SessionCreatedEntity) => {
    onEntityNavigate?.(entity.entityType, entity.id);
  }, [onEntityNavigate]);

  if (sessionLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="font-mono text-sm text-muted-foreground animate-pulse">
          [LOADING SESSION...]
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4">
        <div className="font-mono text-sm text-muted-foreground">
          [SESSION NOT FOUND]
        </div>
        {onBack && (
          <Button variant="ghost" size="sm" onClick={onBack} className="h-7 px-2">
            <ArrowLeft className="w-4 h-4 mr-1" />
            <span className="text-xs">Back</span>
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header Bar - Matches TaskDetailView pattern */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/10">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button variant="ghost" size="sm" onClick={onBack} className="h-7 px-2 -ml-2">
              <ArrowLeft className="w-4 h-4 mr-1" />
              <span className="text-xs">Back</span>
            </Button>
          )}
          <div className="w-px h-4 bg-border" />
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            SESSION_DETAIL
          </span>
        </div>
      </div>

      {/* Session Identity */}
      <header className="flex-shrink-0 border-b border-border bg-card px-4 py-3">
        <div className="flex-1 min-w-0">
          <h1 className="font-mono text-lg font-bold truncate">
            {session.name || 'Unnamed Session'}
          </h1>
          <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground mt-1">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatRelativeTime(session.startedAt)}
            </span>
            {(session.author || session.createdBy) && (
              <span className="flex items-center gap-1">
                <span className="opacity-50">by</span>
                <span className="font-semibold text-foreground/80">
                  {session.author ? session.author.name : `@${session.createdBy}`}
                </span>
              </span>
            )}
            {session.totalCost !== undefined && session.totalCost > 0 && (
              <span className="flex items-center gap-1">
                <DollarSign className="w-3 h-3" />
                ${session.totalCost.toFixed(4)}
              </span>
            )}
            <span className="flex items-center gap-1">
              <MessageSquare className="w-3 h-3" />
              {(session as Session & { messageCount?: number }).messageCount || 0} messages
            </span>
          </div>
        </div>

        {/* Session ID badge */}
        <div className="flex items-center gap-2 mt-3 text-2xs font-mono text-muted-foreground/60">
          <CopyableId id={sessionId} label="SESSION:" />
          {session.claudeSessionId && (
            <>
              <span className="mx-1">|</span>
              <CopyableId id={session.claudeSessionId} label="CLAUDE:" showEllipsis />
            </>
          )}
        </div>
      </header>

      {/* Activity Panel - fills remaining space */}
      <main className="flex-1 min-h-0 overflow-hidden">
        <SessionActivityPanel
          sessionId={sessionId}
          memories={memories}
          memoriesLoading={memoriesLoading}
          memoriesError={memoriesError}
          memoryCount={memoryCount}
          memorySearchQuery={memorySearchQuery}
          onMemorySearchChange={setMemorySearchQuery}
          entities={entities}
          entitiesLoading={entitiesLoading}
          entitiesError={entitiesError}
          entityCounts={entityCounts}
          timeline={timelineData?.timeline || []}
          timelineLoading={timelineLoading}
          onEntityClick={handleEntityClick}
        />
      </main>
    </div>
  );
}

export default SessionDetailView;
