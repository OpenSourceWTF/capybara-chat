/**
 * useTaskPR Hook
 *
 * Manages PR lifecycle for a worker task.
 * Listens to socket events for real-time updates (via GitHub webhooks).
 * Provides manual sync, merge, close, and create operations.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  WorkerTask,
  GitHubPRState,
  PRMergeableState,
  PRChecksStatus,
  PRReviewDecision,
} from '@capybara-chat/types';
import { SOCKET_EVENTS } from '@capybara-chat/types';
import { useServer } from '../context/ServerContext';
import { useSocket } from '../context/SocketContext';
import { api } from '../lib/api';
import { createLogger } from '../lib/logger';
import { getErrorMessage } from '../lib/errors';

const log = createLogger('useTaskPR');

// PR status extracted from task
export interface PRStatus {
  prNumber: number;
  prUrl: string;
  prState: GitHubPRState;
  prMergeable?: boolean;
  prMergeableState?: PRMergeableState;
  prChecksStatus?: PRChecksStatus;
  prReviewDecision?: PRReviewDecision;
  prLastSyncedAt?: number;
  prChangedFiles?: number;
  prAdditions?: number;
  prDeletions?: number;
}

// Polling configuration for webhook fallback (local dev)
const DEFAULT_POLL_INTERVAL_MS = 30000; // 30 seconds

export interface UseTaskPROptions {
  /** Enable auto-polling as webhook fallback (default: true for open PRs) */
  autoPoll?: boolean;
  /** Poll interval in ms (default: 30000) */
  pollInterval?: number;
}

export interface CreatePRInput {
  title?: string;
  body?: string;
  draft?: boolean;
}

export interface MergePRInput {
  mergeMethod?: 'merge' | 'squash' | 'rebase';
  commitTitle?: string;
  commitMessage?: string;
  deleteWorktree?: boolean;
  deleteBranch?: boolean;
}

export interface ClosePRInput {
  reason?: string;
}

export interface UseTaskPRResult {
  // State
  prStatus: PRStatus | null;
  hasPR: boolean;
  isLoading: boolean;
  isSyncing: boolean;
  error: string | null;

  // Computed states
  canMerge: boolean;
  canClose: boolean;
  isReadyToMerge: boolean;

  // Actions
  syncPRStatus: (force?: boolean) => Promise<void>;
  createPR: (input?: CreatePRInput) => Promise<boolean>;
  linkPR: () => Promise<boolean>;
  mergePR: (input?: MergePRInput) => Promise<boolean>;
  closePR: (input?: ClosePRInput) => Promise<boolean>;
}

// Socket event payload types
interface TaskPRSyncedPayload {
  task: WorkerTask;
  previousState?: GitHubPRState;
}

interface TaskPRMergedPayload {
  taskId: string;
  prNumber: number;
  sha: string;
}

interface TaskPRClosedPayload {
  taskId: string;
  prNumber: number;
  reason?: string;
}

/**
 * Hook for managing PR lifecycle of a worker task.
 * Real-time updates via socket events (GitHub webhooks push to server).
 */
