/**
 * SpecDetail - View spec details with contextual actions
 *
 * Read-only view of a spec with:
 * - Formatted display (badges, dates, tags)
 * - Sessions list
 * - Worker tasks management
 * - Edit button opens EntityView (with MCP Forms support)
 */

import { useState, useEffect } from 'react';
import type { Spec, Session } from '@capybara-chat/types';
import { SERVER_DEFAULTS, API_PATHS, entityPath, EntityStatus, SessionStatus } from '@capybara-chat/types';
import { Button, Badge, LoadingSpinner, EmptyState, TagList, ContentPreview, Markdown } from '../ui';
import { ArrowLeft, Edit2, Play } from 'lucide-react';
import { useFetch } from '../../hooks/useFetch';
import { useFetchList } from '../../hooks/useFetchList';
import { usePost } from '../../hooks/useApiMutation';
import { getSpecStatusVariant } from '../../lib/badge-variants';
import { truncateId, formatDate } from '../../lib/utils';
import { WorkerTaskMonitor } from '../main/WorkerTaskMonitor';

interface SpecDetailProps {
  specId: string;
  workspaceId?: string;
  serverUrl?: string;
  onBack?: () => void;
  onSessionSelect?: (session: Session) => void;
  /** Opens the spec in EntityView with MCP Forms support */
  onEdit?: (specId: string) => void;
  /** Navigate to SpawnTaskPanel with this spec pre-selected */
  onCreateTask?: () => void;
}

