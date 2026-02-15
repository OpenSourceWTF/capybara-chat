/**
 * WorkspaceManager - Manage GitHub workspaces
 * 
 * Uses TerminalLibraryLayout for consistent terminal aesthetic
 * with status filters in the collapsible sidebar
 */

import { useState, useEffect, useCallback } from 'react';
import type { Workspace, GitHubConfig } from '@capybara-chat/types';
import { API_PATHS, CloneStatus } from '@capybara-chat/types';
import { Button, TerminalRow } from '../ui';
import { TerminalLibraryLayout, FilterOption } from '../library';
import { GitBranch, AlertTriangle, RefreshCw, Trash2, Settings } from 'lucide-react';
import { createLogger } from '../../lib/logger';
import { AddWorkspaceModal } from '../modals/AddWorkspaceModal';
import { GitHubConfigModal } from '../modals/GitHubConfigModal';
import { api } from '../../lib/api';
import { useServer } from '../../context/ServerContext';
import { useModal } from '../../hooks/useModal';
import { useFetchList } from '../../hooks/useFetchList';
import { formatDateTime } from '../../lib/utils';
import {
  useWorkspaceStats,
  useWorkspaceSync,
  useWorkspaceClone,
  useDeleteWorkspace,
} from '../../hooks/useWorkspace';
import { CloneStatusBadge, MergeConflictModal, type MergeConflictResult } from '../workspace';

const log = createLogger('WorkspaceManager');

// Wrapper component for workspace row with hooks
function WorkspaceRow({
  workspace,
  onDelete
}: {
  workspace: Workspace;
  onDelete: (id: string) => void;
}) {
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [conflictResult, setConflictResult] = useState<MergeConflictResult | null>(null);

  const isReady = workspace.cloneStatus === CloneStatus.READY;
  const isPendingOrFailed = workspace.cloneStatus === CloneStatus.PENDING || workspace.cloneStatus === CloneStatus.FAILED;

  const { stats, loading: statsLoading, refetch: refetchStats } = useWorkspaceStats(workspace.id, { skip: !isReady });
  const { sync, loading: syncLoading } = useWorkspaceSync(workspace.id);
  const { clone, loading: cloneLoading } = useWorkspaceClone(workspace.id);
  const { deleteWorkspace, loading: deleteLoading } = useDeleteWorkspace();

  const handleClone = async () => {
    const result = await clone();
    if (result) refetchStats();
  };

  const handleSync = async () => {
    const result = await sync('merge');
    if (result?.success) {
      refetchStats();
    } else if (result && !result.success && (result.conflicts !== undefined || result.error?.includes('conflict'))) {
      setConflictResult(result as MergeConflictResult);
      setShowConflictModal(true);
    }
  };

  const handleResetSync = async () => {
    setShowConflictModal(false);
    setConflictResult(null);
    const result = await sync('reset');
    if (result?.success) refetchStats();
  };

  const handleDelete = async () => {
    const result = await deleteWorkspace(workspace.id, { pushUnpushedBranches: true });
    if (result?.deleted) onDelete(workspace.id);
  };

  const isBehind = (stats?.behind ?? 0) > 0;
  const hasConflicts = stats?.hasConflicts ?? false;

  return (
    <>
      {/* Merge Conflict Modal */}
      <MergeConflictModal
        open={showConflictModal}
        result={conflictResult}
        workspaceName={workspace.name}
        onReset={handleResetSync}
        onClose={() => {
          setShowConflictModal(false);
          setConflictResult(null);
        }}
        isResetting={syncLoading}
      />

      <TerminalRow
      onClick={() => window.open(`https://github.com/${workspace.repoOwner}/${workspace.repoName}`, '_blank')}
      title={
        <span className="flex items-center gap-2">
          <span className="font-bold">{workspace.name}</span>
          <CloneStatusBadge status={workspace.cloneStatus} error={workspace.cloneError} />
          {hasConflicts && (
            <span className="flex items-center gap-1 text-warning text-xs">
              <AlertTriangle className="w-3 h-3" />
              conflicts
            </span>
          )}
        </span>
      }
      date={workspace.lastSyncedAt ? formatDateTime(workspace.lastSyncedAt) : undefined}
      meta={
        <span className="text-muted-foreground/70">
          {workspace.repoOwner}/{workspace.repoName}
          <span className="mx-1 opacity-50">|</span>
          <GitBranch className="w-3 h-3 inline" /> {workspace.defaultBranch}
          {isReady && !statsLoading && stats && (
            <>
              <span className="mx-1 opacity-50">|</span>
              <span className={stats.ahead > 0 ? 'text-success' : ''}>↑{stats.ahead}</span>
              <span className="mx-1">/</span>
              <span className={stats.behind > 0 ? 'text-warning' : ''}>↓{stats.behind}</span>
            </>
          )}
        </span>
      }
      actions={
        <div className="flex items-center gap-1">
          {isPendingOrFailed && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => { e.stopPropagation(); handleClone(); }}
              disabled={cloneLoading}
              className="h-6 rounded-none text-xs"
            >
              <RefreshCw className={`w-3 h-3 mr-1 ${cloneLoading ? 'animate-spin' : ''}`} />
              clone
            </Button>
          )}
          {isReady && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => { e.stopPropagation(); handleSync(); }}
              disabled={syncLoading}
              className={`h-6 rounded-none text-xs ${(isBehind || (stats?.ahead ?? 0) > 0) ? 'text-warning' : ''}`}
              title={`Pull from remote${isBehind ? ` (${stats?.behind} behind)` : ''}, push local${(stats?.ahead ?? 0) > 0 ? ` (${stats?.ahead} ahead)` : ''}`}
            >
              <RefreshCw className={`w-3 h-3 mr-1 ${syncLoading ? 'animate-spin' : ''}`} />
              sync
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => { e.stopPropagation(); handleDelete(); }}
            disabled={deleteLoading}
            className="h-6 rounded-none text-xs text-destructive hover:text-destructive"
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      }
    />
    </>
  );
}

