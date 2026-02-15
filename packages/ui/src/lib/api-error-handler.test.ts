/**
 * API Error Handler Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { handleApiError, extractResponseError, handleApiResponse } from './api-error-handler';

// Mock the logger
vi.mock('./logger', () => ({
  createLogger: () => ({
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  }),
}));

describe('handleApiError', () => {
  it('returns formatted error message from Error object', () => {
    const error = new Error('Network failure');
    const result = handleApiError('Fetch failed', error);
    expect(result).toContain('Network failure');
  });

  it('returns formatted error message from string', () => {
    const result = handleApiError('Request failed', 'Connection timeout');
    expect(result).toContain('Connection timeout');
  });

  it('returns context as fallback for unknown error types', () => {
    const result = handleApiError('API error', undefined);
    expect(result).toContain('API error');
  });

  it('handles options parameter', () => {
    const error = new Error('Not found');
    const result = handleApiError('Fetch failed', error, { url: '/api/test', id: '123' });
    expect(result).toContain('Not found');
  });
});

describe('extractResponseError', () => {
  it('extracts text from response body', async () => {
    const response = {
      text: vi.fn().mockResolvedValue('Resource not found'),
      statusText: 'Not Found',
    } as unknown as Response;

    const result = await extractResponseError(response, 'Default error');
    expect(result).toBe('Resource not found');
  });

  it('returns fallback when text is empty', async () => {
    const response = {
      text: vi.fn().mockResolvedValue(''),
      statusText: 'Not Found',
    } as unknown as Response;

    const result = await extractResponseError(response, 'Default error');
    expect(result).toBe('Default error');
  });

  it('returns statusText when text() throws', async () => {
    const response = {
      text: vi.fn().mockRejectedValue(new Error('Parse error')),
      statusText: 'Internal Server Error',
    } as unknown as Response;

    const result = await extractResponseError(response, 'Default error');
    expect(result).toBe('Internal Server Error');
  });

  it('returns fallback when text() throws and no statusText', async () => {
    const response = {
      text: vi.fn().mockRejectedValue(new Error('Parse error')),
      statusText: '',
    } as unknown as Response;

    const result = await extractResponseError(response, 'Default error');
    expect(result).toBe('Default error');
  });
});

describe('handleApiResponse', () => {
  it('returns data when response is ok', async () => {
    const mockData = { id: 1, name: 'Test' };
    const response = {
      ok: true,
      json: vi.fn().mockResolvedValue(mockData),
    } as unknown as Response;

    const result = await handleApiResponse<typeof mockData>(response, 'Fetch data');
    expect(result).toEqual({ data: mockData, error: null });
  });

  it('returns error when response is not ok', async () => {
    const response = {
      ok: false,
      text: vi.fn().mockResolvedValue('Not found'),
      statusText: 'Not Found',
    } as unknown as Response;

    const result = await handleApiResponse<any>(response, 'Fetch data');
    expect(result).toEqual({ data: null, error: 'Not found' });
  });

  it('returns context as error when response text is empty', async () => {
    const response = {
      ok: false,
      text: vi.fn().mockResolvedValue(''),
      statusText: '',
    } as unknown as Response;

    const result = await handleApiResponse<any>(response, 'Failed to load');
    expect(result).toEqual({ data: null, error: 'Failed to load' });
  });
});
