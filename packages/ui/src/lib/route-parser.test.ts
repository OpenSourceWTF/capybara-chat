/**
 * Route Parser Tests
 */

import { describe, it, expect } from 'vitest';
import { parseRoute, buildPath } from './route-parser';

describe('Route Parser', () => {
  describe('parseRoute', () => {
    it('parses root path as prompts', () => {
      expect(parseRoute('/', '')).toEqual({ tab: 'prompts', sessionId: undefined });
    });

    it('parses empty path as prompts', () => {
      expect(parseRoute('', '')).toEqual({ tab: 'prompts', sessionId: undefined });
    });

    it('parses tab paths', () => {
      expect(parseRoute('/prompts', '')).toEqual({ tab: 'prompts', sessionId: undefined });
      expect(parseRoute('/documents', '')).toEqual({ tab: 'documents', sessionId: undefined });
      expect(parseRoute('/agents', '')).toEqual({ tab: 'agents', sessionId: undefined });
      expect(parseRoute('/sessions', '')).toEqual({ tab: 'sessions', sessionId: undefined });
    });

    it('parses entity view mode', () => {
      expect(parseRoute('/prompts/prompt_abc123', '')).toEqual({
        tab: 'prompts',
        entityId: 'prompt_abc123',
        entityMode: 'view',
        sessionId: undefined,
      });
    });

    it('parses entity edit mode', () => {
      expect(parseRoute('/prompts/prompt_abc123/edit', '')).toEqual({
        tab: 'prompts',
        entityId: 'prompt_abc123',
        entityMode: 'edit',
        sessionId: undefined,
      });
    });

    it('parses new entity path', () => {
      expect(parseRoute('/prompts/new', '')).toEqual({
        tab: 'prompts',
        entityId: 'new',
        entityMode: 'edit',
        sessionId: undefined,
      });
    });

    it('parses session query param', () => {
      expect(parseRoute('/prompts', '?session=sess_123')).toEqual({
        tab: 'prompts',
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

    it('handles unknown tab as prompts', () => {
      expect(parseRoute('/unknown', '')).toEqual({ tab: 'prompts', sessionId: undefined });
    });

    it('handles trailing slashes', () => {
      expect(parseRoute('/prompts/', '')).toEqual({ tab: 'prompts', sessionId: undefined });
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
    it('builds tab path', () => {
      expect(buildPath({ tab: 'prompts' })).toBe('/prompts');
      expect(buildPath({ tab: 'documents' })).toBe('/documents');
    });

    it('builds entity view path', () => {
      expect(buildPath({ tab: 'prompts', entityId: 'prompt_123' })).toBe('/prompts/prompt_123');
    });

    it('builds entity edit path', () => {
      expect(buildPath({ tab: 'prompts', entityId: 'prompt_123', entityMode: 'edit' })).toBe('/prompts/prompt_123/edit');
    });

    it('does not add /edit for view mode', () => {
      expect(buildPath({ tab: 'prompts', entityId: 'prompt_123', entityMode: 'view' })).toBe('/prompts/prompt_123');
    });

    it('builds path with session param', () => {
      expect(buildPath({ tab: 'prompts', sessionId: 'sess_456' })).toBe('/prompts?session=sess_456');
    });

    it('builds full path with entity and session', () => {
      expect(buildPath({
        tab: 'documents',
        entityId: 'doc_789',
        entityMode: 'edit',
        sessionId: 'sess_abc',
      })).toBe('/documents/doc_789/edit?session=sess_abc');
    });

    it('defaults to /prompts when tab is missing', () => {
      expect(buildPath({})).toBe('/prompts');
    });

    it('encodes session ID in query param', () => {
      expect(buildPath({ tab: 'prompts', sessionId: 'sess with spaces' })).toBe('/prompts?session=sess%20with%20spaces');
    });
  });

  describe('round-trip', () => {
    it('parseRoute → buildPath → parseRoute is stable', () => {
      const cases = [
        { path: '/prompts', search: '' },
        { path: '/prompts/prompt_123', search: '' },
        { path: '/prompts/prompt_123/edit', search: '' },
        { path: '/prompts/new', search: '' },
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
