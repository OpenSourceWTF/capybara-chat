/**
 * TaskExpandedView - Minimal inline expansion showing ONLY additional details
 *
 * Design: The task row already shows name, status, spec, workspace, duration.
 * This expansion shows ONLY what's NOT in the row:
 * - Error details (if failed)
 * - PR status (if has PR)
 * - Additional metadata (technique, model override, paths)
 * - Action buttons (cancel, view session)
 *
 * NO redundant headers, NO nested collapsibles.
 */

import { useState, useCallback, useEffect } from 'react';
import {
  AlertCircle,
  Loader2,
  RefreshCw,
  StopCircle,
  ExternalLink,
  MessageSquare,
  Terminal,
  Copy,
  Check,
  GitBranch,
  Wrench,
  Settings,
  GitPullRequest,
  CheckCircle,
  XCircle,
  Clock,
  RotateCcw,
  Server,
  FolderGit,
} from 'lucide-react';
import type { WorkerTask, HumanInputRequest, SocketEventPayloads } from '@capybara-chat/types';
import { SOCKET_EVENTS } from '@capybara-chat/types';
import { Button, Badge } from '../ui';
import { cn } from '../../lib/utils';
import { useServer } from '../../context/ServerContext';
import { useSocket } from '../../context/SocketContext';
import { api } from '../../lib/api';
import { HumanInputModal } from '../chat/HumanInputModal';

interface TaskExpandedViewProps {
  task: WorkerTask;
  onTaskUpdate?: (task: WorkerTask) => void;
  onCollapse: () => void;
  onViewSession?: (sessionId: string) => void;
}

