/**
 * SubagentEditor - List editor for subagent links
 *
 * Features:
 * - List of linked subagents with optional description override
 * - Shows agent's own description as placeholder (auto-composed if override empty)
 * - Add sub-agent via SearchableSelect
 * - Excludes current agent and already-linked agents
 */

import { useState, useCallback } from 'react';
import { Plus, Trash2, Users } from 'lucide-react';
import type { SubagentLink, AgentDefinition } from '@capybara-chat/types';
import { API_PATHS, AgentModel, MODEL_REGISTRY } from '@capybara-chat/types';
import { Button } from './Button';
import { Badge } from './Badge';
import { SearchableSelect } from './SearchableSelect';
import { api } from '../../lib/api';

export interface SubagentEditorProps {
  value: SubagentLink[];
  onChange: (links: SubagentLink[]) => void;
  currentAgentId?: string;
  serverUrl?: string;
  disabled?: boolean;
}

export function SubagentEditor({
  value,
  onChange,
  currentAgentId,
  serverUrl = '',
  disabled = false,
}: SubagentEditorProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [agentNames, setAgentNames] = useState<Record<string, string>>({});
  const [agentDescriptions, setAgentDescriptions] = useState<Record<string, string>>({});

  // Fetch agent definitions for the picker (excluding current + already linked)
  const fetchAgents = useCallback(async (query: string): Promise<AgentDefinition[]> => {
    try {
      const params = new URLSearchParams();
      if (query) params.set('search', query);
      params.set('status', 'published');
      const url = `${serverUrl}${API_PATHS.AGENT_DEFINITIONS}?${params}`;
      const res = await api.get(url);
      if (!res.ok) return [];
      const data = await res.json();
      const items: AgentDefinition[] = Array.isArray(data) ? data : (data.data || data.agentDefinitions || []);

      // Cache names and descriptions for display
      const nameMap: Record<string, string> = { ...agentNames };
      const descMap: Record<string, string> = { ...agentDescriptions };
      for (const item of items) {
        nameMap[item.id] = item.name;
        if (item.description) descMap[item.id] = item.description;
      }
      setAgentNames(nameMap);
      setAgentDescriptions(descMap);

      // Filter out current agent and already-linked
      const linkedIds = new Set(value.map(l => l.agentDefinitionId));
      return items.filter(a =>
        a.id !== currentAgentId && !linkedIds.has(a.id)
      );
    } catch {
      return [];
    }
  }, [serverUrl, currentAgentId, value, agentNames, agentDescriptions]);

  const handleAdd = useCallback((_id: string | null, agent: AgentDefinition | null) => {
    if (!agent) return;
    onChange([...value, {
      agentDefinitionId: agent.id,
      descriptionOverride: '',
    }]);
    setAgentNames(prev => ({ ...prev, [agent.id]: agent.name }));
    if (agent.description) {
      setAgentDescriptions(prev => ({ ...prev, [agent.id]: agent.description }));
    }
    setShowPicker(false);
  }, [value, onChange]);

  const handleRemove = useCallback((idx: number) => {
    onChange(value.filter((_, i) => i !== idx));
  }, [value, onChange]);

  const handleDescriptionChange = useCallback((idx: number, description: string) => {
    const updated = [...value];
    updated[idx] = { ...updated[idx], descriptionOverride: description };
    onChange(updated);
  }, [value, onChange]);

  const handleModelChange = useCallback((idx: number, model: string) => {
    const updated = [...value];
    // 'inherit' explicitly means use parent's model (stored as undefined in SDK)
    const modelValue = model === 'inherit' ? undefined : model as SubagentLink['model'];
    updated[idx] = { ...updated[idx], model: modelValue };
    onChange(updated);
  }, [value, onChange]);

  const handleSetAllModels = useCallback((model: string) => {
    // 'inherit' explicitly means use parent's model (stored as undefined in SDK)
    const modelValue = model === 'inherit' ? undefined : model as SubagentLink['model'];
    const updated = value.map(link => ({
      ...link,
      model: modelValue,
    }));
    onChange(updated);
  }, [value, onChange]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-terminal-header flex items-center gap-1.5">
          <Users className="w-3 h-3" />
          SUB-AGENTS
        </h4>
        <div className="flex items-center gap-2">
          {value.length > 1 && !disabled && (
            <select
              onChange={(e) => e.target.value && handleSetAllModels(e.target.value)}
              className="h-5 text-2xs font-mono bg-background border border-border/60 px-1 rounded-none focus:outline-none focus:ring-1 focus:ring-primary/20"
              defaultValue=""
            >
              <option value="">Set All Models</option>
              {(Object.keys(MODEL_REGISTRY) as string[]).map((key) => (
                <option key={key} value={key}>{key}</option>
              ))}
              <option value={AgentModel.INHERIT}>inherit</option>
            </select>
          )}
          {value.length > 0 && (
            <Badge variant="outline" size="sm" className="text-2xs">
              {value.length} linked
            </Badge>
          )}
        </div>
      </div>

      {/* Subagent list */}
      {value.length > 0 && (
        <div className="space-y-2">
          {value.map((link, idx) => {
            const name = agentNames[link.agentDefinitionId] || link.agentDefinitionId;
            const defaultDesc = agentDescriptions[link.agentDefinitionId] || '';
            const hasOverride = !!link.descriptionOverride?.trim();

            return (
              <div
                key={link.agentDefinitionId}
                className="group rounded-none border border-border/60 bg-card/50 p-3 transition-colors"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge variant="soft" intent="neutral" size="sm" className="shrink-0">
                      {name}
                    </Badge>
                    {link.alias && (
                      <span className="text-xs text-muted-foreground/50 truncate font-mono">
                        as "{link.alias}"
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      value={link.model || 'inherit'}
                      onChange={(e) => handleModelChange(idx, e.target.value)}
                      disabled={disabled}
                      className="h-5 text-2xs font-mono bg-background border border-border/60 px-1 rounded-none focus:outline-none focus:ring-1 focus:ring-primary/20"
                    >
                      <option value={AgentModel.INHERIT}>inherit</option>
                      {(Object.keys(MODEL_REGISTRY) as string[]).map((key) => (
                        <option key={key} value={key}>{key}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => handleRemove(idx)}
                      disabled={disabled}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded-none text-muted-foreground/50 hover:text-destructive transition-all"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Description override (optional - falls back to agent's own description) */}
                <div className="relative">
                  <textarea
                    value={link.descriptionOverride || ''}
                    onChange={(e) => handleDescriptionChange(idx, e.target.value)}
                    placeholder={defaultDesc || 'Override delegation description (optional)'}
                    disabled={disabled}
                    rows={2}
                    className="w-full text-xs font-mono rounded-none border border-border/60 bg-background/50 px-2.5 py-1.5 resize-none transition-colors placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary/50"
                  />
                  {!hasOverride && defaultDesc && (
                    <div className="mt-1 text-2xs bg-muted/20 px-2 py-1 select-none text-muted-foreground/50 font-mono italic">
                      Using agent's description (auto-composed)
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {value.length === 0 && !showPicker && (
        <div className="py-4 text-center border border-dashed border-border/60 rounded-none">
          <p className="text-xs text-muted-foreground/50 font-mono">No sub-agents linked</p>
        </div>
      )}

      {/* Picker */}
      {showPicker && (
        <div className="space-y-2">
          <SearchableSelect<AgentDefinition>
            fetchOptions={fetchAgents}
            renderOption={(agent) => (
              <div>
                <div className="font-medium text-sm">{agent.name}</div>
                {agent.description && (
                  <div className="text-xs text-muted-foreground/60 truncate mt-0.5">
                    {agent.description}
                  </div>
                )}
              </div>
            )}
            getLabel={(agent) => agent.name}
            getValue={(agent) => agent.id}
            value={null}
            onChange={handleAdd}
            placeholder="Search agent definitions..."
            emptyMessage="No matching agents"
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowPicker(false)}
            className="h-6 text-xs"
          >
            Cancel
          </Button>
        </div>
      )}

      {/* Add button */}
      {!disabled && !showPicker && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowPicker(true)}
          className="h-6 text-xs gap-1 border-dashed"
        >
          <Plus className="w-2.5 h-2.5" />
          Add Sub-Agent
        </Button>
      )}
    </div>
  );
}
