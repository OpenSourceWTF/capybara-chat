/**
 * Dashboard - Agent Pool Overview with Kanban Board
 *
 * Shows tasks in a kanban board layout organized by state.
 * Includes stats overview and logs tab.
 *
 * Design: Terminal aesthetic with zero radius, warm colors
 */

import { useState, useCallback } from 'react';
import { useSocket } from '../../context/SocketContext';
import { useTasks } from '../../hooks/useTasks';
import { LogsTab } from './LogsTab';
import { KanbanBoard } from '../kanban';
import { cn } from '../../lib/utils';
import type { WorkerTaskState, WorkerTask } from '@capybara-chat/types';

enum DashboardTab {
  Kanban = 'kanban',
  Logs = 'logs',
}

interface DashboardProps {
  onTaskSelect?: (task: WorkerTask) => void;
}

export function Dashboard({ onTaskSelect }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<DashboardTab>(DashboardTab.Kanban);
  const { agentStatus } = useSocket();
  const { tasks, isLoading, refetch, updateTask } = useTasks({ autoRefresh: true, refreshInterval: 5000 });

  // Handler for kanban drag-and-drop state changes
  const handleTaskStateChange = useCallback(async (taskId: string, newState: WorkerTaskState) => {
    try {
      await updateTask(taskId, { state: newState });
      refetch(); // Refresh to get latest state
    } catch (error) {
      console.error('Failed to update task state:', error);
    }
  }, [updateTask, refetch]);

  // 134-kanban-reorder: Handler for within-column reordering
  const handleTaskPositionChange = useCallback(async (taskId: string, position: number) => {
    try {
      await updateTask(taskId, { position });
      refetch(); // Refresh to get latest order
    } catch (error) {
      console.error('Failed to update task position:', error);
    }
  }, [updateTask, refetch]);

  // Compute stats from real data
  const activeTasks = tasks.filter(t => t.state === 'running' || t.state === 'assigned');
  const queuedTasks = tasks.filter(t => t.state === 'queued');
  const completedToday = tasks.filter(t => {
    if (t.state !== 'complete' || !t.completedAt) return false;
    const today = new Date();
    const completedDate = new Date(t.completedAt);
    return completedDate.toDateString() === today.toDateString();
  });

  // Calculate average duration of completed tasks
  const avgDuration = (): string => {
    const completed = tasks.filter(t => t.state === 'complete' && t.startedAt && t.completedAt);
    if (completed.length === 0) return '--';
    const totalMs = completed.reduce((acc, t) => acc + ((t.completedAt || 0) - (t.startedAt || 0)), 0);
    const avgMinutes = Math.floor(totalMs / completed.length / 60000);
    if (avgMinutes < 60) return `${avgMinutes}m`;
    const hours = Math.floor(avgMinutes / 60);
    return `${hours}h ${avgMinutes % 60}m`;
  };

  return (
    <div className="flex flex-col h-full bg-background font-mono">
      {/* Header Section */}
      <div className="flex-shrink-0 border-b border-border">
        {/* Title and Status */}
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <h1 className="text-base font-bold uppercase tracking-wider">Agent Pool</h1>
            <p className="text-2xs text-muted-foreground">
              Monitor long-running tasks and agent activity
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "w-2 h-2",
                agentStatus === 'online' && "bg-emerald-500",
                agentStatus === 'connecting' && "bg-amber-500 animate-pulse",
                agentStatus === 'offline' && "bg-red-500"
              )}
            />
            <span className="text-2xs text-muted-foreground uppercase tracking-wider">
              {agentStatus === 'online' ? 'Bridge Connected' :
                agentStatus === 'connecting' ? 'Connecting...' : 'Bridge Offline'}
            </span>
          </div>
        </div>

        {/* Stats Row - Enhanced visual hierarchy for at-a-glance monitoring */}
        <div className="flex items-stretch gap-0 border-t border-border">
          {/* Active Tasks - Primary KPI with blue */}
          <div className="flex-1 flex flex-col items-center justify-center px-4 py-2 bg-blue-600/5 border-r border-border">
            <span className="text-xl font-black text-blue-600 tabular-nums">{activeTasks.length}</span>
            <span className="text-2xs text-muted-foreground uppercase tracking-widest flex items-center gap-1">
              <span className={cn("w-1.5 h-1.5", activeTasks.length > 0 ? "bg-blue-600 animate-pulse" : "bg-muted-foreground/30")} />
              ACTIVE
            </span>
          </div>
          {/* Queued Tasks - Secondary with neutral styling */}
          <div className="flex-1 flex flex-col items-center justify-center px-4 py-2 bg-muted/20 border-r border-border">
            <span className="text-xl font-black text-foreground/70 tabular-nums">{queuedTasks.length}</span>
            <span className="text-2xs text-muted-foreground uppercase tracking-widest flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-muted-foreground/50" />
              QUEUED
            </span>
          </div>
          {/* Completed Today - Success indicator with green */}
          <div className="flex-1 flex flex-col items-center justify-center px-4 py-2 bg-emerald-600/5 border-r border-border">
            <span className="text-xl font-black text-emerald-600 tabular-nums">{completedToday.length}</span>
            <span className="text-2xs text-muted-foreground uppercase tracking-widest flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-emerald-600" />
              TODAY
            </span>
          </div>
          {/* Average Duration - Informational metric */}
          <div className="flex-1 flex flex-col items-center justify-center px-4 py-2 bg-muted/10">
            <span className="text-xl font-black text-foreground/60 tabular-nums">{avgDuration()}</span>
            <span className="text-2xs text-muted-foreground uppercase tracking-widest">AVG TIME</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-t border-border">
          <button
            className={cn(
              "px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors",
              "border-b-2 -mb-px",
              activeTab === DashboardTab.Kanban
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setActiveTab(DashboardTab.Kanban)}
          >
            Kanban
          </button>
          <button
            className={cn(
              "px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors",
              "border-b-2 -mb-px",
              activeTab === DashboardTab.Logs
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setActiveTab(DashboardTab.Logs)}
          >
            Logs
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === DashboardTab.Logs && <LogsTab />}

        {activeTab === DashboardTab.Kanban && (
          <KanbanBoard
            tasks={tasks}
            isLoading={isLoading}
            onRefetch={refetch}
            onTaskSelect={onTaskSelect}
            onTaskStateChange={handleTaskStateChange}
            onTaskPositionChange={handleTaskPositionChange}
          />
        )}
      </div>
    </div>
  );
}
