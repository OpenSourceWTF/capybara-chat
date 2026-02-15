/**
 * Context Injection State Manager Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ContextInjectionStateManager,
  createContextInjectionStateManager,
  getContextInjectionStateManager,
  resetContextInjectionStateManager,
} from './context-injection-state.js';

describe('ContextInjectionStateManager', () => {
  let manager: ContextInjectionStateManager;

  beforeEach(() => {
    manager = createContextInjectionStateManager();
    resetContextInjectionStateManager();
  });

  describe('getEntityKey', () => {
    it('should return entityId when provided', () => {
      expect(manager.getEntityKey('entity-123')).toBe('entity-123');
    });

    it('should return __new__ when entityId is undefined', () => {
      expect(manager.getEntityKey(undefined)).toBe('__new__');
    });

    it('should return __new__ when entityId is empty string', () => {
      expect(manager.getEntityKey('')).toBe('__new__');
    });
  });

  describe('shouldInjectFullContext', () => {
    it('should return true for new session (no state)', () => {
      expect(manager.shouldInjectFullContext('session-1', 'entity-1')).toBe(true);
    });

    it('should return false after context has been injected for same entity', () => {
      manager.markContextInjected('session-1', 'entity-1');
      expect(manager.shouldInjectFullContext('session-1', 'entity-1')).toBe(false);
    });

    it('should return true when entity changes', () => {
      manager.markContextInjected('session-1', 'entity-1');
      expect(manager.shouldInjectFullContext('session-1', 'entity-2')).toBe(true);
    });

    it('should return true when switching from existing entity to new entity', () => {
      manager.markContextInjected('session-1', 'entity-1');
      expect(manager.shouldInjectFullContext('session-1', undefined)).toBe(true);
    });

    it('should return true when switching from new entity to existing entity', () => {
      manager.markContextInjected('session-1', undefined);
      expect(manager.shouldInjectFullContext('session-1', 'entity-1')).toBe(true);
    });

    it('should track different sessions independently', () => {
      manager.markContextInjected('session-1', 'entity-1');
      expect(manager.shouldInjectFullContext('session-1', 'entity-1')).toBe(false);
      expect(manager.shouldInjectFullContext('session-2', 'entity-1')).toBe(true);
    });
  });

  describe('markContextInjected', () => {
    it('should mark context as injected for session/entity pair', () => {
      manager.markContextInjected('session-1', 'entity-1');

      const state = manager.getState('session-1');
      expect(state).toEqual({ entityKey: 'entity-1', injected: true });
    });

    it('should update entity key when marking new entity', () => {
      manager.markContextInjected('session-1', 'entity-1');
      manager.markContextInjected('session-1', 'entity-2');

      const state = manager.getState('session-1');
      expect(state).toEqual({ entityKey: 'entity-2', injected: true });
    });

    it('should handle undefined entityId as __new__', () => {
      manager.markContextInjected('session-1', undefined);

      const state = manager.getState('session-1');
      expect(state).toEqual({ entityKey: '__new__', injected: true });
    });
  });

  describe('resetSession', () => {
    it('should reset injected flag to false', () => {
      manager.markContextInjected('session-1', 'entity-1');
      expect(manager.shouldInjectFullContext('session-1', 'entity-1')).toBe(false);

      manager.resetSession('session-1');

      expect(manager.shouldInjectFullContext('session-1', 'entity-1')).toBe(true);
    });

    it('should preserve entity key when resetting', () => {
      manager.markContextInjected('session-1', 'entity-1');
      manager.resetSession('session-1');

      const state = manager.getState('session-1');
      expect(state?.entityKey).toBe('entity-1');
      expect(state?.injected).toBe(false);
    });

    it('should do nothing for non-existent session', () => {
      // Should not throw
      manager.resetSession('nonexistent');
      expect(manager.getState('nonexistent')).toBeUndefined();
    });
  });

  describe('clearSession', () => {
    it('should remove all state for session', () => {
      manager.markContextInjected('session-1', 'entity-1');
      expect(manager.getState('session-1')).toBeDefined();

      manager.clearSession('session-1');

      expect(manager.getState('session-1')).toBeUndefined();
    });

    it('should not affect other sessions', () => {
      manager.markContextInjected('session-1', 'entity-1');
      manager.markContextInjected('session-2', 'entity-2');

      manager.clearSession('session-1');

      expect(manager.getState('session-1')).toBeUndefined();
      expect(manager.getState('session-2')).toBeDefined();
    });
  });

  describe('reset', () => {
    it('should clear all state', () => {
      manager.markContextInjected('session-1', 'entity-1');
      manager.markContextInjected('session-2', 'entity-2');

      manager.reset();

      expect(manager.getState('session-1')).toBeUndefined();
      expect(manager.getState('session-2')).toBeUndefined();
    });
  });

  describe('singleton', () => {
    it('should return same instance from getContextInjectionStateManager', () => {
      const manager1 = getContextInjectionStateManager();
      const manager2 = getContextInjectionStateManager();

      expect(manager1).toBe(manager2);
    });

    it('should return new instance after reset', () => {
      const manager1 = getContextInjectionStateManager();
      resetContextInjectionStateManager();
      const manager2 = getContextInjectionStateManager();

      expect(manager1).not.toBe(manager2);
    });
  });
});
