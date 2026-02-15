/**
 * PromptsLibrary - Browse and manage prompt segments
 *
 * Uses GenericLibrary for common functionality, with additional
 * clone action that is unique to prompts.
 */

import { useState, useCallback } from 'react';
import { Copy } from 'lucide-react';
import type { PromptSegment } from '@capybara-chat/types';
import { API_PATHS, EntityStatus, SOCKET_EVENTS, entityPath } from '@capybara-chat/types';
import { Badge, Button, TerminalRow, TerminalTag } from '../ui';
import { GenericLibrary, type LibraryConfig } from './GenericLibrary';
import { openEditEntity } from '../../lib/entity-events';
import { api } from '../../lib/api';
import { createLogger } from '../../lib/logger';
import { getErrorMessage } from '../../lib/errors';
import { formatLibraryTimestamp, formatFullTimestamp } from '../../lib/date-formatting';

const log = createLogger('PromptsLibrary');

/**
 * Prompt library configuration
 */
const PROMPT_CONFIG: LibraryConfig<PromptSegment> = {
  apiPath: API_PATHS.PROMPTS,
  dataKey: 'segments',
  entityType: 'prompt',
  socketEvents: [
    SOCKET_EVENTS.PROMPT_CREATED,
    SOCKET_EVENTS.PROMPT_UPDATED,
    SOCKET_EVENTS.PROMPT_DELETED,
  ],
  searchFields: ['name', 'content', 'summary'],
  commandPrefix: 'echo $PROMPTS/',
  newButtonLabel: 'new prompt',
  loadingMessage: 'Loading prompts...',
  emptyMessage: 'No prompts found.',
  emptyActionLabel: 'touch new_prompt',
  deleteLabel: 'Delete prompt',
};

interface PromptsLibraryProps {
  serverUrl?: string;
  onPromptSelect?: (prompt: PromptSegment) => void;
  onNewPrompt?: () => void;
}

export function PromptsLibrary({
  serverUrl,
  onPromptSelect,
  onNewPrompt,
}: PromptsLibraryProps) {
  const [cloning, setCloning] = useState<string | null>(null);

  // Clone a prompt and open it for editing
  const handleClone = useCallback(
    async (prompt: PromptSegment, e: React.MouseEvent) => {
      e.stopPropagation();
      setCloning(prompt.id);
      try {
        const res = await api.post(
          `${serverUrl || ''}${entityPath(API_PATHS.PROMPTS, prompt.id)}/clone`
        );
        if (!res.ok) {
          const error = await res.text();
          throw new Error(error || 'Failed to clone prompt');
        }
        const cloned: PromptSegment = await res.json();
        openEditEntity('prompt', cloned.id);
      } catch (err) {
        log.error('Failed to clone prompt', { error: getErrorMessage(err) });
      } finally {
        setCloning(null);
      }
    },
    [serverUrl]
  );

  return (
    <GenericLibrary<PromptSegment>
      config={PROMPT_CONFIG}
      serverUrl={serverUrl}
      onSelect={onPromptSelect}
      onNew={onNewPrompt}
      renderItem={({ item: prompt, onSelect, deleteAction }) => (
        <TerminalRow
          key={prompt.id}
          onClick={onSelect}
          title={
            <span className="flex items-center gap-2">
              {prompt.name}
              {prompt.status === EntityStatus.DRAFT && (
                <Badge variant="soft" intent="neutral" size="sm">
                  Draft
                </Badge>
              )}
              {(prompt.author || prompt.createdBy) && (
                <span className="text-2xs text-muted-foreground/60 font-mono">
                  {prompt.author ? `By ${prompt.author.name}` : `@${prompt.createdBy}`}
                </span>
              )}
            </span>
          }
          date={formatLibraryTimestamp(prompt.updatedAt)}
          dateTooltip={formatFullTimestamp(prompt.updatedAt)}
          actions={
            <div className="flex items-center h-6 gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => handleClone(prompt, e)}
                disabled={cloning === prompt.id}
                className="h-6 w-6 text-muted-foreground hover:text-primary"
                title="Clone prompt"
              >
                <Copy
                  className={`w-3 h-3 ${cloning === prompt.id ? 'animate-pulse' : ''}`}
                />
              </Button>
              {deleteAction}
            </div>
          }
        >
          <p className="line-clamp-2 text-foreground/70">
            {prompt.summary || prompt.content.slice(0, 200)}
          </p>
          {(prompt.tags.length > 0 || prompt.variables.length > 0) && (
            <div className="mt-2 flex flex-wrap gap-2 items-center">
              {prompt.tags.slice(0, 3).map((tag) => (
                <TerminalTag key={tag}>{tag}</TerminalTag>
              ))}
              {prompt.tags.length > 3 && (
                <span className="text-2xs text-muted-foreground/50">
                  +{prompt.tags.length - 3}
                </span>
              )}
              {prompt.variables.length > 0 && (
                <div className="flex gap-1 flex-wrap border-l border-border pl-2 ml-1">
                  {prompt.variables.map((v) => (
                    <span
                      key={v}
                      className="text-2xs px-1.5 py-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-mono border border-amber-500/20"
                    >
                      {`{{${v}}}`}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </TerminalRow>
      )}
    />
  );
}
