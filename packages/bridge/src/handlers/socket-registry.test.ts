/**
 * Tests for socket-registry.ts
 *
 * Verifies:
 * - Human input response handler forwards to humanLoop
 * - Session hidden handler cleans up all state managers
 * - Session message handler forwards to messageHandler
 * - registerSocketEventHandlers registers all events
 * - Cleanup function unregisters all events
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createHumanInputResponseHandler,
  createSessionHiddenHandler,
  createSessionMessageHandler,
  createModelSwitchHandler,
  createSessionStopHandler,
  registerSocketEventHandlers,
  type SocketHandlerDeps,
} from './socket-registry.js';
import type { BridgeServices, BridgeStateManagers } from '../bridge-init.js';
import type { BridgeConfig } from '../interfaces.js';
import { SOCKET_EVENTS } from '@capybara-chat/types';

describe('socket-registry', () => {
  let mockServices: BridgeServices;
  let mockStateManagers: BridgeStateManagers;
  let mockConfig: BridgeConfig;
  let mockDeps: SocketHandlerDeps;

  beforeEach(() => {
    // Create mock sessionContextStore with chained return for getOrCreate
    const mockSessionContext = { modelOverride: undefined };
    const mockSessionContextStore = {
      delete: vi.fn(),
      getOrCreate: vi.fn().mockReturnValue(mockSessionContext),
      update: vi.fn(),
    };

    mockStateManagers = {
      concurrency: { clearSession: vi.fn() },
      agentConfigManager: {},
      sessionContextStore: mockSessionContextStore,
    } as unknown as BridgeStateManagers;

    mockServices = {
      humanLoop: {
        provideInput: vi.fn().mockReturnValue(true),
        cancelRequest: vi.fn(),
      },
      assistantPool: null,
      messageHandler: {
        handleMessage: vi.fn().mockResolvedValue(undefined),
      },
      stateManagers: mockStateManagers,
    } as unknown as BridgeServices;

    mockConfig = {
      serverUrl: 'http://localhost:2279',
      bridgePort: 2280,
    } as BridgeConfig;

    mockDeps = {
      services: mockServices,
      config: mockConfig,
      stateManagers: mockStateManagers,
    };
  });

  describe('createHumanInputResponseHandler', () => {
    it('should forward input to humanLoop.provideInput', () => {
      const handler = createHumanInputResponseHandler(mockDeps);

      handler({ sessionId: 'session-123', response: 'user response' });

      expect(mockServices.humanLoop.provideInput).toHaveBeenCalledWith(
        'session-123',
        'user response'
      );
    });

    it('should handle case when no pending request exists', () => {
      (mockServices.humanLoop.provideInput as ReturnType<typeof vi.fn>).mockReturnValue(false);

      const handler = createHumanInputResponseHandler(mockDeps);
      handler({ sessionId: 'no-pending', response: 'too late' });

      // Should not throw, just log warning
      expect(mockServices.humanLoop.provideInput).toHaveBeenCalled();
    });
  });

  describe('createSessionHiddenHandler', () => {
    it('should clean up all state managers', () => {
      const handler = createSessionHiddenHandler(mockDeps);

      handler({ sessionId: 'session-to-clean' });

      expect(mockStateManagers.sessionContextStore.delete).toHaveBeenCalledWith('session-to-clean');
      expect(mockStateManagers.concurrency.clearSession).toHaveBeenCalledWith('session-to-clean');
      expect(mockServices.humanLoop.cancelRequest).toHaveBeenCalledWith('session-to-clean');
    });
  });

  describe('createSessionMessageHandler', () => {
    it('should forward message to messageHandler', async () => {
      const handler = createSessionMessageHandler(mockServices.messageHandler);

      await handler({
        sessionId: 'session-1',
        content: 'Hello',
      } as any);

      expect(mockServices.messageHandler!.handleMessage).toHaveBeenCalledWith({
        sessionId: 'session-1',
        content: 'Hello',
      });
    });

    it('should handle null messageHandler gracefully', async () => {
      const handler = createSessionMessageHandler(null);

      // Should not throw
      await handler({
        sessionId: 'session-1',
        content: 'Hello',
      } as any);
    });
  });

  describe('registerSocketEventHandlers', () => {
    it('should register all socket event handlers', () => {
      const mockSocket = {
        on: vi.fn(),
        off: vi.fn(),
      };

      const cleanup = registerSocketEventHandlers(mockSocket as any, mockDeps);

      expect(mockSocket.on).toHaveBeenCalledTimes(5);
      expect(mockSocket.on).toHaveBeenCalledWith(
        SOCKET_EVENTS.SESSION_HUMAN_INPUT_RESPONSE,
        expect.any(Function)
      );
      expect(mockSocket.on).toHaveBeenCalledWith(
        SOCKET_EVENTS.SESSION_HIDDEN,
        expect.any(Function)
      );
      expect(mockSocket.on).toHaveBeenCalledWith(
        SOCKET_EVENTS.SESSION_MESSAGE,
        expect.any(Function)
      );
      expect(mockSocket.on).toHaveBeenCalledWith(
        SOCKET_EVENTS.SESSION_MODEL_SWITCH,
        expect.any(Function)
      );
      expect(mockSocket.on).toHaveBeenCalledWith(
        SOCKET_EVENTS.SESSION_STOP,
        expect.any(Function)
      );

      expect(typeof cleanup).toBe('function');
    });

    it('should return cleanup function that unregisters handlers', () => {
      const mockSocket = {
        on: vi.fn(),
        off: vi.fn(),
      };

      const cleanup = registerSocketEventHandlers(mockSocket as any, mockDeps);
      cleanup();

      expect(mockSocket.off).toHaveBeenCalledTimes(5);
      expect(mockSocket.off).toHaveBeenCalledWith(
        SOCKET_EVENTS.SESSION_HUMAN_INPUT_RESPONSE,
        expect.any(Function)
      );
      expect(mockSocket.off).toHaveBeenCalledWith(
        SOCKET_EVENTS.SESSION_HIDDEN,
        expect.any(Function)
      );
      expect(mockSocket.off).toHaveBeenCalledWith(
        SOCKET_EVENTS.SESSION_MESSAGE,
        expect.any(Function)
      );
      expect(mockSocket.off).toHaveBeenCalledWith(
        SOCKET_EVENTS.SESSION_MODEL_SWITCH,
        expect.any(Function)
      );
      expect(mockSocket.off).toHaveBeenCalledWith(
        SOCKET_EVENTS.SESSION_STOP,
        expect.any(Function)
      );
    });
  });

  describe('createSessionStopHandler', () => {
    it('should close assistant pool session if available', async () => {
      const mockCloseSession = vi.fn().mockResolvedValue(undefined);
      mockServices.assistantPool = { closeSession: mockCloseSession } as unknown as BridgeServices['assistantPool'];

      const handler = createSessionStopHandler(mockDeps);
      await handler({ sessionId: 'session-123' });

      expect(mockCloseSession).toHaveBeenCalledWith('session-123');
    });

    it('should handle null assistantPool gracefully', async () => {
      mockServices.assistantPool = null;

      const handler = createSessionStopHandler(mockDeps);
      // Should not throw
      await handler({ sessionId: 'session-123' });
    });
  });

  describe('createModelSwitchHandler', () => {
    it('should set model override but preserve session for resume', async () => {
      const handler = createModelSwitchHandler(mockDeps);

      await handler({ sessionId: 'session-123', model: 'opus' });

      expect(mockStateManagers.sessionContextStore.getOrCreate).toHaveBeenCalledWith('session-123');
      expect(mockStateManagers.sessionContextStore.update).toHaveBeenCalled();
    });

    it('should close assistant pool session if available', async () => {
      const mockCloseSession = vi.fn().mockResolvedValue(undefined);
      mockServices.assistantPool = { closeSession: mockCloseSession } as unknown as BridgeServices['assistantPool'];

      const handler = createModelSwitchHandler(mockDeps);
      await handler({ sessionId: 'session-123', model: 'haiku' });

      expect(mockCloseSession).toHaveBeenCalledWith('session-123');
    });
  });
});
