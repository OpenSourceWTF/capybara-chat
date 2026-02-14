/**
 * File System Adapter
 *
 * Abstraction over Node.js fs module for testability.
 * Production code uses NodeFileSystemAdapter.
 * Tests can use MockFileSystemAdapter.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
  readdirSync,
  statSync,
  renameSync,
  copyFileSync,
  unlinkSync,
} from 'fs';
import {
  access,
  mkdir,
  readFile,
  writeFile,
  rm,
  readdir,
  stat,
  rename,
  copyFile,
  unlink,
} from 'fs/promises';
import type { Stats } from 'fs';

/**
 * Synchronous file system operations
 */
export interface FileSystemAdapter {
  existsSync(path: string): boolean;
  mkdirSync(path: string, options?: { recursive?: boolean }): void;
  readFileSync(path: string, encoding: BufferEncoding): string;
  writeFileSync(path: string, content: string, encoding?: BufferEncoding): void;
  rmSync(path: string, options?: { recursive?: boolean; force?: boolean }): void;
  readdirSync(path: string): string[];
  statSync(path: string): Stats;
  renameSync(oldPath: string, newPath: string): void;
  copyFileSync(src: string, dest: string): void;
  unlinkSync(path: string): void;
}

/**
 * Asynchronous file system operations
 */
export interface AsyncFileSystemAdapter {
  access(path: string): Promise<void>;
  mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
  readFile(path: string, encoding: BufferEncoding): Promise<string>;
  writeFile(path: string, content: string, encoding?: BufferEncoding): Promise<void>;
  rm(path: string, options?: { recursive?: boolean; force?: boolean }): Promise<void>;
  readdir(path: string): Promise<string[]>;
  stat(path: string): Promise<Stats>;
  rename(oldPath: string, newPath: string): Promise<void>;
  copyFile(src: string, dest: string): Promise<void>;
  unlink(path: string): Promise<void>;
}

/**
 * Combined file system adapter (both sync and async)
 */
export interface FullFileSystemAdapter extends FileSystemAdapter, AsyncFileSystemAdapter { }

/**
 * Production implementation using Node.js fs module
 */
export class NodeFileSystemAdapter implements FullFileSystemAdapter {
  // Sync methods
  existsSync(path: string): boolean {
    return existsSync(path);
  }

  mkdirSync(path: string, options?: { recursive?: boolean }): void {
    mkdirSync(path, options);
  }

  readFileSync(path: string, encoding: BufferEncoding): string {
    return readFileSync(path, encoding);
  }

  writeFileSync(path: string, content: string, encoding: BufferEncoding = 'utf-8'): void {
    writeFileSync(path, content, encoding);
  }

  rmSync(path: string, options?: { recursive?: boolean; force?: boolean }): void {
    rmSync(path, options);
  }

  readdirSync(path: string): string[] {
    return readdirSync(path);
  }

  statSync(path: string): Stats {
    return statSync(path);
  }

  renameSync(oldPath: string, newPath: string): void {
    renameSync(oldPath, newPath);
  }

  copyFileSync(src: string, dest: string): void {
    copyFileSync(src, dest);
  }

  unlinkSync(path: string): void {
    unlinkSync(path);
  }

  // Async methods
  async access(path: string): Promise<void> {
    await access(path);
  }

  async mkdir(path: string, options?: { recursive?: boolean }): Promise<void> {
    await mkdir(path, options);
  }

  async readFile(path: string, encoding: BufferEncoding): Promise<string> {
    return await readFile(path, encoding);
  }

  async writeFile(path: string, content: string, encoding: BufferEncoding = 'utf-8'): Promise<void> {
    await writeFile(path, content, encoding);
  }

  async rm(path: string, options?: { recursive?: boolean; force?: boolean }): Promise<void> {
    await rm(path, options);
  }

  async readdir(path: string): Promise<string[]> {
    return await readdir(path);
  }

  async stat(path: string): Promise<Stats> {
    return await stat(path);
  }

  async rename(oldPath: string, newPath: string): Promise<void> {
    await rename(oldPath, newPath);
  }

  async copyFile(src: string, dest: string): Promise<void> {
    await copyFile(src, dest);
  }

  async unlink(path: string): Promise<void> {
    await unlink(path);
  }
}

/**
 * Default singleton for production use
 */
export const nodeFs = new NodeFileSystemAdapter();
