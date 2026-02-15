/**
 * DocumentViewerModal - Modal for viewing auto-saved documents
 * 
 * Opens when clicking document links in chat to show full content
 * without navigating away from the conversation.
 */

import { useEffect, useState, useCallback } from 'react';
import { Markdown } from '../ui/Markdown';
import { TagList } from '../ui/TagList';
import { api } from '../../lib/api';
import { createLogger } from '../../lib/logger';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '../ui/Dialog';

const log = createLogger('DocumentViewerModal');

interface Document {
  id: string;
  name: string;
  content: string;
  tags: string[];
  createdAt: number;
  sessionId?: string;
}

interface DocumentViewerModalProps {
  documentId: string | null;
  onClose: () => void;
  serverUrl?: string;
}

export function DocumentViewerModal({ documentId, onClose, serverUrl = '' }: DocumentViewerModalProps) {
  const [document, setDocument] = useState<Document | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDocument = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.get(`${serverUrl}/api/documents/${id}`);
      if (!response.ok) {
        throw new Error(`Failed to load document: ${response.status}`);
      }
      const doc = await response.json() as Document;
      setDocument(doc);
    } catch (err) {
      log.error('Failed to fetch document', err as Error);
      setError(err instanceof Error ? err.message : 'Failed to load document');
    } finally {
      setLoading(false);
    }
  }, [serverUrl]);

  useEffect(() => {
    if (documentId) {
      fetchDocument(documentId);
    } else {
      setDocument(null);
    }
  }, [documentId, fetchDocument]);

  if (!documentId) return null;

  return (
    <Dialog open={!!documentId} onClose={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader onClose={onClose}>
          <DialogTitle className="flex items-center gap-3">
            <span className="text-2xl">📄</span>
            <div className="flex flex-col items-start">
              <span className="text-lg font-semibold leading-none uppercase tracking-wide">
                {loading ? 'Loading...' : document?.name || 'Document'}
              </span>
              {document?.tags && document.tags.length > 0 && (
                <TagList tags={document.tags} maxVisible={0} className="mt-1.5" />
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        <DialogBody>
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent" />
            </div>
          )}

          {error && (
            <div className="text-center py-12 text-destructive">
              <p className="font-medium">{error}</p>
              <button
                onClick={() => documentId && fetchDocument(documentId)}
                className="mt-4 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-none uppercase font-bold text-xs"
              >
                Retry
              </button>
            </div>
          )}

          {document && !loading && !error && (
            <Markdown className="prose-lg max-w-none">{document.content}</Markdown>
          )}
        </DialogBody>

        <DialogFooter className="justify-between text-sm text-muted-foreground bg-muted/30">
          <span>
            {document && new Date(document.createdAt).toLocaleString()}
          </span>
          <span className="font-mono text-xs">
            {document?.id}
          </span>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
