/**
 * TaskView - Redesigned task modal with clear visual hierarchy
 *
 * Layout:
 * - Header: Status icon, name, ID, quick actions
 * - Stats: Duration, started time, iteration, phase
 * - Error (if any): Collapsible error display with parsed details
 * - PR Status (if any): PR state, checks, reviews
 * - Metadata: Collapsible task configuration details
 * - Activity: Timeline of tool calls and messages
 *
 * Design: Terminal aesthetic with zero radius per STYLE_GUIDE.md
 */

import { useState, useCallback, useEffect } from 'react';
import { Clock, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import type { WorkerTask, HumanInputRequest, SocketEventPayloads } from '@capybara-chat/types';
import { SOCKET_EVENTS } from '@capybara-chat/types';
import { HumanInputModal } from '../chat/HumanInputModal';
import { useServer } from '../../context/ServerContext';
import { useSocket } from '../../context/SocketContext';
import { useSessionMessages } from '../../hooks/useSessionMessages';
import { api } from '../../lib/api';

// Modular components
import { TaskModalHeader } from './TaskModalHeader';
import { TaskStats } from './TaskStats';
import { TaskErrorSection } from './TaskErrorSection';
import { TaskPRStatus } from './TaskPRStatus';
import { TaskMetadata } from './TaskMetadata';
import { TaskActivityFeed } from './TaskActivityFeed';

interface TaskViewProps {
  task: WorkerTask;
  onTaskUpdate?: (task: WorkerTask) => void;
  onClose?: () => void;
  /** Navigate to spec detail view */
  onViewSpec?: (specId: string) => void;
}

export function TaskView({ task, onTaskUpdate, onClose, onViewSpec }: TaskViewProps) {
  const { serverUrl } = useServer();
  const { on, off } = useSocket();
  const [cancelling, setCancelling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [humanInputRequest, setHumanInputRequest] = useState<HumanInputRequest | null>(null);
  const [responding, setResponding] = useState(false);

  // Local state for streaming updates (from socket events)
  const [liveProgress, setLiveProgress] = useState<string | null>(null);
  const [livePhase, setLivePhase] = useState<string | null>(null);

  // Queue state for message queueing
  const [queueSize, setQueueSize] = useState(0);
  const [resumeError, setResumeError] = useState<string | null>(null);

  // Load session timeline for historic chat data
  const {
    timeline,
    loading: timelineLoading,
    addAssistantMessage,
    addToolUse,
    markAllToolsComplete,
    refresh: refreshTimeline,
  } = useSessionMessages(task.sessionId || null, { serverUrl });

  // Subscribe to task and session socket events for real-time updates
  useEffect(() => {
    const handleTaskProgress = (data: SocketEventPayloads[typeof SOCKET_EVENTS.TASK_PROGRESS]) => {
      if (data.taskId !== task.id) return;
      setLiveProgress(data.message);
      if (data.phase) setLivePhase(data.phase);
    };

    const handleTaskOutput = (data: SocketEventPayloads[typeof SOCKET_EVENTS.TASK_OUTPUT]) => {
      if (data.taskId !== task.id) return;
      if (data.type === 'complete') {
        handleRefresh();
      }
    };

    // Handle session responses (for chat-like timeline display)
    const handleSessionResponse = (data: SocketEventPayloads[typeof SOCKET_EVENTS.SESSION_RESPONSE]) => {
      if (data.sessionId !== task.sessionId) return;
      addAssistantMessage({
        id: data.message.id,
        sessionId: data.sessionId,
        role: 'assistant',
        content: data.message.content,
        streaming: data.message.streaming,
        createdAt: data.message.createdAt,
        itemType: 'message',
      });
    };

    // Handle tool use events (for inline tool progress in timeline)
    // Now passes messageId for embedding tools in parent message (131-tool-embedding)
    const handleSessionToolUse = (data: SocketEventPayloads[typeof SOCKET_EVENTS.SESSION_TOOL_USE]) => {
      if (data.sessionId !== task.sessionId) return;
      addToolUse({
        toolUseId: data.toolUseId,
        toolName: data.toolName,
        input: data.input,
        output: data.output,
        error: data.error,
        parentToolUseId: data.parentToolUseId,
        elapsedMs: data.elapsedMs,
        timestamp: data.timestamp,
        messageId: data.messageId,  // Links tool to parent message (131-tool-embedding)
      });
    };

    // Handle session activity events (for tool completion)
    const handleSessionActivity = (data: SocketEventPayloads[typeof SOCKET_EVENTS.SESSION_ACTIVITY]) => {
      if (data.sessionId !== task.sessionId) return;
      if (data.activity.type === 'tool_end') {
        markAllToolsComplete();
      }
    };

    // Handle message queue events
    const handleMessageQueued = (data: SocketEventPayloads[typeof SOCKET_EVENTS.SESSION_MESSAGE_QUEUED]) => {
      if (data.sessionId !== task.sessionId) return;
      setQueueSize(data.queueSize);
      setLiveProgress(`Message queued (position ${data.position})`);
    };

    const handleMessageDequeued = (data: SocketEventPayloads[typeof SOCKET_EVENTS.SESSION_MESSAGE_DEQUEUED]) => {
      if (data.sessionId !== task.sessionId) return;
      setQueueSize(data.remaining);
      if (data.remaining === 0) {
        setLiveProgress(null);
      }
    };

    const handleTaskResumed = (data: SocketEventPayloads[typeof SOCKET_EVENTS.TASK_RESUMED]) => {
      if (data.taskId !== task.id) return;
      setResumeError(null);
      setLiveProgress(`Task resuming (was ${data.resumedFrom})`);
      setLivePhase('resuming');
    };

    const handleTaskResumeFailed = (data: SocketEventPayloads[typeof SOCKET_EVENTS.TASK_RESUME_FAILED]) => {
      if (data.taskId !== task.id) return;
      const message = data.reason === 'session_expired'
        ? 'Session expired - cannot resume'
        : `Resume failed: ${data.reason}`;
      setResumeError(message);
      setLiveProgress(null);
    };

    on(SOCKET_EVENTS.TASK_PROGRESS, handleTaskProgress);
    on(SOCKET_EVENTS.TASK_OUTPUT, handleTaskOutput);
    on(SOCKET_EVENTS.SESSION_RESPONSE, handleSessionResponse);
    on(SOCKET_EVENTS.SESSION_TOOL_USE, handleSessionToolUse);
    on(SOCKET_EVENTS.SESSION_ACTIVITY, handleSessionActivity);
    on(SOCKET_EVENTS.SESSION_MESSAGE_QUEUED, handleMessageQueued);
    on(SOCKET_EVENTS.SESSION_MESSAGE_DEQUEUED, handleMessageDequeued);
    on(SOCKET_EVENTS.TASK_RESUMED, handleTaskResumed);
    on(SOCKET_EVENTS.TASK_RESUME_FAILED, handleTaskResumeFailed);

    return () => {
      off(SOCKET_EVENTS.TASK_PROGRESS, handleTaskProgress);
      off(SOCKET_EVENTS.TASK_OUTPUT, handleTaskOutput);
      off(SOCKET_EVENTS.SESSION_RESPONSE, handleSessionResponse);
      off(SOCKET_EVENTS.SESSION_TOOL_USE, handleSessionToolUse);
      off(SOCKET_EVENTS.SESSION_ACTIVITY, handleSessionActivity);
      off(SOCKET_EVENTS.SESSION_MESSAGE_QUEUED, handleMessageQueued);
      off(SOCKET_EVENTS.SESSION_MESSAGE_DEQUEUED, handleMessageDequeued);
      off(SOCKET_EVENTS.TASK_RESUMED, handleTaskResumed);
      off(SOCKET_EVENTS.TASK_RESUME_FAILED, handleTaskResumeFailed);
    };
  }, [task.id, task.sessionId, on, off, addAssistantMessage, addToolUse, markAllToolsComplete]);

  // Reset streaming state when task changes
  useEffect(() => {
    setLiveProgress(null);
    setLivePhase(null);
  }, [task.id]);

  const isTerminal = ['complete', 'failed', 'cancelled'].includes(task.state);
  const isActive = ['running', 'assigned'].includes(task.state);

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

  // Poll for human input when paused
  useEffect(() => {
    fetchHumanInputRequest();
    if (task.state === 'paused') {
      const interval = setInterval(fetchHumanInputRequest, 3000);
      return () => clearInterval(interval);
    }
  }, [task.state, fetchHumanInputRequest]);

  // Handle task cancellation
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
      } else {
        const error = await response.json();
        console.error('Failed to cancel task:', error);
      }
    } catch (error) {
      console.error('Failed to cancel task:', error);
    } finally {
      setCancelling(false);
    }
  };

  // Handle human input response
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
      } else {
        const error = await res.json();
        console.error('Failed to respond to human input:', error);
      }
    } catch (error) {
      console.error('Failed to respond to human input:', error);
    } finally {
      setResponding(false);
    }
  };

  // Refresh task data and timeline
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const response = await api.get(`${serverUrl}/api/tasks/${task.id}`);
      if (response.ok) {
        const updatedTask = await response.json();
        onTaskUpdate?.(updatedTask);
      }
      await refreshTimeline();
    } catch (error) {
      console.error('Failed to refresh task:', error);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-background text-foreground font-mono">
      {/* Header */}
      <TaskModalHeader
        task={task}
        onRefresh={handleRefresh}
        onCancel={handleCancel}
        onClose={onClose || (() => {})}
        refreshing={refreshing}
        cancelling={cancelling}
      />

      {/* Stats strip */}
      <TaskStats task={task} livePhase={livePhase} />

      {/* Scrollable content area */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {/* Error section - prominent when present */}
        {task.error && (
          <div className="p-3 border-b border-border">
            <TaskErrorSection task={task} />
          </div>
        )}

        {/* Resume error */}
        {resumeError && (
          <div className="px-3 py-2 border-b border-border">
            <div className="flex items-start gap-2 p-2 bg-warning/10 border border-warning/20 text-warning text-xs">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>
                <div className="font-semibold">Resume Failed</div>
                <div className="mt-0.5">{resumeError}</div>
              </div>
            </div>
          </div>
        )}

        {/* Message queue indicator */}
        {queueSize > 0 && (
          <div className="px-3 py-2 border-b border-border">
            <div className="flex items-center gap-2 p-2 bg-info/10 border border-info/20 text-info text-xs">
              <Clock className="w-4 h-4 flex-shrink-0" />
              <span>
                {queueSize} message{queueSize > 1 ? 's' : ''} queued - will be processed after current turn
              </span>
            </div>
          </div>
        )}

        {/* PR Status - only if task has a PR */}
        {task.prUrl && (
          <div className="p-3 border-b border-border">
            <TaskPRStatus task={task} />
          </div>
        )}

        {/* Metadata section - collapsible */}
        <TaskMetadata task={task} onViewSpec={onViewSpec} />

        {/* Activity section */}
        <div className="border-b border-border">
          <div className="px-4 py-2 bg-muted/10 border-b border-border">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Activity Timeline
            </span>
          </div>
          <div className="p-3">
            {task.sessionId && (
              <TaskActivityFeed
                timeline={timeline}
                isLoading={timelineLoading}
                isActive={isActive}
                liveProgress={liveProgress || task.lastProgressMessage}
              />
            )}

            {/* States when no session/timeline */}
            {!task.sessionId && (
              <>
                {/* Queued state */}
                {task.state === 'queued' && (
                  <div className="flex items-center justify-center p-8 text-muted-foreground">
                    <Clock className="w-5 h-5 mr-2" />
                    <span className="text-xs">Task is queued, waiting for executor...</span>
                  </div>
                )}

                {/* Paused state - waiting for human input */}
                {task.state === 'paused' && !humanInputRequest && (
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="w-5 h-5 animate-spin text-progress mr-2" />
                    <span className="text-xs text-progress-muted">Task paused - checking for human input request...</span>
                  </div>
                )}

                {/* Completed with no timeline */}
                {task.state === 'complete' && !task.prUrl && !timeline.length && (
                  <div className="flex items-center justify-center p-8 text-success">
                    <CheckCircle className="w-5 h-5 mr-2" />
                    <span className="text-xs">Task completed successfully</span>
                  </div>
                )}
              </>
            )}

            {/* Implementation plan if available */}
            {task.implementationPlan && (
              <div className="mt-4 border border-border">
                <div className="px-3 py-2 bg-muted/30 border-b border-border">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Implementation Plan
                  </span>
                </div>
                <pre className="p-3 text-xs whitespace-pre-wrap max-h-[300px] overflow-y-auto">
                  {task.implementationPlan}
                </pre>
              </div>
            )}
          </div>
        </div>
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

export default TaskView;
