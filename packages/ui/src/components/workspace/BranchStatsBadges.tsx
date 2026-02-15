/**
 * BranchStatsBadges - Display git branch stats (ahead/behind) with GitHub links
 * Features skeleton loading states and fade-in animations
 */

import { ArrowUp, ArrowDown } from 'lucide-react';
import { Badge } from '../ui/Badge';

interface BranchStatsBadgesProps {
  stats: { localCommit?: string; ahead?: number; behind?: number } | null;
  loading: boolean;
  repoOwner: string;
  repoName: string;
}

export function BranchStatsBadges({ stats, loading, repoOwner, repoName }: BranchStatsBadgesProps) {
  // Show skeleton placeholders while loading
  if (loading) {
    return (
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="w-16 h-5 rounded bg-muted animate-pulse" />
      </div>
    );
  }

  // No stats yet (not ready or failed)
  if (!stats) return null;

  const isAhead = (stats.ahead ?? 0) > 0;
  const isBehind = (stats.behind ?? 0) > 0;

  return (
    <div className="flex items-center gap-1.5 shrink-0">
      {stats.localCommit && (
        <a
          href={`https://github.com/${repoOwner}/${repoName}/commit/${stats.localCommit}`}
          target="_blank"
          rel="noopener noreferrer"
          title="View commit on GitHub"
        >
          {/* Commits are technical data, not status - use normal case/font */}
          <Badge variant="outline" intent="neutral" className="gap-1 font-mono tracking-normal normal-case">
            {stats.localCommit}
          </Badge>
        </a>
      )}
      {isAhead && (
        <Badge variant="soft" intent="success" className="gap-0.5 px-1.5">
          <ArrowUp className="w-3 h-3" />
          {stats.ahead}
        </Badge>
      )}
      {isBehind && (
        <Badge variant="soft" intent="warning" className="gap-0.5 px-1.5">
          <ArrowDown className="w-3 h-3" />
          {stats.behind}
        </Badge>
      )}
    </div>
  );
}
