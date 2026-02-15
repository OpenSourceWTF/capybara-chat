/**
 * PromptDetail - View prompt details
 *
 * Read-only view of a prompt with:
 * - Formatted display (color, variables, tags)
 * - Edit button opens EntityView (with MCP Forms support)
 */

import { ArrowLeft, Pencil } from 'lucide-react';
import type { PromptSegment } from '@capybara-chat/types';
import { SERVER_DEFAULTS, API_PATHS, entityPath } from '@capybara-chat/types';
import { Button, LoadingSpinner, EmptyState, TagList, Markdown } from '../ui';
import { useFetch } from '../../hooks/useFetch';
import { formatDate } from '../../lib/utils';

interface PromptDetailProps {
  promptId: string;
  serverUrl?: string;
  onBack?: () => void;
  /** Opens the prompt in EntityView with MCP Forms support */
  onEdit?: (promptId: string) => void;
}

export function PromptDetail({
  promptId,
  serverUrl = SERVER_DEFAULTS.SERVER_URL,
  onBack,
  onEdit,
}: PromptDetailProps) {
  // Use centralized fetch hook
  const { data: prompt, loading } = useFetch<PromptSegment>(
    `${serverUrl}${entityPath(API_PATHS.PROMPTS, promptId)}`
  );

  if (loading) {
    return <LoadingSpinner message="Loading prompt..." />;
  }

  if (!prompt) {
    return (
      <EmptyState
        message="Prompt not found"
        action={
          <Button variant="ghost" size="sm" onClick={onBack} className="h-7 px-2">
            <ArrowLeft className="w-4 h-4 mr-1" />
            <span className="text-xs">Back</span>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Bar - Consistent pattern with TYPE_LABEL */}
      <div className="flex items-center justify-between -mx-6 px-6 py-3 border-b border-border bg-muted/10 mb-2">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="h-7 px-2 -ml-2">
            <ArrowLeft className="w-4 h-4 mr-1" />
            <span className="text-xs">Back</span>
          </Button>
          <div className="w-px h-4 bg-border" />
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            PROMPT_DETAIL
          </span>
        </div>
        {onEdit && (
          <Button variant="ghost" size="sm" onClick={() => onEdit(promptId)} className="h-7 px-2">
            <Pencil className="w-4 h-4 mr-1" />
            <span className="text-xs">Edit</span>
          </Button>
        )}
      </div>

      {/* Prompt Details - Read Only */}
      <div className="p-6 bg-card border border-border" style={{ borderLeftColor: prompt.color, borderLeftWidth: '4px' }}>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div
              className="w-4 h-4 flex-shrink-0"
              style={{ backgroundColor: prompt.color }}
            />
            <h1 className="text-2xl font-bold">{prompt.name}</h1>
          </div>
          {prompt.summary && (
            <p className="text-muted-foreground">{prompt.summary}</p>
          )}
          {prompt.tags.length > 0 && (
            <TagList tags={prompt.tags} maxVisible={0} />
          )}
          {prompt.variables.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2">Variables:</h3>
              <div className="flex gap-2 flex-wrap">
                {prompt.variables.map((v) => (
                  <span key={v} className="px-2 py-1 rounded bg-primary/10 text-primary text-sm font-mono">
                    {`{{${v}}}`}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div>
            <h3 className="text-sm font-semibold mb-2">Content:</h3>
            <div className="bg-muted p-4">
              {prompt.content ? (
                <Markdown className="prose prose-sm max-w-none">{prompt.content}</Markdown>
              ) : (
                <span className="italic text-muted-foreground/50">No content</span>
              )}
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            Created: {formatDate(prompt.createdAt)} •
            Updated: {formatDate(prompt.updatedAt)}
          </div>
        </div>
      </div>
    </div>
  );
}
