/**
 * VersionDiff - Component for displaying diff between document versions
 *
 * Uses react-diff-viewer-continued for syntax-highlighted diffs.
 */

import ReactDiffViewer, { DiffMethod } from 'react-diff-viewer-continued';
import { X } from 'lucide-react';
import { Button } from '../ui';
import type { DocumentVersion } from '@capybara-chat/types';

interface VersionDiffProps {
  /** The current version being compared to */
  currentVersion: DocumentVersion;
  /** The previous version (if available) */
  previousVersion?: DocumentVersion;
  /** Callback to close the diff view */
  onClose: () => void;
  /** Callback to restore a version */
  onRestore?: (version: DocumentVersion) => void;
}

/**
 * Component for showing a diff between two document versions
 */
export function VersionDiff({
  currentVersion,
  previousVersion,
  onClose,
  onRestore,
}: VersionDiffProps) {
  const oldValue = previousVersion?.content ?? '';
  const newValue = currentVersion.content;

  return (
    <div className="flex flex-col h-full" data-testid="version-diff">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border">
        <div>
          <h3 className="text-sm font-medium">Version Comparison</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {previousVersion ? (
              <>
                Comparing with previous version from{' '}
                {formatTimestamp(previousVersion.createdAt)}
              </>
            ) : (
              'This is the first version'
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {onRestore && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onRestore(currentVersion)}
              data-testid="restore-version-button"
            >
              Restore this version
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close diff view">
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Diff viewer */}
      <div className="flex-1 overflow-auto p-4">
        <ReactDiffViewer
          oldValue={oldValue}
          newValue={newValue}
          splitView={false}
          compareMethod={DiffMethod.WORDS}
          useDarkTheme={true}
          leftTitle={
            previousVersion
              ? `v${previousVersion.id.slice(-4)} - ${formatTimestamp(previousVersion.createdAt)}`
              : 'Empty'
          }
          rightTitle={`v${currentVersion.id.slice(-4)} - ${formatTimestamp(currentVersion.createdAt)}`}
          styles={{
            variables: {
              dark: {
                diffViewerBackground: 'hsl(var(--background))',
                addedBackground: 'hsla(142, 76%, 36%, 0.2)',
                addedColor: 'hsl(var(--foreground))',
                removedBackground: 'hsla(0, 84%, 60%, 0.2)',
                removedColor: 'hsl(var(--foreground))',
                wordAddedBackground: 'hsla(142, 76%, 36%, 0.4)',
                wordRemovedBackground: 'hsla(0, 84%, 60%, 0.4)',
                addedGutterBackground: 'hsla(142, 76%, 36%, 0.3)',
                removedGutterBackground: 'hsla(0, 84%, 60%, 0.3)',
                gutterBackground: 'hsl(var(--muted))',
                gutterBackgroundDark: 'hsl(var(--muted))',
                highlightBackground: 'hsl(var(--accent))',
                highlightGutterBackground: 'hsl(var(--accent))',
                codeFoldGutterBackground: 'hsl(var(--muted))',
                codeFoldBackground: 'hsl(var(--muted))',
                emptyLineBackground: 'hsl(var(--muted))',
                diffViewerTitleBackground: 'hsl(var(--card))',
                diffViewerTitleColor: 'hsl(var(--foreground))',
                diffViewerTitleBorderColor: 'hsl(var(--border))',
              },
            },
            contentText: {
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
              fontSize: '13px',
            },
          }}
        />
      </div>
    </div>
  );
}

/**
 * Format a timestamp for display
 */
function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
