/**
 * GitHubConfigModal - GitHub App Installation Manager
 * Shows each GitHub App installation as a card with disconnect option
 *
 * Uses useFetch for data loading and useDelete for removal.
 */

import { useState, useEffect, useCallback } from 'react';
import type { GitHubConfig } from '@capybara-chat/types';
import { API_PATHS } from '@capybara-chat/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody } from '../ui';
import { useLazyFetch } from '../../hooks/useFetch';
import { useDelete } from '../../hooks/useApiMutation';
import { GitBranch, Plus, Loader2, Building2, User, Trash2 } from 'lucide-react';

interface GitHubInstallation {
  id: number;
  account: {
    login: string;
    type: 'User' | 'Organization';
    avatar_url?: string;
  };
  repository_selection: 'all' | 'selected';
}

interface GitHubConfigModalProps {
  serverUrl: string;
  onClose: () => void;
  onSuccess: (config: GitHubConfig) => void;
  successOrg?: string | null; // Show success message when app was just installed
}

// GitHub logo SVG component
const GitHubLogo = ({ className }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
  </svg>
);

interface InstallationsResponse {
  installations: Array<{
    installation_id?: number;
    id?: number;
    account_login?: string;
    account_type?: string;
    repository_selection?: string;
    avatar_url?: string;
    account?: { login: string; type: string; avatar_url?: string };
  }>;
}

