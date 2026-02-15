/**
 * SessionsManager - Browse and manage all sessions
 *
 * Uses TerminalLibraryLayout for consistent terminal aesthetic
 * with status filters in the collapsible sidebar.
 * Shows message count, memory count, and output count for each session.
 */

import { useCallback } from 'react';
import { GitBranch, MessageSquare, Brain, Layers } from 'lucide-react';
import { api } from '../../lib/api';
import { createLogger } from '../../lib/logger';
import type { Session } from '@capybara-chat/types';
import { SERVER_DEFAULTS, API_PATHS, sessionPath } from '@capybara-chat/types';
import { Button, Badge, TerminalRow } from '../ui';
import { TerminalLibraryLayout, FilterOption } from '../library';
import { useFetchList, prependItem } from '../../hooks/useFetchList';
import { getSessionStatusVariant } from '../../lib/badge-variants';
import { truncateId, formatDateTime } from '../../lib/utils';

/** Extended session with enriched counts from server */
interface EnrichedSession extends Session {
  messageCount?: number;
  memoryCount?: number;
  entityCount?: number;
  agentName?: string;
}

const log = createLogger('SessionsManager');

interface SessionsManagerProps {
  serverUrl?: string;
  onSessionSelect?: (session: Session) => void;
}

export function SessionsManager({
  serverUrl = SERVER_DEFAULTS.SERVER_URL,
  onSessionSelect
}: SessionsManagerProps) {
  const { items: sessions, loading, setItems: setSessions } = useFetchList<EnrichedSession>({
    url: `${serverUrl}${API_PATHS.SESSIONS}`,
    dataKey: 'sessions',
  });

  const handleFork = async (sessionId: string) => {
    try {
      const res = await api.post(`${serverUrl}${sessionPath(sessionId, 'fork')}`);
      if (res.ok) {
        const forked = await res.json();
        prependItem(setSessions, forked);
      }
    } catch (err) {
      log.error('Failed to fork session', { error: err });
    }
  };

  // Extract filter options from session statuses
  const getFilterOptions = useCallback((sessions: EnrichedSession[]): FilterOption[] => {
    const statusCounts = new Map<string, number>();
    sessions.forEach(session => {
      const status = session.status || 'UNKNOWN';
      statusCounts.set(status, (statusCounts.get(status) || 0) + 1);
    });

    // Define order for statuses
    const statusOrder = ['RUNNING', 'PENDING', 'PAUSED', 'WAITING_HUMAN', 'WAITING_FOR_PR', 'COMPLETE', 'FAILED'];

    return statusOrder
      .filter(status => statusCounts.has(status))
      .map(status => ({
        value: status,
        label: status.toLowerCase().replace('_', '-'),
        count: statusCounts.get(status) || 0
      }));
  }, []);

  // Filter function supporting multi-select statuses
  const filterFn = useCallback((session: EnrichedSession, query: string, activeFilters: Set<string>): boolean => {
    const lowerQuery = query.toLowerCase();
    const matchesQuery = !query ||
      session.id?.toLowerCase().includes(lowerQuery) ||
      session.name?.toLowerCase().includes(lowerQuery) ||
      session.specId?.toLowerCase().includes(lowerQuery) ||
      session.agentName?.toLowerCase().includes(lowerQuery);

    const matchesFilters = activeFilters.size === 0 ||
      activeFilters.has(session.status);

    return Boolean(matchesQuery && matchesFilters);
  }, []);

  return (
    <TerminalLibraryLayout<EnrichedSession>
      items={sessions}
      loading={loading}
      commandPrefix="ps -ef | grep"
      searchPlaceholder="session_filter..."
      getFilterOptions={getFilterOptions}
      filterFn={filterFn}
      sidebarTitle="STATUS"
      newButtonLabel="spawn"
      loadingMessage="Loading sessions..."
      emptyMessage="No sessions found."
      emptyActionLabel="sessions are created from specs"
      renderItem={(session) => (
        <TerminalRow
          key={session.id}
          onClick={() => onSessionSelect?.(session)}
          title={
            <span className="flex items-center gap-2">
              <span className="font-mono text-xs font-semibold text-primary/80">
                {truncateId(session.id)}
              </span>
              <Badge {...getSessionStatusVariant(session.status)} size="sm">
                {session.status}
              </Badge>
              {session.forkedFromId && (
                <span className="flex items-center gap-0.5 text-2xs text-muted-foreground/60">
                  <GitBranch className="w-2.5 h-2.5" /> fork
                </span>
              )}
            </span>
          }
          date={formatDateTime(session.startedAt)}
          meta={
            <span className="flex items-center gap-3 text-muted-foreground/70">
              {session.specId && (
                <span>spec:{truncateId(session.specId)}</span>
              )}
              {session.agentName && (
                <span className="text-primary/60">{session.agentName}</span>
              )}
            </span>
          }
          actions={
            session.status === 'COMPLETE' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleFork(session.id);
                }}
                className="h-6 text-xs text-muted-foreground hover:text-primary rounded-none"
              >
                <GitBranch className="w-3 h-3 mr-1" /> fork
              </Button>
            )
          }
        >
          {/* Session name */}
          {session.name && (
            <p className="text-foreground/70 truncate">{session.name}</p>
          )}
          {/* Stats row */}
          <div className="flex items-center gap-4 mt-1 text-2xs text-muted-foreground/60">
            {session.messageCount !== undefined && session.messageCount > 0 && (
              <span className="flex items-center gap-1">
                <MessageSquare className="w-3 h-3" />
                <span>{session.messageCount} msgs</span>
              </span>
            )}
            {session.memoryCount !== undefined && session.memoryCount > 0 && (
              <span className="flex items-center gap-1">
                <Brain className="w-3 h-3" />
                <span>{session.memoryCount} memories</span>
              </span>
            )}
            {session.entityCount !== undefined && session.entityCount > 0 && (
              <span className="flex items-center gap-1">
                <Layers className="w-3 h-3" />
                <span>{session.entityCount} output</span>
              </span>
            )}
            {session.totalCost !== undefined && session.totalCost > 0 && (
              <span className="text-muted-foreground/40">
                ${session.totalCost.toFixed(4)}
              </span>
            )}
          </div>
        </TerminalRow>
      )}
    />
  );
}
