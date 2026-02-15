/**
 * SpecsLibrary - Browse and manage specs
 *
 * Uses GenericLibrary for common functionality, only provides
 * configuration and custom item rendering.
 *
 * Features:
 * - Toggle between "new" and "executed" specs based on workflowStatus
 * - New = DRAFT or READY (not yet started)
 * - Executed = IN_PROGRESS, BLOCKED, COMPLETE (has been or is being executed)
 */

import { useState, useCallback, useMemo } from 'react';
import type { Spec } from '@capybara-chat/types';
import { API_PATHS, EntityStatus, SOCKET_EVENTS, SpecStatus } from '@capybara-chat/types';
import { Badge, TerminalRow, TerminalTag } from '../ui';
import { GenericLibrary, type LibraryConfig } from './GenericLibrary';
import { getSpecStatusVariant } from '../../lib/badge-variants';
import { formatLibraryTimestamp, formatFullTimestamp } from '../../lib/date-formatting';
import { cn } from '../../lib/utils';

/**
 * Spec library configuration
 */
const SPEC_CONFIG: LibraryConfig<Spec> = {
  apiPath: API_PATHS.SPECS,
  dataKey: 'specs',
  entityType: 'spec',
  socketEvents: [
    SOCKET_EVENTS.SPEC_CREATED,
    SOCKET_EVENTS.SPEC_UPDATED,
    SOCKET_EVENTS.SPEC_DELETED,
  ],
  searchFields: ['title', 'content'],
  commandPrefix: 'cat specs/',
  newButtonLabel: 'new spec',
  loadingMessage: 'Loading specs...',
  emptyMessage: 'No specs found.',
  emptyActionLabel: 'touch new_spec',
  deleteLabel: 'Delete spec',
};

/** Filter modes for spec execution state */
type SpecFilterMode = 'all' | 'new' | 'executed';

/** Specs that haven't been executed yet */
const NEW_STATUSES: Set<string> = new Set([SpecStatus.DRAFT, SpecStatus.READY]);

/** Specs that have been or are being executed */
const EXECUTED_STATUSES: Set<string> = new Set([SpecStatus.IN_PROGRESS, SpecStatus.BLOCKED, SpecStatus.COMPLETE]);

interface SpecsLibraryProps {
  serverUrl?: string;
  onSpecSelect?: (spec: Spec) => void;
  onNewSpec?: () => void;
}

export function SpecsLibrary({
  serverUrl,
  onSpecSelect,
  onNewSpec,
}: SpecsLibraryProps) {
  const [filterMode, setFilterMode] = useState<SpecFilterMode>('all');

  // Filter function based on execution state
  const customFilter = useCallback((spec: Spec): boolean => {
    // Always exclude archived specs
    if (spec.workflowStatus === SpecStatus.ARCHIVED) {
      return false;
    }

    switch (filterMode) {
      case 'new':
        return NEW_STATUSES.has(spec.workflowStatus);
      case 'executed':
        return EXECUTED_STATUSES.has(spec.workflowStatus);
      case 'all':
      default:
        return true;
    }
  }, [filterMode]);

  // Toggle header action
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
        onClick={() => setFilterMode('new')}
        className={cn(
          'px-2 py-1 text-2xs font-mono transition-colors',
          filterMode === 'new'
            ? 'bg-primary/20 text-primary'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        NEW
      </button>
      <div className="w-px h-4 bg-border" />
      <button
        onClick={() => setFilterMode('executed')}
        className={cn(
          'px-2 py-1 text-2xs font-mono transition-colors',
          filterMode === 'executed'
            ? 'bg-primary/20 text-primary'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        EXECUTED
      </button>
    </div>
  ), [filterMode]);

  return (
    <GenericLibrary<Spec>
      config={SPEC_CONFIG}
      serverUrl={serverUrl}
      onSelect={onSpecSelect}
      onNew={onNewSpec}
      headerAction={headerAction}
      customFilter={customFilter}
      renderItem={({ item: spec, onSelect, deleteAction }) => (
        <TerminalRow
          key={spec.id}
          onClick={onSelect}
          title={spec.title}
          date={formatLibraryTimestamp(spec.updatedAt)}
          dateTooltip={formatFullTimestamp(spec.updatedAt)}
          meta={
            <>
              {spec.priority !== 'normal' && (
                <span className="capitalize">{spec.priority}</span>
              )}
              {spec.workflowStatus !== 'DRAFT' && (
                <Badge {...getSpecStatusVariant(spec.workflowStatus)} size="sm">
                  {spec.workflowStatus}
                </Badge>
              )}
              {spec.status === EntityStatus.DRAFT && (
                <Badge variant="soft" intent="neutral" size="sm">
                  Draft
                </Badge>
              )}
              {(spec.author || spec.createdBy) && (
                <span className="text-2xs text-muted-foreground/60 font-mono">
                  {spec.author ? `By ${spec.author.name}` : `@${spec.createdBy}`}
                </span>
              )}
            </>
          }
          actions={<div className="flex items-center h-6">{deleteAction}</div>}
        >
          {spec.content && (
            <p className="line-clamp-2 text-foreground/70">{spec.content}</p>
          )}
          {spec.tags && spec.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {spec.tags.slice(0, 4).map((tag) => (
                <TerminalTag key={tag}>{tag}</TerminalTag>
              ))}
              {spec.tags.length > 4 && (
                <span className="text-2xs text-muted-foreground/50">
                  +{spec.tags.length - 4}
                </span>
              )}
            </div>
          )}
        </TerminalRow>
      )}
    />
  );
}
