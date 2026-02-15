/**
 * AgentDefinitionsLibrary - Browse and manage agent definitions
 *
 * Uses GenericLibrary for common functionality, only provides
 * configuration and custom item rendering.
 *
 * Note: System agents (isSystem=true) have delete action hidden.
 */

import { Cpu, Link2, Lock } from 'lucide-react';
import type { AgentDefinition } from '@capybara-chat/types';
import { API_PATHS, EntityStatus, SOCKET_EVENTS, resolveModelLabel } from '@capybara-chat/types';
import { Badge, TerminalRow, TerminalTag, ASCIIFaceAvatar } from '../ui';
import { GenericLibrary, type LibraryConfig } from './GenericLibrary';
import { formatLibraryTimestamp, formatFullTimestamp } from '../../lib/date-formatting';

/**
 * Agent definitions library configuration
 */
const AGENT_DEFINITIONS_CONFIG: LibraryConfig<AgentDefinition> = {
  apiPath: API_PATHS.AGENT_DEFINITIONS,
  dataKey: 'agentDefinitions',
  entityType: 'agentDefinition',
  socketEvents: [
    SOCKET_EVENTS.AGENT_DEFINITION_CREATED,
    SOCKET_EVENTS.AGENT_DEFINITION_UPDATED,
    SOCKET_EVENTS.AGENT_DEFINITION_DELETED,
  ],
  searchFields: ['name', 'description'],
  commandPrefix: 'ps aux | grep',
  searchPlaceholder: 'agent_filter...',
  newButtonLabel: 'spawn new_agent',
  loadingMessage: 'Loading agents...',
  emptyMessage: 'No agents found.',
  emptyActionLabel: 'spawn default_agent',
  deleteLabel: 'Delete agent',
};

interface AgentDefinitionsLibraryProps {
  serverUrl?: string;
  onAgentSelect?: (agent: AgentDefinition) => void;
  onNewAgent?: () => void;
}

export function AgentDefinitionsLibrary({
  serverUrl,
  onAgentSelect,
  onNewAgent,
}: AgentDefinitionsLibraryProps) {
  return (
    <GenericLibrary<AgentDefinition>
      config={AGENT_DEFINITIONS_CONFIG}
      serverUrl={serverUrl}
      onSelect={onAgentSelect}
      onNew={onNewAgent}
      renderItem={({ item: agent, isOwner, onSelect, deleteAction }) => (
        <TerminalRow
          key={agent.id}
          onClick={onSelect}
          title={
            <span className="flex items-center gap-2">
              <ASCIIFaceAvatar id={agent.id} />
              {agent.name}
              {agent.isSystem && (
                <Badge
                  variant="soft"
                  intent="primary"
                  size="sm"
                  className="gap-0.5"
                >
                  <Lock className="w-2.5 h-2.5" /> System
                </Badge>
              )}
              {agent.status === EntityStatus.DRAFT && (
                <Badge variant="soft" intent="neutral" size="sm">
                  Draft
                </Badge>
              )}
              {(agent.author || agent.createdBy) && (
                <span className="text-2xs text-muted-foreground/60 font-mono">
                  {agent.author ? `By ${agent.author.name}` : `@${agent.createdBy}`}
                </span>
              )}
            </span>
          }
          date={formatLibraryTimestamp(agent.updatedAt)}
          dateTooltip={formatFullTimestamp(agent.updatedAt)}
          meta={
            <>
              <span className="flex items-center gap-1">
                <Cpu className="w-3 h-3 opacity-60" />
                {resolveModelLabel(agent.agentContext?.model)}
              </span>
              {agent.agentContext?.subagents &&
                Object.keys(agent.agentContext.subagents).length > 0 && (
                  <span className="flex items-center gap-1 opacity-70">
                    <Link2 className="w-3 h-3" />
                    {Object.keys(agent.agentContext.subagents).length} subagent
                    {Object.keys(agent.agentContext.subagents).length !== 1
                      ? 's'
                      : ''}
                  </span>
                )}
            </>
          }
          actions={
            // Hide delete action for system agents and non-owned agents
            !agent.isSystem && isOwner && deleteAction && (
              <div className="flex items-center h-6">{deleteAction}</div>
            )
          }
        >
          {agent.description && (
            <p className="line-clamp-2 text-foreground/70">
              {agent.description}
            </p>
          )}
          {agent.tags && agent.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {agent.tags.slice(0, 4).map((tag) => (
                <TerminalTag key={tag}>{tag}</TerminalTag>
              ))}
              {agent.tags.length > 4 && (
                <span className="text-2xs text-muted-foreground/50">
                  +{agent.tags.length - 4}
                </span>
              )}
            </div>
          )}
        </TerminalRow>
      )}
    />
  );
}
