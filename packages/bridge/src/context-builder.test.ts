/**
 * Tests for Context Builder
 * B2/C2 fix: Updated to mock getApiClient instead of legacy functions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildFullContext,
  buildMinimalPrefix,
  markContextInjected,
  resetContextInjected,
} from './context-builder.js';

// Create mock API client methods
const mockGet = vi.fn();
const mockPatch = vi.fn();

// Mock the API client to return injectable client
vi.mock('./utils/api-client.js', () => ({
  getApiClient: () => ({
    get: mockGet,
    patch: mockPatch,
    post: vi.fn(),
  }),
}));

describe('Context Builder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('buildMinimalPrefix', () => {
    it('should build prefix for existing entity', () => {
      const result = buildMinimalPrefix(
        { editingEntityType: 'spec', editingEntityId: 'spec-123' },
        'Update the title'
      );

      expect(result).toContain('[editing: spec/spec-123]');
      expect(result).toContain('Update the title');
    });

    it('should build prefix for new entity (no ID)', () => {
      const result = buildMinimalPrefix(
        { editingEntityType: 'prompt', editingEntityId: undefined },
        'Create a new prompt'
      );

      expect(result).toContain('[editing: prompt/new]');
      expect(result).toContain('Create a new prompt');
    });

    it('should preserve user message exactly', () => {
      const message = 'This is a\nmulti-line\nmessage';
      const result = buildMinimalPrefix(
        { editingEntityType: 'document', editingEntityId: 'doc-1' },
        message
      );

      expect(result).toContain(message);
    });
  });

  describe('buildFullContext', () => {
    it('should build context for new entity creation', async () => {
      const result = await buildFullContext(
        { editingEntityType: 'spec', editingEntityId: undefined },
        'Create a new spec about authentication'
      );

      expect(result).toContain('Entity Creation Context');
      expect(result).toContain('new spec');
      expect(result).toContain('spec_create');
      expect(result).toContain('Required: title, content');
      expect(result).toContain('Create a new spec about authentication');
    });

    it('should build context for existing entity editing', async () => {
      mockGet.mockResolvedValue({
        ok: true,
        data: {
          id: 'spec-123',
          title: 'My Spec',
          content: 'Spec content here',
          priority: 'high',
        },
      });

      const result = await buildFullContext(
        { editingEntityType: 'spec', editingEntityId: 'spec-123' },
        'Update the priority'
      );

      expect(result).toContain('Entity Editing Context');
      expect(result).toContain('My Spec');
      expect(result).toContain('spec-123');
      expect(result).toContain('spec_get');
      expect(result).toContain('spec_update');
      expect(result).toContain('Update the priority');
    });

    it('should handle API fetch failure gracefully', async () => {
      mockGet.mockResolvedValue({
        ok: false,
        error: 'Not found',
      });

      const result = await buildFullContext(
        { editingEntityType: 'spec', editingEntityId: 'missing-spec' },
        'Update this spec'
      );

      // Should still generate context with minimal info
      expect(result).toContain('Entity Editing Context');
      expect(result).toContain('missing-spec');
    });

    it('should use correct tools for different entity types', async () => {
      mockGet.mockResolvedValue({
        ok: true,
        data: { id: '123', name: 'Test' },
      });

      // Test prompt
      const promptResult = await buildFullContext(
        { editingEntityType: 'prompt', editingEntityId: 'prompt-1' },
        'Edit prompt'
      );
      expect(promptResult).toContain('prompt_get');
      expect(promptResult).toContain('prompt_update');
      expect(promptResult).toContain('promptId');

      // Test document
      const docResult = await buildFullContext(
        { editingEntityType: 'document', editingEntityId: 'doc-1' },
        'Edit document'
      );
      expect(docResult).toContain('document_get');
      expect(docResult).toContain('document_update');
      expect(docResult).toContain('documentId');

      // Test agentDefinition
      const agentResult = await buildFullContext(
        { editingEntityType: 'agentDefinition', editingEntityId: 'agent-1' },
        'Edit agent'
      );
      expect(agentResult).toContain('agent_get');
      expect(agentResult).toContain('agent_update');
      expect(agentResult).toContain('agentId');
    });

    it('should truncate long content in entity values', async () => {
      mockGet.mockResolvedValue({
        ok: true,
        data: {
          id: 'spec-1',
          title: 'Test',
          content: 'A'.repeat(500), // Very long content
        },
      });

      const result = await buildFullContext(
        { editingEntityType: 'spec', editingEntityId: 'spec-1' },
        'Edit'
      );

      expect(result).toContain('[truncated]');
      expect(result.length).toBeLessThan(1500); // Should be reasonably short
    });

    it('should handle unknown entity type gracefully', async () => {
      // Should not call API for unknown type

      const result = await buildFullContext(
        { editingEntityType: 'unknownType', editingEntityId: 'id-1' },
        'Edit'
      );

      expect(result).toContain('Entity Editing Context');
      expect(result).toContain('unknownType');
    });
  });

  describe('markContextInjected', () => {
    it('should call API to mark context as injected', async () => {
      mockPatch.mockResolvedValue({ ok: true, data: undefined });

      await markContextInjected('session-123');

      expect(mockPatch).toHaveBeenCalledWith(
        '/api/sessions/session-123',
        { formContextInjected: true }
      );
    });

    it('should handle API failure gracefully', async () => {
      mockPatch.mockResolvedValue({ ok: false, error: 'Error' });

      // Should not throw
      await expect(markContextInjected('session-123')).resolves.not.toThrow();
    });
  });

  describe('resetContextInjected', () => {
    it('should call API to reset context flag', async () => {
      mockPatch.mockResolvedValue({ ok: true, data: undefined });

      await resetContextInjected('session-456');

      expect(mockPatch).toHaveBeenCalledWith(
        '/api/sessions/session-456',
        { formContextInjected: false }
      );
    });

    it('should handle API failure gracefully', async () => {
      mockPatch.mockResolvedValue({ ok: false, error: 'Error' });

      // Should not throw
      await expect(resetContextInjected('session-456')).resolves.not.toThrow();
    });
  });
});
