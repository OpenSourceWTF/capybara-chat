/**
 * TaskDetailView - Full left-pane task detail experience
 *
 * Follows the entity view pattern like SpecView, DocumentView, etc.
 * Shows task in full width with:
 * - Header with back navigation and status
 * - Status section with progress/success/error messages
 * - Work product (PR file changes)
 * - Session link for full activity timeline
 *
 * Design: Terminal aesthetic per STYLE_GUIDE.md
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  AlertCircle,
  CheckCircle,
  Clock,
  Loader2,
  RefreshCw,
  StopCircle,
  ExternalLink,
  GitPullRequest,
  GitBranch,
  XCircle,
  GitCommit,
  FileCode,
  FileDiff,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  Copy,
  Check,
  PanelRight,
  RotateCcw,
  FolderGit,
  Server,
  FileText,
  Upload,
  Plus,
  DollarSign,
  Link,
} from 'lucide-react';
import type { WorkerTask, HumanInputRequest, SocketEventPayloads, Session } from '@capybara-chat/types';
import { SOCKET_EVENTS, API_PATHS } from '@capybara-chat/types';
import { Button, Badge } from '../ui';
import { cn, formatCost } from '../../lib/utils';
import { useServer } from '../../context/ServerContext';
import { useSocket } from '../../context/SocketContext';
import { useFetch } from '../../hooks/useFetch';
import { useTaskPR } from '../../hooks/useTaskPR';
import { api } from '../../lib/api';
import { HumanInputModal } from '../chat/HumanInputModal';
import { formatLibraryTimestamp, formatFullTimestamp } from '../../lib/date-formatting';
import { TASK_STATE_CONFIG } from '../../lib/task-state-config';

interface TaskDetailViewProps {
  taskId: string;
  serverUrl?: string;
  onBack?: () => void;
  /** Navigate to full session detail view (left pane) */
  onViewSession?: (sessionId: string) => void;
  /** Open session in chat pane (right pane) */
  onOpenSessionInPane?: (sessionId: string) => void;
  /** Navigate to spec detail view */
  onViewSpec?: (specId: string) => void;
}

