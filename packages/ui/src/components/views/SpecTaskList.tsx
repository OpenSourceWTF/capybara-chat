/**
 * SpecTaskList - Manage tasks for a spec
 *
 * Allows users to create, update, and delete tasks associated with a spec.
 * Shows task progress with status tracking and completion percentage.
 *
 * Previously named: TasksPanel
 */

import { useState } from 'react';
import { Plus, X, Check } from 'lucide-react';
import type { Task, TaskStatus } from '@capybara-chat/types';
import { Button, Input, Badge, Textarea, Select, Progress, EmptyState, ConfirmDeleteDialog } from '../ui';
import { getTaskStatusVariant } from '../../lib/badge-variants';

interface SpecTaskListProps {
  specId: string;
  tasks: Task[];
  onTasksChange?: (tasks: Task[]) => void;
}

/**
 * SpecTaskList manages tasks associated with a spec
 */
export function SpecTaskList({
  specId,
  tasks: initialTasks,
  onTasksChange
}: SpecTaskListProps) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [showAddTask, setShowAddTask] = useState(false);

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);

  const handleAddTask = () => {
    if (!newTaskTitle.trim()) return;

    const newTask: Task = {
      id: `task-${Date.now()}`,
      specId,
      title: newTaskTitle.trim(),
      description: newTaskDescription.trim(),
      status: 'PENDING',
      order: tasks.length,
      createdAt: Date.now()
    };

    const updatedTasks = [...tasks, newTask];
    setTasks(updatedTasks);
    onTasksChange?.(updatedTasks);
    setNewTaskTitle('');
    setNewTaskDescription('');
    setShowAddTask(false);
  };

  const handleUpdateTaskStatus = (taskId: string, status: TaskStatus) => {
    const updatedTasks = tasks.map((task) =>
      task.id === taskId ? { ...task, status, completedAt: status === 'COMPLETE' ? Date.now() : task.completedAt } : task
    );
    setTasks(updatedTasks);
    onTasksChange?.(updatedTasks);
  };

  const handleDeleteClick = (task: Task) => {
    setDeleteTarget(task);
  };

  const handleConfirmDelete = () => {
    if (deleteTarget) {
      const updatedTasks = tasks.filter((task) => task.id !== deleteTarget.id);
      setTasks(updatedTasks);
      onTasksChange?.(updatedTasks);
      setDeleteTarget(null);
    }
  };

  const completedCount = tasks.filter((t) => t.status === 'COMPLETE').length;
  const progressValue = tasks.length > 0 ? (completedCount / tasks.length) * 100 : 0;

  return (
    <div className="space-y-4" role="region" aria-label="Spec task list">
      {/* Delete Confirmation Dialog */}
      <ConfirmDeleteDialog
        open={!!deleteTarget}
        entityType="task"
        entityName={deleteTarget?.title}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Header with Progress */}
      <div className="flex justify-between items-center">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="font-semibold">Tasks</h3>
            <span className="text-sm text-muted-foreground" aria-label={`${completedCount} of ${tasks.length} tasks completed`}>
              {completedCount} / {tasks.length}
            </span>
          </div>
          <Progress value={progressValue} max={100} aria-label={`Task progress: ${Math.round(progressValue)}%`} />
        </div>
        <Button
          variant="ghost"
          onClick={() => setShowAddTask(!showAddTask)}
          className="ml-4"
          aria-expanded={showAddTask}
          aria-controls="add-task-form"
        >
          {showAddTask ? 'Cancel' : <><Plus className="w-4 h-4 mr-1" aria-hidden="true" /> Add Task</>}
        </Button>
      </div>

      {/* Add Task Form */}
      {showAddTask && (
        <div id="add-task-form" className="p-4 bg-muted/50 space-y-3">
          <Input
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            placeholder="Task title..."
            aria-label="Task title"
          />
          <Textarea
            value={newTaskDescription}
            onChange={(e) => setNewTaskDescription(e.target.value)}
            placeholder="Task description (optional)..."
            className="h-20"
            aria-label="Task description"
          />
          <Button onClick={handleAddTask} disabled={!newTaskTitle.trim()} className="w-full">
            Add Task
          </Button>
        </div>
      )}

      {/* Tasks List */}
      {tasks.length === 0 ? (
        <EmptyState message="No tasks yet. Click 'Add Task' to create one." />
      ) : (
        <div className="space-y-2" role="list">
          {tasks.map((task) => (
            <div
              key={task.id}
              className="p-3 bg-muted/50 hover:bg-muted transition-colors"
              role="listitem"
            >
              <div className="flex items-start gap-3">
                {/* Checkbox */}
                <Button
                  variant={task.status === 'COMPLETE' ? 'default' : 'outline'}
                  size="icon"
                  className="w-6 h-6 flex-shrink-0"
                  onClick={() =>
                    handleUpdateTaskStatus(
                      task.id,
                      task.status === 'COMPLETE' ? 'PENDING' : 'COMPLETE'
                    )
                  }
                  aria-label={task.status === 'COMPLETE' ? 'Mark as pending' : 'Mark as complete'}
                  aria-pressed={task.status === 'COMPLETE'}
                >
                  {task.status === 'COMPLETE' && <Check className="w-3 h-3" aria-hidden="true" />}
                </Button>

                {/* Task Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4
                      className={`font-medium ${task.status === 'COMPLETE' ? 'line-through text-muted-foreground' : ''
                        }`}
                    >
                      {task.title}
                    </h4>
                    <Badge {...getTaskStatusVariant(task.status)}>{task.status}</Badge>
                  </div>
                  {task.description && (
                    <p className="text-sm text-muted-foreground">{task.description}</p>
                  )}
                </div>

                {/* Status Dropdown */}
                <Select
                  value={task.status}
                  onChange={(e) =>
                    handleUpdateTaskStatus(task.id, e.target.value as TaskStatus)
                  }
                  className="w-32"
                  aria-label={`Change status for ${task.title}`}
                >
                  <option value="PENDING">Pending</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="COMPLETE">Complete</option>
                  <option value="SKIPPED">Skipped</option>
                </Select>

                {/* Delete */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDeleteClick(task)}
                  className="text-destructive hover:bg-destructive/10"
                  aria-label={`Delete task: ${task.title}`}
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** @deprecated Use SpecTaskList instead */
export const TasksPanel = SpecTaskList;
