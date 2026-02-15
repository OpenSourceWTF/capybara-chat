/**
 * useSessionSocketEvents Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSessionResponseEvents, useSessionLifecycleEvents } from './useSessionSocketEvents';
import { MessageStatus, SOCKET_EVENTS } from '@capybara-chat/types';

// Mock the socket context
const mockOn = vi.fn();
const mockOff = vi.fn();

vi.mock('../context/SocketContext', () => ({
  useSocket: () => ({
    on: mockOn,
    off: mockOff,
    emit: vi.fn(),
    connected: true,
  }),
}));

describe('useSessionResponseEvents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers event listeners when sessionId is provided', () => {
    const onResponse = vi.fn();
    const onMessageStatus = vi.fn();
    const onError = vi.fn();

    renderHook(() =>
      useSessionResponseEvents({
        sessionId: 'session-123',
        onResponse,
        onMessageStatus,
        onError,
      })
    );

    expect(mockOn).toHaveBeenCalledWith(SOCKET_EVENTS.SESSION_RESPONSE, expect.any(Function));
    expect(mockOn).toHaveBeenCalledWith(SOCKET_EVENTS.MESSAGE_STATUS, expect.any(Function));
    expect(mockOn).toHaveBeenCalledWith(SOCKET_EVENTS.SESSION_ERROR, expect.any(Function));
  });

  it('does not register listeners when sessionId is null', () => {
    renderHook(() =>
      useSessionResponseEvents({
        sessionId: null,
        onResponse: vi.fn(),
      })
    );

    expect(mockOn).not.toHaveBeenCalled();
  });

  it('only registers listeners for provided handlers', () => {
    renderHook(() =>
      useSessionResponseEvents({
        sessionId: 'session-123',
        onResponse: vi.fn(),
        // onMessageStatus not provided
        // onError not provided
      })
    );

    expect(mockOn).toHaveBeenCalledTimes(1);
    expect(mockOn).toHaveBeenCalledWith(SOCKET_EVENTS.SESSION_RESPONSE, expect.any(Function));
  });

  it('unregisters listeners on unmount', () => {
    const { unmount } = renderHook(() =>
      useSessionResponseEvents({
        sessionId: 'session-123',
        onResponse: vi.fn(),
        onMessageStatus: vi.fn(),
      })
    );

    unmount();

    expect(mockOff).toHaveBeenCalledWith(SOCKET_EVENTS.SESSION_RESPONSE, expect.any(Function));
    expect(mockOff).toHaveBeenCalledWith(SOCKET_EVENTS.MESSAGE_STATUS, expect.any(Function));
  });

  it('filters events by sessionId', () => {
    const onResponse = vi.fn();
    let registeredHandler: (data: unknown) => void = () => {};

    mockOn.mockImplementation((event, handler) => {
      if (event === SOCKET_EVENTS.SESSION_RESPONSE) {
        registeredHandler = handler;
      }
    });

    renderHook(() =>
      useSessionResponseEvents({
        sessionId: 'session-123',
        onResponse,
      })
    );

    // Event for a different session should be ignored
    registeredHandler({
      sessionId: 'other-session',
      message: { id: '1', content: 'test', role: 'assistant', createdAt: Date.now(), status: MessageStatus.COMPLETED },
    });
    expect(onResponse).not.toHaveBeenCalled();

    // Event for the current session should be handled
    registeredHandler({
      sessionId: 'session-123',
      message: { id: '2', content: 'test', role: 'assistant', createdAt: Date.now(), status: MessageStatus.COMPLETED },
    });
    expect(onResponse).toHaveBeenCalledTimes(1);
  });
});

describe('useSessionLifecycleEvents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers lifecycle event listeners', () => {
    const onCreated = vi.fn();
    const onHidden = vi.fn();
    const onUpdated = vi.fn();

    renderHook(() =>
      useSessionLifecycleEvents({
        onCreated,
        onHidden,
        onUpdated,
      })
    );

    expect(mockOn).toHaveBeenCalledWith(SOCKET_EVENTS.SESSION_CREATED, onCreated);
    expect(mockOn).toHaveBeenCalledWith(SOCKET_EVENTS.SESSION_HIDDEN, onHidden);
    expect(mockOn).toHaveBeenCalledWith(SOCKET_EVENTS.SESSION_UPDATED, onUpdated);
  });

  it('only registers provided handlers', () => {
    renderHook(() =>
      useSessionLifecycleEvents({
        onCreated: vi.fn(),
        // others not provided
      })
    );

    expect(mockOn).toHaveBeenCalledTimes(1);
    expect(mockOn).toHaveBeenCalledWith(SOCKET_EVENTS.SESSION_CREATED, expect.any(Function));
  });

  it('unregisters listeners on unmount', () => {
    const onCreated = vi.fn();
    const { unmount } = renderHook(() =>
      useSessionLifecycleEvents({
        onCreated,
      })
    );

    unmount();

    expect(mockOff).toHaveBeenCalledWith(SOCKET_EVENTS.SESSION_CREATED, onCreated);
  });
});
