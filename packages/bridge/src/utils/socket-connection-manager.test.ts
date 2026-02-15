/**
 * Tests for SocketConnectionManager
 *
 * Tests socket connection lifecycle management:
 * - Connect with handler registration
 * - Disconnect with cleanup
 * - Reconnect (idempotent)
 * - Duplicate socket detection
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import {
  SocketConnectionManager,
  createSocketConnectionManager,
  type HandlerRegistration,
} from './socket-connection-manager.js';

// Mock socket-deduplication module
vi.mock('./socket-deduplication.js', () => ({
  cleanupListeners: vi.fn(),
  registerListeners: vi.fn((socket, handlers) => handlers),
  detectDuplicateSocket: vi.fn(),
}));

import {
  cleanupListeners,
  registerListeners,
  detectDuplicateSocket,
} from './socket-deduplication.js';

describe('SocketConnectionManager', () => {
  let manager: SocketConnectionManager;
  let mockSocket: {
    id: string;
    connected: boolean;
    disconnect: Mock;
    on: Mock;
    off: Mock;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    manager = new SocketConnectionManager('TestService');
    mockSocket = {
      id: 'socket-1',
      connected: true,
      disconnect: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
    };
  });

  describe('connect', () => {
    it('should register handlers on first connection', () => {
      const handlers: HandlerRegistration[] = [
        { event: 'message', handler: vi.fn() },
        { event: 'error', handler: vi.fn() },
      ];

      manager.connect(mockSocket as unknown as Parameters<typeof manager.connect>[0], handlers);

      expect(registerListeners).toHaveBeenCalledWith(
        mockSocket,
        handlers,
        'TestService'
      );
    });

    it('should store connection state', () => {
      manager.connect(mockSocket as unknown as Parameters<typeof manager.connect>[0]);

      expect(manager.isConnected()).toBe(true);
      expect(manager.getSocket()).toBe(mockSocket);
    });

    it('should work without handlers', () => {
      manager.connect(mockSocket as unknown as Parameters<typeof manager.connect>[0]);

      expect(manager.isConnected()).toBe(true);
      expect(registerListeners).not.toHaveBeenCalled();
    });

    it('should detect duplicate socket on reconnect', () => {
      manager.connect(mockSocket as unknown as Parameters<typeof manager.connect>[0]);

      const newSocket = { ...mockSocket, id: 'socket-2' };
      manager.connect(newSocket as unknown as Parameters<typeof manager.connect>[0]);

      expect(detectDuplicateSocket).toHaveBeenCalledWith(
        mockSocket,
        newSocket,
        'TestService'
      );
    });

    it('should disconnect old socket when connecting new one', () => {
      manager.connect(mockSocket as unknown as Parameters<typeof manager.connect>[0]);

      const newSocket = {
        ...mockSocket,
        id: 'socket-2',
        disconnect: vi.fn(),
      };
      manager.connect(newSocket as unknown as Parameters<typeof manager.connect>[0]);

      expect(mockSocket.disconnect).toHaveBeenCalled();
    });

    it('should clean up handlers when reconnecting same socket', () => {
      const handlers: HandlerRegistration[] = [
        { event: 'message', handler: vi.fn() },
      ];

      manager.connect(mockSocket as unknown as Parameters<typeof manager.connect>[0], handlers);
      manager.connect(mockSocket as unknown as Parameters<typeof manager.connect>[0], handlers);

      expect(cleanupListeners).toHaveBeenCalled();
    });

    it('should not disconnect when reconnecting same socket', () => {
      manager.connect(mockSocket as unknown as Parameters<typeof manager.connect>[0]);
      manager.connect(mockSocket as unknown as Parameters<typeof manager.connect>[0]);

      expect(mockSocket.disconnect).not.toHaveBeenCalled();
    });

    it('should store custom cleanup function', () => {
      const cleanup = vi.fn();
      manager.connect(mockSocket as unknown as Parameters<typeof manager.connect>[0], [], cleanup);

      manager.disconnect();

      expect(cleanup).toHaveBeenCalled();
    });
  });

  describe('disconnect', () => {
    it('should clean up handlers', () => {
      const handlers: HandlerRegistration[] = [
        { event: 'message', handler: vi.fn() },
      ];
      manager.connect(mockSocket as unknown as Parameters<typeof manager.connect>[0], handlers);

      manager.disconnect();

      expect(cleanupListeners).toHaveBeenCalledWith(
        mockSocket,
        handlers,
        'TestService'
      );
    });

    it('should disconnect socket', () => {
      manager.connect(mockSocket as unknown as Parameters<typeof manager.connect>[0]);

      manager.disconnect();

      expect(mockSocket.disconnect).toHaveBeenCalled();
    });

    it('should clear connection state', () => {
      manager.connect(mockSocket as unknown as Parameters<typeof manager.connect>[0]);

      manager.disconnect();

      expect(manager.isConnected()).toBe(false);
      expect(manager.getSocket()).toBeNull();
    });

    it('should do nothing if not connected', () => {
      manager.disconnect();

      expect(cleanupListeners).not.toHaveBeenCalled();
    });

    it('should call custom cleanup function', () => {
      const cleanup = vi.fn();
      manager.connect(mockSocket as unknown as Parameters<typeof manager.connect>[0], [], cleanup);

      manager.disconnect();

      expect(cleanup).toHaveBeenCalledTimes(1);
    });

    it('should not call disconnect if socket already disconnected', () => {
      mockSocket.connected = false;
      manager.connect(mockSocket as unknown as Parameters<typeof manager.connect>[0]);

      manager.disconnect();

      expect(mockSocket.disconnect).not.toHaveBeenCalled();
    });
  });

  describe('isConnected', () => {
    it('should return false initially', () => {
      expect(manager.isConnected()).toBe(false);
    });

    it('should return true after connect', () => {
      manager.connect(mockSocket as unknown as Parameters<typeof manager.connect>[0]);

      expect(manager.isConnected()).toBe(true);
    });

    it('should return false after disconnect', () => {
      manager.connect(mockSocket as unknown as Parameters<typeof manager.connect>[0]);
      manager.disconnect();

      expect(manager.isConnected()).toBe(false);
    });

    it('should return false if socket is not connected', () => {
      mockSocket.connected = false;
      manager.connect(mockSocket as unknown as Parameters<typeof manager.connect>[0]);

      expect(manager.isConnected()).toBe(false);
    });
  });

  describe('getSocket', () => {
    it('should return null initially', () => {
      expect(manager.getSocket()).toBeNull();
    });

    it('should return socket after connect', () => {
      manager.connect(mockSocket as unknown as Parameters<typeof manager.connect>[0]);

      expect(manager.getSocket()).toBe(mockSocket);
    });

    it('should return null after disconnect', () => {
      manager.connect(mockSocket as unknown as Parameters<typeof manager.connect>[0]);
      manager.disconnect();

      expect(manager.getSocket()).toBeNull();
    });
  });

  describe('createSocketConnectionManager', () => {
    it('should create a new manager instance', () => {
      const created = createSocketConnectionManager('MyService');

      expect(created).toBeInstanceOf(SocketConnectionManager);
    });
  });
});
