/**
 * API Client Tests
 *
 * Tests for injectable API client configuration and operations.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  loadApiClientConfig,
  createApiClient,
  getApiClient,
  resetApiClient,
  type ApiClientConfig,
} from './api-client.js';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('loadApiClientConfig', () => {
  it('should load from provided env object', () => {
    const env = {
      CAPYBARA_SERVER_URL: 'http://custom:3000',
      CAPYBARA_API_KEY: 'my-api-key',
    };

    const config = loadApiClientConfig(env);

    expect(config.serverUrl).toBe('http://custom:3000');
    expect(config.apiKey).toBe('my-api-key');
  });

  it('should use defaults for missing values', () => {
    const config = loadApiClientConfig({});

    expect(config.serverUrl).toBe('http://localhost:2279');
    expect(config.apiKey).toBeUndefined();
  });

  it('should use dev-key when ALLOW_DEV_KEY is true and no API key', () => {
    const env = {
      ALLOW_DEV_KEY: 'true',
    };

    const config = loadApiClientConfig(env);

    expect(config.apiKey).toBe('dev-key');
  });

  it('should prefer explicit API key over dev-key', () => {
    const env = {
      CAPYBARA_API_KEY: 'explicit-key',
      ALLOW_DEV_KEY: 'true',
    };

    const config = loadApiClientConfig(env);

    expect(config.apiKey).toBe('explicit-key');
  });
});

describe('createApiClient', () => {
  const testConfig: ApiClientConfig = {
    serverUrl: 'http://test-server:3000',
    apiKey: 'test-api-key',
  };

  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe('get', () => {
    it('should make GET request with correct URL and headers', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: 'test' }),
      });

      const client = createApiClient(testConfig);
      await client.get('/api/test');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-server:3000/api/test',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'X-Api-Key': 'test-api-key',
          }),
        })
      );
    });

    it('should return ok result on success', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: 123, name: 'Test' }),
      });

      const client = createApiClient(testConfig);
      const result = await client.get<{ id: number; name: string }>('/api/test');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual({ id: 123, name: 'Test' });
      }
    });

    it('should return error result on failure', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        text: () => Promise.resolve('Not found'),
      });

      const client = createApiClient(testConfig);
      const result = await client.get('/api/missing');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('Not found');
        expect(result.status).toBe(404);
      }
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const client = createApiClient(testConfig);
      const result = await client.get('/api/test');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('Network error');
      }
    });

    it('should handle 204 No Content', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 204,
      });

      const client = createApiClient(testConfig);
      const result = await client.get('/api/test');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toBeUndefined();
      }
    });
  });

  describe('post', () => {
    it('should make POST request with JSON body', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 201,
        json: () => Promise.resolve({ id: 1 }),
      });

      const client = createApiClient(testConfig);
      await client.post('/api/items', { name: 'New Item' });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-server:3000/api/items',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'New Item' }),
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-Api-Key': 'test-api-key',
          }),
        })
      );
    });
  });

  describe('patch', () => {
    it('should make PATCH request with JSON body', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: 1, name: 'Updated' }),
      });

      const client = createApiClient(testConfig);
      await client.patch('/api/items/1', { name: 'Updated' });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-server:3000/api/items/1',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ name: 'Updated' }),
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-Api-Key': 'test-api-key',
          }),
        })
      );
    });
  });

  describe('without API key', () => {
    it('should not include X-Api-Key header when no API key', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      });

      const client = createApiClient({ serverUrl: 'http://test:3000' });
      await client.get('/api/public');

      const [, options] = mockFetch.mock.calls[0];
      expect(options.headers).not.toHaveProperty('X-Api-Key');
    });
  });
});

describe('Singleton pattern', () => {
  beforeEach(() => {
    resetApiClient();
    mockFetch.mockReset();
  });

  afterEach(() => {
    resetApiClient();
  });

  it('should return same instance from getApiClient', () => {
    const instance1 = getApiClient();
    const instance2 = getApiClient();

    expect(instance1).toBe(instance2);
  });

  it('should create new instance after reset', () => {
    const instance1 = getApiClient();
    resetApiClient();
    const instance2 = getApiClient();

    expect(instance2).not.toBe(instance1);
  });
});
