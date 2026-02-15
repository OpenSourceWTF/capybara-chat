/**
 * Session State Manager Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createSessionStateManager,
  getSessionStateManager,
  resetSessionStateManager,
  type ContextUsage,
} from './session-state-manager.js';

describe('SessionStateManager', () => {
  let manager: ReturnType<typeof createSessionStateManager>;

  beforeEach(() => {
    manager = createSessionStateManager();
    resetSessionStateManager();
  });

  describe('Claude session ID caching', () => {
    it('should store and retrieve Claude session ID', () => {
      manager.setClaudeSessionId('session-1', 'claude-123');
      expect(manager.getClaudeSessionId('session-1')).toBe('claude-123');
    });

    it('should return undefined for non-existent session', () => {
      expect(manager.getClaudeSessionId('nonexistent')).toBeUndefined();
    });

    it('should clear Claude session ID', () => {
      manager.setClaudeSessionId('session-1', 'claude-123');
      manager.clearClaudeSessionId('session-1');
      expect(manager.getClaudeSessionId('session-1')).toBeUndefined();
    });

    it('should overwrite existing Claude session ID', () => {
      manager.setClaudeSessionId('session-1', 'claude-123');
      manager.setClaudeSessionId('session-1', 'claude-456');
      expect(manager.getClaudeSessionId('session-1')).toBe('claude-456');
    });
  });

  describe('Context usage caching', () => {
    const usage: ContextUsage = { used: 80000, total: 100000, percent: 80 };

    it('should store and retrieve context usage', () => {
      manager.setContextUsage('session-1', usage);
      expect(manager.getContextUsage('session-1')).toEqual(usage);
    });

    it('should return undefined for non-existent session', () => {
      expect(manager.getContextUsage('nonexistent')).toBeUndefined();
    });

    it('should clear context usage', () => {
      manager.setContextUsage('session-1', usage);
      manager.clearContextUsage('session-1');
      expect(manager.getContextUsage('session-1')).toBeUndefined();
    });

    it('should overwrite existing context usage', () => {
      const usage1: ContextUsage = { used: 80000, total: 100000, percent: 80 };
      const usage2: ContextUsage = { used: 90000, total: 100000, percent: 90 };
      manager.setContextUsage('session-1', usage1);
      manager.setContextUsage('session-1', usage2);
      expect(manager.getContextUsage('session-1')).toEqual(usage2);
    });
  });

  describe('clearSession', () => {
    it('should clear all state for a session', () => {
      manager.setClaudeSessionId('session-1', 'claude-123');
      manager.setContextUsage('session-1', { used: 80000, total: 100000, percent: 80 });

      manager.clearSession('session-1');

      expect(manager.getClaudeSessionId('session-1')).toBeUndefined();
      expect(manager.getContextUsage('session-1')).toBeUndefined();
    });

    it('should not affect other sessions', () => {
      manager.setClaudeSessionId('session-1', 'claude-123');
      manager.setClaudeSessionId('session-2', 'claude-456');

      manager.clearSession('session-1');

      expect(manager.getClaudeSessionId('session-1')).toBeUndefined();
      expect(manager.getClaudeSessionId('session-2')).toBe('claude-456');
    });
  });

  describe('reset', () => {
    it('should clear all state', () => {
      manager.setClaudeSessionId('session-1', 'claude-123');
      manager.setClaudeSessionId('session-2', 'claude-456');
      manager.setContextUsage('session-1', { used: 80000, total: 100000, percent: 80 });

      manager.reset();

      expect(manager.getClaudeSessionId('session-1')).toBeUndefined();
      expect(manager.getClaudeSessionId('session-2')).toBeUndefined();
      expect(manager.getContextUsage('session-1')).toBeUndefined();
    });
  });

  describe('singleton', () => {
    it('should return same instance from getSessionStateManager', () => {
      const manager1 = getSessionStateManager();
      const manager2 = getSessionStateManager();

      expect(manager1).toBe(manager2);
    });

    it('should return new instance after reset', () => {
      const manager1 = getSessionStateManager();
      resetSessionStateManager();
      const manager2 = getSessionStateManager();

      expect(manager1).not.toBe(manager2);
    });
  });
});
