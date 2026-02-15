/**
 * Route Parser Tests
 */

import { describe, it, expect } from 'vitest';
import { parseRoute, buildPath } from './route-parser';

describe('Route Parser', () => {
  describe('parseRoute', () => {
    it('parses root path as dashboard', () => {
      expect(parseRoute('/', '')).toEqual({ tab: 'dashboard', sessionId: undefined });
    });

    it('parses empty path as dashboard', () => {
      expect(parseRoute('', '')).toEqual({ tab: 'dashboard', sessionId: undefined });
    });

    it('parses tab paths', () => {
      expect(parseRoute('/specs', '')).toEqual({ tab: 'specs', sessionId: undefined });
      expect(parseRoute('/prompts', '')).toEqual({ tab: 'prompts', sessionId: undefined });
      expect(parseRoute('/documents', '')).toEqual({ tab: 'documents', sessionId: undefined });
      expect(parseRoute('/agents', '')).toEqual({ tab: 'agents', sessionId: undefined });
      expect(parseRoute('/tasks', '')).toEqual({ tab: 'tasks', sessionId: undefined });
      expect(parseRoute('/sessions', '')).toEqual({ tab: 'sessions', sessionId: undefined });
      expect(parseRoute('/workspaces', '')).toEqual({ tab: 'workspaces', sessionId: undefined });
    });

    it('parses entity view mode', () => {
      expect(parseRoute('/specs/spec_abc123', '')).toEqual({
        tab: 'specs',
        entityId: 'spec_abc123',
        entityMode: 'view',
        sessionId: undefined,
      });
    });

    it('parses entity edit mode', () => {
      expect(parseRoute('/specs/spec_abc123/edit', '')).toEqual({
        tab: 'specs',
        entityId: 'spec_abc123',
        entityMode: 'edit',
        sessionId: undefined,
      });
    });

    it('parses new entity path', () => {
      expect(parseRoute('/specs/new', '')).toEqual({
        tab: 'specs',
        entityId: 'new',
        entityMode: 'edit',
        sessionId: undefined,
      });
    });

    it('parses session query param', () => {
      expect(parseRoute('/specs', '?session=sess_123')).toEqual({
        tab: 'specs',
        sessionId: 'sess_123',
      });
    });

    it('parses entity + session combined', () => {
      expect(parseRoute('/documents/doc_456/edit', '?session=sess_789')).toEqual({
        tab: 'documents',
        entityId: 'doc_456',
        entityMode: 'edit',
        sessionId: 'sess_789',
      });
    });

    it('handles unknown tab as dashboard', () => {
      expect(parseRoute('/unknown', '')).toEqual({ tab: 'dashboard', sessionId: undefined });
    });

    it('handles trailing slashes', () => {
      expect(parseRoute('/specs/', '')).toEqual({ tab: 'specs', sessionId: undefined });
    });

    it('handles entity IDs with special characters', () => {
      expect(parseRoute('/agents/agent_abc-123', '')).toEqual({
        tab: 'agents',
        entityId: 'agent_abc-123',
        entityMode: 'view',
        sessionId: undefined,
      });
    });
  });

  describe('buildPath', () => {
    it('builds dashboard path', () => {
      expect(buildPath({ tab: 'dashboard' })).toBe('/');
    });

    it('builds tab path', () => {
      expect(buildPath({ tab: 'specs' })).toBe('/specs');
      expect(buildPath({ tab: 'prompts' })).toBe('/prompts');
    });

    it('builds entity view path', () => {
      expect(buildPath({ tab: 'specs', entityId: 'spec_123' })).toBe('/specs/spec_123');
    });

    it('builds entity edit path', () => {
      expect(buildPath({ tab: 'specs', entityId: 'spec_123', entityMode: 'edit' })).toBe('/specs/spec_123/edit');
    });

    it('does not add /edit for view mode', () => {
      expect(buildPath({ tab: 'specs', entityId: 'spec_123', entityMode: 'view' })).toBe('/specs/spec_123');
    });

    it('builds path with session param', () => {
      expect(buildPath({ tab: 'specs', sessionId: 'sess_456' })).toBe('/specs?session=sess_456');
    });

    it('builds full path with entity and session', () => {
      expect(buildPath({
        tab: 'documents',
        entityId: 'doc_789',
        entityMode: 'edit',
        sessionId: 'sess_abc',
      })).toBe('/documents/doc_789/edit?session=sess_abc');
    });

    it('defaults to dashboard when tab is missing', () => {
      expect(buildPath({})).toBe('/');
    });

    it('encodes session ID in query param', () => {
      expect(buildPath({ tab: 'specs', sessionId: 'sess with spaces' })).toBe('/specs?session=sess%20with%20spaces');
    });
  });

  describe('round-trip', () => {
    it('parseRoute → buildPath → parseRoute is stable', () => {
      const cases = [
        { path: '/', search: '' },
        { path: '/specs', search: '' },
        { path: '/specs/spec_123', search: '' },
        { path: '/specs/spec_123/edit', search: '' },
        { path: '/specs/new', search: '' },
        { path: '/agents/agent_1', search: '?session=sess_x' },
      ];

      for (const { path, search } of cases) {
        const state = parseRoute(path, search);
        const rebuilt = buildPath(state);
        // Extract path and search from rebuilt
        const [rebuiltPath, rebuiltSearch] = rebuilt.includes('?')
          ? [rebuilt.split('?')[0], '?' + rebuilt.split('?')[1]]
          : [rebuilt, ''];
        const reparsed = parseRoute(rebuiltPath, rebuiltSearch);
        expect(reparsed).toEqual(state);
      }
    });
  });
});