export function SpecDetail({
  specId,
  workspaceId,
  serverUrl = SERVER_DEFAULTS.SERVER_URL,
  onBack,
  onSessionSelect,
  onEdit,
  onCreateTask,
}: SpecDetailProps) {
  const [localSessions, setLocalSessions] = useState<Session[]>([]);

  // Use centralized fetch hooks
  const { data: spec, loading } = useFetch<Spec>(
    `${serverUrl}${entityPath(API_PATHS.SPECS, specId)}`
  );
  const { items: fetchedSessions } = useFetchList<Session>({
    url: `${serverUrl}${entityPath(API_PATHS.SPECS, specId, 'sessions')}`,
    dataKey: 'sessions',
  });

  // Use centralized mutation hook for creating sessions
  const { post } = usePost<void, Session>(`${serverUrl}${entityPath(API_PATHS.SPECS, specId, 'run')}`);

  // Sync fetched sessions to local state
  useEffect(() => {
    setLocalSessions(fetchedSessions);
  }, [fetchedSessions]);

  const handleCreateSession = async () => {
    const session = await post();
    if (session) {
      setLocalSessions((prev) => [session, ...prev]);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading spec..." />;
  }

  if (!spec) {
    return (
      <EmptyState
        message="Spec not found"
        action={
          <Button variant="ghost" size="sm" onClick={onBack} className="h-7 px-2">
            <ArrowLeft className="w-4 h-4 mr-1" />
            <span className="text-xs">Back</span>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-20">
      {/* Header Bar - Consistent pattern with TYPE_LABEL */}
      <div className="flex items-center justify-between -mx-6 px-6 py-3 border-b border-border bg-muted/10 mb-8">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="h-7 px-2 -ml-2">
            <ArrowLeft className="w-4 h-4 mr-1" />
            <span className="text-xs">Back</span>
          </Button>
          <div className="w-px h-4 bg-border" />
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            SPEC_DETAIL
          </span>
        </div>
        <div className="flex items-center gap-2">
          {onEdit && (
            <Button variant="outline" size="sm" onClick={() => onEdit(specId)}>
              <Edit2 className="w-3.5 h-3.5 mr-2" /> Edit Spec
            </Button>
          )}
          {onCreateTask && (
            <Button size="sm" onClick={onCreateTask}>
              <Play className="w-3.5 h-3.5 mr-2" /> New Task
            </Button>
          )}
        </div>
      </div>

      {/* 2. Header & Inline Metadata */}
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">{spec.title}</h1>

        {/* Inline Metadata Row */}
        <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
          {/* Priority */}
          <span className="capitalize">{spec.priority}</span>

          <span className="opacity-30">•</span>
          <span className="font-mono text-xs">{formatDate(spec.updatedAt || spec.createdAt)}</span>

          {/* Status Badges */}
          {spec.workflowStatus !== 'DRAFT' && (
            <>
              <span className="opacity-30">•</span>
              <Badge {...getSpecStatusVariant(spec.workflowStatus)} size="sm">{spec.workflowStatus}</Badge>
            </>
          )}
          {spec.status === EntityStatus.DRAFT && (
            <>
              <span className="opacity-30">•</span>
              <Badge variant="soft" intent="neutral" size="sm">Draft</Badge>
            </>
          )}

          {/* Issue Link */}
          {spec.issueUrl && (
            <>
              <span className="opacity-30">•</span>
              <a
                href={spec.issueUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-primary transition-colors"
              >
                Issue #{spec.issueNumber}
              </a>
            </>
          )}

          {/* PR Link */}
          {spec.githubPrUrl && (
            <>
              <span className="opacity-30">•</span>
              <a
                href={spec.githubPrUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-primary transition-colors"
              >
                PR #{spec.githubPrNumber}
              </a>
            </>
          )}
        </div>

        {/* Tags */}
        {spec.tags.length > 0 && (
          <TagList tags={spec.tags} maxVisible={6} />
        )}
      </div>

      {/* 3. Content Area - Using unified ContentPreview with Markdown */}
      <ContentPreview filename="SPECIFICATION.md">
        {spec.content ? (
          <Markdown className="prose prose-sm max-w-none text-foreground/90">{spec.content}</Markdown>
        ) : (
          <span className="italic text-muted-foreground/50">No content</span>
        )}
      </ContentPreview>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* 4. Sessions - "Flight Log" Style */}
        <div className="md:col-span-2 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b">
            <h2 className="text-lg font-semibold tracking-tight">Session Log</h2>
            <Button size="sm" variant="secondary" onClick={handleCreateSession} className="h-7 text-xs">
              + New Session
            </Button>
          </div>

          <div className="space-y-0">
            {localSessions.length === 0 ? (
              <div className="py-12 text-center border-2 border-dashed">
                <p className="text-muted-foreground text-sm">No sessions yet</p>
                <Button variant="link" onClick={handleCreateSession}>Start the first session</Button>
              </div>
            ) : (
              <div className="relative pl-4 space-y-6 before:absolute before:left-[5px] before:top-2 before:bottom-0 before:w-px before:bg-border/50">
                {localSessions.map((session) => (
                  <button
                    key={session.id}
                    type="button"
                    className="relative group cursor-pointer text-left w-full"
                    onClick={() => onSessionSelect?.(session)}
                  >
                    <div className="absolute -left-[16px] top-1.5 w-2.5 h-2.5 bg-background border-2 border-primary ring-4 ring-background group-hover:scale-110 transition-transform" />
                    <div className="bg-card/50 hover:bg-card border border-transparent hover:border-border/60 p-3 transition-all duration-200">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono text-xs text-primary font-semibold">SESSION-{truncateId(session.id)}</span>
                        <span className="text-2xs text-muted-foreground uppercase tracking-widest">{formatDate(session.startedAt)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium opacity-90 group-hover:opacity-100">{session.name || "Untitled Session"}</div>
                        <Badge variant="soft" size="sm" intent={session.status === SessionStatus.RUNNING ? 'primary' : 'neutral'}>{session.status}</Badge>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 5. Tasks Sidebar */}
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-2 border-b">
            <h2 className="text-lg font-semibold tracking-tight">Tasks</h2>
          </div>
          {workspaceId ? (
            <WorkerTaskMonitor workspaceId={workspaceId} specId={specId} />
          ) : (
            <div className="text-sm text-muted-foreground p-4 bg-muted/20 border border-dashed text-center">
              No workspace context
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
