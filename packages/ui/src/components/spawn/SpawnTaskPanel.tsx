/**
 * SpawnTaskPanel - Inline task spawning in Content Pane
 *
 * Replaces modal-based task creation with an inline page at /new-task.
 * Features:
 * - Searchable selectors for Spec, Workspace, Agent
 * - Agent filtered to task_agent role only
 * - Auto-detects {{variables}} from spec content
 * - Each variable gets its own input field
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Zap, ArrowLeft, FileText, FolderGit2, Bot, Variable, Loader2, Type, Cpu, Users } from 'lucide-react';
import { API_PATHS, AgentDefinitionRole, AgentModel, SpecStatus, MODEL_REGISTRY } from '@capybara-chat/types';
import type { Spec, Workspace, AgentDefinition, WorkerTask, AgentModel as AgentModelType } from '@capybara-chat/types';
import { Button, LoadingSpinner } from '../ui';
import { SearchableSelect } from '../ui/SearchableSelect';
import { useFetchList } from '../../hooks/useFetchList';
import { useServer } from '../../context/ServerContext';
import { useTasks } from '../../hooks/useTasks';
import { createLogger } from '../../lib/logger';

const log = createLogger('SpawnTaskPanel');

/** Extract {{variable}} patterns from content */
function extractVariables(content: string): string[] {
  const regex = /\{\{(\w+)\}\}/g;
  const matches = new Set<string>();
  let match;
  while ((match = regex.exec(content)) !== null) {
    matches.add(match[1]);
  }
  return Array.from(matches);
}

interface SpawnTaskPanelProps {
  /** Pre-select a spec (e.g., when navigating from SpecView "Run Task") */
  initialSpecId?: string;
  onBack?: () => void;
  onTaskCreated?: (task: WorkerTask) => void;
}

