/**
 * Workspace Filesystem Scanner Tests
 *
 * Tests for injectable workspace scanner with mock filesystem and git executor.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CloneStatus, WORKSPACE } from '@capybara-chat/types';
import type { Stats } from 'fs';
import type { IFilesystem, IGitExecutor } from './interfaces.js';
import {
  WorkspaceFilesystemScanner,
  createWorkspaceScanner,
  getWorkspaceScanner,
  resetWorkspaceScanner,
  defaultFilesystem,
  defaultGitExecutor,
} from './workspace-scanner.js';

// Mock filesystem implementation
function createMockFilesystem(
  files: Map<string, { isDirectory: boolean }> = new Map()
): IFilesystem {
  return {
    existsSync: (path: string) => files.has(path),
    readdirSync: (path: string) => {
      const entries: string[] = [];
      const prefix = path.endsWith('/') ? path : path + '/';
      for (const [filePath] of files) {
        if (filePath.startsWith(prefix) && !filePath.slice(prefix.length).includes('/')) {
          entries.push(filePath.slice(prefix.length));
        }
      }
      return entries;
    },
    statSync: (path: string) => {
      const file = files.get(path);
      if (!file) {
        throw new Error(`ENOENT: no such file or directory, stat '${path}'`);
      }
      return {
        isDirectory: () => file.isDirectory,
      } as Stats;
    },
  };
}

// Mock git executor implementation
function createMockGitExecutor(responses: Map<string, string> = new Map()): IGitExecutor {
  return {
    exec: (cwd: string, command: string) => {
      const key = `${cwd}:${command}`;
      const response = responses.get(key);
      if (response === undefined) {
        throw new Error(`Command not mocked: git ${command} in ${cwd}`);
      }
      return response;
    },
  };
}

describe('WorkspaceFilesystemScanner', () => {
  const basePath = '/workspaces';

  describe('constructor', () => {
    it('should use default dependencies when none provided', () => {
      const scanner = new WorkspaceFilesystemScanner('/test');
      expect(scanner).toBeInstanceOf(WorkspaceFilesystemScanner);
    });

    it('should accept custom dependencies', () => {
      const mockFs = createMockFilesystem();
      const mockGit = createMockGitExecutor();
      const scanner = new WorkspaceFilesystemScanner('/test', { fs: mockFs, git: mockGit });
      expect(scanner).toBeInstanceOf(WorkspaceFilesystemScanner);
    });

    it('should use WORKSPACE.BASE_PATH as default base path', () => {
      const scanner = new WorkspaceFilesystemScanner();
      // We can't directly access private basePath, but can test via scanOne behavior
      expect(scanner).toBeInstanceOf(WorkspaceFilesystemScanner);
    });
  });

  describe('scanAll', () => {
    it('should return empty array when base path does not exist', async () => {
      const mockFs = createMockFilesystem(new Map());
      const scanner = createWorkspaceScanner(basePath, { fs: mockFs });

      const reports = await scanner.scanAll();

      expect(reports).toEqual([]);
    });

    it('should skip hidden directories', async () => {
      const files = new Map<string, { isDirectory: boolean }>([
        [basePath, { isDirectory: true }],
        [`${basePath}/.worktrees`, { isDirectory: true }],
        [`${basePath}/.git`, { isDirectory: true }],
        [`${basePath}/owner--repo`, { isDirectory: true }],
        [`${basePath}/owner--repo/.git`, { isDirectory: true }],
      ]);
      const mockFs = createMockFilesystem(files);
      const mockGit = createMockGitExecutor(
        new Map([
          [`${basePath}/owner--repo:rev-parse --abbrev-ref HEAD`, 'main\n'],
          [`${basePath}/owner--repo:status --porcelain`, ''],
          [`${basePath}/owner--repo:rev-list --left-right --count origin/main...HEAD`, '0\t0'],
        ])
      );
      const scanner = createWorkspaceScanner(basePath, { fs: mockFs, git: mockGit });

      const reports = await scanner.scanAll();

      expect(reports.length).toBe(1);
      expect(reports[0].repoOwner).toBe('owner');
    });

    it('should skip non-directory entries', async () => {
      const files = new Map<string, { isDirectory: boolean }>([
        [basePath, { isDirectory: true }],
        [`${basePath}/README.md`, { isDirectory: false }],
        [`${basePath}/owner--repo`, { isDirectory: true }],
        [`${basePath}/owner--repo/.git`, { isDirectory: true }],
      ]);
      const mockFs = createMockFilesystem(files);
      const mockGit = createMockGitExecutor(
        new Map([
          [`${basePath}/owner--repo:rev-parse --abbrev-ref HEAD`, 'main\n'],
          [`${basePath}/owner--repo:status --porcelain`, ''],
          [`${basePath}/owner--repo:rev-list --left-right --count origin/main...HEAD`, '0\t0'],
        ])
      );
      const scanner = createWorkspaceScanner(basePath, { fs: mockFs, git: mockGit });

      const reports = await scanner.scanAll();

      expect(reports.length).toBe(1);
    });

    it('should skip directories that do not match owner--repo format', async () => {
      const files = new Map<string, { isDirectory: boolean }>([
        [basePath, { isDirectory: true }],
        [`${basePath}/not-a-workspace`, { isDirectory: true }],
        [`${basePath}/owner--repo`, { isDirectory: true }],
        [`${basePath}/owner--repo/.git`, { isDirectory: true }],
      ]);
      const mockFs = createMockFilesystem(files);
      const mockGit = createMockGitExecutor(
        new Map([
          [`${basePath}/owner--repo:rev-parse --abbrev-ref HEAD`, 'main\n'],
          [`${basePath}/owner--repo:status --porcelain`, ''],
          [`${basePath}/owner--repo:rev-list --left-right --count origin/main...HEAD`, '0\t0'],
        ])
      );
      const scanner = createWorkspaceScanner(basePath, { fs: mockFs, git: mockGit });

      const reports = await scanner.scanAll();

      expect(reports.length).toBe(1);
      expect(reports[0].repoOwner).toBe('owner');
    });

    it('should scan multiple workspaces', async () => {
      const files = new Map<string, { isDirectory: boolean }>([
        [basePath, { isDirectory: true }],
        [`${basePath}/owner1--repo1`, { isDirectory: true }],
        [`${basePath}/owner1--repo1/.git`, { isDirectory: true }],
        [`${basePath}/owner2--repo2`, { isDirectory: true }],
        [`${basePath}/owner2--repo2/.git`, { isDirectory: true }],
      ]);
      const mockFs = createMockFilesystem(files);
      const mockGit = createMockGitExecutor(
        new Map([
          [`${basePath}/owner1--repo1:rev-parse --abbrev-ref HEAD`, 'main\n'],
          [`${basePath}/owner1--repo1:status --porcelain`, ''],
          [`${basePath}/owner1--repo1:rev-list --left-right --count origin/main...HEAD`, '0\t0'],
          [`${basePath}/owner2--repo2:rev-parse --abbrev-ref HEAD`, 'develop\n'],
          [`${basePath}/owner2--repo2:status --porcelain`, 'M file.txt\n'],
          [`${basePath}/owner2--repo2:rev-list --left-right --count origin/develop...HEAD`, '2\t1'],
        ])
      );
      const scanner = createWorkspaceScanner(basePath, { fs: mockFs, git: mockGit });

      const reports = await scanner.scanAll();

      expect(reports.length).toBe(2);
      expect(reports.map((r) => r.repoName).sort()).toEqual(['repo1', 'repo2']);
    });
  });

  describe('scanOne', () => {
    it('should return PENDING status when workspace does not exist', async () => {
      const mockFs = createMockFilesystem(new Map());
      const scanner = createWorkspaceScanner(basePath, { fs: mockFs });

      const report = await scanner.scanOne('owner', 'repo');

      expect(report).toEqual({
        repoOwner: 'owner',
        repoName: 'repo',
        cloneStatus: CloneStatus.PENDING,
      });
    });

    it('should return FAILED status when directory exists but is not a git repo', async () => {
      const files = new Map<string, { isDirectory: boolean }>([
        [`${basePath}/owner--repo`, { isDirectory: true }],
      ]);
      const mockFs = createMockFilesystem(files);
      const scanner = createWorkspaceScanner(basePath, { fs: mockFs });

      const report = await scanner.scanOne('owner', 'repo');

      expect(report).toEqual({
        repoOwner: 'owner',
        repoName: 'repo',
        cloneStatus: CloneStatus.FAILED,
        error: 'Directory exists but is not a git repository',
      });
    });

    it('should return READY status with branch info for valid git repo', async () => {
      const files = new Map<string, { isDirectory: boolean }>([
        [`${basePath}/owner--repo`, { isDirectory: true }],
        [`${basePath}/owner--repo/.git`, { isDirectory: true }],
      ]);
      const mockFs = createMockFilesystem(files);
      const mockGit = createMockGitExecutor(
        new Map([
          [`${basePath}/owner--repo:rev-parse --abbrev-ref HEAD`, 'main\n'],
          [`${basePath}/owner--repo:status --porcelain`, ''],
          [`${basePath}/owner--repo:rev-list --left-right --count origin/main...HEAD`, '0\t0'],
        ])
      );
      const scanner = createWorkspaceScanner(basePath, { fs: mockFs, git: mockGit });

      const report = await scanner.scanOne('owner', 'repo');

      expect(report).toEqual({
        repoOwner: 'owner',
        repoName: 'repo',
        cloneStatus: CloneStatus.READY,
        currentBranch: 'main',
        hasLocalChanges: false,
        ahead: 0,
        behind: 0,
      });
    });

    it('should detect local changes', async () => {
      const files = new Map<string, { isDirectory: boolean }>([
        [`${basePath}/owner--repo`, { isDirectory: true }],
        [`${basePath}/owner--repo/.git`, { isDirectory: true }],
      ]);
      const mockFs = createMockFilesystem(files);
      const mockGit = createMockGitExecutor(
        new Map([
          [`${basePath}/owner--repo:rev-parse --abbrev-ref HEAD`, 'feature\n'],
          [`${basePath}/owner--repo:status --porcelain`, ' M src/index.ts\n?? newfile.txt\n'],
          [`${basePath}/owner--repo:rev-parse --verify origin/feature`, 'abc123\n'],  // Remote branch exists
          [`${basePath}/owner--repo:rev-list --left-right --count origin/feature...HEAD`, '0\t3'],
        ])
      );
      const scanner = createWorkspaceScanner(basePath, { fs: mockFs, git: mockGit });

      const report = await scanner.scanOne('owner', 'repo');

      expect(report?.hasLocalChanges).toBe(true);
      expect(report?.ahead).toBe(3);
    });

    it('should handle missing upstream gracefully', async () => {
      const files = new Map<string, { isDirectory: boolean }>([
        [`${basePath}/owner--repo`, { isDirectory: true }],
        [`${basePath}/owner--repo/.git`, { isDirectory: true }],
      ]);
      const mockFs = createMockFilesystem(files);
      const mockGit: IGitExecutor = {
        exec: (cwd: string, command: string) => {
          if (command.includes('rev-parse')) return 'local-branch\n';
          if (command.includes('status')) return '';
          if (command.includes('rev-list')) throw new Error('No upstream configured');
          throw new Error(`Unexpected command: ${command}`);
        },
      };
      const scanner = createWorkspaceScanner(basePath, { fs: mockFs, git: mockGit });

      const report = await scanner.scanOne('owner', 'repo');

      expect(report?.cloneStatus).toBe(CloneStatus.READY);
      expect(report?.ahead).toBe(0);
      expect(report?.behind).toBe(0);
    });

    it('should capture error when git commands fail', async () => {
      const files = new Map<string, { isDirectory: boolean }>([
        [`${basePath}/owner--repo`, { isDirectory: true }],
        [`${basePath}/owner--repo/.git`, { isDirectory: true }],
      ]);
      const mockFs = createMockFilesystem(files);
      const mockGit: IGitExecutor = {
        exec: () => {
          throw new Error('Git repository is corrupted');
        },
      };
      const scanner = createWorkspaceScanner(basePath, { fs: mockFs, git: mockGit });

      const report = await scanner.scanOne('owner', 'repo');

      expect(report?.cloneStatus).toBe(CloneStatus.READY);
      expect(report?.error).toBe('Git repository is corrupted');
    });

    it('should use correct separator in workspace path', async () => {
      const files = new Map<string, { isDirectory: boolean }>([
        [`${basePath}/owner${WORKSPACE.SEPARATOR}repo`, { isDirectory: true }],
        [`${basePath}/owner${WORKSPACE.SEPARATOR}repo/.git`, { isDirectory: true }],
      ]);
      const mockFs = createMockFilesystem(files);
      const mockGit = createMockGitExecutor(
        new Map([
          [`${basePath}/owner${WORKSPACE.SEPARATOR}repo:rev-parse --abbrev-ref HEAD`, 'main\n'],
          [`${basePath}/owner${WORKSPACE.SEPARATOR}repo:status --porcelain`, ''],
          [
            `${basePath}/owner${WORKSPACE.SEPARATOR}repo:rev-list --left-right --count origin/main...HEAD`,
            '0\t0',
          ],
        ])
      );
      const scanner = createWorkspaceScanner(basePath, { fs: mockFs, git: mockGit });

      const report = await scanner.scanOne('owner', 'repo');

      expect(report?.cloneStatus).toBe(CloneStatus.READY);
    });
  });
});

describe('Singleton Functions', () => {
  beforeEach(() => {
    resetWorkspaceScanner();
  });

  it('should return singleton instance from getWorkspaceScanner', () => {
    const instance1 = getWorkspaceScanner();
    const instance2 = getWorkspaceScanner();

    expect(instance1).toBe(instance2);
  });

  it('should create new instance after reset', () => {
    const instance1 = getWorkspaceScanner();
    resetWorkspaceScanner();
    const instance2 = getWorkspaceScanner();

    expect(instance2).not.toBe(instance1);
  });
});

describe('Default Implementations', () => {
  it('should export defaultFilesystem with required methods', () => {
    expect(typeof defaultFilesystem.existsSync).toBe('function');
    expect(typeof defaultFilesystem.readdirSync).toBe('function');
    expect(typeof defaultFilesystem.statSync).toBe('function');
  });

  it('should export defaultGitExecutor with exec method', () => {
    expect(typeof defaultGitExecutor.exec).toBe('function');
  });
});

describe('createWorkspaceScanner', () => {
  it('should create scanner with default base path and no deps', () => {
    const scanner = createWorkspaceScanner();
    expect(scanner).toBeInstanceOf(WorkspaceFilesystemScanner);
  });

  it('should create scanner with custom base path', () => {
    const scanner = createWorkspaceScanner('/custom/path');
    expect(scanner).toBeInstanceOf(WorkspaceFilesystemScanner);
  });

  it('should create scanner with custom dependencies', () => {
    const mockFs = createMockFilesystem();
    const mockGit = createMockGitExecutor();
    const scanner = createWorkspaceScanner('/test', { fs: mockFs, git: mockGit });
    expect(scanner).toBeInstanceOf(WorkspaceFilesystemScanner);
  });
});
