/**
 * SessionPipelineLogs - Real-time pipeline log viewer
 *
 * Phase 4: Observability component for debugging pipeline execution
 * Follows "Cozy Terminal" design: monospace, warm colors, zero radius
 */

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Filter } from 'lucide-react';
import { Button } from '../ui';
import type { PipelineLog } from '../../hooks/useSessionPipelineEvents';

export interface SessionPipelineLogsProps {
  logs: PipelineLog[];
}

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'all';

export function SessionPipelineLogs({ logs }: SessionPipelineLogsProps) {
  const [levelFilter, setLevelFilter] = useState<LogLevel>('all');
  const [autoScroll, setAutoScroll] = useState(true);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter logs by level
  const filteredLogs = logs.filter(log => {
    if (levelFilter === 'all') return true;
    return log.level === levelFilter;
  });

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [filteredLogs, autoScroll]);

  // Detect manual scroll to disable auto-scroll
  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const isAtBottom = Math.abs(scrollHeight - clientHeight - scrollTop) < 50;
    setAutoScroll(isAtBottom);
  };

  // Format timestamp with milliseconds
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const timeStr = date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const ms = date.getMilliseconds().toString().padStart(3, '0');
    return `${timeStr}.${ms}`;
  };

  // Get log level color
  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error': return 'text-red-500';
      case 'warn': return 'text-yellow-500';
      case 'info': return 'text-blue-500';
      case 'debug': return 'text-muted-foreground';
      default: return 'text-foreground';
    }
  };

  // Get level badge style
  const getLevelBadgeStyle = (level: string) => {
    switch (level) {
      case 'error': return 'bg-red-900/20 text-red-400 border-red-700';
      case 'warn': return 'bg-yellow-900/20 text-yellow-400 border-yellow-700';
      case 'info': return 'bg-blue-900/20 text-blue-400 border-blue-700';
      case 'debug': return 'bg-muted/50 text-muted-foreground border-border';
      default: return 'bg-muted text-foreground border-border';
    }
  };

  if (logs.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-xs font-mono text-muted-foreground">
        [NO PIPELINE LOGS YET]
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header with filters */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/10">
        <div className="flex items-center gap-2">
          <Filter className="w-3 h-3 text-muted-foreground" />
          <span className="text-2xs font-mono text-muted-foreground uppercase">Level:</span>
          {(['all', 'debug', 'info', 'warn', 'error'] as LogLevel[]).map(level => (
            <button
              key={level}
              onClick={() => setLevelFilter(level)}
              className={`text-2xs font-mono px-1.5 py-0.5 border transition-colors ${
                levelFilter === level
                  ? getLevelBadgeStyle(level)
                  : 'bg-background text-muted-foreground border-border hover:bg-muted/50'
              }`}
            >
              {level.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-2xs font-mono text-muted-foreground">
            {filteredLogs.length} / {logs.length}
          </span>
          {!autoScroll && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setAutoScroll(true);
                logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="h-5 px-1 text-2xs"
            >
              <ChevronDown className="w-3 h-3 mr-1" />
              Jump to Bottom
            </Button>
          )}
        </div>
      </div>

      {/* Log entries */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-2 space-y-1 font-mono text-2xs"
      >
        {filteredLogs.map((log, index) => (
          <div
            key={index}
            className="flex gap-2 px-2 py-1 hover:bg-muted/30 transition-colors"
          >
            {/* Timestamp */}
            <span className="text-muted-foreground/60 flex-shrink-0">
              {formatTime(log.timestamp)}
            </span>

            {/* Level badge */}
            <span
              className={`flex-shrink-0 w-12 text-center border ${getLevelBadgeStyle(log.level)}`}
            >
              {log.level.toUpperCase()}
            </span>

            {/* Source tag */}
            {log.source && (
              <span className="flex-shrink-0 px-1 bg-muted/50 text-muted-foreground border border-border">
                {log.source}
              </span>
            )}

            {/* Message */}
            <span className={`flex-1 ${getLevelColor(log.level)}`}>
              {log.message}
            </span>

            {/* Context (if any) */}
            {log.context && Object.keys(log.context).length > 0 && (
              <span className="text-muted-foreground/60 flex-shrink-0">
                {JSON.stringify(log.context)}
              </span>
            )}
          </div>
        ))}
        <div ref={logsEndRef} />
      </div>
    </div>
  );
}

export default SessionPipelineLogs;
