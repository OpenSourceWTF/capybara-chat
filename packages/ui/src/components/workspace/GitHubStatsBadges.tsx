/**
 * GitHubStatsBadges - Display open issues and PRs count as clickable badges
 * Features skeleton loading states and fade-in animations
 */

import { GitPullRequest, CircleDot } from 'lucide-react';
import { Badge } from '../ui/Badge';

interface GitHubStatsBadgesProps {
  repoOwner: string;
  repoName: string;
  prsCount: number;
  issuesCount?: number;
  loading?: boolean;
}

export function GitHubStatsBadges({
  repoOwner,
  repoName,
  prsCount,
  issuesCount,
  loading = false
}: GitHubStatsBadgesProps) {
  const baseUrl = `https://github.com/${repoOwner}/${repoName}`;

  // Show skeleton placeholders while loading
  if (loading) {
    return (
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="w-8 h-5 rounded bg-muted animate-pulse" />
        <span className="w-8 h-5 rounded bg-muted animate-pulse" />
      </div>
    );
  }

  // Don't render if no data
  if (prsCount === 0 && (!issuesCount || issuesCount === 0)) {
    return null;
  }

  return (
    <div className="flex items-center gap-1.5 shrink-0">
      {/* Open PRs */}
      {prsCount > 0 && (
        <a
          href={`${baseUrl}/pulls`}
          target="_blank"
          rel="noopener noreferrer"
          title={`${prsCount} open pull request${prsCount !== 1 ? 's' : ''}`}
        >
          <Badge variant="soft" intent="info" className="gap-1.5">
            <GitPullRequest className="w-3 h-3" />
            {prsCount}
          </Badge>
        </a>
      )}

      {/* Open Issues */}
      {typeof issuesCount === 'number' && issuesCount > 0 && (
        <a
          href={`${baseUrl}/issues`}
          target="_blank"
          rel="noopener noreferrer"
          title={`${issuesCount} open issue${issuesCount !== 1 ? 's' : ''}`}
        >
          <Badge variant="soft" intent="success" className="gap-1.5">
            <CircleDot className="w-3 h-3" />
            {issuesCount}
          </Badge>
        </a>
      )}
    </div>
  );
}
