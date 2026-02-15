/**
 * LogsTab - Application logs viewer with filtering and infinite scroll
 *
 * Displays server and agent-bridge logs with:
 * - Level filter (debug, info, warn, error)
 * - Source filter (server, agent-bridge, gateway, huddle)
 * - Text search
 * - Infinite scroll pagination
 */

import { useRef, useCallback, useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useLogsQuery } from '../../hooks/useLogsQuery';
import { formatTime, formatDate, cn } from '../../lib/utils';
import type { LogLevel, PersistedLogEntry } from '@capybara-chat/types';

const LEVEL_STYLES: Record<LogLevel, { badge: string; border: string }> = {
  debug: { badge: 'bg-muted text-muted-foreground', border: 'border-l-muted-foreground opacity-80' },
  info: { badge: 'bg-blue-700 text-blue-100', border: 'border-l-blue-500' },
  warn: { badge: 'bg-yellow-600 text-yellow-100', border: 'border-l-yellow-500' },
  error: { badge: 'bg-red-600 text-red-100', border: 'border-l-red-500' },
};

const SOURCE_OPTIONS = [
  { value: '', label: 'All Sources' },
  { value: 'server', label: 'Server' },
  { value: 'agent-bridge', label: 'Agent Bridge' },
  { value: 'gateway', label: 'Gateway' },
  { value: 'huddle', label: 'Huddle' },
];

const LEVEL_OPTIONS = [
  { value: '', label: 'All Levels' },
  { value: 'debug', label: 'Debug' },
  { value: 'info', label: 'Info' },
  { value: 'warn', label: 'Warning' },
  { value: 'error', label: 'Error' },
];

