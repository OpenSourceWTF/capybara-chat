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
      expect(isEntityType('document')).toBe(true);
      expect(isEntityType('agentDefinition')).toBe(true);
    });

    it('returns false for invalid entity types', () => {
      expect(isEntityType('invalid')).toBe(false);
      expect(isEntityType('user')).toBe(false);
      expect(isEntityType('')).toBe(false);
      expect(isEntityType('spec')).toBe(false);
      expect(isEntityType('pipeline')).toBe(false);
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

      it('parses /edit prompt', () => {
        const result = parseSlashCommand('/edit prompt');
        expect(result).toEqual({
          action: 'edit',
          entityType: 'prompt',
          entityId: undefined,
          raw: '/edit prompt',
        });
      });

      it('parses /edit prompt:prompt-123 with ID', () => {
        const result = parseSlashCommand('/edit prompt:prompt-123');
        expect(result).toEqual({
          action: 'edit',
          entityType: 'prompt',
          entityId: 'prompt-123',
          raw: '/edit prompt:prompt-123',
        });
      });

      it('parses /open document', () => {
        const result = parseSlashCommand('/open document');
        expect(result).toEqual({
          action: 'open',
          entityType: 'document',
          entityId: undefined,
          raw: '/open document',
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
        const result = parseSlashCommand('/e prompt');
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

      it('parses /new document with multi-word name', () => {
        const result = parseSlashCommand('/new document My Cool Document');
        expect(result).toEqual({
          action: 'new',
          entityType: 'document',
          entityId: undefined,
          entityName: 'My Cool Document',
          raw: '/new document My Cool Document',
        });
      });

      it('does not set entityName for /new without name', () => {
        const result = parseSlashCommand('/new document');
        expect(result?.entityName).toBeUndefined();
      });

      it('does not set entityName for /edit commands', () => {
        const result = parseSlashCommand('/edit prompt some-name');
        expect(result?.entityName).toBeUndefined();
      });

      it('handles /create alias with name', () => {
        const result = parseSlashCommand('/create document My Document');
        expect(result?.action).toBe('new');
        expect(result?.entityType).toBe('document');
        expect(result?.entityName).toBe('My Document');
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
        isCommandComplete({ action: 'edit', entityType: 'prompt', raw: '/edit prompt' })
      ).toBe(true);
    });

    it('returns true for /edit with entity type and ID', () => {
      expect(
        isCommandComplete({
          action: 'edit',
          entityType: 'prompt',
          entityId: 'prompt-123',
          raw: '/edit prompt:prompt-123',
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
          entityType: 'document',
          entityId: 'doc-123',
          raw: '/edit document:doc-123',
        })
      ).toBe('/edit document:doc-123');
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

    it('returns inactive for /edit prompt without trailing space', () => {
      const result = getEntitySelectionState('/edit prompt');
      expect(result.active).toBe(false);
    });

    it('returns active for /edit prompt with trailing space', () => {
      const result = getEntitySelectionState('/edit prompt ');
      expect(result.active).toBe(true);
      expect(result.entityType).toBe('prompt');
      expect(result.action).toBe('edit');
      expect(result.searchQuery).toBe('');
      expect(result.commandPrefix).toBe('/edit prompt:');
    });

    it('returns active for /edit prompt with search query (space format)', () => {
      const result = getEntitySelectionState('/edit prompt my-prompt');
      expect(result.active).toBe(true);
      expect(result.entityType).toBe('prompt');
      expect(result.searchQuery).toBe('my-prompt');
      expect(result.commandPrefix).toBe('/edit prompt:');
    });

    it('returns active for /edit prompt:query (colon format)', () => {
      const result = getEntitySelectionState('/edit prompt:my-prompt');
      expect(result.active).toBe(true);
      expect(result.entityType).toBe('prompt');
      expect(result.searchQuery).toBe('my-prompt');
      expect(result.commandPrefix).toBe('/edit prompt:');
    });

    it('returns active for /edit prompt: with empty query after colon', () => {
      const result = getEntitySelectionState('/edit prompt:');
      expect(result.active).toBe(true);
      expect(result.entityType).toBe('prompt');
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
      const result = getEntitySelectionState('/edit prompt my search query');
      expect(result.active).toBe(true);
      expect(result.searchQuery).toBe('my search query');
    });
  });

  describe('buildCommandWithEntity', () => {
    it('builds command with entity ID', () => {
      const result = buildCommandWithEntity('/edit prompt:', 'prompt-123');
      expect(result).toBe('/edit prompt:prompt-123');
    });

    it('works with different entity types', () => {
      const result = buildCommandWithEntity('/open document:', 'doc-456');
      expect(result).toBe('/open document:doc-456');
    });
  });
});
