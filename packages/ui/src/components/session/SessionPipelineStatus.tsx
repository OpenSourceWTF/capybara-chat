/**
 * SessionPipelineStatus - Visual stage timeline for pipeline execution
 *
 * Phase 4: Observability component showing pipeline progress
 * Follows "Cozy Terminal" design: monospace, warm colors, zero radius
 */

import { CheckCircle2, Circle, XCircle, Loader2 } from 'lucide-react';
import type { StageTimeline } from '../../hooks/useSessionPipelineEvents';

export interface SessionPipelineStatusProps {
  stages: StageTimeline[];
  pipelineStatus: 'idle' | 'running' | 'complete' | 'error';
}

export function SessionPipelineStatus({ stages, pipelineStatus }: SessionPipelineStatusProps) {
  // Format duration
  const formatDuration = (durationMs?: number) => {
    if (!durationMs) return '--';
    if (durationMs < 1000) return `${durationMs}ms`;
    return `${(durationMs / 1000).toFixed(2)}s`;
  };

  // Format stage name for display
  const formatStageName = (stage: string) => {
    return stage
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'complete':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Circle className="w-4 h-4 text-muted-foreground" />;
    }
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'text-blue-500';
      case 'complete': return 'text-green-500';
      case 'error': return 'text-red-500';
      default: return 'text-muted-foreground';
    }
  };

  // Calculate total duration
  const totalDuration = stages.reduce((sum, stage) => {
    return sum + (stage.durationMs || 0);
  }, 0);

  if (pipelineStatus === 'idle') {
    return (
      <div className="h-full flex items-center justify-center text-xs font-mono text-muted-foreground">
        [PIPELINE IDLE - WAITING FOR MESSAGE]
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header with overall status */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/10">
        <div className="flex items-center gap-2">
          {pipelineStatus === 'running' && <Loader2 className="w-3 h-3 text-blue-500 animate-spin" />}
          {pipelineStatus === 'complete' && <CheckCircle2 className="w-3 h-3 text-green-500" />}
          {pipelineStatus === 'error' && <XCircle className="w-3 h-3 text-red-500" />}
          <span className="text-xs font-mono uppercase font-bold">
            Pipeline: {pipelineStatus}
          </span>
        </div>
        {pipelineStatus !== 'running' && totalDuration > 0 && (
          <span className="text-xs font-mono text-muted-foreground">
            Total: {formatDuration(totalDuration)}
          </span>
        )}
      </div>

      {/* Stage timeline */}
      <div className="flex-1 overflow-y-auto p-4">
        {stages.length === 0 ? (
          <div className="text-xs font-mono text-muted-foreground text-center py-8">
            [NO STAGES STARTED YET]
          </div>
        ) : (
          <div className="space-y-4">
            {stages.map((stage, index) => (
              <div key={`${stage.stage}-${index}`} className="relative">
                {/* Connector line to next stage */}
                {index < stages.length - 1 && (
                  <div className="absolute left-[7px] top-8 w-px h-8 bg-border" />
                )}

                {/* Stage card */}
                <div className="flex gap-3">
                  {/* Status icon */}
                  <div className="flex-shrink-0 mt-0.5">
                    {getStatusIcon(stage.status)}
                  </div>

                  {/* Stage details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className={`font-mono text-sm font-bold ${getStatusColor(stage.status)}`}>
                        {formatStageName(stage.stage)}
                      </span>
                      {stage.durationMs !== undefined && (
                        <span className="text-xs font-mono text-muted-foreground flex-shrink-0">
                          {formatDuration(stage.durationMs)}
                        </span>
                      )}
                    </div>

                    {/* Stage status badge */}
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className={`inline-block px-2 py-0.5 text-2xs font-mono uppercase border ${
                          stage.status === 'running'
                            ? 'bg-blue-900/20 text-blue-400 border-blue-700'
                            : stage.status === 'complete'
                            ? 'bg-green-900/20 text-green-400 border-green-700'
                            : 'bg-red-900/20 text-red-400 border-red-700'
                        }`}
                      >
                        {stage.status}
                      </span>
                      {stage.status === 'running' && (
                        <span className="text-2xs font-mono text-muted-foreground animate-pulse">
                          Processing...
                        </span>
                      )}
                    </div>

                    {/* Error message if failed */}
                    {stage.error && (
                      <div className="mt-2 px-3 py-2 bg-red-950/30 border border-red-900/50 text-2xs font-mono text-red-300">
                        <div className="font-bold mb-1">ERROR:</div>
                        <div className="whitespace-pre-wrap">{stage.error}</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer with stage count */}
      <div className="flex-shrink-0 px-4 py-2 border-t border-border bg-muted/10 text-2xs font-mono text-muted-foreground">
        {stages.length > 0 && (
          <div>
            Completed {stages.filter(s => s.status === 'complete').length} / {stages.length} stages
          </div>
        )}
      </div>
    </div>
  );
}

export default SessionPipelineStatus;
