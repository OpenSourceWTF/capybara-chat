/**
 * EditingContextBadge - Shows the current entity editing context
 *
 * Displays a badge indicating which entity is being edited, with an
 * expandable panel showing the full context that Claude receives.
 *
 * This helps users understand what information the AI assistant has access to.
 *
 * Pure functions extracted to lib/editing-context-utils.ts for unit testing.
 */

import { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, Bot, Eye } from 'lucide-react';
import { Button } from './Button';
import { formatEntityType, buildContextPreview } from '../../lib/editing-context-utils';

/**
 * Props for EditingContextBadge
 */
export interface EditingContextBadgeProps {
  /** Entity type being edited */
  entityType: string;
  /** Entity ID */
  entityId?: string;
  /** Entity title/name for display */
  entityTitle?: string;
  /** Current form data (for context preview) */
  formData?: Record<string, unknown>;
  /** Whether the session is connected/syncing */
  isConnected?: boolean;
  /** Custom class name */
  className?: string;
}

/**
 * EditingContextBadge component
 */
export function EditingContextBadge({
  entityType,
  entityId,
  entityTitle,
  formData,
  isConnected = false,
  className = '',
}: EditingContextBadgeProps) {
  const [expanded, setExpanded] = useState(false);

  const contextPreview = useMemo(
    () => buildContextPreview(entityType, entityId, entityTitle, formData),
    [entityType, entityId, entityTitle, formData]
  );

  const displayTitle = entityTitle || (entityId ? `#${entityId.slice(0, 8)}` : 'New');

  return (
    <div className={`editing-context-badge ${className}`}>
      {/* Badge */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 border border-primary/20">
        <Bot className="w-4 h-4 text-primary" />
        <span className="text-sm font-medium text-primary font-mono">
          Editing: {formatEntityType(entityType)}
        </span>
        <span className="text-sm text-primary/70 font-mono">
          {displayTitle}
        </span>
        {isConnected && (
          <span className="flex items-center gap-1 text-2xs text-green-600 dark:text-green-400 font-mono">
            <span className="w-1.5 h-1.5 bg-green-500 animate-pulse" />
            Synced
          </span>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded(!expanded)}
          className="ml-auto h-6 px-2 text-primary/70 hover:text-primary"
          title={expanded ? 'Hide AI context' : 'Show AI context'}
        >
          <Eye className="w-3.5 h-3.5 mr-1" />
          {expanded ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </Button>
      </div>

      {/* Expanded context viewer */}
      {expanded && (
        <div className="mt-2 p-4 bg-muted/50 border border-border">
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border">
            <Bot className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground font-mono">
              Context sent to AI assistant
            </span>
          </div>
          <pre className="text-2xs text-muted-foreground whitespace-pre-wrap font-mono overflow-auto max-h-[300px]">
            {contextPreview}
          </pre>
          <p className="mt-3 text-2xs text-muted-foreground/70 italic font-mono">
            This context is automatically injected when you send messages to help the AI understand what you're editing.
          </p>
        </div>
      )}
    </div>
  );
}
