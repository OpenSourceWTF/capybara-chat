/**
 * Tests for useApiMutation hooks
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDelete, usePost, usePatch } from './useApiMutation';

// Mock the api module
vi.mock('../lib/api', () => ({
  api: {
    delete: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
  },
}));

// Import the mocked api after mocking
import { api } from '../lib/api';

describe('useDelete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should delete successfully', async () => {
    const mockResponse = { ok: true };
    vi.mocked(api.delete).mockResolvedValue(mockResponse as Response);

    const onSuccess = vi.fn();
    const { result } = renderHook(() =>
      useDelete('/api/items', { onSuccess })
    );

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe(null);

    let deleteResult: boolean;
    await act(async () => {
      deleteResult = await result.current.deleteItem('123');
    });

    expect(deleteResult!).toBe(true);
    expect(api.delete).toHaveBeenCalledWith('/api/items/123');
    expect(onSuccess).toHaveBeenCalledWith('123');
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe(null);
  });

  it('should handle delete failure', async () => {
    const mockResponse = {
      ok: false,
      text: () => Promise.resolve('Not found'),
      statusText: 'Not Found',
    };
    vi.mocked(api.delete).mockResolvedValue(mockResponse as Response);

    const { result } = renderHook(() => useDelete('/api/items'));

    let deleteResult: boolean;
    await act(async () => {
      deleteResult = await result.current.deleteItem('123');
    });

    expect(deleteResult!).toBe(false);
    expect(result.current.error).toBe('Not found');
  });

  it('should handle network errors', async () => {
    vi.mocked(api.delete).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useDelete('/api/items'));

    let deleteResult: boolean;
    await act(async () => {
      deleteResult = await result.current.deleteItem('123');
    });

    expect(deleteResult!).toBe(false);
    expect(result.current.error).toBe('Network error');
  });

  // NOTE: Confirmation dialog testing moved to component-level tests
  // since confirmation is now handled by ConfirmDeleteDialog component,
  // not by the useDelete hook.
});

describe('usePost', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should post successfully', async () => {
    const mockData = { id: '123', name: 'Test' };
    const mockResponse = {
      ok: true,
      json: () => Promise.resolve(mockData),
    };
    vi.mocked(api.post).mockResolvedValue(mockResponse as Response);

    const { result } = renderHook(() =>
      usePost<{ name: string }, { id: string; name: string }>('/api/items')
    );

    let postResult: { id: string; name: string } | null;
    await act(async () => {
      postResult = await result.current.post({ name: 'Test' });
    });

    expect(postResult!).toEqual(mockData);
    expect(api.post).toHaveBeenCalledWith('/api/items', { name: 'Test' });
    expect(result.current.error).toBe(null);
  });

  it('should handle post failure', async () => {
    const mockResponse = {
      ok: false,
      text: () => Promise.resolve('Validation error'),
      statusText: 'Bad Request',
    };
    vi.mocked(api.post).mockResolvedValue(mockResponse as Response);

    const { result } = renderHook(() => usePost('/api/items'));

    let postResult: unknown;
    await act(async () => {
      postResult = await result.current.post({ name: 'Test' });
    });

    expect(postResult).toBe(null);
    expect(result.current.error).toBe('Validation error');
  });
});

describe('usePatch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should patch successfully', async () => {
    const mockData = { id: '123', name: 'Updated' };
    const mockResponse = {
      ok: true,
      json: () => Promise.resolve(mockData),
    };
    vi.mocked(api.patch).mockResolvedValue(mockResponse as Response);

    const { result } = renderHook(() =>
      usePatch<{ name: string }, { id: string; name: string }>('/api/items')
    );

    let patchResult: { id: string; name: string } | null;
    await act(async () => {
      patchResult = await result.current.patch('123', { name: 'Updated' });
    });

    expect(patchResult!).toEqual(mockData);
    expect(api.patch).toHaveBeenCalledWith('/api/items/123', { name: 'Updated' });
    expect(result.current.error).toBe(null);
  });

  it('should handle patch failure', async () => {
    const mockResponse = {
      ok: false,
      text: () => Promise.resolve('Update failed'),
      statusText: 'Bad Request',
    };
    vi.mocked(api.patch).mockResolvedValue(mockResponse as Response);

    const { result } = renderHook(() => usePatch('/api/items'));

    let patchResult: unknown;
    await act(async () => {
      patchResult = await result.current.patch('123', { name: 'Test' });
    });

    expect(patchResult).toBe(null);
    expect(result.current.error).toBe('Update failed');
  });
});
