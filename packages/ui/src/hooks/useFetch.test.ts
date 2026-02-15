/**
 * Tests for useFetch hooks
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useFetch, useLazyFetch } from './useFetch';
import { useFetchList } from './useFetchList';

// Mock the api module
vi.mock('../lib/api', () => ({
  api: {
    get: vi.fn(),
  },
}));

import { api } from '../lib/api';

describe('useFetch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch data successfully', async () => {
    const mockData = { id: '1', name: 'Test' };
    vi.mocked(api.get).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    } as Response);

    const { result } = renderHook(() => useFetch<typeof mockData>('/api/test'));

    // Initially loading
    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBe(null);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual(mockData);
    expect(result.current.error).toBe(null);
    expect(api.get).toHaveBeenCalledWith('/api/test');
  });

  it('should handle fetch failure', async () => {
    vi.mocked(api.get).mockResolvedValue({
      ok: false,
      text: () => Promise.resolve('Not found'),
      statusText: 'Not Found',
    } as Response);

    const { result } = renderHook(() => useFetch('/api/test'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toBe(null);
    expect(result.current.error).toBe('Not found');
  });

  it('should handle network errors', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useFetch('/api/test'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toBe(null);
    expect(result.current.error).toBe('Network error');
  });

  it('should skip fetch when skip option is true', async () => {
    const { result } = renderHook(() => useFetch('/api/test', { skip: true }));

    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBe(null);
    expect(api.get).not.toHaveBeenCalled();
  });

  it('should refetch when refetch is called', async () => {
    const mockData = { id: '1' };
    vi.mocked(api.get).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    } as Response);

    const { result } = renderHook(() => useFetch('/api/test'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(api.get).toHaveBeenCalledTimes(1);

    // Call refetch
    await result.current.refetch();

    expect(api.get).toHaveBeenCalledTimes(2);
  });
});

describe('useFetchList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should extract array from response by dataKey', async () => {
    const mockItems = [{ id: '1' }, { id: '2' }];
    vi.mocked(api.get).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ items: mockItems, total: 2 }),
    } as Response);

    const { result } = renderHook(() => useFetchList<{ id: string }>({
      url: '/api/test',
      dataKey: 'items',
    }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.items).toEqual(mockItems);
    expect(result.current.error).toBe(null);
  });

  it('should return empty array if key not found', async () => {
    vi.mocked(api.get).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ other: [] }),
    } as Response);

    const { result } = renderHook(() => useFetchList({
      url: '/api/test',
      dataKey: 'items',
    }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.items).toEqual([]);
  });

  it('should support params filtering', async () => {
    const mockItems = [{ id: '1' }];
    vi.mocked(api.get).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ items: mockItems }),
    } as Response);

    const { result } = renderHook(() => useFetchList<{ id: string }>({
      url: '/api/test',
      dataKey: 'items',
      params: { status: 'active' },
    }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(api.get).toHaveBeenCalledWith('/api/test?status=active');
    expect(result.current.items).toEqual(mockItems);
  });

  it('should not fetch when enabled is false', async () => {
    const { result } = renderHook(() => useFetchList({
      url: '/api/test',
      dataKey: 'items',
      enabled: false,
    }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(api.get).not.toHaveBeenCalled();
    expect(result.current.items).toEqual([]);
  });
});

describe('useLazyFetch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not fetch until fetch is called', async () => {
    const { result } = renderHook(() => useLazyFetch('/api/test'));

    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBe(null);
    expect(api.get).not.toHaveBeenCalled();
  });

  it('should fetch when fetch is called', async () => {
    const mockData = { id: '1' };
    vi.mocked(api.get).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    } as Response);

    const { result } = renderHook(() => useLazyFetch<typeof mockData>('/api/test'));

    // Call fetch
    const data = await result.current.fetch();

    expect(data).toEqual(mockData);
    expect(api.get).toHaveBeenCalledWith('/api/test');

    // Wait for state to update
    await waitFor(() => {
      expect(result.current.data).toEqual(mockData);
    });
  });

  it('should return null on failure', async () => {
    vi.mocked(api.get).mockResolvedValue({
      ok: false,
      text: () => Promise.resolve('Error'),
      statusText: 'Error',
    } as Response);

    const { result } = renderHook(() => useLazyFetch('/api/test'));

    const data = await result.current.fetch();

    expect(data).toBe(null);

    // Wait for state to update
    await waitFor(() => {
      expect(result.current.error).toBe('Error');
    });
  });
});