export function TaskDetailView({
  taskId,
  serverUrl: propServerUrl,
  onBack,
  onViewSession,
  onOpenSessionInPane,
  onViewSpec,
}: TaskDetailViewProps) {
  const { serverUrl: contextServerUrl } = useServer();
  const serverUrl = propServerUrl || contextServerUrl;
  const { on, off } = useSocket();

  // Fetch task data
  const { data: task, loading, error, refetch } = useFetch<WorkerTask>(
    `${serverUrl}${API_PATHS.TASKS}/${taskId}`
  );

  // Local state
  const [cancelling, setCancelling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedTaskId, setCopiedTaskId] = useState(false);
  const [liveProgress, setLiveProgress] = useState<string | null>(null);
  const [humanInputRequest, setHumanInputRequest] = useState<HumanInputRequest | null>(null);
  const [responding, setResponding] = useState(false);
  const [filesExpanded, setFilesExpanded] = useState(true);
  const [diffExpanded, setDiffExpanded] = useState(false);
  const [diffContent, setDiffContent] = useState<string | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [diffError, setDiffError] = useState<string | null>(null);
  const [, setTick] = useState(0); // Force re-render for duration updates
  const [relatedSessions, setRelatedSessions] = useState<Session[]>([]);
  const [sessionsExpanded, setSessionsExpanded] = useState(false);
  const [branchPushed, setBranchPushed] = useState<boolean | null>(null);
  const [resolvedHeadCommit, setResolvedHeadCommit] = useState<string | null>(null);
  const [pushing, setPushing] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);
  const [githubRepoUrl, setGithubRepoUrl] = useState<string | null>(null);

  // PR management hook
  const { createPR, linkPR, isSyncing: prSyncing, error: prError, hasPR } = useTaskPR(taskId);
  const autoLinkAttempted = useRef(false);

  // Reset auto-link attempt tracker when switching tasks
  useEffect(() => { autoLinkAttempted.current = false; }, [taskId]);

  // Subscribe to task socket events
  useEffect(() => {
    const handleTaskProgress = (data: SocketEventPayloads[typeof SOCKET_EVENTS.TASK_PROGRESS]) => {
      if (data.taskId !== taskId) return;
      setLiveProgress(data.message);
    };

    const handleTaskOutput = (data: SocketEventPayloads[typeof SOCKET_EVENTS.TASK_OUTPUT]) => {
      if (data.taskId !== taskId) return;
      if (data.type === 'complete') {
        refetch();
        // 153-task-resume-worktree: Re-check branch push status after task/resume completes.
        // Agent may have made new commits during the conversation, making local ahead of remote.
        setBranchPushed(null);
        setDiffContent(null); // Reset cached diff so it re-fetches
      }
    };

    on(SOCKET_EVENTS.TASK_PROGRESS, handleTaskProgress);
    on(SOCKET_EVENTS.TASK_OUTPUT, handleTaskOutput);

    return () => {
      off(SOCKET_EVENTS.TASK_PROGRESS, handleTaskProgress);
      off(SOCKET_EVENTS.TASK_OUTPUT, handleTaskOutput);
    };
  }, [taskId, on, off, refetch]);

  // Update duration display every second for active tasks
  useEffect(() => {
    const isActive = task && ['running', 'assigned'].includes(task.state);
    if (!isActive) return;

    const interval = setInterval(() => {
      setTick(t => t + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [task?.state]);

  // Fetch sessions related to this spec (sessions that have edited/worked on the spec)
  useEffect(() => {
    if (!task?.specId) return;

    const fetchRelatedSessions = async () => {
      try {
        const response = await api.get(`${serverUrl}${API_PATHS.SESSIONS}?specId=${task.specId}&limit=10`);
        if (response.ok) {
          const data = await response.json();
          // Filter out the current task's session to avoid duplication
          const sessions = (data.sessions || []).filter(
            (s: Session) => s.id !== task.sessionId
          );
          setRelatedSessions(sessions);
        }
      } catch (err) {
        console.error('Failed to fetch related sessions:', err);
      }
    };

    fetchRelatedSessions();
  }, [task?.specId, task?.sessionId, serverUrl]);

  // Fetch workspace to get GitHub repo URL for branch links
  useEffect(() => {
    if (!task?.workspaceId) return;

    const fetchWorkspace = async () => {
      try {
        const response = await api.get(`${serverUrl}${API_PATHS.WORKSPACES}/${task.workspaceId}`);
        if (response.ok) {
          const workspace = await response.json();
          if (workspace.githubRepoFullName) {
            setGithubRepoUrl(`https://github.com/${workspace.githubRepoFullName}`);
          }
        }
      } catch (err) {
        console.error('Failed to fetch workspace:', err);
      }
    };

    fetchWorkspace();
  }, [task?.workspaceId, serverUrl]);

  // Check branch push status on mount (don't wait for diff expansion)
  useEffect(() => {
    if (!task?.branchName || branchPushed !== null) return;

    // If task has a PR, branch must be pushed
    if (task.prUrl) {
      setBranchPushed(true);
      return;
    }

    // Proactively check branch status via diff endpoint
    const checkBranchStatus = async () => {
      try {
        const res = await api.get(`${serverUrl}${API_PATHS.TASKS}/${taskId}/diff`);
        if (res.ok) {
          const data = await res.json();
          // 153-task-resume-worktree: If local is ahead of remote, treat as not fully pushed
          const isFullyPushed = (data.branchPushed ?? true) && !(data.localAhead > 0);
          setBranchPushed(isFullyPushed);
          // Cache the diff content too
          if (data.diff) {
            setDiffContent(data.diff);
          }
        } else {
          const errorData = await res.json().catch(() => ({}));
          if (errorData.branchNotPushed) {
            setBranchPushed(false);
          }
        }
      } catch {
        // Silent fail - will check again when diff is expanded
      }
    };

    checkBranchStatus();
  }, [task?.branchName, task?.prUrl, taskId, serverUrl, branchPushed]);

  // Auto-link or auto-create PR when branch is pushed but task has no PR
  // Attempts once per task: tries to link existing PR, falls back to creating one
  useEffect(() => {
    if (!task?.branchName || task?.prUrl || hasPR) return;
    if (branchPushed !== true) return; // Only try when we know branch is pushed
    if (autoLinkAttempted.current) return; // Only attempt once per task

    autoLinkAttempted.current = true;
    linkPR().then(linked => {
      if (linked) {
        refetch();
      } else {
        // No existing PR found — auto-create one
        createPR().then(created => {
          if (created) refetch();
        });
      }
    }).catch(() => {
      // Link failed — try creating instead
      createPR().then(created => {
        if (created) refetch();
      }).catch(() => {});
    });
  }, [task?.branchName, task?.prUrl, branchPushed, hasPR, linkPR, createPR, refetch]);

  // Fetch pending human input request
  const fetchHumanInputRequest = useCallback(async () => {
    if (!task || task.state !== 'paused') {
      setHumanInputRequest(null);
      return;
    }

    try {
      const response = await api.get(`${serverUrl}/api/tasks/${taskId}/human-input`);
      if (response.ok) {
        const data = await response.json();
        const pending = data.requests?.find(
          (r: HumanInputRequest) => r.status === 'pending'
        );
        setHumanInputRequest(pending || null);
      }
    } catch (err) {
      console.error('Failed to fetch human input request:', err);
    }
  }, [taskId, task?.state, serverUrl]);

  useEffect(() => {
    fetchHumanInputRequest();
    if (task?.state === 'paused') {
      const interval = setInterval(fetchHumanInputRequest, 3000);
      return () => clearInterval(interval);
    }
  }, [task?.state, fetchHumanInputRequest]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const handleCancel = async () => {
    if (!task || cancelling) return;
    const isTerminal = ['complete', 'failed', 'cancelled'].includes(task.state);
    if (isTerminal) return;

    setCancelling(true);
    try {
      const response = await api.post(`${serverUrl}/api/tasks/${taskId}/cancel`, {
        reason: 'Cancelled by user',
      });
      if (response.ok) {
        refetch();
      }
    } catch (err) {
      console.error('Failed to cancel task:', err);
    } finally {
      setCancelling(false);
    }
  };

  const handleRetry = async () => {
    if (!task || retrying) return;
    const canRetry = ['failed', 'cancelled'].includes(task.state);
    if (!canRetry) return;

    setRetrying(true);
    try {
      const response = await api.patch(`${serverUrl}${API_PATHS.TASKS}/${taskId}`, {
        state: 'queued',
      });
      if (response.ok) {
        refetch();
      }
    } catch (err) {
      console.error('Failed to retry task:', err);
    } finally {
      setRetrying(false);
    }
  };

  // 168-right-bar-elimination: Reinject button removed from TaskDetailView.
  // Reinject is now available via the "..." context menu in the chat input bar.

  const handleHumanInputResponse = async (response: string) => {
    if (!humanInputRequest || responding) return;
    setResponding(true);
    try {
      const res = await api.post(
        `${serverUrl}/api/tasks/${taskId}/human-input/${humanInputRequest.id}`,
        { response }
      );
      if (res.ok) {
        setHumanInputRequest(null);
        refetch();
      }
    } catch (err) {
      console.error('Failed to respond to human input:', err);
    } finally {
      setResponding(false);
    }
  };

  const handleCopyError = async () => {
    if (task?.error) {
      await navigator.clipboard.writeText(task.error);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Push branch to remote
  const handlePushBranch = async () => {
    if (pushing || !task?.branchName) return;
    setPushing(true);
    setPushError(null);
    try {
      const res = await api.post(`${serverUrl}${API_PATHS.TASKS}/${taskId}/push`);
      if (res.ok) {
        setBranchPushed(true);
        // Refresh diff to use remote refs now
        setDiffContent(null);
        fetchDiff();
      } else {
        const data = await res.json().catch(() => ({}));
        setPushError(data.error || 'Failed to push branch');
      }
    } catch (err) {
      setPushError('Failed to push branch');
    } finally {
      setPushing(false);
    }
  };

  // Create PR for task
  const handleCreatePR = async () => {
    const success = await createPR();
    if (success) {
      refetch(); // Refresh task to get PR info
    }
  };

  // Fetch diff when expanding
  const fetchDiff = useCallback(async () => {
    if (diffContent || diffLoading || !task?.branchName) return;

    setDiffLoading(true);
    setDiffError(null);
    try {
      const res = await api.get(`${serverUrl}${API_PATHS.TASKS}/${taskId}/diff`);
      if (res.ok) {
        const data = await res.json();
        setDiffContent(data.diff || '');
        // Capture headCommit resolved by the server
        if (data.headCommit) {
          setResolvedHeadCommit(data.headCommit);
        }
        // Track if branch is pushed to remote
        // 153-task-resume-worktree: If local is ahead of remote, treat as not fully pushed
        if (data.branchPushed !== undefined) {
          const isFullyPushed = data.branchPushed && !(data.localAhead > 0);
          setBranchPushed(isFullyPushed);
        }
      } else {
        const errorData = await res.json().catch(() => ({}));
        setDiffError(errorData.error || 'Failed to load diff');
        // If branch not pushed, the error response tells us
        if (errorData.branchNotPushed) {
          setBranchPushed(false);
        }
      }
    } catch (err) {
      setDiffError('Failed to fetch diff');
    } finally {
      setDiffLoading(false);
    }
  }, [diffContent, diffLoading, task?.branchName, serverUrl, taskId]);

  // Eagerly fetch diff to resolve headCommit for GIT INFO section
  useEffect(() => {
    if (task?.branchName && !task.headCommit && !resolvedHeadCommit && !diffContent && !diffLoading) {
      fetchDiff();
    }
  }, [task?.branchName, task?.headCommit, resolvedHeadCommit, diffContent, diffLoading, fetchDiff]);

  // Toggle diff expansion
  const handleDiffToggle = () => {
    const newExpanded = !diffExpanded;
    setDiffExpanded(newExpanded);
    if (newExpanded && !diffContent && !diffLoading) {
      fetchDiff();
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-background font-mono">
        <div className="text-center">
          <Loader2 className="w-6 h-6 animate-spin text-progress mx-auto mb-2" />
          <span className="text-xs uppercase tracking-wider text-progress-muted">Loading task...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !task) {
    return (
      <div className="h-full flex items-center justify-center bg-background font-mono">
        <div className="text-center text-destructive p-8 border border-destructive/20">
          <AlertCircle className="w-8 h-8 mx-auto mb-3" />
          <p className="text-sm font-bold mb-1">TASK_NOT_FOUND</p>
          <p className="text-2xs opacity-70">{error || `Task ${taskId} not found`}</p>
          {onBack && (
            <Button variant="ghost" size="sm" onClick={onBack} className="mt-4">
              ← Back to Tasks
            </Button>
          )}
        </div>
      </div>
    );
  }

  const stateConfig = TASK_STATE_CONFIG[task.state];
  const StateIcon = stateConfig.icon;
  const isTerminal = ['complete', 'failed', 'cancelled'].includes(task.state);
  const isActive = ['running', 'assigned'].includes(task.state);
  const canRetry = ['failed', 'cancelled'].includes(task.state);
  const progressMessage = liveProgress || task.lastProgressMessage;

  const formatDuration = (): string => {
    if (!task.startedAt) return '--';
    const endTime = task.completedAt || Date.now();
    const durationMs = endTime - task.startedAt;
    const minutes = Math.floor(durationMs / 60000);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  };

  return (
    <div className="h-full flex flex-col bg-background text-foreground font-mono">
      {/* Header */}
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
            TASK_DETAIL
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            className="h-7 px-2 text-xs"
          >
            <RefreshCw className={cn('w-3 h-3 mr-1', refreshing && 'animate-spin')} />
            Refresh
          </Button>
          {canRetry && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRetry}
              disabled={retrying}
              className="h-7 px-2 text-xs text-progress hover:text-progress hover:bg-progress/10"
            >
              <RotateCcw className={cn('w-3 h-3 mr-1', retrying && 'animate-spin')} />
              Retry
            </Button>
          )}
          {!isTerminal && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              disabled={cancelling}
              className="h-7 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <StopCircle className="w-3 h-3 mr-1" />
              Cancel
            </Button>
          )}
        </div>
      </div>

      {/* Task Identity */}
      <div className="px-4 py-4 border-b border-border">
        <div className="flex items-start gap-4">
          {/* Status icon */}
          <div className={cn(
            'w-12 h-12 flex items-center justify-center border-2',
            task.state === 'complete' && 'border-success bg-success/10 text-success',
            task.state === 'failed' && 'border-destructive bg-destructive/10 text-destructive',
            task.state === 'running' && 'border-progress bg-progress/10 text-progress',
            task.state === 'assigned' && 'border-progress bg-progress/10 text-progress',
            task.state === 'paused' && 'border-warning bg-warning/10 text-warning',
            task.state === 'queued' && 'border-muted-foreground bg-muted/10 text-muted-foreground',
            task.state === 'cancelled' && 'border-muted-foreground bg-muted/10 text-muted-foreground',
          )}>
            <StateIcon className={cn('w-6 h-6', isActive && 'animate-spin')} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-lg font-bold truncate">
                {task.name || 'Unnamed Task'}
              </h1>
              <Badge variant="solid" intent={stateConfig.intent} size="sm">
                {stateConfig.label.toUpperCase()}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(task.id);
                  setCopiedTaskId(true);
                  setTimeout(() => setCopiedTaskId(false), 1500);
                }}
                className="inline-flex items-center gap-1 font-mono hover:text-foreground transition-colors"
                title="Copy full task ID"
              >
                {task.id.substring(0, 12)}
                {copiedTaskId ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3 opacity-50" />}
              </button>
              <span className="opacity-30">•</span>
              {onViewSpec ? (
                <button
                  onClick={() => onViewSpec(task.specId)}
                  className="flex items-center gap-1 text-primary hover:underline hover:text-primary/80 transition-colors"
                >
                  <FileText className="w-3 h-3" />
                  spec:{task.specId.substring(0, 8)}
                </button>
              ) : (
                <span>spec:{task.specId.substring(0, 8)}</span>
              )}
              <span className="opacity-30">•</span>
              <span>ws:{task.workspaceId.substring(0, 8)}</span>
              {task.iteration > 0 && (
                <>
                  <span className="opacity-30">•</span>
                  <span>iter:{task.iteration}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Strip */}
      <div className="px-4 py-2 border-b border-border bg-muted/5 flex items-center gap-6 text-xs">
        <div className="flex items-center gap-2">
          <Clock className="w-3 h-3 text-muted-foreground" />
          <span className="text-muted-foreground">Started:</span>
          <span
            className="font-mono"
            title={task.startedAt ? formatFullTimestamp(task.startedAt) : undefined}
          >
            {task.startedAt ? formatLibraryTimestamp(task.startedAt) : '--'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Duration:</span>
          <span className="font-mono">{formatDuration()}</span>
        </div>
        {formatCost(task.sessionTotalCost) && (
          <div className="flex items-center gap-2">
            <DollarSign className="w-3 h-3 text-muted-foreground" />
            <span className="text-muted-foreground">Cost:</span>
            <span className="font-mono">{formatCost(task.sessionTotalCost)}</span>
          </div>
        )}
        {task.currentPhase && (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Phase:</span>
            <Badge variant="soft" intent="primary" size="sm">{task.currentPhase}</Badge>
          </div>
        )}
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Attempt:</span>
          <span className="font-mono">{task.attempt}/{task.maxAttempts}</span>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {/* Status Section - Prominent */}
        <div className="px-4 py-4 border-b border-border">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              STATUS
            </span>
          </div>
          <div className={cn(
            'p-4 border',
            task.state === 'complete' && 'border-success/30 bg-success/5',
            task.state === 'failed' && 'border-destructive/30 bg-destructive/5',
            task.state === 'running' && 'border-progress/30 bg-progress/5',
            task.state === 'assigned' && 'border-progress/30 bg-progress/5',
            task.state === 'paused' && 'border-warning/30 bg-warning/5',
            task.state === 'queued' && 'border-border bg-muted/5',
            task.state === 'cancelled' && 'border-border bg-muted/5',
          )}>
            <div className="flex items-start gap-3">
              <StateIcon className={cn(
                'w-5 h-5 mt-0.5 flex-shrink-0',
                task.state === 'complete' && 'text-success',
                task.state === 'failed' && 'text-destructive',
                (task.state === 'running' || task.state === 'assigned') && 'text-progress animate-spin',
                task.state === 'paused' && 'text-warning',
                (task.state === 'queued' || task.state === 'cancelled') && 'text-muted-foreground',
              )} />
              <div className="flex-1 min-w-0">
                <p className={cn(
                  'font-semibold text-sm',
                  task.state === 'complete' && 'text-success',
                  task.state === 'failed' && 'text-destructive',
                  (task.state === 'running' || task.state === 'assigned') && 'text-progress',
                  task.state === 'paused' && 'text-warning',
                )}>
                  {stateConfig.message}
                </p>
                {progressMessage && isActive && (
                  <p className="text-sm text-muted-foreground mt-1 truncate">
                    {progressMessage}
                  </p>
                )}
                {task.state === 'complete' && task.prUrl && (
                  <p className="text-sm text-success/80 mt-1">
                    Pull request created and ready for review
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Error Section */}
        {task.error && (
          <div className="px-4 py-4 border-b border-border">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-destructive">
                ERROR
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyError}
                  className="h-6 px-2 text-2xs"
                >
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                </Button>
              </div>
            </div>
            <div className="p-4 bg-destructive/5 border border-destructive/20">
              <pre className="text-xs text-destructive/90 whitespace-pre-wrap overflow-x-auto max-h-[200px] overflow-y-auto">
                {task.error}
              </pre>
            </div>
            {canRetry && (
              <div className="mt-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRetry}
                  disabled={retrying}
                  className="w-full h-9 text-sm border-progress/50 text-progress hover:bg-progress/10 hover:border-progress"
                >
                  <RotateCcw className={cn('w-4 h-4 mr-2', retrying && 'animate-spin')} />
                  {retrying ? 'Requeuing...' : 'Retry Task'}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Git & Workspace Info */}
        {(task.branchName || task.worktreePath) && (
          <div className="px-4 py-4 border-b border-border">
            <div className="flex items-center gap-2 mb-3">
              <FolderGit className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                GIT INFO
              </span>
            </div>
            <div className="p-3 border border-border bg-muted/5 space-y-2">
              {/* Workspace */}
              <div className="flex items-center gap-2 text-xs">
                <Server className="w-3 h-3 text-muted-foreground/70 flex-shrink-0" />
                <span className="text-muted-foreground">workspace:</span>
                <span className="font-mono">{task.workspaceId}</span>
              </div>
              {/* Worktree Path */}
              {task.worktreePath && (
                <div className="flex items-start gap-2 text-xs">
                  <FolderGit className="w-3 h-3 text-muted-foreground/70 flex-shrink-0 mt-0.5" />
                  <span className="text-muted-foreground flex-shrink-0">path:</span>
                  <span className="font-mono break-all text-foreground/80">{task.worktreePath}</span>
                </div>
              )}
              {/* Branch */}
              {task.branchName && (
                <div className="flex items-center gap-2 text-xs">
                  <GitBranch className="w-3 h-3 text-muted-foreground/70 flex-shrink-0" />
                  <span className="text-muted-foreground">branch:</span>
                  {(branchPushed || task.prUrl) && githubRepoUrl ? (
                    <a
                      href={`${githubRepoUrl}/tree/${task.branchName}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-primary hover:underline flex items-center gap-1"
                    >
                      {task.branchName}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : (
                    <span className="font-mono text-foreground">{task.branchName}</span>
                  )}
                  {branchPushed === false && (
                    <Badge variant="soft" intent="warning" size="sm" className="ml-1">not pushed</Badge>
                  )}
                  {branchPushed === null && !task.prUrl && (
                    <Badge variant="soft" intent="secondary" size="sm" className="ml-1">checking...</Badge>
                  )}
                </div>
              )}
              {/* Commit */}
              {(task.headCommit || resolvedHeadCommit) && (
                <div className="flex items-center gap-2 text-xs">
                  <GitCommit className="w-3 h-3 text-muted-foreground/70 flex-shrink-0" />
                  <span className="text-muted-foreground">commit:</span>
                  <span className="font-mono">{task.headCommit || resolvedHeadCommit}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Pull Request Section - Shows when PR exists */}
        {task.prUrl && (
          <div className="px-4 py-4 border-b border-border">
            <div className="flex items-center gap-2 mb-3">
              <GitPullRequest className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                PULL REQUEST
              </span>
            </div>
            <div className="p-4 border border-border bg-card/50">
              <div className="flex items-center justify-between mb-3">
                <a
                  href={task.prUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-semibold text-primary hover:underline flex items-center gap-2"
                >
                  PR #{task.prNumber}
                  <ExternalLink className="w-3 h-3" />
                </a>
                {task.prState && (
                  <Badge
                    variant="solid"
                    intent={
                      task.prState === 'merged' ? 'success' :
                      task.prState === 'closed' ? 'danger' : 'info'
                    }
                    size="sm"
                  >
                    {task.prState}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                {task.prChecksStatus && (
                  <span className="flex items-center gap-1">
                    {task.prChecksStatus === 'success' ? (
                      <CheckCircle className="w-3 h-3 text-success" />
                    ) : task.prChecksStatus === 'failure' ? (
                      <XCircle className="w-3 h-3 text-destructive" />
                    ) : (
                      <Clock className="w-3 h-3 text-warning" />
                    )}
                    {task.prChecksStatus} checks
                  </span>
                )}
                {task.prReviewDecision && task.prReviewDecision !== 'none' && (
                  <span className="flex items-center gap-1">
                    {task.prReviewDecision === 'approved' ? (
                      <CheckCircle className="w-3 h-3 text-success" />
                    ) : (
                      <AlertCircle className="w-3 h-3 text-warning" />
                    )}
                    {task.prReviewDecision.replace('_', ' ')}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* No PR Section - Shows when branch exists but no PR */}
        {!task.prUrl && task.branchName && (
          <div className="px-4 py-4 border-b border-border">
            <div className="flex items-center gap-2 mb-3">
              <GitPullRequest className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                PULL REQUEST
              </span>
            </div>
            <div className="p-4 border border-border bg-card/50 text-center">
              <GitPullRequest className="w-6 h-6 mx-auto mb-2 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground mb-3">
                No pull request created yet
              </p>
              <div className="flex justify-center gap-2 flex-wrap">
                {/* Push button - show when not pushed or unknown */}
                {branchPushed !== true && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePushBranch}
                    disabled={pushing}
                    className="h-8 text-xs"
                  >
                    {pushing ? (
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    ) : (
                      <Upload className="w-3 h-3 mr-1" />
                    )}
                    Push Branch
                  </Button>
                )}
                {/* Link PR - try to find existing PR on GitHub */}
                {branchPushed === true && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { linkPR().then(success => { if (success) refetch(); }); }}
                    disabled={prSyncing}
                    className="h-8 text-xs"
                    title="Find and link an existing PR for this branch"
                  >
                    {prSyncing ? (
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    ) : (
                      <Link className="w-3 h-3 mr-1" />
                    )}
                    Link PR
                  </Button>
                )}
                {/* Create PR */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCreatePR}
                  disabled={prSyncing || branchPushed !== true}
                  className="h-8 text-xs border-success/30 hover:bg-success/10 hover:border-success text-success"
                  title={branchPushed !== true ? 'Push branch first' : 'Create a new PR'}
                >
                  {prSyncing ? (
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  ) : (
                    <Plus className="w-3 h-3 mr-1" />
                  )}
                  Create PR
                </Button>
              </div>
              {branchPushed !== true && !prError && !pushError && (
                <p className="text-2xs text-muted-foreground/60 mt-2">
                  Branch must be pushed before creating PR
                </p>
              )}
              {branchPushed === true && !prError && !pushError && (
                <p className="text-2xs text-muted-foreground/60 mt-2">
                  Click "Link PR" if a PR already exists, or "Create PR" to make a new one
                </p>
              )}
              {(prError || pushError) && (
                <div className="mt-3 p-2 border border-destructive/30 bg-destructive/5 rounded text-left">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-3 h-3 text-destructive flex-shrink-0 mt-0.5" />
                    <div className="text-xs text-destructive">
                      {pushError || prError}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Work Product Section */}
        {(task.prAdditions !== undefined || task.prDeletions !== undefined || task.prChangedFiles !== undefined) && (
          <div className="px-4 py-4 border-b border-border">
            <button
              onClick={() => setFilesExpanded(!filesExpanded)}
              className="flex items-center gap-2 mb-3 hover:text-foreground transition-colors w-full text-left"
            >
              {filesExpanded ? (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              )}
              <FileCode className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                WORK PRODUCT
              </span>
              <span className="text-xs text-muted-foreground ml-2">
                {task.prChangedFiles} files changed
                {task.prAdditions !== undefined && task.prDeletions !== undefined && (
                  <>
                    <span className="text-success ml-2">+{task.prAdditions}</span>
                    <span className="text-destructive ml-1">-{task.prDeletions}</span>
                  </>
                )}
              </span>
            </button>
            {filesExpanded && (
              <div className="p-4 border border-border bg-muted/5">
                <div className="flex items-center gap-6 text-sm">
                  <div className="flex items-center gap-2">
                    <FileCode className="w-4 h-4 text-muted-foreground" />
                    <span className="font-mono">{task.prChangedFiles || 0} files</span>
                  </div>
                  <div className="flex items-center gap-2 text-success">
                    <span className="font-mono">+{task.prAdditions || 0}</span>
                    <span className="text-muted-foreground">additions</span>
                  </div>
                  <div className="flex items-center gap-2 text-destructive">
                    <span className="font-mono">-{task.prDeletions || 0}</span>
                    <span className="text-muted-foreground">deletions</span>
                  </div>
                </div>
                {task.prUrl && (
                  <a
                    href={`${task.prUrl}/files`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 mt-3 text-xs text-primary hover:underline"
                  >
                    View full diff on GitHub
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            )}
          </div>
        )}

        {/* Code Diff */}
        {task.branchName && (
          <div className="px-4 py-4 border-b border-border">
            <button
              onClick={handleDiffToggle}
              className="flex items-center gap-2 mb-3 hover:text-foreground transition-colors w-full text-left"
            >
              {diffExpanded ? (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              )}
              <FileDiff className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                CODE DIFF
              </span>
              {diffLoading && (
                <Loader2 className="w-3 h-3 text-progress animate-spin ml-2" />
              )}
            </button>
            {diffExpanded && (
              <div className="border border-border bg-muted/5">
                {diffLoading ? (
                  <div className="p-4 text-center">
                    <Loader2 className="w-4 h-4 animate-spin text-progress mx-auto mb-2" />
                    <span className="text-xs text-progress-muted">Loading diff...</span>
                  </div>
                ) : diffError ? (
                  <div className="p-4 text-center">
                    <AlertCircle className="w-4 h-4 mx-auto mb-2 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{diffError}</span>
                    {branchPushed === false && (
                      <div className="mt-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handlePushBranch}
                          disabled={pushing}
                          className="h-8 text-xs border-primary/30 hover:bg-primary/10 hover:border-primary"
                        >
                          {pushing ? (
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          ) : (
                            <Upload className="w-3 h-3 mr-1" />
                          )}
                          Push Branch to View Diff
                        </Button>
                      </div>
                    )}
                    {task.prUrl && (
                      <a
                        href={`${task.prUrl}/files`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-1 mt-2 text-xs text-primary hover:underline"
                      >
                        View diff on GitHub
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                ) : diffContent ? (
                  <pre className="p-4 text-xs font-mono overflow-x-auto max-h-[500px] overflow-y-auto whitespace-pre">
                    {diffContent.split('\n').map((line, i) => (
                      <div
                        key={i}
                        className={cn(
                          'px-2 -mx-2',
                          line.startsWith('+') && !line.startsWith('+++') && 'bg-success/10 text-success',
                          line.startsWith('-') && !line.startsWith('---') && 'bg-destructive/10 text-destructive',
                          line.startsWith('@@') && 'bg-info/10 text-info',
                          (line.startsWith('diff ') || line.startsWith('index ')) && 'text-muted-foreground font-bold'
                        )}
                      >
                        {line}
                      </div>
                    ))}
                  </pre>
                ) : (
                  <div className="p-4 text-center text-muted-foreground/60">
                    <span className="text-xs">No changes detected</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Session Link */}
        {task.sessionId && (
          <div className="px-4 py-4 border-b border-border">
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                SESSION
              </span>
            </div>
            <div className="flex gap-2">
              {onOpenSessionInPane && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenSessionInPane(task.sessionId!)}
                  className="flex-1 justify-center h-10 text-sm border-primary/30 hover:bg-primary/10 hover:border-primary"
                >
                  <PanelRight className="w-4 h-4 mr-2" />
                  Open in Chat Pane
                </Button>
              )}
              {onViewSession && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onViewSession(task.sessionId!)}
                  className="flex-1 justify-center h-10 text-sm border-muted-foreground/30 hover:bg-muted/10"
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Full Timeline
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Spec Link - Navigate to the spec this task is executing */}
        {onViewSpec && (
          <div className="px-4 py-4 border-b border-border">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                SPEC
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onViewSpec(task.specId)}
              className="w-full justify-center h-10 text-sm border-primary/30 hover:bg-primary/10 hover:border-primary"
            >
              <FileText className="w-4 h-4 mr-2" />
              View Spec
            </Button>
          </div>
        )}

        {/* Related Sessions - Sessions that have edited/worked on this spec */}
        {relatedSessions.length > 0 && (
          <div className="px-4 py-4 border-b border-border">
            <button
              onClick={() => setSessionsExpanded(!sessionsExpanded)}
              className="flex items-center gap-2 mb-3 hover:text-foreground transition-colors w-full text-left"
            >
              {sessionsExpanded ? (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              )}
              <MessageSquare className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                RELATED SESSIONS
              </span>
              <span className="text-xs text-muted-foreground ml-2">
                ({relatedSessions.length} session{relatedSessions.length !== 1 ? 's' : ''} for this spec)
              </span>
            </button>
            {sessionsExpanded && (
              <div className="space-y-2">
                {relatedSessions.map((session) => (
                  <div
                    key={session.id}
                    className="p-3 border border-border bg-muted/5 flex items-center justify-between"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {session.name || 'Unnamed Session'}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2">
                        <span className="font-mono">{session.id.substring(0, 8)}</span>
                        <span className="opacity-30">•</span>
                        <span>{session.sessionType}</span>
                        {session.lastActivityAt && (
                          <>
                            <span className="opacity-30">•</span>
                            <span>{formatLibraryTimestamp(session.lastActivityAt)}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 ml-2">
                      {onOpenSessionInPane && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onOpenSessionInPane(session.id)}
                          className="h-8 px-2"
                          title="Open in Chat Pane"
                        >
                          <PanelRight className="w-4 h-4" />
                        </Button>
                      )}
                      {onViewSession && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onViewSession(session.id)}
                          className="h-8 px-2"
                          title="View Full Timeline"
                        >
                          <MessageSquare className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Implementation Plan */}
        {task.implementationPlan && (
          <div className="px-4 py-4 border-b border-border">
            <div className="flex items-center gap-2 mb-3">
              <FileCode className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                IMPLEMENTATION PLAN
              </span>
            </div>
            <div className="p-4 border border-border bg-muted/5">
              <pre className="text-xs whitespace-pre-wrap max-h-[300px] overflow-y-auto">
                {task.implementationPlan}
              </pre>
            </div>
          </div>
        )}
      </div>

      {/* Human Input Modal */}
      <HumanInputModal
        request={
          humanInputRequest
            ? {
                question: humanInputRequest.question,
                context: humanInputRequest.context,
                options: humanInputRequest.options,
                sessionId: task.sessionId || task.id,
              }
            : null
        }
        onSubmit={handleHumanInputResponse}
        onCancel={() => setHumanInputRequest(null)}
      />
    </div>
  );
}

export default TaskDetailView;
