/**
 * Tests for bridge-init.ts
 *
 * Verifies:
 * - createBridgeServices creates all services in CLI mode
 * - createBridgeServices returns null services in Docker mode
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
  // Mock implementations if needed
}));

vi.mock('@capybara-chat/cli-provider', () => ({
  // Mock cli provider exports if needed, though we moved away from it for pool creation
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

      expect(managers).toHaveProperty('taskMessageQueue');
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
    it('should create all services in CLI mode', () => {
      const config: BridgeConfig = {
        serverUrl: 'http://localhost:2279',
        bridgePort: 2280,
        useDocker: false,
        enableTaskExecutor: true,
        model: 'claude-sonnet',
      };

      const deps: CreateBridgeServicesDeps = {
        config,
        apiClient: mockApiClient,
        getSocket: () => mockSocket,
        getAssistantPool: () => null,
      };

      const services = createBridgeServices(deps);

      expect(services.spawner).toBeDefined();
      expect(services.humanLoop).toBeDefined();
      expect(services.assistantPool).toBeDefined();

      expect(services.messageHandler).toBeDefined();
      expect(services.stateManagers).toBeDefined();
    });

    it('should return null pool-based services in Docker mode', () => {
      const config: BridgeConfig = {
        serverUrl: 'http://localhost:2279',
        bridgePort: 2280,
        useDocker: true, // Docker mode
        enableTaskExecutor: false,
      };

      const deps: CreateBridgeServicesDeps = {
        config,
        apiClient: mockApiClient,
        getSocket: () => mockSocket,
        getAssistantPool: () => null,
      };

      const services = createBridgeServices(deps);

      // Spawner and humanLoop always created
      expect(services.spawner).toBeDefined();
      expect(services.humanLoop).toBeDefined();

      // Pool-based services are null in Docker mode
      expect(services.assistantPool).toBeNull();

      expect(services.messageHandler).toBeNull();
    });

    it('should accept custom state managers for testing', () => {
      const config: BridgeConfig = {
        serverUrl: 'http://localhost:2279',
        bridgePort: 2280,
        useDocker: true,
        enableTaskExecutor: false,
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

    it('should use assistantPoolFactory when provided (GAP-004 fix)', () => {
      const config: BridgeConfig = {
        serverUrl: 'http://localhost:2279',
        bridgePort: 2280,
        useDocker: false,
        enableTaskExecutor: true,
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
        useDocker: false,
        enableTaskExecutor: true,
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
