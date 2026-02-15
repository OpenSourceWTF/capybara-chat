/**
 * SpecView - Spec-specific wrapper for EntityView
 *
 * Adds spec-specific sections:
 * - Sessions timeline
 * - Worker tasks
 */

import { useState, useEffect, useMemo } from 'react';
import type { Spec, Session, WorkerTask } from '@capybara-chat/types';
import { SERVER_DEFAULTS, API_PATHS, entityPath, SessionStatus, SpecStatus, Priority } from '@capybara-chat/types';
import { EntityView } from '../entity/EntityView';
import { specSchema, type SpecFormData } from '../../schemas/spec-schema';
import { Button, Badge, Select, CopyableId } from '../ui';
import { Play, DollarSign } from 'lucide-react';
import { useFetchList } from '../../hooks/useFetchList';
import { usePost } from '../../hooks/useApiMutation';
import { getSpecStatusVariant } from '../../lib/badge-variants';
import { truncateId, formatCost } from '../../lib/utils';
import { formatLibraryTimestamp, formatFullTimestamp } from '../../lib/date-formatting';
import { SpecTasksSection } from './SpecTasksSection';
import { SpecWorkflowBar } from './SpecWorkflowBar';

interface SpecViewProps {
  specId: string;
  workspaceId?: string;
  serverUrl?: string;
  sessionId?: string;
  initialMode?: 'view' | 'edit';
  onBack?: () => void;
  onSessionSelect?: (session: Session) => void;
  /** Navigate to task detail view */
  onTaskSelect?: (task: WorkerTask) => void;
  /** Navigate to SpawnTaskPanel with this spec pre-selected */
  onCreateTask?: () => void;
  onSave?: (spec: Spec) => void;
  onClose?: () => void;
}

