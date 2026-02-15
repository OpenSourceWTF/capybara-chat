/**
 * RepoSelector - GitHub repository selector with search filter
 *
 * Extracted from AddWorkspaceModal for better separation of concerns.
 */

import { useMemo } from 'react';
import { GitFork, Loader2 } from 'lucide-react';
import { Input, Label } from '../ui';

export interface GitHubRepo {
  name: string;
  fullName: string;
  isPrivate: boolean;
  url: string;
  defaultBranch: string;
  description: string | null;
}

export interface RepoSelectorProps {
  repos: GitHubRepo[];
  selectedRepo: string;
  loading: boolean;
  filter: string;
  disabled?: boolean;
  onFilterChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRepoSelect: (repoName: string) => void;
  onClearSelection: () => void;
}

export function RepoSelector({
  repos,
  selectedRepo,
  loading,
  filter,
  disabled = false,
  onFilterChange,
  onRepoSelect,
  onClearSelection,
}: RepoSelectorProps) {
  // Filtered repos based on search
  const filteredRepos = useMemo(() => {
    if (!filter.trim()) return repos;
    const lower = filter.toLowerCase();
    return repos.filter(
      (r) =>
        r.name.toLowerCase().includes(lower) ||
        r.description?.toLowerCase().includes(lower)
    );
  }, [repos, filter]);

  const selectedRepoInfo = repos.find(r => r.name === selectedRepo);

  return (
    <div>
      <Label className="block mb-1 text-xs uppercase tracking-wide">Repository</Label>
      {/* Selected repo display */}
      {selectedRepo ? (
        <div className="flex items-center gap-2 p-2 border border-border rounded-none bg-muted/30">
          <div className="w-6 h-6 flex items-center justify-center flex-shrink-0 text-muted-foreground">
            <GitFork className="w-4 h-4" />
          </div>
          <span className="font-medium">{selectedRepo}</span>
          {selectedRepoInfo?.isPrivate && <span className="text-xs">🔒</span>}
          <button
            type="button"
            onClick={onClearSelection}
            className="ml-auto text-xs text-muted-foreground hover:text-foreground uppercase font-bold tracking-wide"
          >
            Change
          </button>
        </div>
      ) : (
        <>
          {/* Filter input */}
          <Input
            value={filter}
            onChange={onFilterChange}
            placeholder={loading ? 'Loading repositories...' : `Search ${repos.length} repositories...`}
            disabled={loading || disabled}
            className="mb-2"
          />
          {/* Fixed height scrollable list */}
          <div className="h-48 overflow-y-auto border border-border rounded-none bg-background">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-sm text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <span className="font-mono uppercase text-xs">Loading repositories...</span>
              </div>
            ) : filteredRepos.length === 0 ? (
              <div className="flex items-center justify-center h-full text-sm text-muted-foreground font-mono uppercase text-xs">
                {repos.length === 0 ? 'No repositories found' : 'No matches'}
              </div>
            ) : (
              filteredRepos.map((repo) => (
                <button
                  key={repo.name}
                  type="button"
                  onClick={() => onRepoSelect(repo.name)}
                  className="w-full text-left px-3 py-2.5 hover:bg-muted/50 flex items-center gap-3 text-sm border-b border-border last:border-b-0 group"
                >
                  {/* GitHub repo icon */}
                  <div className="w-6 h-6 flex items-center justify-center flex-shrink-0 text-muted-foreground">
                    <GitFork className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium group-hover:text-primary transition-colors">{repo.name}</span>
                      {repo.isPrivate && <span className="text-xs opacity-60">🔒</span>}
                    </div>
                    {repo.description && (
                      <p className="text-xs text-muted-foreground truncate font-mono">
                        {repo.description}
                      </p>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </>
      )}
      {/* Selected repo description */}
      {selectedRepoInfo?.description && (
        <p className="text-xs text-muted-foreground mt-2 font-mono">
          {selectedRepoInfo.description}
        </p>
      )}
    </div>
  );
}
