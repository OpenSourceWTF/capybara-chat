/**
 * PromptView - Prompt-specific wrapper for EntityView
 * 150-session-costs: Added session cost aggregation
 */

import { useMemo } from 'react';
import { DollarSign } from 'lucide-react';
import type { PromptSegment, Session } from '@capybara-chat/types';
import { SERVER_DEFAULTS, API_PATHS } from '@capybara-chat/types';
import { EntityView } from '../entity/EntityView';
import { Badge, CopyableId } from '../ui';
import { promptSchema, type PromptFormData } from '../../schemas/prompt-schema';
import { useFetchList } from '../../hooks/useFetchList';
import { formatCost } from '../../lib/utils';

interface PromptViewProps {
  promptId: string;
  serverUrl?: string;
  sessionId?: string;
  initialMode?: 'view' | 'edit';
  onBack?: () => void;
  onSave?: (prompt: PromptSegment) => void;
  onClose?: () => void;
}

export function PromptView({
  promptId,
  serverUrl = SERVER_DEFAULTS.SERVER_URL,
  sessionId,
  initialMode = 'view',
  onBack,
  onSave,
  onClose,
}: PromptViewProps) {
  // 150-session-costs: Fetch sessions that have edited this prompt
  const { items: sessions } = useFetchList<Session>({
    url: promptId ? `${serverUrl}${API_PATHS.SESSIONS}?editingEntityType=prompt&editingEntityId=${promptId}&limit=50` : '',
    dataKey: 'sessions',
  });

  // Calculate total cost from all sessions
  const totalSessionCost = useMemo(() => {
    return sessions.reduce((sum, session) => sum + (session.totalCost || 0), 0);
  }, [sessions]);

  return (
    <EntityView<PromptSegment, PromptFormData>
      schema={promptSchema}
      entityId={promptId}
      serverUrl={serverUrl}
      sessionId={sessionId}
      apiPath={API_PATHS.PROMPTS}
      initialMode={initialMode}
      onBack={onBack}
      backLabel="Back to Prompts"
      onSave={onSave}
      onClose={onClose}
      titleField="name"
      contentField="content"
      renderContentAsMarkdown={true}
      renderMetadata={(prompt) => (
        <>
          <CopyableId id={prompt.id} />
          <span className="opacity-30">•</span>
          {(prompt.author || prompt.createdBy) && (
            <span className="text-muted-foreground/80 font-mono text-xs">
              {prompt.author ? `By ${prompt.author.name}` : `@${prompt.createdBy}`}
            </span>
          )}
          {formatCost(totalSessionCost) ? (
            <>
              <span className="opacity-30">•</span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground font-mono">
                <DollarSign className="w-3 h-3" />
                {formatCost(totalSessionCost, { showDollarSign: false })}
              </span>
            </>
          ) : null}
        </>
      )}
      renderViewPreamble={(prompt) =>
        prompt.summary ? (
          <div className="space-y-2 pb-4 mb-4 border-b border-border">
            <h3 className="text-2xs font-mono font-bold text-muted-foreground uppercase tracking-widest">
              SUMMARY::
            </h3>
            <p className="text-sm text-foreground/80">{prompt.summary}</p>
          </div>
        ) : null
      }
      renderViewSections={(prompt) => (
        <>
          {/* Output Type */}
          {prompt.outputType && (
            <div className="space-y-2 pt-4 border-t border-border">
              <h3 className="text-2xs font-mono font-bold text-muted-foreground uppercase tracking-widest">
                OUTPUT_TYPE::
              </h3>
              <Badge variant="outline" size="sm" className="rounded-none font-mono">[{prompt.outputType}]</Badge>
            </div>
          )}

          {/* Variables section */}
          {prompt.variables && prompt.variables.length > 0 && (
            <div className="space-y-3 pt-4 border-t border-border">
              <h3 className="text-2xs font-mono font-bold text-muted-foreground uppercase tracking-widest">
                VARIABLES [{prompt.variables.length}]::
              </h3>
              <div className="flex gap-2 flex-wrap">
                {prompt.variables.map((v) => (
                  <span
                    key={v}
                    className="text-xs px-2 py-1 rounded-none bg-amber-500/10 text-amber-600 dark:text-amber-400 font-mono border border-amber-500/20"
                  >
                    {`{{${v}}}`}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    />
  );
}
