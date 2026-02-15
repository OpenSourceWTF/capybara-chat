/**
 * Slash Command Parser Tests
 */

import { describe, it, expect } from 'vitest';
import {
  parseSlashCommand,
  getCommandSuggestions,
  isSlashCommand,
  isCommandComplete,
  formatCommand,
  isEntityType,
  getEntitySelectionState,
  buildCommandWithEntity,
} from './slash-command-parser';

describe('Slash Command Parser', () => {
  describe('isSlashCommand', () => {
    it('returns true for slash commands', () => {
      expect(isSlashCommand('/new')).toBe(true);
      expect(isSlashCommand('/edit prompt')).toBe(true);
      expect(isSlashCommand('  /help')).toBe(true);
    });

    it('returns false for non-slash commands', () => {
      expect(isSlashCommand('hello')).toBe(false);
      expect(isSlashCommand('new prompt')).toBe(false);
      expect(isSlashCommand('')).toBe(false);
    });
  });

  describe('isEntityType', () => {
    it('returns true for valid entity types', () => {
      expect(isEntityType('prompt')).toBe(true);
      expect(isEntityType('pipeline')).toBe(true);
      expect(isEntityType('spec')).toBe(true);
      expect(isEntityType('document')).toBe(true);
    });

    it('returns false for invalid entity types', () => {
      expect(isEntityType('invalid')).toBe(false);
      expect(isEntityType('user')).toBe(false);
      expect(isEntityType('')).toBe(false);
    });
  });

  describe('parseSlashCommand', () => {
    describe('basic parsing', () => {
      it('parses /new prompt', () => {
        const result = parseSlashCommand('/new prompt');
        expect(result).toEqual({
          action: 'new',
          entityType: 'prompt',
          entityId: undefined,
          raw: '/new prompt',
        });
      });

      it('parses /create document (alias)', () => {
        const result = parseSlashCommand('/create document');
        expect(result).toEqual({
          action: 'new', // normalized from create
          entityType: 'document',
          entityId: undefined,
          raw: '/create document',
        });
      });

      it('parses /edit spec', () => {
        const result = parseSlashCommand('/edit spec');
        expect(result).toEqual({
          action: 'edit',
          entityType: 'spec',
          entityId: undefined,
          raw: '/edit spec',
        });
      });

      it('parses /edit spec:spec-123 with ID', () => {
        const result = parseSlashCommand('/edit spec:spec-123');
        expect(result).toEqual({
          action: 'edit',
          entityType: 'spec',
          entityId: 'spec-123',
          raw: '/edit spec:spec-123',
        });
      });

      it('parses /open pipeline', () => {
        const result = parseSlashCommand('/open pipeline');
        expect(result).toEqual({
          action: 'open',
          entityType: 'pipeline',
          entityId: undefined,
          raw: '/open pipeline',
        });
      });

      it('parses /help', () => {
        const result = parseSlashCommand('/help');
        expect(result).toEqual({
          action: 'help',
          raw: '/help',
        });
      });
    });

    describe('alias handling', () => {
      it('normalizes /n to /new', () => {
        const result = parseSlashCommand('/n prompt');
        expect(result?.action).toBe('new');
      });

      it('normalizes /e to /edit', () => {
        const result = parseSlashCommand('/e spec');
        expect(result?.action).toBe('edit');
      });

      it('normalizes /o to /open', () => {
        const result = parseSlashCommand('/o document');
        expect(result?.action).toBe('open');
      });

      it('normalizes /h to /help', () => {
        const result = parseSlashCommand('/h');
        expect(result?.action).toBe('help');
      });

      it('handles /? as help', () => {
        const result = parseSlashCommand('/?');
        expect(result?.action).toBe('help');
      });
    });

    describe('whitespace handling', () => {
      it('handles leading whitespace', () => {
        const result = parseSlashCommand('  /new prompt');
        expect(result).not.toBeNull();
        expect(result?.action).toBe('new');
      });

      it('handles extra whitespace between parts', () => {
        const result = parseSlashCommand('/new    prompt');
        expect(result?.entityType).toBe('prompt');
      });
    });

    describe('entityName for /new commands', () => {
      it('parses /new prompt with custom name', () => {
        const result = parseSlashCommand('/new prompt MyPrompt');
        expect(result).toEqual({
          action: 'new',
          entityType: 'prompt',
          entityId: undefined,
          entityName: 'MyPrompt',
          raw: '/new prompt MyPrompt',
        });
      });

      it('parses /new spec with multi-word name', () => {
        const result = parseSlashCommand('/new spec My Cool Feature Spec');
        expect(result).toEqual({
          action: 'new',
          entityType: 'spec',
          entityId: undefined,
          entityName: 'My Cool Feature Spec',
          raw: '/new spec My Cool Feature Spec',
        });
      });

      it('does not set entityName for /new without name', () => {
        const result = parseSlashCommand('/new document');
        expect(result?.entityName).toBeUndefined();
      });

      it('does not set entityName for /edit commands', () => {
        const result = parseSlashCommand('/edit spec some-name');
        expect(result?.entityName).toBeUndefined();
      });

      it('handles /create alias with name', () => {
        const result = parseSlashCommand('/create pipeline My Pipeline');
        expect(result?.action).toBe('new');
        expect(result?.entityType).toBe('pipeline');
        expect(result?.entityName).toBe('My Pipeline');
      });
    });

    describe('invalid commands', () => {
      it('returns null for non-slash commands', () => {
        expect(parseSlashCommand('hello')).toBeNull();
      });

      it('returns null for empty input', () => {
        expect(parseSlashCommand('')).toBeNull();
      });

      it('returns null for just slash', () => {
        expect(parseSlashCommand('/')).toBeNull();
      });

      it('returns null for invalid action', () => {
        expect(parseSlashCommand('/invalid prompt')).toBeNull();
      });

      it('returns partial result for action without entity', () => {
        const result = parseSlashCommand('/new');
        expect(result).toEqual({
          action: 'new',
          raw: '/new',
        });
      });

      it('returns null entityType for invalid entity', () => {
        const result = parseSlashCommand('/new invalid');
        expect(result?.entityType).toBeUndefined();
      });
    });
  });

  describe('getCommandSuggestions', () => {
    it('returns empty for empty input', () => {
      expect(getCommandSuggestions('')).toEqual([]);
    });

    it('returns empty for non-slash input', () => {
      expect(getCommandSuggestions('new')).toEqual([]);
    });

    it('returns all relevant suggestions for /', () => {
      const suggestions = getCommandSuggestions('/');
      expect(suggestions.length).toBeGreaterThan(0);
    });

    it('filters suggestions by /n', () => {
      const suggestions = getCommandSuggestions('/n');
      expect(suggestions.every((s) => s.command.startsWith('/n'))).toBe(true);
      expect(suggestions.some((s) => s.command === '/new prompt')).toBe(true);
    });

    it('filters suggestions by /new', () => {
      const suggestions = getCommandSuggestions('/new');
      expect(suggestions.every((s) => s.command.startsWith('/new'))).toBe(true);
    });

    it('filters suggestions by /new p', () => {
      const suggestions = getCommandSuggestions('/new p');
      expect(suggestions.every((s) => s.command.startsWith('/new p'))).toBe(true);
      expect(suggestions.some((s) => s.command === '/new prompt')).toBe(true);
      expect(suggestions.some((s) => s.command === '/new pipeline')).toBe(true);
    });

    it('returns exact match first', () => {
      const suggestions = getCommandSuggestions('/new prompt');
      expect(suggestions[0]?.command).toBe('/new prompt');
    });

    it('returns empty for no matches', () => {
      const suggestions = getCommandSuggestions('/xyz');
      expect(suggestions).toEqual([]);
    });
  });

  describe('isCommandComplete', () => {
    it('returns true for /help', () => {
      expect(isCommandComplete({ action: 'help', raw: '/help' })).toBe(true);
    });

    it('returns true for /new with entity type', () => {
      expect(
        isCommandComplete({ action: 'new', entityType: 'prompt', raw: '/new prompt' })
      ).toBe(true);
    });

    it('returns false for /new without entity type', () => {
      expect(isCommandComplete({ action: 'new', raw: '/new' })).toBe(false);
    });

    it('returns true for /edit with entity type', () => {
      expect(
        isCommandComplete({ action: 'edit', entityType: 'spec', raw: '/edit spec' })
      ).toBe(true);
    });

    it('returns true for /edit with entity type and ID', () => {
      expect(
        isCommandComplete({
          action: 'edit',
          entityType: 'spec',
          entityId: 'spec-123',
          raw: '/edit spec:spec-123',
        })
      ).toBe(true);
    });
  });

  describe('formatCommand', () => {
    it('formats help command', () => {
      expect(formatCommand({ action: 'help', raw: '/help' })).toBe('/help');
    });

    it('formats new command with entity type', () => {
      expect(formatCommand({ action: 'new', entityType: 'prompt', raw: '/new prompt' })).toBe(
        '/new prompt'
      );
    });

    it('formats edit command with entity type and ID', () => {
      expect(
        formatCommand({
          action: 'edit',
          entityType: 'spec',
          entityId: 'spec-123',
          raw: '/edit spec:spec-123',
        })
      ).toBe('/edit spec:spec-123');
    });
  });

  describe('getEntitySelectionState', () => {
    it('returns inactive for non-slash input', () => {
      const result = getEntitySelectionState('hello');
      expect(result.active).toBe(false);
    });

    it('returns inactive for incomplete command', () => {
      const result = getEntitySelectionState('/edit');
      expect(result.active).toBe(false);
    });

    it('returns inactive for /new commands (no entity selection needed)', () => {
      const result = getEntitySelectionState('/new prompt');
      expect(result.active).toBe(false);
    });

    it('returns inactive for /edit spec without trailing space', () => {
      const result = getEntitySelectionState('/edit spec');
      expect(result.active).toBe(false);
    });

    it('returns active for /edit spec with trailing space', () => {
      const result = getEntitySelectionState('/edit spec ');
      expect(result.active).toBe(true);
      expect(result.entityType).toBe('spec');
      expect(result.action).toBe('edit');
      expect(result.searchQuery).toBe('');
      expect(result.commandPrefix).toBe('/edit spec:');
    });

    it('returns active for /edit spec with search query (space format)', () => {
      const result = getEntitySelectionState('/edit spec my-spec');
      expect(result.active).toBe(true);
      expect(result.entityType).toBe('spec');
      expect(result.searchQuery).toBe('my-spec');
      expect(result.commandPrefix).toBe('/edit spec:');
    });

    it('returns active for /edit spec:query (colon format)', () => {
      const result = getEntitySelectionState('/edit spec:my-spec');
      expect(result.active).toBe(true);
      expect(result.entityType).toBe('spec');
      expect(result.searchQuery).toBe('my-spec');
      expect(result.commandPrefix).toBe('/edit spec:');
    });

    it('returns active for /edit spec: with empty query after colon', () => {
      const result = getEntitySelectionState('/edit spec:');
      expect(result.active).toBe(true);
      expect(result.entityType).toBe('spec');
      expect(result.searchQuery).toBe('');
    });

    it('works with /open command', () => {
      const result = getEntitySelectionState('/open document ');
      expect(result.active).toBe(true);
      expect(result.entityType).toBe('document');
      expect(result.action).toBe('open');
    });

    it('works with short alias /e', () => {
      const result = getEntitySelectionState('/e prompt:test');
      expect(result.active).toBe(true);
      expect(result.entityType).toBe('prompt');
      expect(result.searchQuery).toBe('test');
    });

    it('returns inactive for invalid entity type', () => {
      const result = getEntitySelectionState('/edit invalid ');
      expect(result.active).toBe(false);
    });

    it('handles multi-word search queries', () => {
      const result = getEntitySelectionState('/edit spec my search query');
      expect(result.active).toBe(true);
      expect(result.searchQuery).toBe('my search query');
    });
  });

  describe('buildCommandWithEntity', () => {
    it('builds command with entity ID', () => {
      const result = buildCommandWithEntity('/edit spec:', 'spec-123');
      expect(result).toBe('/edit spec:spec-123');
    });

    it('works with different entity types', () => {
      const result = buildCommandWithEntity('/open document:', 'doc-456');
      expect(result).toBe('/open document:doc-456');
    });
  });
});
