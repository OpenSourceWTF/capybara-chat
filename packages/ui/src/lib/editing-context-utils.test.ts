/**
 * Editing Context Utilities Tests
 */

import { describe, it, expect } from 'vitest';
import {
  formatEntityType,
  compactValues,
  buildContextPreview,
  ENTITY_TOOL_MAP,
} from './editing-context-utils';

describe('formatEntityType', () => {
  it('capitalizes first letter', () => {
    expect(formatEntityType('spec')).toBe('Spec');
    expect(formatEntityType('prompt')).toBe('Prompt');
    expect(formatEntityType('document')).toBe('Document');
  });

  it('handles already capitalized', () => {
    expect(formatEntityType('Spec')).toBe('Spec');
  });

  it('handles empty string', () => {
    expect(formatEntityType('')).toBe('');
  });

  it('handles single character', () => {
    expect(formatEntityType('a')).toBe('A');
  });
});

describe('compactValues', () => {
  it('skips metadata keys', () => {
    const data = {
      id: '123',
      createdAt: '2024-01-01',
      updatedAt: '2024-01-02',
      sessionId: 'sess-1',
      workspaceId: 'ws-1',
      title: 'Keep this',
    };
    const result = compactValues(data);
    expect(result).not.toHaveProperty('id');
    expect(result).not.toHaveProperty('createdAt');
    expect(result).not.toHaveProperty('updatedAt');
    expect(result).not.toHaveProperty('sessionId');
    expect(result).not.toHaveProperty('workspaceId');
    expect(result).toHaveProperty('title', 'Keep this');
  });

  it('skips null, undefined, and empty string', () => {
    const data = {
      nullVal: null,
      undefinedVal: undefined,
      emptyVal: '',
      validVal: 'keep',
    };
    const result = compactValues(data);
    expect(result).not.toHaveProperty('nullVal');
    expect(result).not.toHaveProperty('undefinedVal');
    expect(result).not.toHaveProperty('emptyVal');
    expect(result).toHaveProperty('validVal', 'keep');
  });

  it('truncates long strings', () => {
    const longString = 'a'.repeat(150);
    const data = { content: longString };
    const result = compactValues(data);
    expect(result.content).toBe('a'.repeat(100) + '...[truncated]');
  });

  it('does not truncate short strings', () => {
    const data = { content: 'short string' };
    const result = compactValues(data);
    expect(result.content).toBe('short string');
  });

  it('truncates long arrays', () => {
    const longArray = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const data = { items: longArray };
    const result = compactValues(data);
    expect(result.items).toEqual([1, 2, 3, 4, 5, '...(5 more)']);
  });

  it('does not truncate short arrays', () => {
    const data = { items: [1, 2, 3] };
    const result = compactValues(data);
    expect(result.items).toEqual([1, 2, 3]);
  });

  it('handles mixed types', () => {
    const data = {
      number: 42,
      boolean: true,
      nested: { key: 'value' },
    };
    const result = compactValues(data);
    expect(result.number).toBe(42);
    expect(result.boolean).toBe(true);
    expect(result.nested).toEqual({ key: 'value' });
  });
});

describe('buildContextPreview', () => {
  it('includes entity type and title', () => {
    const result = buildContextPreview('spec', 'spec-123', 'My Spec', {});
    expect(result).toContain('**spec**');
    expect(result).toContain('"My Spec"');
  });

  it('includes entity ID', () => {
    const result = buildContextPreview('spec', 'spec-123', 'Title', {});
    expect(result).toContain('`spec-123`');
  });

  it('shows "new" for undefined entity ID', () => {
    const result = buildContextPreview('spec', undefined, 'Title', {});
    expect(result).toContain('`new`');
  });

  it('uses "Untitled" for undefined title', () => {
    const result = buildContextPreview('spec', 'id', undefined, {});
    expect(result).toContain('"Untitled"');
  });

  it('includes correct tools for known entity types', () => {
    const specResult = buildContextPreview('spec', 'id', 'Title', {});
    expect(specResult).toContain('`spec_get`');
    expect(specResult).toContain('`spec_update`');

    const promptResult = buildContextPreview('prompt', 'id', 'Title', {});
    expect(promptResult).toContain('`prompt_get`');
    expect(promptResult).toContain('`prompt_update`');
  });

  it('uses fallback tools for unknown entity types', () => {
    const result = buildContextPreview('unknown', 'id', 'Title', {});
    expect(result).toContain('`get`');
    expect(result).toContain('`update`');
  });

  it('includes compacted form data', () => {
    const formData = { title: 'Test', description: 'Desc' };
    const result = buildContextPreview('spec', 'id', 'Title', formData);
    expect(result).toContain('"title": "Test"');
    expect(result).toContain('"description": "Desc"');
  });

  it('handles undefined form data', () => {
    const result = buildContextPreview('spec', 'id', 'Title', undefined);
    expect(result).toContain('{}');
  });
});

describe('ENTITY_TOOL_MAP', () => {
  it('has mappings for common entity types', () => {
    expect(ENTITY_TOOL_MAP).toHaveProperty('spec');
    expect(ENTITY_TOOL_MAP).toHaveProperty('prompt');
    expect(ENTITY_TOOL_MAP).toHaveProperty('document');
    expect(ENTITY_TOOL_MAP).toHaveProperty('agentDefinition');
  });

  it('each mapping has get, update, create', () => {
    for (const [, tools] of Object.entries(ENTITY_TOOL_MAP)) {
      expect(tools).toHaveProperty('get');
      expect(tools).toHaveProperty('update');
      expect(tools).toHaveProperty('create');
    }
  });
});