export function WorkspaceManager() {
  const { serverUrl } = useServer();
  const [githubConfig, setGithubConfig] = useState<GitHubConfig | null>(null);
  const [oauthConnected, setOauthConnected] = useState(false);
  const [hasAppInstallations, setHasAppInstallations] = useState(false);
  const [githubChecksDone, setGithubChecksDone] = useState(false);

  const addModal = useModal();
  const githubConfigModal = useModal<{ successOrg?: string | null }>();

  const { items: workspaces, loading, setItems: setWorkspaces } = useFetchList<Workspace>({
    url: `${serverUrl}${API_PATHS.WORKSPACES}`,
    dataKey: 'workspaces',
  });

  const fetchGitHubConfig = useCallback(async () => {
    try {
      const res = await api.get(`${serverUrl}${API_PATHS.SETTINGS_GITHUB}`);
      if (res.ok) {
        const data = await res.json();
        setGithubConfig(data);
      }
    } catch (err) {
      log.error('Failed to fetch GitHub config', { error: err });
    }
  }, [serverUrl]);

  const fetchOAuthStatus = useCallback(async () => {
    try {
      const res = await api.get(`${serverUrl}${API_PATHS.AUTH_GITHUB}/status`);
      if (res.ok) {
        const data = await res.json();
        setOauthConnected(data.connected);
      }
    } catch (err) {
      log.error('Failed to fetch OAuth status', { error: err });
    }
  }, [serverUrl]);

  const fetchAppInstallations = useCallback(async () => {
    try {
      const res = await api.get(`${serverUrl}${API_PATHS.GITHUB_INSTALLATIONS}`);
      if (res.ok) {
        const data = await res.json();
        setHasAppInstallations((data.installations || []).length > 0);
      }
    } catch (err) {
      log.error('Failed to fetch App installations', { error: err });
    }
  }, [serverUrl]);

  useEffect(() => {
    Promise.all([fetchGitHubConfig(), fetchOAuthStatus(), fetchAppInstallations()])
      .finally(() => setGithubChecksDone(true));
  }, [fetchGitHubConfig, fetchOAuthStatus, fetchAppInstallations]);

  // Auto-open GitHub config modal on successful installation redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const githubAppParam = params.get('github_app');
    const orgName = params.get('org');

    if (githubAppParam === 'installed') {
      githubConfigModal.openWith({ successOrg: orgName });
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [githubConfigModal]);

  const handleAddWorkspace = async () => {
    if (!githubConfig?.configured && !oauthConnected && !hasAppInstallations) {
      githubConfigModal.open();
      return;
    }
    addModal.open();
  };

  const isGitHubConfigured = githubConfig?.configured || oauthConnected || hasAppInstallations;

  const handleDeleteWorkspace = (id: string) => {
    setWorkspaces((prev) => prev.filter((w) => w.id !== id));
  };

  // Extract filter options from clone status
  const getFilterOptions = useCallback((workspaces: Workspace[]): FilterOption[] => {
    const statusCounts = new Map<string, number>();
    workspaces.forEach(ws => {
      const status = ws.cloneStatus || 'unknown';
      statusCounts.set(status, (statusCounts.get(status) || 0) + 1);
    });

    return Array.from(statusCounts.entries()).map(([status, count]) => ({
      value: status,
      label: status.toLowerCase(),
      count
    }));
  }, []);

  // Filter function
  const filterFn = useCallback((ws: Workspace, query: string, activeFilters: Set<string>): boolean => {
    const lowerQuery = query.toLowerCase();
    const matchesQuery = !query ||
      ws.name.toLowerCase().includes(lowerQuery) ||
      ws.repoOwner?.toLowerCase().includes(lowerQuery) ||
      ws.repoName?.toLowerCase().includes(lowerQuery);

    const matchesFilters = activeFilters.size === 0 ||
      activeFilters.has(ws.cloneStatus || 'unknown');

    return Boolean(matchesQuery && matchesFilters);
  }, []);

  // Header action for GitHub config
  const headerAction = (
    <Button
      variant="outline"
      size="sm"
      onClick={githubConfigModal.open}
      className={`rounded-none h-7 ${!githubChecksDone
        ? 'border-muted text-muted-foreground'
        : isGitHubConfigured
          ? 'border-green-500/30 text-green-700 dark:text-green-400'
          : 'border-amber-500/50 text-amber-700 dark:text-amber-400'
        }`}
      disabled={!githubChecksDone}
    >
      <Settings className="w-3 h-3 mr-1" />
      {!githubChecksDone ? '...' : isGitHubConfigured ? 'github:ok' : 'config'}
    </Button>
  );

  return (
    <>
      <TerminalLibraryLayout<Workspace>
        items={workspaces}
        loading={loading}
        commandPrefix="ls -la"
        searchPlaceholder="workspace..."
        getFilterOptions={getFilterOptions}
        filterFn={filterFn}
        sidebarTitle="STATUS"
        newButtonLabel="mkdir"
        onNewClick={handleAddWorkspace}
        loadingMessage="Loading workspaces..."
        emptyMessage="No workspaces yet"
        emptyActionLabel="Add a GitHub repository to get started!"
        headerAction={headerAction}
        renderItem={(ws) => (
          <WorkspaceRow
            key={ws.id}
            workspace={ws}
            onDelete={handleDeleteWorkspace}
          />
        )}
      />

      {/* Modals */}
      {addModal.isOpen && (
        <AddWorkspaceModal
          serverUrl={serverUrl}
          existingWorkspaceNames={workspaces.map(w => w.name)}
          onClose={addModal.close}
          onSuccess={(ws) => {
            setWorkspaces((prev) => [ws, ...prev]);
            addModal.close();
          }}
        />
      )}

      {githubConfigModal.isOpen && (
        <GitHubConfigModal
          serverUrl={serverUrl}
          successOrg={githubConfigModal.data?.successOrg}
          onClose={githubConfigModal.close}
          onSuccess={(config) => {
            setGithubConfig(config);
            githubConfigModal.close();
          }}
        />
      )}
    </>
  );
}
