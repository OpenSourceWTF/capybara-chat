/**
 * Workspace Filesystem Scanner
 *
 * Scans the /workspaces directory to report actual filesystem status
 * back to the server for reconciliation with database records.
 *
 * This ensures the UI displays accurate workspace status even after
 * container restarts or manual filesystem changes.
 *
 * Supports dependency injection for testability:
 * - Production: Uses real fs and execSync
 * - Tests: Pass mock implementations via constructor
 */

import { readdirSync, existsSync, statSync } from 'fs';
import { execSync } from 'child_process';
import path from 'path';
import {
  type WorkspaceStatusReport,
  CloneStatus,
  WORKSPACE,
  parseWorkspaceDirName,
  createLogger,
} from '@capybara-chat/types';
import type { IFilesystem, IGitExecutor } from './interfaces.js';

const log = createLogger('WorkspaceScanner');

/**
 * Default filesystem implementation using Node.js fs module
 */
export const defaultFilesystem: IFilesystem = {
  existsSync,
  readdirSync,
  statSync,
};

/**
 * Default git executor using execSync
 */
export const defaultGitExecutor: IGitExecutor = {
  exec(cwd: string, command: string): string {
    return execSync(`git ${command}`, {
      cwd,
      encoding: 'utf-8',
      timeout: 10000,
      stdio: ['pipe', 'pipe', 'pipe'], // Suppress stderr output (errors are caught)
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    });
  },
};

/**
 * Dependencies for WorkspaceFilesystemScanner
 */
export interface WorkspaceScannerDeps {
  fs?: IFilesystem;
  git?: IGitExecutor;
}

export class WorkspaceFilesystemScanner {
  private basePath: string;
  private fs: IFilesystem;
  private git: IGitExecutor;

  constructor(basePath: string = WORKSPACE.BASE_PATH, deps: WorkspaceScannerDeps = {}) {
    this.basePath = basePath;
    this.fs = deps.fs ?? defaultFilesystem;
    this.git = deps.git ?? defaultGitExecutor;
  }

  /**
   * Scan all workspace directories and return status reports
   */
  async scanAll(): Promise<WorkspaceStatusReport[]> {
    const reports: WorkspaceStatusReport[] = [];

    if (!this.fs.existsSync(this.basePath)) {
      log.warn('Workspace base path does not exist', { basePath: this.basePath });
      return reports;
    }

    try {
      const entries = this.fs.readdirSync(this.basePath);

      for (const entry of entries) {
        // Skip hidden directories (like .worktrees)
        if (entry.startsWith('.')) continue;

        const fullPath = path.join(this.basePath, entry);

        // Skip if not a directory
        try {
          const stat = this.fs.statSync(fullPath);
          if (!stat.isDirectory()) continue;
        } catch {
          continue;
        }

        // Parse owner--repo format
        const parsed = parseWorkspaceDirName(entry);
        if (!parsed) {
          log.debug('Skipping non-workspace directory', { entry });
          continue;
        }

        const report = await this.scanOne(parsed.owner, parsed.repo);
        if (report) {
          reports.push(report);
        }
      }
    } catch (err) {
      log.error('Failed to scan workspaces', err as Error);
    }

    log.info('Workspace scan complete', { count: reports.length });
    return reports;
  }

  /**
   * Scan a single workspace directory
   */
  async scanOne(repoOwner: string, repoName: string): Promise<WorkspaceStatusReport | null> {
    const dirName = `${repoOwner}${WORKSPACE.SEPARATOR}${repoName}`;
    const workspacePath = path.join(this.basePath, dirName);

    if (!this.fs.existsSync(workspacePath)) {
      return {
        repoOwner,
        repoName,
        cloneStatus: CloneStatus.PENDING,
      };
    }

    const gitDir = path.join(workspacePath, '.git');
    const isGitRepo = this.fs.existsSync(gitDir);

    if (!isGitRepo) {
      // Directory exists but no .git - likely failed clone or partial
      return {
        repoOwner,
        repoName,
        cloneStatus: CloneStatus.FAILED,
        error: 'Directory exists but is not a git repository',
      };
    }

    // It's a valid git repo - gather additional info
    const report: WorkspaceStatusReport = {
      repoOwner,
      repoName,
      cloneStatus: CloneStatus.READY,
    };

    try {
      // Get current branch
      report.currentBranch = this.git.exec(workspacePath, 'rev-parse --abbrev-ref HEAD').trim();

      // Check for local changes
      const status = this.git.exec(workspacePath, 'status --porcelain');
      report.hasLocalChanges = status.trim().length > 0;

      // Get ahead/behind counts (may fail if no upstream)
      try {
        // First check if the remote branch exists to avoid noisy git errors
        const remoteBranch = `origin/${report.currentBranch}`;
        try {
          this.git.exec(workspacePath, `rev-parse --verify ${remoteBranch}`);
        } catch {
          // Remote branch doesn't exist - no upstream to compare
          report.ahead = 0;
          report.behind = 0;
          return report;
        }

        const revList = this.git.exec(
          workspacePath,
          `rev-list --left-right --count ${remoteBranch}...HEAD`
        );
        const [behind, ahead] = revList.trim().split(/\s+/).map(Number);
        report.behind = isNaN(behind) ? 0 : behind;
        report.ahead = isNaN(ahead) ? 0 : ahead;
      } catch {
        // No upstream or fetch needed - not an error
        report.ahead = 0;
        report.behind = 0;
      }
    } catch (err) {
      report.error = (err as Error).message;
    }

    return report;
  }
}

// Singleton instance
let defaultScanner: WorkspaceFilesystemScanner | null = null;

/**
 * Get the default workspace scanner instance
 */
export function getWorkspaceScanner(): WorkspaceFilesystemScanner {
  if (!defaultScanner) {
    defaultScanner = new WorkspaceFilesystemScanner();
  }
  return defaultScanner;
}

/**
 * Reset the default workspace scanner (for testing)
 */
export function resetWorkspaceScanner(): void {
  defaultScanner = null;
}

/**
 * Create a workspace scanner with custom dependencies (for testing)
 */
export function createWorkspaceScanner(
  basePath?: string,
  deps?: WorkspaceScannerDeps
): WorkspaceFilesystemScanner {
  return new WorkspaceFilesystemScanner(basePath, deps);
}

// D5 fix: Removed redundant module-level workspaceScanner export
// Use getWorkspaceScanner() singleton instead
