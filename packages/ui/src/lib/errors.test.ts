/**
 * Tests for frontend error utilities
 */

import { describe, it, expect, vi } from 'vitest';
import {
  ApiError,
  assertResponse,
  getErrorMessage,
  getResponseError,
  isErrorResponse,
  formatApiError,
} from './errors';

describe('ApiError', () => {
  it('creates error with status and message', () => {
    const error = new ApiError(404, 'Not found');
    expect(error.status).toBe(404);
    expect(error.message).toBe('Not found');
    expect(error.name).toBe('ApiError');
  });

  it('stores optional body', () => {
    const error = new ApiError(400, 'Bad request', '{"field":"name"}');
    expect(error.body).toBe('{"field":"name"}');
  });

  describe('isClientError', () => {
    it('returns true for 4xx status codes', () => {
      expect(new ApiError(400, 'Bad request').isClientError).toBe(true);
      expect(new ApiError(404, 'Not found').isClientError).toBe(true);
      expect(new ApiError(422, 'Unprocessable').isClientError).toBe(true);
      expect(new ApiError(499, 'Client closed').isClientError).toBe(true);
    });

    it('returns false for non-4xx status codes', () => {
      expect(new ApiError(200, 'OK').isClientError).toBe(false);
      expect(new ApiError(301, 'Redirect').isClientError).toBe(false);
      expect(new ApiError(500, 'Server error').isClientError).toBe(false);
    });
  });

  describe('isServerError', () => {
    it('returns true for 5xx status codes', () => {
      expect(new ApiError(500, 'Internal error').isServerError).toBe(true);
      expect(new ApiError(502, 'Bad gateway').isServerError).toBe(true);
      expect(new ApiError(503, 'Unavailable').isServerError).toBe(true);
    });

    it('returns false for non-5xx status codes', () => {
      expect(new ApiError(200, 'OK').isServerError).toBe(false);
      expect(new ApiError(404, 'Not found').isServerError).toBe(false);
    });
  });

  describe('isNotFound', () => {
    it('returns true for 404', () => {
      expect(new ApiError(404, 'Not found').isNotFound).toBe(true);
    });

    it('returns false for other status codes', () => {
      expect(new ApiError(400, 'Bad request').isNotFound).toBe(false);
      expect(new ApiError(500, 'Server error').isNotFound).toBe(false);
    });
  });

  describe('isUnauthorized', () => {
    it('returns true for 401', () => {
      expect(new ApiError(401, 'Unauthorized').isUnauthorized).toBe(true);
    });

    it('returns false for other status codes', () => {
      expect(new ApiError(403, 'Forbidden').isUnauthorized).toBe(false);
      expect(new ApiError(404, 'Not found').isUnauthorized).toBe(false);
    });
  });
});

describe('assertResponse', () => {
  const createMockResponse = (ok: boolean, status: number, body?: string, statusText = ''): Response => {
    return {
      ok,
      status,
      statusText,
      text: vi.fn().mockResolvedValue(body),
    } as unknown as Response;
  };

  it('does not throw for successful response', async () => {
    const res = createMockResponse(true, 200);
    await expect(assertResponse(res, 'test')).resolves.toBeUndefined();
  });

  it('throws ApiError for failed response', async () => {
    const res = createMockResponse(false, 404, 'Resource not found');
    await expect(assertResponse(res, 'fetch resource')).rejects.toThrow(ApiError);
  });

  it('includes status code in thrown error', async () => {
    const res = createMockResponse(false, 401, 'Invalid token');
    try {
      await assertResponse(res, 'authenticate');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).status).toBe(401);
    }
  });

  it('includes context in error message', async () => {
    const res = createMockResponse(false, 500, 'Database error');
    try {
      await assertResponse(res, 'save user');
    } catch (err) {
      expect((err as ApiError).message).toContain('save user');
    }
  });

  it('includes response body in error', async () => {
    const res = createMockResponse(false, 400, '{"error":"validation failed"}');
    try {
      await assertResponse(res, 'submit form');
    } catch (err) {
      expect((err as ApiError).body).toBe('{"error":"validation failed"}');
    }
  });

  it('handles text() rejection gracefully', async () => {
    const res = {
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: vi.fn().mockRejectedValue(new Error('Stream error')),
    } as unknown as Response;

    try {
      await assertResponse(res, 'fetch data');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).status).toBe(500);
    }
  });
});

describe('getErrorMessage', () => {
  it('extracts message from Error', () => {
    const error = new Error('Test error');
    expect(getErrorMessage(error)).toBe('Test error');
  });

  it('extracts message from ApiError', () => {
    const error = new ApiError(404, 'Resource not found');
    expect(getErrorMessage(error)).toBe('Resource not found');
  });

  it('returns string as-is', () => {
    expect(getErrorMessage('String error')).toBe('String error');
  });

  it('returns fallback for unknown types', () => {
    expect(getErrorMessage(null)).toBe('An error occurred');
    expect(getErrorMessage(undefined)).toBe('An error occurred');
    expect(getErrorMessage(123)).toBe('An error occurred');
    expect(getErrorMessage({})).toBe('An error occurred');
  });

  it('uses custom fallback', () => {
    expect(getErrorMessage(null, 'Custom fallback')).toBe('Custom fallback');
  });
});

describe('getResponseError', () => {
  it('extracts text from response', async () => {
    const res = {
      text: vi.fn().mockResolvedValue('Error details'),
      statusText: 'Bad Request',
    } as unknown as Response;

    expect(await getResponseError(res)).toBe('Error details');
  });

  it('falls back to statusText if text is empty', async () => {
    const res = {
      text: vi.fn().mockResolvedValue(''),
      statusText: 'Not Found',
    } as unknown as Response;

    expect(await getResponseError(res)).toBe('Not Found');
  });

  it('uses fallback if all else fails', async () => {
    const res = {
      text: vi.fn().mockRejectedValue(new Error('Stream error')),
      statusText: '',
    } as unknown as Response;

    expect(await getResponseError(res, 'Custom fallback')).toBe('Custom fallback');
  });
});

describe('isErrorResponse', () => {
  it('returns true for non-ok response', () => {
    expect(isErrorResponse({ ok: false } as Response)).toBe(true);
  });

  it('returns false for ok response', () => {
    expect(isErrorResponse({ ok: true } as Response)).toBe(false);
  });
});

describe('formatApiError', () => {
  it('formats error with URL and message', () => {
    const error = new Error('Connection refused');
    expect(formatApiError('/api/users', error)).toBe(
      'Request to /api/users failed: Connection refused'
    );
  });

  it('formats ApiError', () => {
    const error = new ApiError(404, 'User not found');
    expect(formatApiError('/api/users/123', error)).toBe(
      'Request to /api/users/123 failed: User not found'
    );
  });
});