export function useTaskPR(
  taskId: string | null,
  options: UseTaskPROptions = {}
): UseTaskPRResult {
  const { autoPoll = true, pollInterval = DEFAULT_POLL_INTERVAL_MS } = options;
  const { serverUrl } = useServer();
  const { socket } = useSocket();

  const [prStatus, setPRStatus] = useState<PRStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ref to track current taskId for socket handlers
  const taskIdRef = useRef(taskId);
  taskIdRef.current = taskId;

  // Extract PR status from task
  const extractPRStatus = useCallback((task: WorkerTask): PRStatus | null => {
    if (!task.prNumber || !task.prUrl) return null;

    return {
      prNumber: task.prNumber,
      prUrl: task.prUrl,
      prState: task.prState || 'open',
      prMergeable: task.prMergeable,
      prMergeableState: task.prMergeableState,
      prChecksStatus: task.prChecksStatus,
      prReviewDecision: task.prReviewDecision,
      prLastSyncedAt: task.prLastSyncedAt,
      prChangedFiles: task.prChangedFiles,
      prAdditions: task.prAdditions,
      prDeletions: task.prDeletions,
    };
  }, []);

  // Fetch initial PR status from task
  const fetchPRStatus = useCallback(async () => {
    if (!taskId) {
      setPRStatus(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await api.get(`${serverUrl}/api/tasks/${taskId}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch task: ${res.statusText}`);
      }

      const task: WorkerTask = await res.json();
      setPRStatus(extractPRStatus(task));
    } catch (err) {
      log.error('Failed to fetch PR status', { taskId, error: err });
      setError(getErrorMessage(err, 'Failed to fetch PR status'));
    } finally {
      setIsLoading(false);
    }
  }, [taskId, serverUrl, extractPRStatus]);

  // Manual sync PR status from GitHub
  const syncPRStatus = useCallback(async (force = false) => {
    if (!taskId) return;

    setIsSyncing(true);
    setError(null);

    try {
      const url = `${serverUrl}/api/tasks/${taskId}/pr/sync${force ? '?force=true' : ''}`;
      const res = await api.post(url);

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed to sync PR: ${res.statusText}`);
      }

      const result = await res.json();
      if (result.task) {
        setPRStatus(extractPRStatus(result.task));
      }

      log.info('PR status synced', { taskId, prNumber: result.task?.prNumber });
    } catch (err) {
      log.error('Failed to sync PR status', { taskId, error: err });
      setError(getErrorMessage(err, 'Failed to sync PR status'));
    } finally {
      setIsSyncing(false);
    }
  }, [taskId, serverUrl, extractPRStatus]);

  // Create PR for task
  const createPR = useCallback(async (input?: CreatePRInput): Promise<boolean> => {
    if (!taskId) return false;

    setIsSyncing(true);
    setError(null);

    try {
      const res = await api.post(`${serverUrl}/api/tasks/${taskId}/pr/create`, input || {});

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed to create PR: ${res.statusText}`);
      }

      const result = await res.json();
      log.info('PR created', { taskId, prNumber: result.prNumber });

      // Refresh PR status
      await fetchPRStatus();
      return true;
    } catch (err) {
      log.error('Failed to create PR', { taskId, error: err });
      setError(getErrorMessage(err, 'Failed to create PR'));
      return false;
    } finally {
      setIsSyncing(false);
    }
  }, [taskId, serverUrl, fetchPRStatus]);

  // Link existing PR from GitHub
  const linkPR = useCallback(async (): Promise<boolean> => {
    if (!taskId) return false;

    setIsSyncing(true);
    setError(null);

    try {
      const res = await api.post(`${serverUrl}/api/tasks/${taskId}/pr/link`);

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.notFound) {
          throw new Error('No open PR found for this branch');
        }
        throw new Error(data.error || `Failed to link PR: ${res.statusText}`);
      }

      const result = await res.json();
      log.info('PR linked', { taskId, prNumber: result.prNumber });

      // Refresh PR status
      await fetchPRStatus();
      return true;
    } catch (err) {
      log.error('Failed to link PR', { taskId, error: err });
      setError(getErrorMessage(err, 'Failed to link PR'));
      return false;
    } finally {
      setIsSyncing(false);
    }
  }, [taskId, serverUrl, fetchPRStatus]);

  // Merge PR
  const mergePR = useCallback(async (input?: MergePRInput): Promise<boolean> => {
    if (!taskId) return false;

    setIsSyncing(true);
    setError(null);

    try {
      const res = await api.post(`${serverUrl}/api/tasks/${taskId}/pr/merge`, input || {});

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed to merge PR: ${res.statusText}`);
      }

      log.info('PR merged', { taskId });

      // Refresh PR status
      await fetchPRStatus();
      return true;
    } catch (err) {
      log.error('Failed to merge PR', { taskId, error: err });
      setError(getErrorMessage(err, 'Failed to merge PR'));
      return false;
    } finally {
      setIsSyncing(false);
    }
  }, [taskId, serverUrl, fetchPRStatus]);

  // Close PR without merging
  const closePR = useCallback(async (input?: ClosePRInput): Promise<boolean> => {
    if (!taskId) return false;

    setIsSyncing(true);
    setError(null);

    try {
      const res = await api.post(`${serverUrl}/api/tasks/${taskId}/pr/close`, input || {});

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed to close PR: ${res.statusText}`);
      }

      log.info('PR closed', { taskId });

      // Refresh PR status
      await fetchPRStatus();
      return true;
    } catch (err) {
      log.error('Failed to close PR', { taskId, error: err });
      setError(getErrorMessage(err, 'Failed to close PR'));
      return false;
    } finally {
      setIsSyncing(false);
    }
  }, [taskId, serverUrl, fetchPRStatus]);

  // Initial fetch
  useEffect(() => {
    fetchPRStatus();
  }, [fetchPRStatus]);

  // Subscribe to socket events for real-time PR updates
  useEffect(() => {
    if (!socket || !taskId) return;

    const handlePRSynced = (data: TaskPRSyncedPayload) => {
      if (data.task.id === taskIdRef.current) {
        log.debug('PR synced via socket', { taskId: data.task.id });
        setPRStatus(extractPRStatus(data.task));
      }
    };

    const handlePRMerged = (data: TaskPRMergedPayload) => {
      if (data.taskId === taskIdRef.current) {
        log.debug('PR merged via socket', { taskId: data.taskId });
        // Refetch to get full updated state
        fetchPRStatus();
      }
    };

    const handlePRClosed = (data: TaskPRClosedPayload) => {
      if (data.taskId === taskIdRef.current) {
        log.debug('PR closed via socket', { taskId: data.taskId });
        fetchPRStatus();
      }
    };

    const handleChecksUpdated = (data: { taskId: string }) => {
      if (data.taskId === taskIdRef.current) {
        log.debug('PR checks updated via socket', { taskId: data.taskId });
        fetchPRStatus();
      }
    };

    const handleReviewUpdated = (data: { taskId: string }) => {
      if (data.taskId === taskIdRef.current) {
        log.debug('PR review updated via socket', { taskId: data.taskId });
        fetchPRStatus();
      }
    };

    // Subscribe to all PR-related events
    socket.on(SOCKET_EVENTS.TASK_PR_SYNCED, handlePRSynced);
    socket.on(SOCKET_EVENTS.TASK_PR_MERGED, handlePRMerged);
    socket.on(SOCKET_EVENTS.TASK_PR_CLOSED, handlePRClosed);
    socket.on(SOCKET_EVENTS.TASK_PR_CHECKS_UPDATED, handleChecksUpdated);
    socket.on(SOCKET_EVENTS.TASK_PR_REVIEW_UPDATED, handleReviewUpdated);

    return () => {
      socket.off(SOCKET_EVENTS.TASK_PR_SYNCED, handlePRSynced);
      socket.off(SOCKET_EVENTS.TASK_PR_MERGED, handlePRMerged);
      socket.off(SOCKET_EVENTS.TASK_PR_CLOSED, handlePRClosed);
      socket.off(SOCKET_EVENTS.TASK_PR_CHECKS_UPDATED, handleChecksUpdated);
      socket.off(SOCKET_EVENTS.TASK_PR_REVIEW_UPDATED, handleReviewUpdated);
    };
  }, [socket, taskId, extractPRStatus, fetchPRStatus]);

  // Auto-polling fallback for when webhooks aren't available (local dev)
  // Only polls when: task has open PR, autoPoll enabled, component mounted
  useEffect(() => {
    // Don't poll if disabled
    if (!autoPoll || !taskId) return;

    // Don't poll if no PR or PR is closed/merged
    if (!prStatus?.prNumber || (prStatus.prState && prStatus.prState !== 'open')) {
      return;
    }

    log.debug('Starting PR status polling', { taskId, intervalMs: pollInterval });

    const timer = setInterval(() => {
      // Skip if already syncing to avoid concurrent requests
      if (!isSyncing) {
        syncPRStatus(false).catch(() => {
          // Errors are already logged in syncPRStatus
        });
      }
    }, pollInterval);

    return () => {
      log.debug('Stopping PR status polling', { taskId });
      clearInterval(timer);
    };
  }, [autoPoll, taskId, prStatus?.prNumber, prStatus?.prState, pollInterval, syncPRStatus, isSyncing]);

  // Computed states
  const hasPR = prStatus !== null;
  const canMerge = hasPR && prStatus.prState === 'open';
  const canClose = hasPR && prStatus.prState === 'open';
  const isReadyToMerge =
    canMerge &&
    prStatus.prMergeable === true &&
    prStatus.prChecksStatus === 'success' &&
    (prStatus.prReviewDecision === 'approved' || prStatus.prReviewDecision === 'none');

  return {
    prStatus,
    hasPR,
    isLoading,
    isSyncing,
    error,
    canMerge,
    canClose,
    isReadyToMerge,
    syncPRStatus,
    createPR,
    linkPR,
    mergePR,
    closePR,
  };
}
