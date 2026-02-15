/**
 * MCPServerEditor - List editor for MCP server configurations
 *
 * Redesigned for "Cozy Terminal" aesthetic:
 * - No active/inactive toggle (add/remove only)
 * - Inline editing when expanded
 * - KeyValue editor for environment variables
 */

import { useState, useCallback } from 'react';
import { Plus, Trash2, Server, ChevronDown, ChevronRight, Pencil } from 'lucide-react';
import type { AgentMCPServerConfig } from '@capybara-chat/types';
import { Button } from './Button';
import { Badge } from './Badge';
import { KeyValueEditor } from './KeyValueEditor';


export interface MCPServerEditorProps {
  value: AgentMCPServerConfig[];
  onChange: (servers: AgentMCPServerConfig[]) => void;
  disabled?: boolean;
}

const TEMPLATES: { label: string; config: Omit<AgentMCPServerConfig, 'enabled'> }[] = [
  {
    label: 'Huddle MCP',
    config: {
      name: 'capybara-huddle',
      command: 'npx',
      args: ['tsx', 'packages/huddle-mcp/src/cli.ts'],
    },
  },
];

interface ServerFormState {
  name: string;
  command: string;
  args: string;
  env: Record<string, string>;
}

const EMPTY_FORM: ServerFormState = { name: '', command: '', args: '', env: {} };