export function LogsTab() {
  const { logs, loading, loadingMore, error, hasMore, total, loadMore, refresh, clearLogs, filters, setFilters } = useLogsQuery();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const logsEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== (filters.search || '')) {
        setFilters({ ...filters, search: searchInput || undefined });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, filters, setFilters]);

  // Infinite scroll handler
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container || loadingMore || !hasMore) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    if (scrollTop + clientHeight >= scrollHeight - 100) {
      loadMore();
    }
  }, [loadMore, loadingMore, hasMore]);

  // Attach scroll listener
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const renderLogEntry = (entry: PersistedLogEntry, prevEntry: PersistedLogEntry | null) => {
    const showDate = !prevEntry || formatDate(entry.createdAt) !== formatDate(prevEntry.createdAt);
    const isExpanded = expandedId === entry.id;
    const hasDetails = entry.context || entry.error;
    const levelStyle = LEVEL_STYLES[entry.level];

    return (
      <div key={entry.id}>
        {showDate && (
          <div className="flex items-center gap-4 py-2 my-2">
            <div className="flex-1 h-px bg-border" />
            <span className="text-2xs uppercase tracking-widest text-muted-foreground">
              {formatDate(entry.createdAt)}
            </span>
            <div className="flex-1 h-px bg-border" />
          </div>
        )}
        <div
          className={cn(
            'py-1.5 px-2 mb-0.5 font-mono text-xs leading-snug transition-colors border-l-2',
            levelStyle.border,
            isExpanded && 'bg-accent',
            hasDetails && 'cursor-pointer hover:bg-accent'
          )}
          onClick={() => hasDetails && toggleExpand(entry.id)}
        >
          <div className="flex items-start gap-2 flex-nowrap">
            <span className="text-muted-foreground text-xs shrink-0 tabular-nums">
              {formatTime(entry.createdAt)}
            </span>
            <span className={cn('px-1 text-2xs font-semibold uppercase shrink-0', levelStyle.badge)}>
              {entry.level.toUpperCase()}
            </span>
            <span className="text-muted-foreground text-xs shrink-0">{entry.source}</span>
            <span className="text-cyan-500 font-medium shrink-0">[{entry.prefix}]</span>
            <span className="flex-1 break-words whitespace-pre-wrap">{entry.message}</span>
            {hasDetails && (
              <span className="text-muted-foreground text-2xs shrink-0 ml-auto">
                {isExpanded ? '▼' : '▶'}
              </span>
            )}
          </div>
          {isExpanded && (
            <div className="mt-2 p-2 bg-background border border-border">
              {entry.context && (
                <div>
                  <strong className="text-2xs uppercase text-muted-foreground">Context:</strong>
                  <pre className="mt-1 text-xs whitespace-pre-wrap break-words max-h-[200px] overflow-y-auto">
                    {JSON.stringify(entry.context, null, 2)}
                  </pre>
                </div>
              )}
              {entry.error && (
                <div className="mt-2">
                  <strong className="text-2xs uppercase text-muted-foreground">Error:</strong>
                  <pre className="mt-1 text-red-500 text-xs">{entry.error.message}</pre>
                  {entry.error.stack && (
                    <pre className="text-muted-foreground text-2xs">{entry.error.stack}</pre>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-background text-foreground">
      {/* Filter Bar */}
      <div className="flex items-center justify-between gap-4 px-4 py-3 bg-card border-b border-border shrink-0">
        <div className="flex gap-2 flex-1">
          <select
            className="px-3 py-2 bg-background border border-border text-foreground text-sm font-mono min-w-[120px] cursor-pointer hover:border-muted-foreground focus:outline-none focus:border-primary"
            value={filters.level || ''}
            onChange={(e) => setFilters({ ...filters, level: e.target.value as LogLevel || undefined })}
          >
            {LEVEL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          <select
            className="px-3 py-2 bg-background border border-border text-foreground text-sm font-mono min-w-[120px] cursor-pointer hover:border-muted-foreground focus:outline-none focus:border-primary"
            value={filters.source || ''}
            onChange={(e) => setFilters({ ...filters, source: e.target.value || undefined })}
          >
            {SOURCE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          <input
            type="text"
            className="flex-1 max-w-[300px] px-3 py-2 bg-background border border-border text-foreground text-sm font-mono placeholder:text-muted-foreground focus:outline-none focus:border-primary"
            placeholder="Search logs..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground tabular-nums font-mono">
            [{logs.length}/{total}]
          </span>
          <button
            className="w-7 h-7 bg-transparent border border-border text-foreground cursor-pointer flex items-center justify-center text-base transition-colors hover:bg-destructive/10 hover:border-destructive hover:text-destructive disabled:opacity-50 disabled:cursor-not-allowed font-mono"
            onClick={clearLogs}
            title="Clear all logs"
            aria-label="Clear all logs"
            disabled={loading || logs.length === 0}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button
            className="w-7 h-7 bg-transparent border border-border text-foreground cursor-pointer flex items-center justify-center text-base transition-colors hover:bg-accent hover:border-muted-foreground disabled:opacity-50 disabled:cursor-not-allowed font-mono"
            onClick={refresh}
            disabled={loading}
            title="Refresh logs"
            aria-label="Refresh logs"
          >
            ↻
          </button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="p-4 m-4 bg-red-500/10 border border-red-500/30 text-center">
          <p className="text-red-500 mb-2">Failed to load logs: {error}</p>
          <button
            className="px-3 py-1 bg-red-500 text-white border-none cursor-pointer font-mono"
            onClick={refresh}
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading && logs.length === 0 && (
        <div className="p-4 text-center text-muted-foreground text-xs">Loading logs...</div>
      )}

      {/* Empty State */}
      {!loading && logs.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center p-12 text-center">
          <div className="text-4xl mb-4 opacity-50">📋</div>
          <p className="font-semibold text-base">No logs found</p>
          <p className="text-muted-foreground text-sm mt-2">
            {filters.level || filters.source || filters.search
              ? 'Try adjusting your filters'
              : 'Logs will appear here as the server runs'}
          </p>
        </div>
      )}

      {/* Logs List */}
      {logs.length > 0 && (
        <div className="flex-1 overflow-y-auto overflow-x-hidden" ref={scrollContainerRef}>
          <div className="p-2">
            {logs.map((entry, index) => renderLogEntry(entry, index > 0 ? logs[index - 1] : null))}
          </div>

          {loadingMore && (
            <div className="p-4 text-center text-muted-foreground text-xs">Loading more logs...</div>
          )}

          {!hasMore && logs.length > 0 && (
            <div className="p-4 text-center text-muted-foreground text-xs">End of logs</div>
          )}

          <div ref={logsEndRef} />
        </div>
      )}
    </div>
  );
}
