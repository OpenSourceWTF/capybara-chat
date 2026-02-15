/**
 * DocumentsLibrary - Browse and manage documents
 *
 * Uses GenericLibrary for common functionality, only provides
 * configuration and custom item rendering.
 *
 * Features:
 * - Toggle between "docs" and "memories" based on document type
 * - Docs = regular library documents (type='document')
 * - Memories = agent session memories (type='memory')
 */

import { useState, useCallback, useMemo } from 'react';
import { FileText, Brain } from 'lucide-react';
import type { Document } from '@capybara-chat/types';
import { API_PATHS, DocumentType, EntityStatus, SOCKET_EVENTS } from '@capybara-chat/types';
import { Badge, TerminalRow, TerminalTag } from '../ui';
import { GenericLibrary, type LibraryConfig } from './GenericLibrary';
import { formatLibraryTimestamp, formatFullTimestamp } from '../../lib/date-formatting';
import { cn } from '../../lib/utils';

/**
 * Document library configuration
 * Fetches all types (docs + memories) so client-side toggle works
 */
const DOCUMENT_CONFIG: LibraryConfig<Document> = {
  apiPath: `${API_PATHS.DOCUMENTS}?type=all`,
  dataKey: 'documents',
  entityType: 'document',
  socketEvents: [
    SOCKET_EVENTS.DOCUMENT_CREATED,
    SOCKET_EVENTS.DOCUMENT_UPDATED,
    SOCKET_EVENTS.DOCUMENT_DELETED,
    SOCKET_EVENTS.MEMORY_CREATED,
    SOCKET_EVENTS.MEMORY_DELETED,
  ],
  searchFields: ['name', 'content'],
  commandPrefix: 'cat docs/',
  newButtonLabel: 'new doc',
  newButtonTestId: 'new-documents-button',
  loadingMessage: 'Loading documents...',
  emptyMessage: 'No documents found.',
  emptyActionLabel: 'touch new_doc',
  deleteLabel: 'Delete document',
};

/** Filter modes for document type */
type DocFilterMode = 'all' | 'docs' | 'memories';

interface DocumentsLibraryProps {
  serverUrl?: string;
  onDocumentSelect?: (document: Document) => void;
  onNewDocument?: () => void;
}

export function DocumentsLibrary({
  serverUrl,
  onDocumentSelect,
  onNewDocument,
}: DocumentsLibraryProps) {
  const [filterMode, setFilterMode] = useState<DocFilterMode>('all');

  // Filter by document type
  const customFilter = useCallback((doc: Document): boolean => {
    switch (filterMode) {
      case 'docs':
        return doc.type === DocumentType.DOCUMENT;
      case 'memories':
        return doc.type === DocumentType.MEMORY;
      case 'all':
      default:
        return true;
    }
  }, [filterMode]);

  // Toggle header action (matches SpecsLibrary pattern)
  const headerAction = useMemo(() => (
    <div className="flex items-center gap-1 border border-border bg-muted/20">
      <button
        onClick={() => setFilterMode('all')}
        className={cn(
          'px-2 py-1 text-2xs font-mono transition-colors',
          filterMode === 'all'
            ? 'bg-primary/20 text-primary'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        ALL
      </button>
      <div className="w-px h-4 bg-border" />
      <button
        onClick={() => setFilterMode('docs')}
        className={cn(
          'px-2 py-1 text-2xs font-mono transition-colors',
          filterMode === 'docs'
            ? 'bg-primary/20 text-primary'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        DOCS
      </button>
      <div className="w-px h-4 bg-border" />
      <button
        onClick={() => setFilterMode('memories')}
        className={cn(
          'px-2 py-1 text-2xs font-mono transition-colors',
          filterMode === 'memories'
            ? 'bg-primary/20 text-primary'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        MEMORIES
      </button>
    </div>
  ), [filterMode]);

  return (
    <GenericLibrary<Document>
      config={DOCUMENT_CONFIG}
      serverUrl={serverUrl}
      onSelect={onDocumentSelect}
      onNew={onNewDocument}
      headerAction={headerAction}
      customFilter={customFilter}
      renderItem={({ item: doc, onSelect, deleteAction }) => (
        <TerminalRow
          key={doc.id}
          data-testid={`document-card-${doc.id}`}
          onClick={onSelect}
          title={
            <span className="flex items-center gap-2">
              {doc.type === DocumentType.MEMORY
                ? <Brain className="w-4 h-4 text-purple-500 flex-shrink-0" />
                : <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              }
              {doc.name}
              {doc.type === DocumentType.MEMORY && (
                <Badge variant="soft" intent="info" size="sm">
                  Memory
                </Badge>
              )}
              {doc.status === EntityStatus.DRAFT && (
                <Badge variant="soft" intent="neutral" size="sm">
                  Draft
                </Badge>
              )}
              {(doc.author || doc.createdBy) && (
                <span className="text-2xs text-muted-foreground/60 font-mono">
                  {doc.author ? `By ${doc.author.name}` : `@${doc.createdBy}`}
                </span>
              )}
            </span>
          }
          date={formatLibraryTimestamp(doc.updatedAt)}
          dateTooltip={formatFullTimestamp(doc.updatedAt)}
          actions={<div className="flex items-center h-6">{deleteAction}</div>}
        >
          {doc.content && (
            <p className="line-clamp-2 text-foreground/70">{doc.content}</p>
          )}
          {doc.tags && doc.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {doc.tags.slice(0, 4).map((tag) => (
                <TerminalTag key={tag}>{tag}</TerminalTag>
              ))}
              {doc.tags.length > 4 && (
                <span className="text-2xs text-muted-foreground/50">
                  +{doc.tags.length - 4}
                </span>
              )}
            </div>
          )}
        </TerminalRow>
      )}
    />
  );
}
