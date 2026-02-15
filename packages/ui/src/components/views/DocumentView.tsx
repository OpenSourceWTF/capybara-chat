/**
 * DocumentView - Document-specific wrapper for EntityView
 * 150-session-costs: Added session cost aggregation
 */

import { useMemo } from 'react';
import { DollarSign } from 'lucide-react';
import type { Document, Session } from '@capybara-chat/types';
import { SERVER_DEFAULTS, API_PATHS } from '@capybara-chat/types';
import { EntityView } from '../entity/EntityView';
import { CopyableId } from '../ui';
import { documentSchema, type DocumentFormData } from '../../schemas/document-schema';
import { useFetchList } from '../../hooks/useFetchList';
import { formatCost } from '../../lib/utils';

interface DocumentViewProps {
  documentId: string;
  serverUrl?: string;
  sessionId?: string;
  initialMode?: 'view' | 'edit';
  onBack?: () => void;
  onSave?: (doc: Document) => void;
  onClose?: () => void;
}

export function DocumentView({
  documentId,
  serverUrl = SERVER_DEFAULTS.SERVER_URL,
  sessionId,
  initialMode = 'view',
  onBack,
  onSave,
  onClose,
}: DocumentViewProps) {
  // 150-session-costs: Fetch sessions that have edited this document
  const { items: sessions } = useFetchList<Session>({
    url: documentId ? `${serverUrl}${API_PATHS.SESSIONS}?editingEntityType=document&editingEntityId=${documentId}&limit=50` : '',
    dataKey: 'sessions',
  });

  // Calculate total cost from all sessions
  const totalSessionCost = useMemo(() => {
    return sessions.reduce((sum, session) => sum + (session.totalCost || 0), 0);
  }, [sessions]);

  return (
    <EntityView<Document, DocumentFormData>
      schema={documentSchema}
      entityId={documentId}
      serverUrl={serverUrl}
      sessionId={sessionId}
      apiPath={API_PATHS.DOCUMENTS}
      initialMode={initialMode}
      onBack={onBack}
      backLabel="Back to Documents"
      onSave={onSave}
      onClose={onClose}
      titleField="name"
      contentField="content"
      renderContentAsMarkdown={true}
      renderMetadata={(doc) => (
        <>
          <CopyableId id={doc.id} />
          <span className="opacity-30">•</span>
          {(doc.author || doc.createdBy) && (
            <span className="text-muted-foreground">
              {doc.author ? `By ${doc.author.name}` : `@${doc.createdBy}`}
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
    />
  );
}
