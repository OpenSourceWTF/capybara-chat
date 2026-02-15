/**
 * Agent Config Manager Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  AgentConfigManager,
  createAgentConfigManager,
  getAgentConfigManager,
  resetAgentConfigManager,
  type DefaultAgentConfig,
  type AgentConfigManagerDeps,
} from './agent-config-manager.js';
import type { IApiClient, ApiResult } from '../interfaces.js';

/**
 * Create a mock API client for testing
 */
function createMockApiClient(
  responses: Map<string, ApiResult<unknown>> = new Map()
): IApiClient {
  return {
    async get<T>(path: string): Promise<ApiResult<T>> {
      const response = responses.get(path);
      if (response) {
        return response as ApiResult<T>;
      }
      return { ok: false, error: 'Not found', status: 404 };
    },
    async post<T>(): Promise<ApiResult<T>> {
      return { ok: false, error: 'Not implemented' };
    },
    async patch<T>(): Promise<ApiResult<T>> {
      return { ok: false, error: 'Not implemented' };
    },
  };
}

const mockDefaultConfig: DefaultAgentConfig = {
  id: 'default-agent',
  name: 'Default Agent',
  resolvedSystemPrompt: 'You are a helpful assistant.',
  agentContext: {
    model: 'sonnet',
    allowedTools: ['read', 'write'],
  },
};

const mockCustomConfig: DefaultAgentConfig = {
  id: 'custom-agent',
  name: 'Custom Agent',
  resolvedSystemPrompt: 'You are a custom assistant.',
  agentContext: {
    model: 'opus',
    allowedTools: ['read'],
  },
};

