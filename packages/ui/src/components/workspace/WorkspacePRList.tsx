/**
 * WorkspacePRList - Display list of open PRs with merge actions
 */

import { GitPullRequest } from 'lucide-react';
import { Button } from '../ui';

interface WorkspacePRListProps {
  prs: Array<{ number: number; title: string; url: string }>;
  onMerge: (prNumber: number) => void;
  mergeLoading: boolean;
}

export function WorkspacePRList({ prs, onMerge, mergeLoading }: WorkspacePRListProps) {
  if (prs.length === 0) return null;

  return (
    <div className="border-t pt-2 mt-2">
      <div className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
        <GitPullRequest className="w-3 h-3" />
        Open Pull Requests ({prs.length})
      </div>
      <div className="space-y-1">
        {prs.slice(0, 3).map((pr) => (
          <div key={pr.number} className="flex items-center justify-between text-sm bg-muted/50 rounded px-2 py-1">
            <a
              href={pr.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline truncate flex-1"
            >
              #{pr.number} {pr.title}
            </a>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onMerge(pr.number)}
              disabled={mergeLoading}
              className="ml-2 h-6 px-2 text-xs"
            >
              Merge
            </Button>
          </div>
        ))}
        {prs.length > 3 && (
          <div className="text-xs text-muted-foreground">
            +{prs.length - 3} more PRs
          </div>
        )}
      </div>
    </div>
  );
}