export function GitHubConfigModal({
  serverUrl,
  onClose,
  onSuccess,
  successOrg,
}: GitHubConfigModalProps) {
  const [installations, setInstallations] = useState<GitHubInstallation[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Use centralized fetch hook
  const { data, loading, fetch: fetchInstallations } = useLazyFetch<InstallationsResponse>(
    `${serverUrl}${API_PATHS.GITHUB_INSTALLATIONS}`
  );

  // Use centralized delete hook
  const { deleteItem, loading: _deleting } = useDelete(`${serverUrl}${API_PATHS.GITHUB_INSTALLATIONS}`, {
    onSuccess: (id) => {
      setInstallations(prev => prev.filter(i => i.id !== Number(id)));
      setConfirmDelete(null);
      // Notify parent if no installations left
      if (installations.length <= 1) {
        onSuccess({ configured: false });
      }
    },
  });

  // Fetch on mount
  useEffect(() => {
    fetchInstallations();
  }, [fetchInstallations]);

  // Map API response when data changes
  useEffect(() => {
    if (data?.installations) {
      const mapped: GitHubInstallation[] = data.installations.map((i) => {
        const accountType = (i.account?.type ?? i.account_type ?? 'Organization') as 'User' | 'Organization';
        return {
          id: i.installation_id ?? i.id ?? 0,
          account: {
            login: i.account?.login ?? i.account_login ?? 'Unknown',
            type: accountType,
            avatar_url: i.account?.avatar_url ?? i.avatar_url,
          },
          repository_selection: (i.repository_selection ?? 'selected') as 'all' | 'selected',
        };
      });
      setInstallations(mapped);
    }
  }, [data]);

  const handleAddInstallation = useCallback(() => {
    window.location.href = `${serverUrl}${API_PATHS.GITHUB_INSTALLATIONS}/install`;
  }, [serverUrl]);

  const handleRemoveInstallation = useCallback(async (installationId: number) => {
    setDeletingId(installationId);
    await deleteItem(String(installationId));
    setDeletingId(null);
  }, [deleteItem]);

  const hasInstallations = installations.length > 0;

  return (
    <Dialog open onClose={onClose}>
      <DialogContent className="max-w-[420px] p-0 flex flex-col gap-0 border border-border">
        <DialogHeader onClose={onClose}>
          <DialogTitle className="flex items-center gap-3">
            <div className="flex items-center justify-center w-7 h-7 bg-muted text-foreground rounded-none">
              <GitHubLogo className="w-5 h-5" />
            </div>
            <div className="flex flex-col items-start gap-0.5">
              <span className="uppercase tracking-wide leading-none">GitHub Integration</span>
              <span className="text-2xs font-normal text-muted-foreground font-mono leading-none">Manage repository access</span>
            </div>
          </DialogTitle>
        </DialogHeader>

        <DialogBody className="p-5 space-y-4">
          {/* Success message */}
          {successOrg && (
            <div className="flex items-center gap-3 p-3 bg-green-500/10 text-green-500 border border-green-500/20">
              <div className="flex items-center justify-center w-5 h-5 bg-green-500 text-black font-bold text-xs">✓</div>
              <span className="text-sm font-mono">Connected to <strong>{successOrg}</strong></span>
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span className="text-sm font-mono uppercase">Loading installations...</span>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {hasInstallations ? (
                <>
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                    <GitBranch className="w-3.5 h-3.5" />
                    <span>Connected Accounts</span>
                  </div>

                  {installations.map((installation) => (
                    <div key={installation.id} className="p-3 bg-muted/30 border border-border hover:border-primary/50 transition-colors group">
                      {confirmDelete === installation.id ? (
                        /* Confirm delete state */
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-10 h-10 bg-destructive/10 text-destructive shrink-0">
                            <Trash2 className="w-4 h-4" />
                          </div>
                          <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                            <span className="text-sm font-bold uppercase text-destructive">Remove access?</span>
                            <span className="text-xs text-muted-foreground truncate font-mono" title={installation.account.login}>
                              {installation.account.login}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => setConfirmDelete(null)}
                              className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                              disabled={deletingId === installation.id}
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleRemoveInstallation(installation.id)}
                              className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50"
                              disabled={deletingId === installation.id}
                            >
                              {deletingId === installation.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                'Remove'
                              )}
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* Normal card content */
                        <div className="flex items-center gap-3">
                          {/* Avatar */}
                          {installation.account.avatar_url ? (
                            <img
                              src={installation.account.avatar_url}
                              alt={installation.account.login}
                              className="w-10 h-10 rounded-none border border-border shrink-0"
                            />
                          ) : (
                            <div className="flex items-center justify-center w-10 h-10 bg-muted text-muted-foreground border border-border shrink-0">
                              {installation.account.type === 'Organization' ? (
                                <Building2 className="w-5 h-5" />
                              ) : (
                                <User className="w-5 h-5" />
                              )}
                            </div>
                          )}

                          {/* Info */}
                          <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                            <div className="font-medium truncate text-sm">
                              {installation.account.login}
                            </div>
                            <div className="flex items-center gap-2 text-2xs text-muted-foreground font-mono uppercase">
                              <span>
                                {installation.account.type === 'Organization' ? 'Org' : 'User'}
                              </span>
                              <span className="opacity-50">|</span>
                              <span>
                                {installation.repository_selection === 'all' ? 'All repos' : 'Selected'}
                              </span>
                            </div>
                          </div>

                          {/* Disconnect button */}
                          <button
                            onClick={() => setConfirmDelete(installation.id)}
                            className="flex items-center justify-center w-8 h-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100"
                            title="Remove access"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center gap-3 py-8 text-center border border-dashed border-border bg-muted/10">
                  <GitHubLogo className="w-12 h-12 opacity-20" />
                  <p className="font-medium text-sm">No GitHub accounts connected</p>
                  <p className="text-xs text-muted-foreground font-mono">
                    Install the GitHub App to access repositories
                  </p>
                </div>
              )}

              {/* Add Installation button */}
              <button
                onClick={handleAddInstallation}
                className="flex items-center justify-center gap-2 w-full p-3 mt-2 bg-primary text-primary-foreground font-bold text-xs uppercase tracking-wider hover:bg-primary/90 transition-colors border border-transparent hover:border-border"
              >
                <Plus className="w-4 h-4" />
                <span>{hasInstallations ? 'Add Another Account' : 'Connect GitHub Account'}</span>
              </button>
            </div>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
