/**
 * Tests for useEntitySearch hook
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useEntitySearch } from './useEntitySearch';

// Mock the api module
vi.mock('../lib/api', () => ({
  api: {
    get: vi.fn(),
  },
}));

import { api } from '../lib/api';

describe('useEntitySearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty results when entityType is null', async () => {
    const { result } = renderHook(() => useEntitySearch(null, 'test'));

    expect(result.current.results).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(api.get).not.toHaveBeenCalled();
  });

  it('fetches entities and filters by search query', async () => {
    const mockPrompts = [
      { id: 'prompt-1', name: 'First Prompt' },
      { id: 'prompt-2', name: 'Second Prompt' },
      { id: 'prompt-3', name: 'Another One' },
    ];

    vi.mocked(api.get).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ segments: mockPrompts }),
    } as Response);

    const { result } = renderHook(() => useEntitySearch('prompt', 'first'));

    // Wait for debounce + fetch
    await waitFor(() => {
      expect(result.current.results).toHaveLength(1);
    }, { timeout: 1000 });

    expect(result.current.results[0]).toEqual({
      id: 'prompt-1',
      displayName: 'First Prompt',
      entityType: 'prompt',
    });
  });

  it('shows all entities when no search query (browse mode)', async () => {
    const mockPrompts = [
      { id: 'prompt-1', name: 'Prompt A' },
      { id: 'prompt-2', name: 'Prompt B' },
    ];

    vi.mocked(api.get).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ segments: mockPrompts }),
    } as Response);

    const { result } = renderHook(() => useEntitySearch('prompt', ''));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    }, { timeout: 1000 });

    // Should show all prompts when query is empty
    expect(result.current.results).toHaveLength(2);
  });

  it('filters by ID as well as name', async () => {
    const mockDocs = [
      { id: 'doc-abc-123', name: 'My Document' },
      { id: 'doc-xyz-456', name: 'Other Document' },
    ];

    vi.mocked(api.get).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ documents: mockDocs }),
    } as Response);

    const { result } = renderHook(() => useEntitySearch('document', 'abc'));

    await waitFor(() => {
      expect(result.current.results).toHaveLength(1);
    }, { timeout: 1000 });

    // Should find by ID match
    expect(result.current.results[0].id).toBe('doc-abc-123');
  });

  it('limits results to maxResults', async () => {
    const mockDocs = Array.from({ length: 20 }, (_, i) => ({
      id: `doc-${i}`,
      name: `Document ${i}`,
    }));

    vi.mocked(api.get).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ documents: mockDocs }),
    } as Response);

    const { result } = renderHook(() =>
      useEntitySearch('document', '', { maxResults: 5 })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    }, { timeout: 1000 });

    expect(result.current.results).toHaveLength(5);
  });

  it('uses title field when name is not available', async () => {
    const mockDocs = [{ id: 'doc-1', title: 'Doc Title' }];

    vi.mocked(api.get).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ documents: mockDocs }),
    } as Response);

    const { result } = renderHook(() => useEntitySearch('document', ''));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    }, { timeout: 1000 });

    expect(result.current.results[0].displayName).toBe('Doc Title');
  });

  it('falls back to ID when no name or title', async () => {
    const mockAgents = [{ id: 'agent-orphan' }];

    vi.mocked(api.get).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ agentDefinitions: mockAgents }),
    } as Response);

    const { result } = renderHook(() => useEntitySearch('agentDefinition', ''));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    }, { timeout: 1000 });

    expect(result.current.results[0].displayName).toBe('agent-orphan');
  });

  it('handles different entity types correctly', async () => {
    vi.mocked(api.get).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ agentDefinitions: [{ id: 'agent-1', name: 'Test' }] }),
    } as Response);

    const { result } = renderHook(() => useEntitySearch('agentDefinition', ''));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    }, { timeout: 1000 });

    expect(api.get).toHaveBeenCalledWith('/api/agent-definitions');
  });
});
