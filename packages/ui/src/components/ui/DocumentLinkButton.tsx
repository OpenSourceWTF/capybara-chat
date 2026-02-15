/**
 * DocumentLinkButton - Prominent button for document links in chat
 * 
 * Renders document links with a large, visually prominent button style
 * to ensure users notice auto-saved documents.
 */

import { HTMLAttributes, useCallback } from 'react';
import { openViewEntity } from '../../lib/entity-events';

interface DocumentLinkButtonProps extends HTMLAttributes<HTMLButtonElement> {
  href: string;
  children: React.ReactNode;
  onOpenDocument?: (documentId: string) => void;
}

/**
 * Extract document ID from /documents/:id path
 */
function extractDocumentId(href: string): string | null {
  const match = href.match(/^\/documents\/([^/]+)/);
  return match ? match[1] : null;
}

export function DocumentLinkButton({ href, children, onOpenDocument, className = '', ...props }: DocumentLinkButtonProps) {
  const handleClick = useCallback(() => {
    const documentId = extractDocumentId(href);
    if (documentId && onOpenDocument) {
      onOpenDocument(documentId);
    } else if (documentId) {
      // Use event bus to open document in view mode
      openViewEntity('document', documentId);
    }
  }, [href, onOpenDocument]);

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`
        inline-flex items-center gap-3 px-6 py-4
        bg-gradient-to-r from-primary/10 to-primary/5
        border-2 border-primary/30
        text-primary font-semibold text-base
        hover:from-primary/20 hover:to-primary/10
        hover:border-primary/50
        hover:scale-[1.02]
        active:scale-[0.98]
        transition-all duration-200
        shadow-lg shadow-primary/5
        cursor-pointer
        ${className}
      `.trim().replace(/\s+/g, ' ')}
      {...props}
    >
      <span className="text-2xl">📄</span>
      <span className="flex flex-col items-start text-left">
        <span className="text-xs text-muted-foreground font-normal">Full Document</span>
        <span>{children}</span>
      </span>
      <span className="ml-auto text-xl opacity-60">→</span>
    </button>
  );
}
