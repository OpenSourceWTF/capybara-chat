/**
 * TaskErrorSection - Error display for task modal
 *
 * Design: Collapsible error section with formatted output
 * Extracts and highlights command failures from error messages
 */

import { memo, useState, useMemo } from 'react';
import { AlertCircle, ChevronDown, ChevronUp, Copy, Check, Terminal } from 'lucide-react';
import type { WorkerTask } from '@capybara-chat/types';
import { Button } from '../ui';

interface TaskErrorSectionProps {
  task: WorkerTask;
}

interface ParsedError {
  title: string;
  command?: string;
  details: string[];
}

// Parse error message to extract meaningful parts
function parseError(error: string): ParsedError {
  const lines = error.split('\n').filter(Boolean);
  const result: ParsedError = {
    title: 'Error',
    details: [],
  };

  // Common error patterns
  const commandFailureMatch = error.match(/Command failed: (.+?)(?:\n|$)/);
  const gitWorktreeMatch = error.match(/git worktree add -b ([\w\-/]+)/);
  const fatalMatch = error.match(/fatal: (.+?)(?:\n|$)/);

  if (commandFailureMatch) {
    result.title = 'Command failed';
    result.command = commandFailureMatch[1].trim();
  }

  if (gitWorktreeMatch) {
    result.title = 'Worktree creation failed';
    result.command = `git worktree add -b ${gitWorktreeMatch[1]}`;
  }

  if (fatalMatch) {
    result.details.push(fatalMatch[1]);
  }

  // Extract remaining useful information
  for (const line of lines) {
    if (line.startsWith('fatal:') || line.startsWith('error:')) {
      continue; // Already captured
    }
    if (line.includes('already exists') || line.includes('not found') || line.includes('permission denied')) {
      if (!result.details.includes(line)) {
        result.details.push(line);
      }
    }
  }

  // Fallback: just use the whole error
  if (result.details.length === 0 && !result.command) {
    result.details = lines.slice(0, 5); // First 5 lines
    if (lines.length > 5) {
      result.details.push(`... (${lines.length - 5} more lines)`);
    }
  }

  return result;
}

export const TaskErrorSection = memo(function TaskErrorSection({ task }: TaskErrorSectionProps) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const parsedError = useMemo(() => task.error ? parseError(task.error) : null, [task.error]);

  if (!task.error) return null;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(task.error || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="border border-destructive/30 bg-destructive/5">
      {/* Error header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-destructive/10 transition-colors"
      >
        <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
        <span className="font-bold text-sm text-destructive flex-1 text-left">
          {parsedError?.title || 'Error'}
        </span>
        {expanded ? (
          <ChevronUp className="w-5 h-5 text-destructive/70" />
        ) : (
          <ChevronDown className="w-5 h-5 text-destructive/70" />
        )}
      </button>

      {/* Collapsed preview */}
      {!expanded && parsedError?.command && (
        <div className="px-4 pb-3">
          <div className="flex items-center gap-2 text-xs font-mono bg-destructive/10 px-3 py-2 border border-destructive/20">
            <Terminal className="w-4 h-4 text-destructive/70 flex-shrink-0" />
            <span className="text-destructive/90 truncate">{parsedError.command}</span>
          </div>
        </div>
      )}

      {/* Expanded error details */}
      {expanded && (
        <div className="border-t border-destructive/20 px-4 py-3 space-y-3">
          {/* Command if present */}
          {parsedError?.command && (
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Command</span>
              <div className="flex items-center gap-2 text-xs font-mono bg-destructive/10 px-3 py-2 border border-destructive/20">
                <Terminal className="w-4 h-4 text-destructive/70 flex-shrink-0" />
                <span className="text-destructive/90 break-all">{parsedError.command}</span>
              </div>
            </div>
          )}

          {/* Error details */}
          {parsedError?.details && parsedError.details.length > 0 && (
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Details</span>
              <ul className="text-sm text-destructive/80 space-y-1">
                {parsedError.details.map((detail, i) => (
                  <li key={i} className="font-mono">• {detail}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Full error output */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Full Output</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className="h-6 px-2 text-xs"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 mr-1" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-1" />
                    Copy
                  </>
                )}
              </Button>
            </div>
            <pre className="text-xs font-mono bg-background/50 border border-destructive/20 p-3 overflow-x-auto max-h-[200px] overflow-y-auto whitespace-pre-wrap text-destructive/70">
              {task.error}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
});
