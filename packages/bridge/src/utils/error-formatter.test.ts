/**
 * Tests for error-formatter utility
 */

import { describe, it, expect } from 'vitest';
import { formatCLIError } from './error-formatter.js';
import {
  CLIError,
  CLITimeoutError,
  CLIProcessExitError,
  type CLIErrorContext,
} from '@capybara-chat/cli-provider';

// Helper to create a minimal CLIErrorContext for testing
const mockContext = (overrides: Partial<CLIErrorContext> = {}): CLIErrorContext => ({
  backend: 'claude',
  command: 'claude --session-id test',
  ...overrides,
});

describe('formatCLIError', () => {
  describe('CLITimeoutError', () => {
    it('should format timeout error with seconds and phase', () => {
      const error = new CLITimeoutError(
        'Test timeout',
        'test-session',
        mockContext(),
        30000,
        'response'
      );
      const result = formatCLIError(error);

      expect(result.haltReason).toBe('timeout');
      expect(result.message).toContain('[Timeout]');
      expect(result.message).toContain('30s');
      expect(result.message).toContain('response');
    });

    it('should round timeout to nearest second', () => {
      const error = new CLITimeoutError(
        'Test timeout',
        'test-session',
        mockContext(),
        45500,
        'init'
      );
      const result = formatCLIError(error);

      expect(result.message).toContain('46s');
    });
  });

  describe('CLIProcessExitError', () => {
    it('should format process exit error with exit code', () => {
      const error = new CLIProcessExitError(
        'Process exited',
        'test-session',
        mockContext({ exitCode: 1 })
      );
      const result = formatCLIError(error);

      expect(result.haltReason).toBe('process_exit');
      expect(result.message).toContain('[Process Error]');
      expect(result.message).toContain('Exit code: 1');
    });

    it('should handle unknown exit code', () => {
      const error = new CLIProcessExitError(
        'Process exited',
        'test-session',
        mockContext()
      );
      const result = formatCLIError(error);

      expect(result.message).toContain('Exit code: unknown');
    });
  });

  describe('CLIError', () => {
    it('should format generic CLI error', () => {
      const error = new CLIError(
        'Something went wrong',
        'test-session',
        mockContext()
      );
      const result = formatCLIError(error);

      expect(result.haltReason).toBe('cli_error');
      expect(result.message).toBe('[CLI Error] Something went wrong');
    });
  });

  describe('unknown errors', () => {
    it('should format unknown error with default message', () => {
      const error = new Error('Random error');
      const result = formatCLIError(error);

      expect(result.haltReason).toBe('cli_error');
      expect(result.message).toContain('[Error]');
      expect(result.message).toContain('Random error');
    });

    it('should include context if provided', () => {
      const error = new Error('Connection failed');
      const result = formatCLIError(error, 'Failed to send message');

      expect(result.message).toContain('Failed to send message');
      expect(result.message).toContain('Connection failed');
    });

    it('should handle string errors', () => {
      const result = formatCLIError('Simple string error');

      expect(result.haltReason).toBe('cli_error');
      expect(result.message).toContain('Simple string error');
    });
  });
});