describe('AgentConfigManager', () => {
  beforeEach(() => {
    resetAgentConfigManager();
  });

  describe('fetchDefaultAgentConfig', () => {
    it('should fetch and store default agent config', async () => {
      const responses = new Map<string, ApiResult<unknown>>();
      responses.set('/api/agent-definitions/default', { ok: true, data: mockDefaultConfig });
      const apiClient = createMockApiClient(responses);
      const manager = createAgentConfigManager({ apiClient });

      await manager.fetchDefaultAgentConfig();

      expect(manager.getDefaultConfig()).toEqual(mockDefaultConfig);
    });

    it('should handle fetch failure gracefully', async () => {
      const apiClient = createMockApiClient(); // No responses configured
      const manager = createAgentConfigManager({ apiClient });

      await manager.fetchDefaultAgentConfig();

      expect(manager.getDefaultConfig()).toBeNull();
    });
  });

  describe('getAgentConfig', () => {
    it('should return default config when no agentDefinitionId provided', async () => {
      const responses = new Map<string, ApiResult<unknown>>();
      responses.set('/api/agent-definitions/default', { ok: true, data: mockDefaultConfig });
      const apiClient = createMockApiClient(responses);
      const manager = createAgentConfigManager({ apiClient });

      await manager.fetchDefaultAgentConfig();
      const config = await manager.getAgentConfig();

      expect(config).toEqual(mockDefaultConfig);
    });

    it('should fetch specific agent config by ID', async () => {
      const responses = new Map<string, ApiResult<unknown>>();
      responses.set('/api/agent-definitions/custom-agent', { ok: true, data: mockCustomConfig });
      const apiClient = createMockApiClient(responses);
      const manager = createAgentConfigManager({ apiClient });

      const config = await manager.getAgentConfig('custom-agent');

      expect(config).toEqual(mockCustomConfig);
    });

    it('should use cached config within TTL', async () => {
      const responses = new Map<string, ApiResult<unknown>>();
      responses.set('/api/agent-definitions/custom-agent', { ok: true, data: mockCustomConfig });
      const apiClient = createMockApiClient(responses);
      const getSpy = vi.spyOn(apiClient, 'get');
      const manager = createAgentConfigManager({ apiClient, cacheTtlMs: 60000 });

      // First call - should hit API
      await manager.getAgentConfig('custom-agent');
      expect(getSpy).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      await manager.getAgentConfig('custom-agent');
      expect(getSpy).toHaveBeenCalledTimes(1);
    });

    it('should refetch config after TTL expires', async () => {
      const responses = new Map<string, ApiResult<unknown>>();
      responses.set('/api/agent-definitions/custom-agent', { ok: true, data: mockCustomConfig });
      const apiClient = createMockApiClient(responses);
      const getSpy = vi.spyOn(apiClient, 'get');
      const manager = createAgentConfigManager({ apiClient, cacheTtlMs: 0 }); // Immediate expiry

      // First call
      await manager.getAgentConfig('custom-agent');
      expect(getSpy).toHaveBeenCalledTimes(1);

      // Second call - should refetch due to expired TTL
      await manager.getAgentConfig('custom-agent');
      expect(getSpy).toHaveBeenCalledTimes(2);
    });

    it('should use stale cache if fetch fails', async () => {
      let callCount = 0;
      const apiClient: IApiClient = {
        async get<T>(path: string): Promise<ApiResult<T>> {
          callCount++;
          if (callCount === 1) {
            return { ok: true, data: mockCustomConfig as T };
          }
          return { ok: false, error: 'Network error' };
        },
        async post<T>(): Promise<ApiResult<T>> {
          return { ok: false, error: 'Not implemented' };
        },
        async patch<T>(): Promise<ApiResult<T>> {
          return { ok: false, error: 'Not implemented' };
        },
      };
      const manager = createAgentConfigManager({ apiClient, cacheTtlMs: 0 });

      // First call - succeeds
      const config1 = await manager.getAgentConfig('custom-agent');
      expect(config1).toEqual(mockCustomConfig);

      // Second call - fails, should use stale cache
      const config2 = await manager.getAgentConfig('custom-agent');
      expect(config2).toEqual(mockCustomConfig);
    });

    it('should fall back to default config if fetch fails and no cache', async () => {
      const responses = new Map<string, ApiResult<unknown>>();
      responses.set('/api/agent-definitions/default', { ok: true, data: mockDefaultConfig });
      // No response for custom-agent
      const apiClient = createMockApiClient(responses);
      const manager = createAgentConfigManager({ apiClient });

      await manager.fetchDefaultAgentConfig();
      const config = await manager.getAgentConfig('nonexistent-agent');

      expect(config).toEqual(mockDefaultConfig);
    });
  });

  describe('reset', () => {
    it('should clear all cached configs', async () => {
      const responses = new Map<string, ApiResult<unknown>>();
      responses.set('/api/agent-definitions/default', { ok: true, data: mockDefaultConfig });
      responses.set('/api/agent-definitions/custom-agent', { ok: true, data: mockCustomConfig });
      const apiClient = createMockApiClient(responses);
      const manager = createAgentConfigManager({ apiClient });

      await manager.fetchDefaultAgentConfig();
      await manager.getAgentConfig('custom-agent');

      expect(manager.getDefaultConfig()).not.toBeNull();

      manager.reset();

      expect(manager.getDefaultConfig()).toBeNull();
    });
  });

  describe('buildAgentContext', () => {
    it('should return undefined for null config', () => {
      const apiClient = createMockApiClient();
      const manager = createAgentConfigManager({ apiClient });

      expect(manager.buildAgentContext(null)).toBeUndefined();
    });

    it('should extract AgentContext fields from DefaultAgentConfig', () => {
      const apiClient = createMockApiClient();
      const manager = createAgentConfigManager({ apiClient });

      const config: DefaultAgentConfig = {
        id: 'test-agent',
        name: 'Test Agent',
        resolvedSystemPrompt: 'Test prompt',
        agentContext: {
          model: 'opus',
          allowedTools: ['read', 'write', 'bash'],
          mcpServers: [{ name: 'test-mcp', command: 'node', args: ['server.js'], enabled: true }],
        },
        resolvedSubagents: {
          helper: { description: 'A helper', prompt: 'Help with tasks' },
        },
      };

      const result = manager.buildAgentContext(config);

      expect(result).toEqual({
        systemPrompt: 'Test prompt',
        allowedTools: ['read', 'write', 'bash'],
        mcpServers: [{ name: 'test-mcp', command: 'node', args: ['server.js'], enabled: true }],
        model: 'opus',
        subagents: {
          helper: { description: 'A helper', prompt: 'Help with tasks' },
        },
      });
    });

    it('should handle config without optional fields', () => {
      const apiClient = createMockApiClient();
      const manager = createAgentConfigManager({ apiClient });

      const config: DefaultAgentConfig = {
        id: 'minimal-agent',
        name: 'Minimal Agent',
        resolvedSystemPrompt: 'Minimal prompt',
        agentContext: {
          model: 'sonnet',
        },
      };

      const result = manager.buildAgentContext(config);

      expect(result).toEqual({
        systemPrompt: 'Minimal prompt',
        allowedTools: undefined,
        mcpServers: undefined,
        model: 'sonnet',
        subagents: undefined,
      });
    });
  });

  describe('singleton', () => {
    it('should return same instance from getAgentConfigManager', () => {
      const apiClient = createMockApiClient();
      const manager1 = getAgentConfigManager(apiClient);
      const manager2 = getAgentConfigManager(apiClient);

      expect(manager1).toBe(manager2);
    });

    it('should return new instance after reset', () => {
      const apiClient = createMockApiClient();
      const manager1 = getAgentConfigManager(apiClient);
      resetAgentConfigManager();
      const manager2 = getAgentConfigManager(apiClient);

      expect(manager1).not.toBe(manager2);
    });
  });
});
