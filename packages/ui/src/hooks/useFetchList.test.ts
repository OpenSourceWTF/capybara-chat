/**
 * useFetchList Hook Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useFetchList, removeById, prependItem } from './useFetchList';

// Mock the api module
vi.mock('../lib/api', () => ({
  api: {
    get: vi.fn(),
  },
}));

// Mock api-error-handler
vi.mock('../lib/api-error-handler', () => ({
  handleApiError: vi.fn((context, error) => `${context}: ${error?.message || 'Unknown error'}`),
  extractResponseError: vi.fn((_response, fallback) => fallback),
}));

import { api } from '../lib/api';

describe('useFetchList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches data on mount and sets items', async () => {
    const mockData = { items: [{ id: '1', name: 'Item 1' }, { id: '2', name: 'Item 2' }] };
    vi.mocked(api.get).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    } as Response);

    const { result } = renderHook(() =>
      useFetchList({ url: '/api/items', dataKey: 'items' })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.items).toHaveLength(2);
    expect(result.current.error).toBeNull();
  });

  it('handles empty data key gracefully', async () => {
    const mockData = { otherKey: [] };
    vi.mocked(api.get).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    } as Response);

    const { result } = renderHook(() =>
      useFetchList({ url: '/api/items', dataKey: 'items' })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.items).toEqual([]);
  });

  it('does not fetch when enabled is false', async () => {
    const { result } = renderHook(() =>
      useFetchList({ url: '/api/items', dataKey: 'items', enabled: false })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(api.get).not.toHaveBeenCalled();
  });

  it('sets error when response is not ok', async () => {
    vi.mocked(api.get).mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve('Server error'),
    } as Response);

    const { result } = renderHook(() =>
      useFetchList({ url: '/api/items', dataKey: 'items' })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeTruthy();
  });

  it('sets error when fetch throws', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() =>
      useFetchList({ url: '/api/items', dataKey: 'items' })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toContain('Network error');
  });

  it('includes params in URL', async () => {
    vi.mocked(api.get).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ items: [] }),
    } as Response);

    renderHook(() =>
      useFetchList({
        url: '/api/items',
        dataKey: 'items',
        params: { status: 'active', category: 'test' },
      })
    );

    await waitFor(() => {
      expect(api.get).toHaveBeenCalled();
    });

    const calledUrl = vi.mocked(api.get).mock.calls[0][0];
    expect(calledUrl).toContain('status=active');
    expect(calledUrl).toContain('category=test');
  });

  it('excludes undefined and empty params', async () => {
    vi.mocked(api.get).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ items: [] }),
    } as Response);

    renderHook(() =>
      useFetchList({
        url: '/api/items',
        dataKey: 'items',
        params: { status: 'active', empty: '', undef: undefined },
      })
    );

    await waitFor(() => {
      expect(api.get).toHaveBeenCalled();
    });

    const calledUrl = vi.mocked(api.get).mock.calls[0][0];
    expect(calledUrl).toContain('status=active');
    expect(calledUrl).not.toContain('empty=');
    expect(calledUrl).not.toContain('undef=');
  });

  it('refetch function triggers new fetch', async () => {
    vi.mocked(api.get).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ items: [{ id: '1' }] }),
    } as Response);

    const { result } = renderHook(() =>
      useFetchList({ url: '/api/items', dataKey: 'items' })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(api.get).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.refetch();
    });

    expect(api.get).toHaveBeenCalledTimes(2);
  });

  it('setItems allows direct manipulation', async () => {
    vi.mocked(api.get).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ items: [{ id: '1' }] }),
    } as Response);

    const { result } = renderHook(() =>
      useFetchList<{ id: string }>({ url: '/api/items', dataKey: 'items' })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.setItems([{ id: 'new' }]);
    });

    expect(result.current.items).toEqual([{ id: 'new' }]);
  });
});

describe('removeById', () => {
  it('removes item with matching id', () => {
    const items = [{ id: '1' }, { id: '2' }, { id: '3' }];
    const setItems = vi.fn((fn) => {
      if (typeof fn === 'function') {
        return fn(items);
      }
      return fn;
    });

    removeById(setItems, '2');

    expect(setItems).toHaveBeenCalled();
    const result = setItems.mock.calls[0][0](items);
    expect(result).toEqual([{ id: '1' }, { id: '3' }]);
  });
});

describe('prependItem', () => {
  it('adds item to beginning of list', () => {
    const items = [{ id: '2' }, { id: '3' }];
    const setItems = vi.fn((fn) => {
      if (typeof fn === 'function') {
        return fn(items);
      }
      return fn;
    });

    prependItem(setItems, { id: '1' });

    expect(setItems).toHaveBeenCalled();
    const result = setItems.mock.calls[0][0](items);
    expect(result).toEqual([{ id: '1' }, { id: '2' }, { id: '3' }]);
  });
});
