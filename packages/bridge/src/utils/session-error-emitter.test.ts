/**
 * Tests for session-error-emitter utility
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { emitSessionError } from './session-error-emitter.js';
import { SOCKET_EVENTS } from '@capybara-chat/types';

describe('emitSessionError', () => {
  let mockSocket: {
    emit: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockSocket = {
      emit: vi.fn(),
    };
  });

  it('should emit three events in correct order', () => {
    emitSessionError(mockSocket as unknown as Parameters<typeof emitSessionError>[0], {
      sessionId: 'session-123',
      messageId: 'msg-456',
      errorMessage: 'Test error',
      haltReason: 'cli_error',
    });

    expect(mockSocket.emit).toHaveBeenCalledTimes(3);

    // Check event order
    const calls = mockSocket.emit.mock.calls;
    expect(calls[0][0]).toBe(SOCKET_EVENTS.SESSION_HALTED);
    expect(calls[1][0]).toBe(SOCKET_EVENTS.SESSION_RESPONSE);
    expect(calls[2][0]).toBe(SOCKET_EVENTS.MESSAGE_STATUS);
  });

  it('should emit SESSION_HALTED with correct payload', () => {
    emitSessionError(mockSocket as unknown as Parameters<typeof emitSessionError>[0], {
      sessionId: 'session-123',
      messageId: 'msg-456',
      errorMessage: 'Test error',
      haltReason: 'timeout',
    });

    const haltedCall = mockSocket.emit.mock.calls[0];
    expect(haltedCall[1]).toMatchObject({
      sessionId: 'session-123',
      reason: 'timeout',
      errorMessage: 'Test error',
      canResume: true,
    });
    expect(haltedCall[1].timestamp).toBeDefined();
  });

  it('should emit SESSION_RESPONSE with system message', () => {
    emitSessionError(mockSocket as unknown as Parameters<typeof emitSessionError>[0], {
      sessionId: 'session-123',
      messageId: 'msg-456',
      errorMessage: 'Test error',
      haltReason: 'cli_error',
    });

    const responseCall = mockSocket.emit.mock.calls[1];
    expect(responseCall[1]).toMatchObject({
      sessionId: 'session-123',
      messageId: 'msg-456',
    });
    expect(responseCall[1].message).toMatchObject({
      content: 'Test error',
      role: 'system',
    });
    expect(responseCall[1].message.id).toBeDefined();
    expect(responseCall[1].message.createdAt).toBeDefined();
  });

  it('should emit MESSAGE_STATUS with failed status', () => {
    emitSessionError(mockSocket as unknown as Parameters<typeof emitSessionError>[0], {
      sessionId: 'session-123',
      messageId: 'msg-456',
      errorMessage: 'Test error',
      haltReason: 'cli_error',
    });

    const statusCall = mockSocket.emit.mock.calls[2];
    expect(statusCall[1]).toEqual({
      sessionId: 'session-123',
      messageId: 'msg-456',
      status: 'failed',
    });
  });

  it('should use fallback messageId when not provided', () => {
    emitSessionError(mockSocket as unknown as Parameters<typeof emitSessionError>[0], {
      sessionId: 'session-123',
      errorMessage: 'Test error',
      haltReason: 'cli_error',
    });

    const statusCall = mockSocket.emit.mock.calls[2];
    expect(statusCall[1].messageId).toBe('session-error');
  });

  it('should allow overriding canResume', () => {
    emitSessionError(mockSocket as unknown as Parameters<typeof emitSessionError>[0], {
      sessionId: 'session-123',
      errorMessage: 'Fatal error',
      haltReason: 'process_exit',
      canResume: false,
    });

    const haltedCall = mockSocket.emit.mock.calls[0];
    expect(haltedCall[1].canResume).toBe(false);
  });

  it('should handle null socket gracefully', () => {
    // Should not throw
    expect(() => {
      emitSessionError(null, {
        sessionId: 'session-123',
        errorMessage: 'Test error',
        haltReason: 'cli_error',
      });
    }).not.toThrow();
  });
});
