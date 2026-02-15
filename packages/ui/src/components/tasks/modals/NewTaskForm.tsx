/**
 * NewTaskForm - Form for creating a new worker task
 *
 * Extracted from TasksLibrary for better separation of concerns.
 */

import { useState } from 'react';
import { API_PATHS } from '@capybara-chat/types';
import type { WorkerTask, Spec, Workspace } from '@capybara-chat/types';
import { Button, Input, LoadingSpinner, Select } from '../../ui';
import { useFetchList } from '../../../hooks/useFetchList';
import { useTechniques } from '../../../hooks/useTechniques';

export interface NewTaskFormProps {
  serverUrl: string;
  onCreated: () => void;
  onCancel: () => void;
  createTask: (data: {
    specId: string;
    workspaceId: string;
    techniqueId: string;
    variables?: Record<string, unknown>;
    maxAttempts?: number;
  }) => Promise<WorkerTask>;
}

export function NewTaskForm({ serverUrl, onCreated, onCancel, createTask }: NewTaskFormProps) {
  const [selectedSpecId, setSelectedSpecId] = useState('');
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState('');
  const [selectedTechniqueId, setSelectedTechniqueId] = useState('');
  const [variables, setVariables] = useState<Record<string, unknown>>({});
  const [maxAttempts, setMaxAttempts] = useState(3);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch specs
  const { items: specs, loading: specsLoading } = useFetchList<Spec>({
    url: `${serverUrl}${API_PATHS.SPECS}`,
    dataKey: 'specs',
  });

  // Fetch workspaces
  const { items: workspaces, loading: workspacesLoading } = useFetchList<Workspace>({
    url: `${serverUrl}${API_PATHS.WORKSPACES}`,
    dataKey: 'workspaces',
  });

  // Fetch techniques
  const { techniques, isLoading: techniquesLoading } = useTechniques();

  const selectedTechnique = techniques.find(t => t.id === selectedTechniqueId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedSpecId || !selectedWorkspaceId || !selectedTechniqueId) {
      setError('Please select a spec, workspace, and technique');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await createTask({
        specId: selectedSpecId,
        workspaceId: selectedWorkspaceId,
        techniqueId: selectedTechniqueId,
        variables,
        maxAttempts,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isLoading = specsLoading || workspacesLoading || techniquesLoading;

  return (
    <form onSubmit={handleSubmit} className="space-y-4 font-mono">
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <span className="text-muted-foreground">spawn</span>
        <span className="font-bold">NEW_TASK</span>
      </div>

      {isLoading ? (
        <LoadingSpinner message="Loading options..." />
      ) : (
        <>
          {/* Spec Selection */}
          <div className="space-y-1">
            <label htmlFor="task-spec" className="text-sm font-medium">
              spec <span className="text-destructive">*</span>
            </label>
            <Select
              id="task-spec"
              value={selectedSpecId}
              onChange={(e) => setSelectedSpecId(e.target.value)}
              required
              className="rounded-none"
            >
              <option value="">--select--</option>
              {specs.map((spec) => (
                <option key={spec.id} value={spec.id}>
                  {spec.title}
                </option>
              ))}
            </Select>
          </div>

          {/* Workspace Selection */}
          <div className="space-y-1">
            <label htmlFor="task-workspace" className="text-sm font-medium">
              workspace <span className="text-destructive">*</span>
            </label>
            <Select
              id="task-workspace"
              value={selectedWorkspaceId}
              onChange={(e) => setSelectedWorkspaceId(e.target.value)}
              required
              className="rounded-none"
            >
              <option value="">--select--</option>
              {workspaces.map((workspace) => (
                <option key={workspace.id} value={workspace.id}>
                  {workspace.name}
                </option>
              ))}
            </Select>
          </div>

          {/* Technique Selection */}
          <div className="space-y-1">
            <label htmlFor="task-technique" className="text-sm font-medium">
              technique <span className="text-destructive">*</span>
            </label>
            <Select
              id="task-technique"
              value={selectedTechniqueId}
              onChange={(e) => setSelectedTechniqueId(e.target.value)}
              required
              className="rounded-none"
            >
              <option value="">--select--</option>
              {techniques.map((technique) => (
                <option key={technique.id} value={technique.id}>
                  {technique.name}
                </option>
              ))}
            </Select>
            {selectedTechnique?.description && (
              <p className="text-xs text-muted-foreground">{selectedTechnique.description}</p>
            )}
          </div>

          {/* Variables (JSON) */}
          {selectedTechnique?.variablesSchema && (
            <div className="space-y-1">
              <label htmlFor="task-variables" className="text-sm font-medium">
                variables
              </label>
              <p className="text-xs text-muted-foreground">
                Configure technique-specific variables (JSON format)
              </p>
              <textarea
                id="task-variables"
                className="w-full px-3 py-2 border border-border bg-card text-foreground text-sm font-mono resize-y focus:outline-none focus:border-primary"
                value={JSON.stringify(variables, null, 2)}
                onChange={(e) => {
                  try {
                    setVariables(JSON.parse(e.target.value || '{}'));
                  } catch {
                    // Invalid JSON, ignore
                  }
                }}
                placeholder="{}"
                rows={4}
              />
            </div>
          )}

          {/* Max Attempts */}
          <div className="space-y-1">
            <label htmlFor="task-max-attempts" className="text-sm font-medium">
              max_attempts
            </label>
            <Input
              id="task-max-attempts"
              type="number"
              min={1}
              max={10}
              value={maxAttempts}
              onChange={(e) => setMaxAttempts(Number(e.target.value))}
              className="w-24 rounded-none"
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="px-3 py-2 bg-destructive/10 border border-destructive text-destructive text-sm">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting} className="rounded-none">
              cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !selectedSpecId || !selectedWorkspaceId || !selectedTechniqueId}
              className="rounded-none"
            >
              {isSubmitting ? 'spawning...' : 'spawn'}
            </Button>
          </div>
        </>
      )}
    </form>
  );
}
