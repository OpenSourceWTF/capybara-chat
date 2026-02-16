/**
 * Tests for bridge-init.ts
 *
 * Verifies:
 * - createBridgeServices creates all services
 * - getStateManagers returns singleton by default
 * - getStateManagers accepts overrides for testing
 * - startAssistantPool/stopAssistantPool handle null gracefully
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createBridgeServices,
  getStateManagers,
  startAssistantPool,
  stopAssistantPool,
  type CreateBridgeServicesDeps,
} from './bridge-init.js';
import type { BridgeConfig, IApiClient } from './interfaces.js';
import { ProviderType } from '@capybara-chat/types';

// Mock external dependencies
vi.mock('./pool/assistant-pool.js', () => ({
  createAssistantPool: vi.fn(() => ({
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('@capybara-chat/cli-provider', () => ({
  createClaudeCLIProvider: vi.fn(),
  GenericCLIProvider: vi.fn(),
}));

vi.mock('./slash-commands.js', () => ({
  initializeCommands: vi.fn(),
}));

describe('bridge-init', () => {
  let mockApiClient: IApiClient;
  let mockSocket: any;

  beforeEach(() => {
    mockApiClient = {
      get: vi.fn(),
      post: vi.fn(),
      patch: vi.fn(),
    };
    mockSocket = {
      emit: vi.fn(),
      on: vi.fn(),
    };
  });

  describe('getStateManagers', () => {
    it('should return state managers with default singletons', () => {
      const managers = getStateManagers(mockApiClient);

      expect(managers).toHaveProperty('concurrency');
      expect(managers).toHaveProperty('agentConfigManager');
      expect(managers).toHaveProperty('sessionContextStore');
    });

    it('should accept overrides for testing', () => {
      const mockConcurrency = { clearSession: vi.fn() } as any;

      const managers = getStateManagers(mockApiClient, {
        concurrency: mockConcurrency,
      });

      expect(managers.concurrency).toBe(mockConcurrency);
    });
  });

  describe('createBridgeServices', () => {
    it('should create all services', () => {
      const config: BridgeConfig = {
        serverUrl: 'http://localhost:2279',
        bridgePort: 2280,
        model: 'claude-sonnet',
      };

      const deps: CreateBridgeServicesDeps = {
        config,
        apiClient: mockApiClient,
        getSocket: () => mockSocket,
        getAssistantPool: () => null,
      };

      const services = createBridgeServices(deps);

      expect(services.humanLoop).toBeDefined();
      expect(services.assistantPool).toBeDefined();
      expect(services.messageHandler).toBeDefined();
      expect(services.stateManagers).toBeDefined();
    });

    it('should accept custom state managers for testing', () => {
      const config: BridgeConfig = {
        serverUrl: 'http://localhost:2279',
        bridgePort: 2280,
      };

      const mockConcurrency = { clearSession: vi.fn() } as any;

      const deps: CreateBridgeServicesDeps = {
        config,
        apiClient: mockApiClient,
        getSocket: () => mockSocket,
        getAssistantPool: () => null,
        stateManagers: {
          concurrency: mockConcurrency,
        },
      };

      const services = createBridgeServices(deps);

      expect(services.stateManagers.concurrency).toBe(mockConcurrency);
    });

    it('should use assistantPoolFactory when provided', () => {
      const config: BridgeConfig = {
        serverUrl: 'http://localhost:2279',
        bridgePort: 2280,
        model: 'claude-sonnet',
      };

      const mockCustomPool = {
        start: vi.fn(),
        stop: vi.fn(),
        sendMessage: vi.fn(),
      };

      const deps: CreateBridgeServicesDeps = {
        config,
        apiClient: mockApiClient,
        getSocket: () => mockSocket,
        getAssistantPool: () => mockCustomPool as any,
        assistantPoolFactory: () => mockCustomPool as any,
      };

      const services = createBridgeServices(deps);

      // Should use the custom pool from factory, not create a new one
      expect(services.assistantPool).toBe(mockCustomPool);
    });

    it('should create pool with providerType CLI when useCliProvider is true', async () => {
      const poolModule = await import('./pool/assistant-pool.js');

      const config: BridgeConfig = {
        serverUrl: 'http://localhost:2279',
        bridgePort: 2280,
        model: 'claude-sonnet',
        useCliProvider: true, // CLI provider mode enabled
      };

      const deps: CreateBridgeServicesDeps = {
        config,
        apiClient: mockApiClient,
        getSocket: () => mockSocket,
        getAssistantPool: () => null,
      };

      createBridgeServices(deps);

      // Since we mocked the module, we can check if createAssistantPool was called
      expect(poolModule.createAssistantPool).toHaveBeenCalledWith(
        expect.objectContaining({
          providerType: ProviderType.CLI,
        })
      );
    });
  });

  describe('startAssistantPool', () => {
    it('should start pool when provided', async () => {
      const mockPool = {
        start: vi.fn().mockResolvedValue(undefined),
        stop: vi.fn(),
      };

      await startAssistantPool(mockPool as any);

      expect(mockPool.start).toHaveBeenCalled();
    });

    it('should handle null pool gracefully', async () => {
      // Should not throw
      await expect(startAssistantPool(null)).resolves.toBeUndefined();
    });
  });

  describe('stopAssistantPool', () => {
    it('should stop pool when provided', async () => {
      const mockPool = {
        start: vi.fn(),
        stop: vi.fn().mockResolvedValue(undefined),
      };

      await stopAssistantPool(mockPool as any);

      expect(mockPool.stop).toHaveBeenCalled();
    });

    it('should handle null pool gracefully', async () => {
      // Should not throw
      await expect(stopAssistantPool(null)).resolves.toBeUndefined();
    });
  });
});