export function SpawnTaskPanel({ initialSpecId, onBack, onTaskCreated }: SpawnTaskPanelProps) {
  const { serverUrl } = useServer();
  const { createTask } = useTasks();

  // Task name
  const [taskName, setTaskName] = useState('');

  // Selection state
  const [selectedSpecId, setSelectedSpecId] = useState<string | null>(null);
  const [selectedSpec, setSelectedSpec] = useState<Spec | null>(null);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<AgentDefinition | null>(null);

  // Variable values
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});

  // Model override state
  const [modelOverride, setModelOverride] = useState<AgentModelType | ''>('');
  const [subagentModelOverrides, setSubagentModelOverrides] = useState<Record<string, AgentModelType>>({});

  // Form state
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

  // Fetch agents (filtered to task_agent role)
  const { items: allAgents, loading: agentsLoading } = useFetchList<AgentDefinition>({
    url: `${serverUrl}${API_PATHS.AGENT_DEFINITIONS}`,
    dataKey: 'agentDefinitions',
  });

  // Filter to task_agent role only
  const taskAgents = useMemo(() => {
    return allAgents.filter(agent => agent.role === AgentDefinitionRole.TASK_AGENT);
  }, [allAgents]);

  // Filter out completed/archived specs - no point spawning tasks for finished work
  const activeSpecs = useMemo(() => {
    return specs.filter(spec =>
      spec.workflowStatus !== SpecStatus.COMPLETE &&
      spec.workflowStatus !== SpecStatus.ARCHIVED
    );
  }, [specs]);

  // Auto-select initial spec when navigating from SpecView
  useEffect(() => {
    if (initialSpecId && specs.length > 0 && !selectedSpecId) {
      const spec = specs.find(s => s.id === initialSpecId);
      if (spec) {
        setSelectedSpecId(spec.id);
        setSelectedSpec(spec);
        setTaskName(`Task: ${spec.title}`);
        // Auto-select workspace if spec has one
        if (spec.workspaceId) {
          const ws = workspaces.find(w => w.id === spec.workspaceId);
          if (ws) {
            setSelectedWorkspaceId(ws.id);
            setSelectedWorkspace(ws);
          }
        }
      }
    }
  }, [initialSpecId, specs, workspaces, selectedSpecId]);

  // Auto-select default agent
  useEffect(() => {
    if (taskAgents.length > 0 && !selectedAgentId) {
      const defaultAgent = taskAgents.find(a => a.isDefault) || taskAgents[0];
      setSelectedAgentId(defaultAgent.id);
      setSelectedAgent(defaultAgent);
    }
  }, [taskAgents, selectedAgentId]);

  // Extract variables from selected spec
  const detectedVariables = useMemo(() => {
    if (!selectedSpec?.content) return [];
    return extractVariables(selectedSpec.content);
  }, [selectedSpec]);

  // Get available subagent names from selected agent
  const subagentNames = useMemo(() => {
    if (!selectedAgent?.agentContext?.subagents) return [];
    return Object.keys(selectedAgent.agentContext.subagents);
  }, [selectedAgent]);

  // Reset variable values when spec changes
  useEffect(() => {
    setVariableValues({});
  }, [selectedSpecId]);

  // Reset subagent model overrides when agent changes
  useEffect(() => {
    setSubagentModelOverrides({});
  }, [selectedAgentId]);

  // Fetch options for searchable selects
  const fetchSpecs = useCallback(async (query: string) => {
    const filtered = activeSpecs.filter(s =>
      s.title.toLowerCase().includes(query.toLowerCase())
    );
    return filtered;
  }, [activeSpecs]);

  const fetchWorkspaces = useCallback(async (query: string) => {
    const filtered = workspaces.filter(w =>
      w.name.toLowerCase().includes(query.toLowerCase())
    );
    return filtered;
  }, [workspaces]);

  const fetchAgents = useCallback(async (query: string) => {
    const filtered = taskAgents.filter(a =>
      a.name.toLowerCase().includes(query.toLowerCase())
    );
    return filtered;
  }, [taskAgents]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedSpecId || !selectedWorkspaceId || !selectedAgentId) {
      setError('Please select a spec, workspace, and agent');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const task = await createTask({
        name: taskName.trim() || undefined,
        specId: selectedSpecId,
        workspaceId: selectedWorkspaceId,
        agentDefinitionId: selectedAgentId,
        variables: Object.keys(variableValues).length > 0 ? variableValues : undefined,
        modelOverride: modelOverride || undefined,
        subagentModelOverrides: Object.keys(subagentModelOverrides).length > 0 ? subagentModelOverrides : undefined,
      });
      log.info('Task created', { taskId: task.id });
      onTaskCreated?.(task);
    } catch (err) {
      log.error('Failed to create task', { error: err });
      setError(err instanceof Error ? err.message : 'Failed to create task');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isLoading = specsLoading || workspacesLoading || agentsLoading;
  const canSubmit = selectedSpecId && selectedWorkspaceId && selectedAgentId && !isSubmitting;

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
        {onBack && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="h-7 px-2 -ml-2"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            <span className="text-xs">Back</span>
          </Button>
        )}
        <Zap className="w-5 h-5 text-primary" />
        <h1 className="font-mono font-bold text-lg tracking-tight">NEW TASK</h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <LoadingSpinner message="Loading options..." />
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6 max-w-xl">
            {/* Spec Selector - First so auto-fill name works */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-mono font-medium text-foreground/80">
                <FileText className="w-4 h-4" />
                SPEC
                <span className="text-destructive">*</span>
              </label>
              <SearchableSelect<Spec>
                value={selectedSpecId}
                selectedItem={selectedSpec}
                onChange={(id, spec) => {
                  setSelectedSpecId(id);
                  setSelectedSpec(spec);
                  // Auto-fill task name if blank
                  if (spec && !taskName.trim()) {
                    setTaskName(`Task: ${spec.title}`);
                  }
                  // Auto-select workspace if spec has one and workspace not already selected
                  if (spec?.workspaceId && !selectedWorkspaceId) {
                    const matchingWorkspace = workspaces.find(w => w.id === spec.workspaceId);
                    if (matchingWorkspace) {
                      setSelectedWorkspaceId(matchingWorkspace.id);
                      setSelectedWorkspace(matchingWorkspace);
                    }
                  }
                }}
                fetchOptions={fetchSpecs}
                getLabel={(s) => s.title}
                getValue={(s) => s.id}
                renderOption={(s) => (
                  <div>
                    <div className="font-medium">{s.title}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {s.workflowStatus} | {s.priority}
                    </div>
                  </div>
                )}
                placeholder="Search specs..."
                emptyMessage="No specs found"
              />
              {selectedSpec && (
                <div className="text-xs text-muted-foreground font-mono pl-6">
                  {selectedSpec.workflowStatus} | {selectedSpec.priority}
                </div>
              )}
            </div>

            {/* Task Name - Auto-filled from spec selection */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-mono font-medium text-foreground/80">
                <Type className="w-4 h-4" />
                NAME
              </label>
              <input
                type="text"
                value={taskName}
                onChange={(e) => setTaskName(e.target.value)}
                placeholder="Auto-filled from spec, or enter custom name..."
                maxLength={200}
                className="w-full px-3 py-2 bg-background border border-border text-sm font-mono focus:outline-none focus:border-primary transition-colors"
              />
              <div className="text-xs text-muted-foreground font-mono pl-6">
                Optional. Auto-fills as "Task: &lt;Spec Name&gt;" when you select a spec.
              </div>
            </div>

            {/* Workspace Selector */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-mono font-medium text-foreground/80">
                <FolderGit2 className="w-4 h-4" />
                WORKSPACE
                <span className="text-destructive">*</span>
              </label>
              <SearchableSelect<Workspace>
                value={selectedWorkspaceId}
                selectedItem={selectedWorkspace}
                onChange={(id, ws) => {
                  setSelectedWorkspaceId(id);
                  setSelectedWorkspace(ws);
                }}
                fetchOptions={fetchWorkspaces}
                getLabel={(w) => w.name}
                getValue={(w) => w.id}
                renderOption={(w) => (
                  <div>
                    <div className="font-medium">{w.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {w.repoOwner}/{w.repoName} | {w.defaultBranch}
                    </div>
                  </div>
                )}
                placeholder="Search workspaces..."
                emptyMessage="No workspaces found"
              />
              {selectedWorkspace && (
                <div className="text-xs text-muted-foreground font-mono pl-6">
                  Branch: {selectedWorkspace.defaultBranch}
                </div>
              )}
            </div>

            {/* Agent Selector */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-mono font-medium text-foreground/80">
                <Bot className="w-4 h-4" />
                AGENT
                <span className="text-destructive">*</span>
              </label>
              <SearchableSelect<AgentDefinition>
                value={selectedAgentId}
                selectedItem={selectedAgent}
                onChange={(id, agent) => {
                  setSelectedAgentId(id);
                  setSelectedAgent(agent);
                }}
                fetchOptions={fetchAgents}
                getLabel={(a) => a.name}
                getValue={(a) => a.id}
                renderOption={(a) => (
                  <div>
                    <div className="font-medium">
                      {a.name}
                      {a.isDefault && (
                        <span className="ml-2 text-xs text-primary">(default)</span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {a.description?.slice(0, 80)}...
                    </div>
                  </div>
                )}
                placeholder="Search task agents..."
                emptyMessage="No task agents found"
              />
              {selectedAgent && (
                <div className="text-xs text-muted-foreground font-mono pl-6">
                  Role: {selectedAgent.role}
                  {selectedAgent.isDefault && ' (default)'}
                </div>
              )}
            </div>

            {/* Model Override Selector */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-mono font-medium text-foreground/80">
                <Cpu className="w-4 h-4" />
                MODEL OVERRIDE
              </label>
              <select
                value={modelOverride}
                onChange={(e) => setModelOverride(e.target.value as AgentModelType | '')}
                className="w-full px-3 py-2 bg-background border border-border text-sm font-mono focus:outline-none focus:border-primary transition-colors"
              >
                <option value="">--default (from agent)--</option>
                {(Object.entries(MODEL_REGISTRY) as [string, { label: string }][]).map(([key, entry]) => (
                  <option key={key} value={key}>{entry.label}</option>
                ))}
              </select>
              <div className="text-xs text-muted-foreground font-mono pl-6">
                Override the main agent model for this task.
              </div>
            </div>

            {/* Subagent Model Overrides */}
            {subagentNames.length > 0 && (
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-mono font-medium text-foreground/80">
                  <Users className="w-4 h-4" />
                  SUBAGENT MODEL OVERRIDES
                  <span className="text-xs text-muted-foreground">
                    ({subagentNames.length} subagents)
                  </span>
                </label>
                <div className="space-y-3">
                  {subagentNames.map((subagentName) => (
                    <div key={subagentName} className="flex items-center gap-3">
                      <span className="text-sm font-mono text-foreground/70 w-32 truncate">
                        {subagentName}
                      </span>
                      <select
                        value={subagentModelOverrides[subagentName] || ''}
                        onChange={(e) =>
                          setSubagentModelOverrides((prev) => {
                            const value = e.target.value as AgentModelType | '';
                            if (value) {
                              return { ...prev, [subagentName]: value as AgentModelType };
                            } else {
                              const { [subagentName]: _, ...rest } = prev;
                              return rest;
                            }
                          })
                        }
                        className="flex-1 px-3 py-2 bg-background border border-border text-sm font-mono focus:outline-none focus:border-primary transition-colors"
                      >
                        <option value="">--default--</option>
                        {(Object.entries(MODEL_REGISTRY) as [string, { label: string }][]).map(([key, entry]) => (
                          <option key={key} value={key}>{entry.label}</option>
                        ))}
                        <option value={AgentModel.INHERIT}>Inherit from parent</option>
                      </select>
                    </div>
                  ))}
                </div>
                <div className="text-xs text-muted-foreground font-mono pl-6">
                  Override specific subagent models by name.
                </div>
              </div>
            )}

            {/* Variables Section */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-mono font-medium text-foreground/80">
                <Variable className="w-4 h-4" />
                VARIABLES
                {detectedVariables.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    ({detectedVariables.length} from spec)
                  </span>
                )}
              </label>

              {detectedVariables.length === 0 ? (
                <div className="px-4 py-3 bg-muted/30 border border-border text-sm text-muted-foreground font-mono">
                  No {'{{variables}}'} detected in spec.
                  <br />
                  Task will run with no substitutions.
                </div>
              ) : (
                <div className="space-y-3">
                  {detectedVariables.map((varName) => (
                    <div key={varName} className="space-y-1">
                      <label
                        htmlFor={`var-${varName}`}
                        className="block text-sm font-mono text-foreground/70"
                      >
                        {varName}
                      </label>
                      <input
                        id={`var-${varName}`}
                        type="text"
                        value={variableValues[varName] || ''}
                        onChange={(e) =>
                          setVariableValues((prev) => ({
                            ...prev,
                            [varName]: e.target.value,
                          }))
                        }
                        placeholder={`Enter ${varName}...`}
                        className="w-full px-3 py-2 bg-background border border-border text-sm font-mono focus:outline-none focus:border-primary transition-colors"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Error Message */}
            {error && (
              <div className="px-4 py-3 bg-destructive/10 border border-destructive text-destructive text-sm font-mono">
                {error}
              </div>
            )}

            {/* Submit Button */}
            <div className="pt-4 border-t border-border">
              <Button
                type="submit"
                disabled={!canSubmit}
                className="w-full font-mono"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="ml-2">SPAWNING...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 mr-2" />
                    SPAWN TASK
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
