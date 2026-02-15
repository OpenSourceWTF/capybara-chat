/**
 * NewChatMenu - Agent picker dropdown for new chat creation
 *
 * Shows a popup menu when clicking "New Chat" that lists available
 * assistant agents. User can select an agent to use for the new session.
 *
 * Styled like DevMenu for consistency.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { Plus, Bot, Loader2 } from 'lucide-react';
import { Button } from '../ui';
import { api } from '../../lib/api';
import { createLogger } from '../../lib/logger';
import { useServer } from '../../context/ServerContext';
import { cn } from '../../lib/utils';
import { API_PATHS, EntityStatus, AgentDefinitionRole } from '@capybara-chat/types';
import type { AgentDefinition } from '@capybara-chat/types';

const log = createLogger('NewChatMenu');

interface NewChatMenuProps {
  /** Called when an agent is selected (or null for default) */
  onSelect: (agentDefinitionId?: string) => void;
  /** Custom class name */
  className?: string;
  /** Render as icon-only button (for collapsed sidebar) */
  iconOnly?: boolean;
}

export function NewChatMenu({ onSelect, className, iconOnly = false }: NewChatMenuProps) {
  const { serverUrl } = useServer();
  const [open, setOpen] = useState(false);
  const [agents, setAgents] = useState<AgentDefinition[]>([]);
  const [loading, setLoading] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Fetch agents when menu opens
  useEffect(() => {
    if (!open) return;

    const fetchAgents = async () => {
      setLoading(true);
      try {
        const res = await api.get(`${serverUrl}${API_PATHS.AGENT_DEFINITIONS}?status=${EntityStatus.PUBLISHED}&role=${AgentDefinitionRole.ASSISTANT}`);
        if (res.ok) {
          const data = await res.json();
          // Filter to assistant-type agents only (double-check in case API doesn't filter)
          const assistants = (data.agentDefinitions || []).filter(
            (a: AgentDefinition) => a.role === AgentDefinitionRole.ASSISTANT
          );
          setAgents(assistants);
        }
      } catch (err) {
        log.error('Failed to fetch agents', { error: err });
      } finally {
        setLoading(false);
      }
    };

    fetchAgents();
  }, [open, serverUrl]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleSelect = useCallback((agentId?: string) => {
    setOpen(false);
    onSelect(agentId);
  }, [onSelect]);

  // Icon-only mode (collapsed sidebar)
  if (iconOnly) {
    return (
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setOpen(!open)}
          className="sidebar-collapsed-icon sidebar-collapsed-add"
          title="New Chat"
        >
          <Plus className="w-4 h-4" />
        </button>

        {open && (
          <div className="absolute left-full top-0 ml-2 w-56 bg-card border border-border/60 shadow-lg z-50 overflow-hidden animate-in fade-in slide-in-from-left-1 duration-150">
            <div className="px-3 py-2 border-b border-border/40 flex items-center gap-1.5">
              <Bot className="w-3 h-3 text-primary" />
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Select Agent</span>
            </div>

            <div className="p-1.5 space-y-0.5 max-h-[300px] overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  {/* Agent list */}
                  {agents.map((agent) => (
                    <button
                      key={agent.id}
                      onClick={() => handleSelect(agent.id)}
                      className="w-full flex items-start gap-2.5 px-2.5 py-2 text-left transition-colors hover:bg-primary/5 hover:text-primary"
                    >
                      <Bot className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-medium truncate">{agent.name || agent.slug}</span>
                          {agent.isDefault && (
                            <span className="text-2xs px-1 py-0.5 bg-primary/10 text-primary rounded font-medium">default</span>
                          )}
                        </div>
                        {agent.description && (
                          <div className="text-2xs text-muted-foreground/60 mt-0.5 line-clamp-1">{agent.description}</div>
                        )}
                      </div>
                    </button>
                  ))}

                  {agents.length === 0 && !loading && (
                    <div className="px-2.5 py-3 text-2xs text-muted-foreground/50 text-center font-mono">
                      No agents available
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Full button mode (expanded sidebar)
  return (
    <div className="relative" ref={menuRef}>
      <Button
        variant="ghost"
        onClick={() => setOpen(!open)}
        className={cn("session-sidebar-new-btn", className)}
      >
        <Plus className="w-4 h-4 session-sidebar-new-icon" />
        <span>New Chat</span>
      </Button>

      {open && (
        <div className="absolute left-0 bottom-full mb-1 w-full bg-card border border-border/60 shadow-lg z-50 overflow-hidden animate-in fade-in slide-in-from-bottom-1 duration-150">
          <div className="px-3 py-2 border-b border-border/40 flex items-center gap-1.5">
            <Bot className="w-3 h-3 text-primary" />
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Select Agent</span>
          </div>

          <div className="p-1.5 space-y-0.5 max-h-[250px] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {/* Agent list */}
                {agents.map((agent) => (
                  <button
                    key={agent.id}
                    onClick={() => handleSelect(agent.id)}
                    className="w-full flex items-start gap-2.5 px-2.5 py-2 text-left transition-colors hover:bg-primary/5 hover:text-primary"
                  >
                    <Bot className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium truncate">{agent.name || agent.slug}</span>
                        {agent.isDefault && (
                          <span className="text-2xs px-1 py-0.5 bg-primary/10 text-primary rounded font-medium">default</span>
                        )}
                      </div>
                      {agent.description && (
                        <div className="text-2xs text-muted-foreground/60 mt-0.5 line-clamp-1">{agent.description}</div>
                      )}
                    </div>
                  </button>
                ))}

                {agents.length === 0 && !loading && (
                  <div className="px-2.5 py-3 text-2xs text-muted-foreground/50 text-center font-mono">
                    No agents available
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
