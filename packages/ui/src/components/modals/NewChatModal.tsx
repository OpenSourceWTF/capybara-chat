/**
 * NewChatModal - Modal for creating a new chat with agent selection
 *
 * 168-right-bar-elimination: Replaces the inline NewChatMenu dropdown
 * with a proper modal that lets users browse and select an agent.
 *
 * Terminal aesthetic: zero radius, monospace, bracketed tags, warm palette.
 */

import { useState, useEffect, useCallback } from 'react';
import { Bot, Loader2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody } from '../ui/Dialog';
import { api } from '../../lib/api';
import { createLogger } from '../../lib/logger';
import { useServer } from '../../context/ServerContext';
import { API_PATHS, EntityStatus, AgentDefinitionRole } from '@capybara-chat/types';
import type { AgentDefinition } from '@capybara-chat/types';

const log = createLogger('NewChatModal');

interface NewChatModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (agentDefinitionId?: string) => void;
}

export function NewChatModal({ open, onClose, onSelect }: NewChatModalProps) {
  const { serverUrl } = useServer();
  const [agents, setAgents] = useState<AgentDefinition[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Fetch agents when modal opens
  useEffect(() => {
    if (!open) return;

    setSelectedId(null);

    const fetchAgents = async () => {
      setLoading(true);
      try {
        const res = await api.get(
          `${serverUrl}${API_PATHS.AGENT_DEFINITIONS}?status=${EntityStatus.PUBLISHED}&role=${AgentDefinitionRole.ASSISTANT}`
        );
        if (res.ok) {
          const data = await res.json();
          const assistants = (data.agentDefinitions || []).filter(
            (a: AgentDefinition) => a.role === AgentDefinitionRole.ASSISTANT
          );
          setAgents(assistants);

          // Pre-select default agent
          const defaultAgent = assistants.find((a: AgentDefinition) => a.isDefault);
          if (defaultAgent) {
            setSelectedId(defaultAgent.id);
          }
        }
      } catch (err) {
        log.error('Failed to fetch agents', { error: err });
      } finally {
        setLoading(false);
      }
    };

    fetchAgents();
  }, [open, serverUrl]);

  const handleCreate = useCallback(() => {
    onSelect(selectedId || undefined);
    onClose();
  }, [selectedId, onSelect, onClose]);

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader onClose={onClose}>
          <DialogTitle className="flex items-center gap-2 uppercase tracking-wider text-base">
            <Bot className="w-4 h-4" />
            NEW_SESSION
          </DialogTitle>
        </DialogHeader>

        <DialogBody className="py-4 px-0">
          <div className="px-6 pb-3">
            <span className="text-2xs font-mono font-bold text-muted-foreground uppercase tracking-widest">
              SELECT_AGENT
            </span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : agents.length === 0 ? (
            <div className="px-6 py-8 text-center text-muted-foreground text-xs font-mono">
              // NO_AGENTS_AVAILABLE
            </div>
          ) : (
            <div className="flex flex-col">
              {agents.map((agent) => {
                const isSelected = agent.id === selectedId;
                return (
                  <button
                    key={agent.id}
                    onClick={() => setSelectedId(agent.id)}
                    onDoubleClick={() => {
                      onSelect(agent.id);
                      onClose();
                    }}
                    className={`w-full flex items-start gap-3 px-6 py-3 text-left transition-colors border-l-2
                      ${isSelected
                        ? 'border-primary bg-primary/5 text-foreground'
                        : 'border-transparent hover:bg-muted/50 text-foreground/80 hover:text-foreground'
                      }`}
                  >
                    <Bot className={`w-4 h-4 mt-0.5 shrink-0 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold truncate uppercase tracking-wider">
                          {agent.name || agent.slug}
                        </span>
                        {agent.isDefault && (
                          <span className="text-2xs font-mono font-bold text-primary">
                            [DEFAULT]
                          </span>
                        )}
                      </div>
                      {agent.description && (
                        <div className="text-2xs text-muted-foreground mt-1 line-clamp-2 font-mono">
                          {agent.description}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Create button */}
          <div className="px-6 pt-4 border-t border-border mt-2">
            <Button
              onClick={handleCreate}
              disabled={loading}
              className="w-full h-10 bg-primary text-primary-foreground hover:bg-primary-hover uppercase tracking-wider font-mono text-xs"
            >
              CREATE_SESSION
            </Button>
            <p className="text-2xs text-muted-foreground/60 mt-2 text-center font-mono">
              Double-click an agent to create immediately
            </p>
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