export function SpecView({
  specId,
  workspaceId,
  serverUrl = SERVER_DEFAULTS.SERVER_URL,
  sessionId,
  initialMode = 'view',
  onBack,
  onSessionSelect,
  onTaskSelect,
  onCreateTask,
  onSave,
  onClose,
}: SpecViewProps) {
  const [localSessions, setLocalSessions] = useState<Session[]>([]);

  // Fetch sessions for this spec (sessions that have worked on this spec)
  const { items: fetchedSessions } = useFetchList<Session>({
    url: specId ? `${serverUrl}${API_PATHS.SESSIONS}?specId=${specId}&limit=20` : '',
    dataKey: 'sessions',
  });

  // Create session mutation
  const { post: createSession } = usePost<void, Session>(
    `${serverUrl}${entityPath(API_PATHS.SPECS, specId, 'run')}`
  );

  // Sync sessions
  useEffect(() => {
    setLocalSessions(fetchedSessions);
  }, [fetchedSessions]);

  // Calculate total cost from all sessions
  const totalSessionCost = useMemo(() => {
    return localSessions.reduce((sum, session) => sum + (session.totalCost || 0), 0);
  }, [localSessions]);

  const handleCreateSession = async () => {
    const session = await createSession();
    if (session) {
      setLocalSessions((prev) => [session, ...prev]);
    }
  };

  return (
    <>
      <EntityView<Spec, SpecFormData>
        schema={specSchema}
        entityId={specId}
        serverUrl={serverUrl}
        sessionId={sessionId}
        apiPath={API_PATHS.SPECS}
        initialMode={initialMode}
        onBack={onBack}
        backLabel="Back to Specs"
        onSave={onSave}
        onClose={onClose}
        titleField="title"
        contentField="content"
        renderContentAsMarkdown={true}
        renderActions={(_spec, mode) =>
          mode === 'view' && onCreateTask ? (
            <Button size="sm" onClick={onCreateTask}>
              <Play className="w-3.5 h-3.5 mr-2" />
              New Task
            </Button>
          ) : null
        }
        renderMetadata={(spec) => (
          <>
            <CopyableId id={spec.id} />
            <span className="opacity-30">•</span>
            {(spec.author || spec.createdBy) && (
              <>
                <span className="text-muted-foreground">
                  {spec.author ? `By ${spec.author.name}` : `@${spec.createdBy}`}
                </span>
                <span className="opacity-30">•</span>
              </>
            )}
            <span className="capitalize">{spec.priority}</span>
            <span className="opacity-30">•</span>
            {spec.workflowStatus !== 'DRAFT' && (
              <>
                <Badge {...getSpecStatusVariant(spec.workflowStatus)} size="sm">
                  {spec.workflowStatus}
                </Badge>
                <span className="opacity-30">•</span>
              </>
            )}
            {spec.issueUrl && (
              <>
                <a
                  href={spec.issueUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-primary transition-colors"
                >
                  Issue #{spec.issueNumber}
                </a>
                <span className="opacity-30">•</span>
              </>
            )}
            {spec.githubPrUrl && (
              <>
                <a
                  href={spec.githubPrUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-primary transition-colors"
                >
                  PR #{spec.githubPrNumber}
                </a>
                <span className="opacity-30">•</span>
              </>
            )}
          </>
        )}
        renderEditFields={(formData, setField, disabled) => (
          <>
            <Select
              value={formData.priority}
              onChange={(e) => setField('priority', e.target.value as Priority)}
              disabled={disabled}
              className="h-7 text-xs w-24"
            >
              <option value={Priority.LOW}>Low</option>
              <option value={Priority.NORMAL}>Normal</option>
              <option value={Priority.HIGH}>High</option>
              <option value={Priority.CRITICAL}>Critical</option>
            </Select>
            <Select
              value={formData.workflowStatus}
              onChange={(e) => setField('workflowStatus', e.target.value as SpecStatus)}
              disabled={disabled}
              className="h-7 text-xs w-28"
            >
              <option value={SpecStatus.READY}>Ready</option>
              <option value={SpecStatus.IN_PROGRESS}>In Progress</option>
              <option value={SpecStatus.BLOCKED}>Blocked</option>
              <option value={SpecStatus.COMPLETE}>Complete</option>
              <option value={SpecStatus.ARCHIVED}>Archived</option>
            </Select>
          </>
        )}
        renderViewSections={(_spec) => (
          <>
            {/* Workflow status bar — shows latest task state + contextual actions */}
            <SpecWorkflowBar
              specId={specId}
              workspaceId={workspaceId}
              serverUrl={serverUrl}
              onTaskSelect={onTaskSelect}
              onCreateTask={() => onCreateTask?.()}
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-4">
              {/* Sessions */}
              <div className="md:col-span-2 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b">
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-semibold tracking-tight">Session Log</h2>
                    {formatCost(totalSessionCost) && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground font-mono">
                        <DollarSign className="w-3 h-3" />
                        {formatCost(totalSessionCost, { showDollarSign: false })}
                      </span>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={handleCreateSession}
                    className="h-7 text-xs"
                  >
                    + New Session
                  </Button>
                </div>

                {localSessions.length === 0 ? (
                  <div className="py-12 text-center border-2 border-dashed">
                    <p className="text-muted-foreground text-sm">No sessions yet</p>
                    <Button variant="link" onClick={handleCreateSession}>
                      Start the first session
                    </Button>
                  </div>
                ) : (
                  <div className="relative pl-4 space-y-6 before:absolute before:left-[5px] before:top-2 before:bottom-0 before:w-px before:bg-border/50">
                    {localSessions.map((session) => (
                      <div
                        key={session.id}
                        className="relative group cursor-pointer"
                        onClick={() => onSessionSelect?.(session)}
                      >
                        <div className="absolute -left-[16px] top-1.5 w-2.5 h-2.5 bg-background border-2 border-primary ring-4 ring-background group-hover:scale-110 transition-transform" />
                        <div className="bg-card/50 hover:bg-card border border-transparent hover:border-border/60 p-3 transition-all duration-200">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-mono text-xs text-primary font-semibold">
                              SESSION-{truncateId(session.id)}
                            </span>
                            <div className="flex items-center gap-2">
                              {formatCost(session.totalCost) && (
                                <span className="flex items-center gap-0.5 text-2xs text-muted-foreground font-mono">
                                  <DollarSign className="w-3 h-3" />
                                  {formatCost(session.totalCost, { showDollarSign: false })}
                                </span>
                              )}
                              <span
                                className="text-2xs text-muted-foreground uppercase tracking-widest"
                                title={formatFullTimestamp(session.startedAt)}
                              >
                                {formatLibraryTimestamp(session.startedAt)}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="text-sm font-medium opacity-90 group-hover:opacity-100">
                              {session.name || 'Untitled Session'}
                            </div>
                            <Badge
                              variant="soft"
                              size="sm"
                              intent={session.status === SessionStatus.RUNNING ? 'primary' : 'neutral'}
                            >
                              {session.status}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Tasks */}
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b">
                  <h2 className="text-lg font-semibold tracking-tight">Tasks</h2>
                </div>
                <SpecTasksSection
                  specId={specId}
                  serverUrl={serverUrl}
                  onTaskSelect={onTaskSelect}
                />
              </div>
            </div>
          </>
        )}
      />

    </>
  );
}