export function MCPServerEditor({ value, onChange, disabled = false }: MCPServerEditorProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newServer, setNewServer] = useState<ServerFormState>(EMPTY_FORM);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  const handleRemove = useCallback((idx: number) => {
    onChange(value.filter((_, i) => i !== idx));
    if (expandedIdx === idx) setExpandedIdx(null);
  }, [value, onChange, expandedIdx]);

  const handleAddFromTemplate = useCallback((template: typeof TEMPLATES[number]) => {
    // Don't add duplicates
    if (value.some(s => s.name === template.config.name)) return;
    onChange([...value, { ...template.config, enabled: true }]);
  }, [value, onChange]);

  const handleAddCustom = useCallback(() => {
    if (!newServer.name.trim() || !newServer.command.trim()) return;

    const args = newServer.args
      .split(',')
      .map(a => a.trim())
      .filter(Boolean);

    onChange([...value, {
      name: newServer.name.trim(),
      command: newServer.command.trim(),
      args,
      env: Object.keys(newServer.env).length > 0 ? newServer.env : undefined,
      enabled: true,
    }]);
    setNewServer(EMPTY_FORM);
    setShowAddForm(false);
  }, [value, onChange, newServer]);

  // Inline editing handlers
  const handleUpdateServer = useCallback((idx: number, updates: Partial<AgentMCPServerConfig>) => {
    const updated = [...value];
    updated[idx] = { ...updated[idx], ...updates };
    onChange(updated);
  }, [value, onChange]);

  const handleUpdateArgs = useCallback((idx: number, argsStr: string) => {
    const args = argsStr.split(',').map(a => a.trim()).filter(Boolean);
    handleUpdateServer(idx, { args });
  }, [handleUpdateServer]);

  const handleUpdateEnv = useCallback((idx: number, env: Record<string, string>) => {
    handleUpdateServer(idx, { env: Object.keys(env).length > 0 ? env : undefined });
  }, [handleUpdateServer]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-terminal-header flex items-center gap-1.5">
          <Server className="w-3 h-3" />
          MCP SERVERS
        </h4>
        {value.length > 0 && (
          <Badge variant="outline" size="sm" className="text-2xs">
            {value.length} configured
          </Badge>
        )}
      </div>

      {/* Server list */}
      {value.length > 0 && (
        <div className="space-y-1">
          {value.map((server, idx) => {
            const isExpanded = expandedIdx === idx;

            return (
              <div
                key={server.name}
                className="group border border-border/60 bg-card/50 transition-colors"
              >
                {/* Server row */}
                <div className="flex items-center gap-2 px-3 py-2">
                  <button
                    type="button"
                    onClick={() => setExpandedIdx(isExpanded ? null : idx)}
                    className="text-muted-foreground/50 hover:text-foreground transition-colors"
                    disabled={disabled}
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-3 h-3" />
                    ) : (
                      <ChevronRight className="w-3 h-3" />
                    )}
                  </button>

                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium truncate font-mono">{server.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground/50 font-mono">
                      {server.command} {(server.args ?? []).slice(0, 2).join(' ')}
                      {(server.args ?? []).length > 2 && '...'}
                    </span>
                  </div>

                  {!disabled && (
                    <>
                      <button
                        type="button"
                        onClick={() => setExpandedIdx(isExpanded ? null : idx)}
                        className="p-1 text-muted-foreground/40 hover:text-primary transition-colors"
                        title="Edit"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemove(idx)}
                        className="p-1 text-muted-foreground/40 hover:text-destructive transition-colors"
                        title="Remove"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </>
                  )}
                </div>

                {/* Expanded editing panel */}
                {isExpanded && (
                  <div className="px-3 pb-3 pt-1 border-t border-border/60 space-y-3">
                    {/* Command (read-only for templates, editable for custom) */}
                    <div>
                      <label className="block text-2xs font-mono text-muted-foreground uppercase tracking-wide mb-1">
                        COMMAND
                      </label>
                      <input
                        type="text"
                        value={server.command}
                        onChange={(e) => handleUpdateServer(idx, { command: e.target.value })}
                        disabled={disabled}
                        className="w-full h-7 px-2 bg-transparent border-b border-border font-mono text-xs placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary transition-colors disabled:opacity-50"
                      />
                    </div>

                    {/* Args */}
                    <div>
                      <label className="block text-2xs font-mono text-muted-foreground uppercase tracking-wide mb-1">
                        ARGS <span className="text-muted-foreground/50">(comma-separated)</span>
                      </label>
                      <input
                        type="text"
                        value={(server.args ?? []).join(', ')}
                        onChange={(e) => handleUpdateArgs(idx, e.target.value)}
                        placeholder="tsx, path/to/cli.ts"
                        disabled={disabled}
                        className="w-full h-7 px-2 bg-transparent border-b border-border font-mono text-xs placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary transition-colors disabled:opacity-50"
                      />
                    </div>

                    {/* Inject Docs Toggle */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleUpdateServer(idx, { injectDocs: !(server.injectDocs ?? true) })}
                        disabled={disabled}
                        className={`font-mono text-xs transition-colors ${(server.injectDocs ?? true)
                            ? 'text-primary hover:text-primary/80'
                            : 'text-muted-foreground/50 hover:text-muted-foreground'
                          } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                        title="Inject MCP tool documentation into agent system prompt"
                      >
                        <span className="opacity-60">[</span>
                        <span className={(server.injectDocs ?? true) ? 'text-primary' : 'opacity-40'}>
                          {(server.injectDocs ?? true) ? 'x' : ' '}
                        </span>
                        <span className="opacity-60">]</span>
                        <span className="ml-1">INJECT_DOCS</span>
                      </button>
                      <span className="text-2xs text-muted-foreground/50">
                        (auto-inject tool usage docs into system prompt)
                      </span>
                    </div>

                    {/* Environment Variables */}
                    <div>
                      <label className="block text-2xs font-mono text-muted-foreground uppercase tracking-wide mb-1">
                        ENVIRONMENT
                      </label>
                      <KeyValueEditor
                        value={server.env}
                        onChange={(env) => handleUpdateEnv(idx, env)}
                        disabled={disabled}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {value.length === 0 && !showAddForm && (
        <div className="py-4 text-center border border-dashed border-border/60">
          <p className="text-xs text-muted-foreground/50 font-mono">No MCP servers configured</p>
        </div>
      )}

      {/* Add form */}
      {showAddForm && (
        <div className="space-y-3 p-3 border border-primary/20 bg-primary/[0.02]">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-2xs font-mono text-muted-foreground uppercase tracking-wide mb-1">
                NAME
              </label>
              <input
                type="text"
                value={newServer.name}
                onChange={(e) => setNewServer(s => ({ ...s, name: e.target.value }))}
                placeholder="my-mcp-server"
                disabled={disabled}
                className="w-full h-7 px-2 bg-transparent border-b border-border font-mono text-xs placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary transition-colors"
              />
            </div>
            <div>
              <label className="block text-2xs font-mono text-muted-foreground uppercase tracking-wide mb-1">
                COMMAND
              </label>
              <input
                type="text"
                value={newServer.command}
                onChange={(e) => setNewServer(s => ({ ...s, command: e.target.value }))}
                placeholder="npx"
                disabled={disabled}
                className="w-full h-7 px-2 bg-transparent border-b border-border font-mono text-xs placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-2xs font-mono text-muted-foreground uppercase tracking-wide mb-1">
              ARGS <span className="text-muted-foreground/50">(comma-separated)</span>
            </label>
            <input
              type="text"
              value={newServer.args}
              onChange={(e) => setNewServer(s => ({ ...s, args: e.target.value }))}
              placeholder="tsx, path/to/cli.ts"
              disabled={disabled}
              className="w-full h-7 px-2 bg-transparent border-b border-border font-mono text-xs placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          <div>
            <label className="block text-2xs font-mono text-muted-foreground uppercase tracking-wide mb-1">
              ENVIRONMENT
            </label>
            <KeyValueEditor
              value={newServer.env}
              onChange={(env) => setNewServer(s => ({ ...s, env }))}
              disabled={disabled}
            />
          </div>

          <div className="flex justify-end gap-1.5 pt-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setShowAddForm(false); setNewServer(EMPTY_FORM); }}
              className="h-6 text-xs uppercase tracking-wide"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleAddCustom}
              disabled={!newServer.name.trim() || !newServer.command.trim() || disabled}
              className="h-6 text-xs uppercase tracking-wide"
            >
              Add
            </Button>
          </div>
        </div>
      )}

      {/* Add buttons */}
      {!disabled && !showAddForm && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {TEMPLATES.filter(t => !value.some(s => s.name === t.config.name)).map((template) => (
            <Button
              key={template.config.name}
              variant="outline"
              size="sm"
              onClick={() => handleAddFromTemplate(template)}
              className="h-6 text-xs gap-1 border-dashed uppercase tracking-wide"
            >
              <Plus className="w-2.5 h-2.5" />
              {template.label}
            </Button>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAddForm(true)}
            className="h-6 text-xs gap-1 border-dashed uppercase tracking-wide"
          >
            <Plus className="w-2.5 h-2.5" />
            Custom
          </Button>
        </div>
      )}
    </div>
  );
}
