/**
 * AddWorkspaceModal - Modal for adding a new workspace
 * Features: Filterable repo list, org avatars, stable sizing, Add Organization link
 *
 * Uses useReducer for cleaner state management of related form fields.
 */

import { useReducer, useEffect, useCallback } from 'react';
import type { Workspace } from '@capybara-chat/types';
import { API_PATHS } from '@capybara-chat/types';
import { Button, Input, Label } from '../ui';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '../ui';
import { api } from '../../lib/api';
import { createLogger } from '../../lib/logger';
import { getErrorMessage } from '../../lib/errors';
import { FolderGit } from 'lucide-react';
import { OrgSelector, type GitHubOrg } from '../workspace/OrgSelector';
import { RepoSelector, type GitHubRepo } from '../workspace/RepoSelector';

const log = createLogger('AddWorkspaceModal');

// Consolidated form state
interface FormState {
  // Form fields
  name: string;
  nameEdited: boolean;
  defaultBranch: string;
  branchEdited: boolean;
  // Submit state
  loading: boolean;
  error: string | null;
  // Organizations
  orgs: GitHubOrg[];
  selectedOrg: string;
  loadingOrgs: boolean;
  // Repositories
  repos: GitHubRepo[];
  selectedRepo: string;
  loadingRepos: boolean;
  repoFilter: string;
}

type FormAction =
  | { type: 'SET_NAME'; name: string; edited?: boolean }
  | { type: 'SET_BRANCH'; branch: string; edited?: boolean }
  | { type: 'SET_ORGS_LOADING' }
  | { type: 'SET_ORGS'; orgs: GitHubOrg[] }
  | { type: 'SELECT_ORG'; org: string }
  | { type: 'SET_REPOS_LOADING' }
  | { type: 'SET_REPOS'; repos: GitHubRepo[] }
  | { type: 'SELECT_REPO'; repo: string; autoName?: string; autoBranch?: string }
  | { type: 'SET_REPO_FILTER'; filter: string }
  | { type: 'SUBMIT_START' }
  | { type: 'SUBMIT_ERROR'; error: string }
  | { type: 'RESET_ERROR' };

const initialState: FormState = {
  name: '',
  nameEdited: false,
  defaultBranch: '',
  branchEdited: false,
  loading: false,
  error: null,
  orgs: [],
  selectedOrg: '',
  loadingOrgs: true,
  repos: [],
  selectedRepo: '',
  loadingRepos: false,
  repoFilter: '',
};

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case 'SET_NAME':
      return { ...state, name: action.name, nameEdited: action.edited ?? true };
    case 'SET_BRANCH':
      return { ...state, defaultBranch: action.branch, branchEdited: action.edited ?? true };
    case 'SET_ORGS_LOADING':
      return { ...state, loadingOrgs: true };
    case 'SET_ORGS':
      return {
        ...state,
        orgs: action.orgs,
        selectedOrg: action.orgs[0]?.login ?? '',
        loadingOrgs: false,
      };
    case 'SELECT_ORG':
      // Selecting a new org clears repos and resets repo-related state
      return {
        ...state,
        selectedOrg: action.org,
        repos: [],
        selectedRepo: '',
        repoFilter: '',
        loadingRepos: true,
      };
    case 'SET_REPOS_LOADING':
      return { ...state, loadingRepos: true, repos: [], selectedRepo: '', repoFilter: '' };
    case 'SET_REPOS':
      return { ...state, repos: action.repos, loadingRepos: false };
    case 'SELECT_REPO':
      return {
        ...state,
        selectedRepo: action.repo,
        repoFilter: '',
        // Auto-set name and branch if not manually edited
        name: !state.nameEdited && action.autoName ? action.autoName : state.name,
        defaultBranch: action.autoBranch ?? state.defaultBranch,
        branchEdited: false, // Reset branch editing when repo changes
      };
    case 'SET_REPO_FILTER':
      return { ...state, repoFilter: action.filter };
    case 'SUBMIT_START':
      return { ...state, loading: true, error: null };
    case 'SUBMIT_ERROR':
      return { ...state, loading: false, error: action.error };
    case 'RESET_ERROR':
      return { ...state, error: null };
    default:
      return state;
  }
}