export function TaskExpandedView({
  task,
  onTaskUpdate,
  onCollapse,
  onViewSession,
}: TaskExpandedViewProps) {
  const { serverUrl } = useServer();
  const { on, off } = useSocket();
  const [cancelling, setCancelling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [humanInputRequest, setHumanInputRequest] = useState<HumanInputRequest | null>(null);
  const [responding, setResponding] = useState(false);
  const [copied, setCopied] = useState(false);
  const [liveProgress, setLiveProgress] = useState<string | null>(null);

  const isTerminal = ['complete', 'failed', 'cancelled'].includes(task.state);
  const isActive = ['running', 'assigned'].includes(task.state);
  const canRetry = ['failed', 'cancelled'].includes(task.state);

  // Subscribe to task socket events
  useEffect(() => {
    const handleTaskProgress = (data: SocketEventPayloads[typeof SOCKET_EVENTS.TASK_PROGRESS]) => {
      if (data.taskId !== task.id) return;
      setLiveProgress(data.message);
    };

    const handleTaskOutput = (data: SocketEventPayloads[typeof SOCKET_EVENTS.TASK_OUTPUT]) => {
      if (data.taskId !== task.id) return;
      if (data.type === 'complete') {
        handleRefresh();
      }
    };

    on(SOCKET_EVENTS.TASK_PROGRESS, handleTaskProgress);
    on(SOCKET_EVENTS.TASK_OUTPUT, handleTaskOutput);

    return () => {
      off(SOCKET_EVENTS.TASK_PROGRESS, handleTaskProgress);
      off(SOCKET_EVENTS.TASK_OUTPUT, handleTaskOutput);
    };
  }, [task.id, on, off]);

  // Fetch pending human input request
  const fetchHumanInputRequest = useCallback(async () => {
    if (task.state !== 'paused') {
      setHumanInputRequest(null);
      return;
    }

    try {
      const response = await api.get(`${serverUrl}/api/tasks/${task.id}/human-input`);
      if (response.ok) {
        const data = await response.json();
        const pending = data.requests?.find(
          (r: HumanInputRequest) => r.status === 'pending'
        );
        setHumanInputRequest(pending || null);
      }
    } catch (error) {
      console.error('Failed to fetch human input request:', error);
    }
  }, [task.id, task.state, serverUrl]);

  useEffect(() => {
    fetchHumanInputRequest();
    if (task.state === 'paused') {
      const interval = setInterval(fetchHumanInputRequest, 3000);
      return () => clearInterval(interval);
    }
  }, [task.state, fetchHumanInputRequest]);

  const handleCancel = async () => {
    if (cancelling || isTerminal) return;
    setCancelling(true);
    try {
      const response = await api.post(`${serverUrl}/api/tasks/${task.id}/cancel`, {
        reason: 'Cancelled by user',
      });
      if (response.ok) {
        const updatedTask = await response.json();
        onTaskUpdate?.(updatedTask);
      }
    } catch (error) {
      console.error('Failed to cancel task:', error);
    } finally {
      setCancelling(false);
    }
  };

  const handleRetry = async () => {
    if (retrying || !canRetry) return;
    setRetrying(true);
    try {
      const response = await api.patch(`${serverUrl}/api/tasks/${task.id}`, {
        state: 'queued',
      });
      if (response.ok) {
        const updatedTask = await response.json();
        onTaskUpdate?.(updatedTask);
      }
    } catch (error) {
      console.error('Failed to retry task:', error);
    } finally {
      setRetrying(false);
    }
  };

  const handleHumanInputResponse = async (response: string) => {
    if (!humanInputRequest || responding) return;
    setResponding(true);
    try {
      const res = await api.post(
        `${serverUrl}/api/tasks/${task.id}/human-input/${humanInputRequest.id}`,
        { response }
      );
      if (res.ok) {
        setHumanInputRequest(null);
        handleRefresh();
      }
    } catch (error) {
      console.error('Failed to respond to human input:', error);
    } finally {
      setResponding(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const response = await api.get(`${serverUrl}/api/tasks/${task.id}`);
      if (response.ok) {
        const updatedTask = await response.json();
        onTaskUpdate?.(updatedTask);
      }
    } catch (error) {
      console.error('Failed to refresh task:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleCopyError = async () => {
    if (task.error) {
      await navigator.clipboard.writeText(task.error);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const progressMessage = liveProgress || task.lastProgressMessage;

  // Check if we have any additional metadata to show
  // Always show metadata section for workspace/path info which is critical for debugging
  const hasMetadata = true;

  return (
    <div className="border-l-2 border-primary/50 bg-muted/5 ml-6 font-mono text-sm">
      {/* Live progress (if active) */}
      {isActive && progressMessage && (
        <div className="px-4 py-2 bg-progress/5 border-b border-progress/20">
          <div className="flex items-center gap-2 text-xs text-progress">
            <Loader2 className="w-3 h-3 animate-spin text-progress flex-shrink-0" />
            <span className="truncate text-progress-muted">{progressMessage}</span>
          </div>
        </div>
      )}

      {/* Error section - only if failed */}
      {task.error && (
        <div className="px-4 py-3 bg-destructive/5 border-b border-destructive/20">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-xs font-bold text-destructive uppercase">Error</span>
                <div className="flex items-center gap-1">
                  {canRetry && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleRetry}
                      disabled={retrying}
                      className="h-5 px-1.5 text-2xs text-progress hover:text-progress hover:bg-progress/10"
                    >
                      <RotateCcw className={cn('w-3 h-3 mr-1', retrying && 'animate-spin')} />
                      Retry
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopyError}
                    className="h-5 px-1.5 text-2xs"
                  >
                    {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  </Button>
                </div>
              </div>
              {/* Show parsed command if present */}
              {task.error.includes('Command failed:') && (
                <div className="flex items-center gap-2 text-xs font-mono bg-destructive/10 px-2 py-1 mb-2 border border-destructive/20">
                  <Terminal className="w-3 h-3 text-destructive/70 flex-shrink-0" />
                  <span className="text-destructive/90 truncate">
                    {task.error.match(/Command failed: (.+?)(?:\n|$)/)?.[1] || 'Unknown command'}
                  </span>
                </div>
              )}
              <pre className="text-xs text-destructive/80 whitespace-pre-wrap max-h-[100px] overflow-y-auto">
                {task.error.split('\n').slice(0, 5).join('\n')}
                {task.error.split('\n').length > 5 && '\n...'}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* PR Status - only if has PR */}
      {task.prUrl && (
        <div className="px-4 py-3 border-b border-border/50">
          <div className="flex items-center gap-3">
            <GitPullRequest className="w-4 h-4 text-muted-foreground" />
            <a
              href={task.prUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline flex items-center gap-1"
            >
              PR #{task.prNumber}
              <ExternalLink className="w-3 h-3" />
            </a>
            {task.prState && (
              <Badge
                variant="soft"
                intent={task.prState === 'merged' ? 'success' : task.prState === 'closed' ? 'danger' : 'info'}
                size="sm"
              >
                {task.prState}
              </Badge>
            )}
            {task.prChecksStatus && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                {task.prChecksStatus === 'success' ? (
                  <CheckCircle className="w-3 h-3 text-success" />
                ) : task.prChecksStatus === 'failure' ? (
                  <XCircle className="w-3 h-3 text-destructive" />
                ) : (
                  <Clock className="w-3 h-3 text-warning" />
                )}
                checks
              </span>
            )}
          </div>
        </div>
      )}

      {/* Additional metadata - flat, not collapsible */}
      {hasMetadata && (
        <div className="px-4 py-3 border-b border-border/50">
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
            {/* Workspace ID - always show */}
            <div className="flex items-center gap-2">
              <Server className="w-3 h-3 text-muted-foreground" />
              <span className="text-muted-foreground">workspace:</span>
              <span className="font-mono">{task.workspaceId.substring(0, 12)}</span>
            </div>
            {task.branchName && (
              <div className="flex items-center gap-2">
                <GitBranch className="w-3 h-3 text-muted-foreground" />
                <span className="text-muted-foreground">branch:</span>
                <span className="font-mono truncate">{task.branchName}</span>
              </div>
            )}
            {task.techniqueId && (
              <div className="flex items-center gap-2">
                <Wrench className="w-3 h-3 text-muted-foreground" />
                <span className="text-muted-foreground">technique:</span>
                <span className="font-mono">{task.techniqueId.substring(0, 12)}</span>
              </div>
            )}
            {task.modelOverride && (
              <div className="flex items-center gap-2">
                <Settings className="w-3 h-3 text-muted-foreground" />
                <span className="text-muted-foreground">model:</span>
                <Badge variant="soft" intent="secondary" size="sm">{task.modelOverride}</Badge>
              </div>
            )}
            {/* Worktree path - full width for long paths */}
            {task.worktreePath && (
              <div className="flex items-start gap-2 col-span-2">
                <FolderGit className="w-3 h-3 text-muted-foreground flex-shrink-0 mt-0.5" />
                <span className="text-muted-foreground flex-shrink-0">path:</span>
                <span className="font-mono text-2xs break-all">{task.worktreePath}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Actions row */}
      <div className="px-4 py-2 flex items-center gap-2">
        {/* View Session - primary action */}
        {task.sessionId && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onViewSession?.(task.sessionId!)}
            className="text-xs h-7 gap-1.5 border-primary/30 hover:bg-primary/10 hover:border-primary"
          >
            <MessageSquare className="w-3 h-3" />
            View Session
          </Button>
        )}

        {/* Retry - only if failed/cancelled */}
        {canRetry && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleRetry}
            disabled={retrying}
            className="text-xs h-7 gap-1.5 border-progress/30 text-progress hover:bg-progress/10 hover:border-progress"
          >
            <RotateCcw className={cn('w-3 h-3', retrying && 'animate-spin')} />
            Retry
          </Button>
        )}

        {/* Refresh */}
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

        {/* Cancel - only if not terminal */}
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

        {/* Collapse - push to right */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onCollapse}
          className="h-7 px-2 text-xs ml-auto"
        >
          Collapse
        </Button>
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

export default TaskExpandedView;