interface AddWorkspaceModalProps {
  serverUrl: string;
  onClose: () => void;
  onSuccess: (ws: Workspace) => void;
  existingWorkspaceNames?: string[];
}

export function AddWorkspaceModal({
  serverUrl,
  onClose,
  onSuccess,
  existingWorkspaceNames = [],
}: AddWorkspaceModalProps) {
  const [state, dispatch] = useReducer(formReducer, initialState);
  const {
    name, nameEdited, defaultBranch, branchEdited,
    loading, error, orgs, selectedOrg, loadingOrgs,
    repos, selectedRepo, loadingRepos, repoFilter,
  } = state;

  // Generate unique workspace name
  const generateUniqueName = useCallback((baseName: string): string => {
    let uniqueName = baseName;
    let counter = 2;
    while (existingWorkspaceNames.includes(uniqueName)) {
      uniqueName = `${baseName}-${counter}`;
      counter++;
    }
    return uniqueName;
  }, [existingWorkspaceNames]);

  // Fetch orgs from GitHub App installations on mount
  useEffect(() => {
    const fetchOrgs = async () => {
      try {
        const res = await api.get(`${serverUrl}${API_PATHS.GITHUB_INSTALLATIONS}/orgs`);
        if (res.ok) {
          const data = await res.json();
          dispatch({ type: 'SET_ORGS', orgs: data.orgs });
        } else {
          dispatch({ type: 'SET_ORGS', orgs: [] });
        }
      } catch (err) {
        log.error('Failed to fetch orgs', { error: err });
        dispatch({ type: 'SET_ORGS', orgs: [] });
      }
    };
    fetchOrgs();
  }, [serverUrl]);

  // Fetch repos when org changes - uses GitHub App installation
  useEffect(() => {
    if (!selectedOrg) return;

    const selectedOrgData = orgs.find(o => o.login === selectedOrg);
    if (!selectedOrgData?.installationId) {
      dispatch({ type: 'SET_REPOS', repos: [] });
      return;
    }

    dispatch({ type: 'SET_REPOS_LOADING' });

    const fetchRepos = async () => {
      try {
        const res = await api.get(`${serverUrl}${API_PATHS.GITHUB_INSTALLATIONS}/${selectedOrgData.installationId}/repos`);
        if (res.ok) {
          const data = await res.json();
          dispatch({ type: 'SET_REPOS', repos: data.repos });
        } else {
          dispatch({ type: 'SET_REPOS', repos: [] });
        }
      } catch (err) {
        log.error('Failed to fetch repos', { error: err });
        dispatch({ type: 'SET_REPOS', repos: [] });
      }
    };
    fetchRepos();
  }, [serverUrl, selectedOrg, orgs]);

  const handleNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch({ type: 'SET_NAME', name: e.target.value });
  }, []);

  const handleBranchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch({ type: 'SET_BRANCH', branch: e.target.value });
  }, []);

  const handleOrgChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    dispatch({ type: 'SELECT_ORG', org: e.target.value });
  }, []);

  const handleRepoSelect = useCallback((repoName: string) => {
    const repo = repos.find(r => r.name === repoName);
    const autoName = generateUniqueName(repoName);
    dispatch({
      type: 'SELECT_REPO',
      repo: repoName,
      autoName,
      autoBranch: repo?.defaultBranch,
    });
  }, [repos, generateUniqueName]);

  const handleRepoFilterChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch({ type: 'SET_REPO_FILTER', filter: e.target.value });
  }, []);

  const handleClearSelectedRepo = useCallback(() => {
    dispatch({ type: 'SELECT_REPO', repo: '' });
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!name.trim() || !selectedOrg || !selectedRepo) return;

    const repo = repos.find(r => r.name === selectedRepo);
    if (!repo) return;

    dispatch({ type: 'SUBMIT_START' });
    try {
      const selectedOrgData = orgs.find(o => o.login === selectedOrg);

      const res = await api.post(`${serverUrl}${API_PATHS.WORKSPACES}`, {
        name: name.trim(),
        repoUrl: repo.url,
        defaultBranch: defaultBranch || repo.defaultBranch,
        installationId: selectedOrgData?.installationId,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create workspace');
      }
      const ws = await res.json();
      onSuccess(ws);
    } catch (err) {
      dispatch({ type: 'SUBMIT_ERROR', error: getErrorMessage(err, 'Failed') });
    }
  }, [name, selectedOrg, selectedRepo, repos, orgs, defaultBranch, serverUrl, onSuccess]);

  const handleAddOrganization = useCallback(() => {
    window.location.href = `${serverUrl}${API_PATHS.GITHUB_INSTALLATIONS}/install`;
  }, [serverUrl]);

  return (
    <Dialog open onClose={onClose}>
      <DialogContent className="min-w-[480px] max-w-[480px] min-h-[620px] p-0 flex flex-col border border-border">
        <DialogHeader onClose={onClose}>
          <DialogTitle className="flex items-center gap-3">
            <div className="flex items-center justify-center w-7 h-7 bg-muted text-foreground rounded-none">
              <FolderGit className="w-5 h-5" />
            </div>
            <div className="flex flex-col items-start gap-0.5">
              <span className="uppercase tracking-wide leading-none">Add Workspace</span>
              <span className="text-2xs font-normal text-muted-foreground font-mono leading-none">Connect a GitHub repository</span>
            </div>
          </DialogTitle>
        </DialogHeader>

        <DialogBody className="space-y-4 flex-1 p-6">
          {/* Organization selector with avatar */}
          <OrgSelector
            orgs={orgs}
            selectedOrg={selectedOrg}
            loading={loadingOrgs}
            onOrgChange={handleOrgChange}
            onAddOrganization={handleAddOrganization}
          />

          {/* Repository with filter - fixed height container */}
          <RepoSelector
            repos={repos}
            selectedRepo={selectedRepo}
            loading={loadingRepos}
            filter={repoFilter}
            disabled={!selectedOrg}
            onFilterChange={handleRepoFilterChange}
            onRepoSelect={handleRepoSelect}
            onClearSelection={handleClearSelectedRepo}
          />

          {/* Name field */}
          <div>
            <Label className="block mb-1 text-xs uppercase tracking-wide">Workspace Name</Label>
            <Input
              value={name}
              onChange={handleNameChange}
              placeholder={selectedRepo || 'Workspace name'}
            />
            {!nameEdited && selectedRepo && (
              <p className="text-xs text-muted-foreground mt-1 font-mono">Auto-generated from repository</p>
            )}
          </div>

          {/* Default Branch field */}
          <div>
            <Label className="block mb-1 text-xs uppercase tracking-wide">Default Branch</Label>
            <Input
              value={defaultBranch}
              onChange={handleBranchChange}
              placeholder="main"
            />
            {!branchEdited && selectedRepo && (
              <p className="text-xs text-muted-foreground mt-1 font-mono">Auto-set from repository's default branch</p>
            )}
          </div>

          {error && <div className="text-sm text-destructive font-mono border border-destructive/20 bg-destructive/10 p-2">{error}</div>}
        </DialogBody>

        <DialogFooter className="p-4 border-t border-border bg-muted/20">
          <Button variant="ghost" onClick={onClose} className="rounded-none uppercase tracking-wide font-bold">Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || !selectedOrg || !selectedRepo || !name.trim()}
            className="rounded-none uppercase tracking-wide font-bold"
          >
            {loading ? 'Adding...' : 'Add Workspace'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
