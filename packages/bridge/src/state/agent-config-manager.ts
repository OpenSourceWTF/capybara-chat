/**
 * Agent Configuration Manager
 *
 * Manages agent configuration fetching and caching with TTL.
 * Extracted from bridge.ts for testability and separation of concerns.
 *
 * Design:
 * - TTL-based cache (5 minutes) for per-agent configs
 * - Falls back to default agent config if fetch fails
 * - Injectable API client for testability
 */

import { createLogger, now, type AgentContext, type AgentModel } from '@capybara-chat/types';
import type { IApiClient, ApiResult } from '../interfaces.js';

const log = createLogger('AgentConfigManager');

/**
 * Agent configuration from API (matches AgentDefinition + resolved fields)
 */
export interface DefaultAgentConfig {
  id: string;
  name: string;
  /** Resolved system prompt (from segment or inline) */
  resolvedSystemPrompt: string;
  /** agentContext contains all agent runtime config */
  agentContext: AgentContext;
  /** Resolved subagent definitions for SDK's agents parameter */
  resolvedSubagents?: Record<string, {
    description: string;
    prompt: string;
    tools?: string[];
    model?: AgentModel;
  }>;
}

/**
 * Per-agent config cache entry with TTL
 */
interface CachedAgentConfig {
  config: DefaultAgentConfig;
  fetchedAt: number;
}

/**
 * Dependencies for AgentConfigManager
 */
export interface AgentConfigManagerDeps {
  apiClient: IApiClient;
  cacheTtlMs?: number;
}

/**
 * Agent Configuration Manager
 *
 * Handles fetching and caching of agent configurations.
 */
export class AgentConfigManager {
  private apiClient: IApiClient;
  private cacheTtlMs: number;
  private defaultAgentConfig: DefaultAgentConfig | null = null;
  private agentConfigCache = new Map<string, CachedAgentConfig>();

  constructor(deps: AgentConfigManagerDeps) {
    this.apiClient = deps.apiClient;
    this.cacheTtlMs = deps.cacheTtlMs ?? 5 * 60 * 1000; // 5 minutes default
  }

  /**
   * Fetch the default agent configuration from the server.
   * This is called at startup to get the system prompt and allowed tools.
   */
  async fetchDefaultAgentConfig(): Promise<void> {
    const result = await this.apiClient.get<DefaultAgentConfig>('/api/agent-definitions/default');
    if (result.ok) {
      this.defaultAgentConfig = result.data;
      log.info('Fetched default agent config', {
        id: this.defaultAgentConfig.id,
        name: this.defaultAgentConfig.name,
        hasSystemPrompt: !!this.defaultAgentConfig.resolvedSystemPrompt,
      });
    } else {
      log.warn('Failed to fetch default agent config - sessions will use default behavior', {
        error: result.error,
      });
    }
  }

  /**
   * Fetch agent config by definition ID (with TTL-based cache).
   * Falls back to defaultAgentConfig if ID not found or fetch fails.
   */
  async getAgentConfig(agentDefinitionId?: string): Promise<DefaultAgentConfig | null> {
    if (!agentDefinitionId) {
      return this.defaultAgentConfig;
    }

    const cached = this.agentConfigCache.get(agentDefinitionId);
    if (cached && (now() - cached.fetchedAt) < this.cacheTtlMs) {
      return cached.config;
    }

    const result = await this.apiClient.get<DefaultAgentConfig>(
      `/api/agent-definitions/${agentDefinitionId}`
    );
    if (result.ok) {
      this.agentConfigCache.set(agentDefinitionId, {
        config: result.data,
        fetchedAt: now(),
      });
      return result.data;
    }

    // If fetch fails but we have stale cache, use it
    if (cached) return cached.config;

    log.warn('Failed to fetch agent config, using default', { agentDefinitionId });
    return this.defaultAgentConfig;
  }

  /**
   * Get the current default agent config (for testing)
   */
  getDefaultConfig(): DefaultAgentConfig | null {
    return this.defaultAgentConfig;
  }

  /**
   * Build an AgentContext from a DefaultAgentConfig.
   * Extracts the fields needed by AssistantPool from the full config.
   *
   * This eliminates duplication in bridge.ts where the same pattern
   * was repeated 3 times (resume from server, resume from cache, create new).
   *
   * @param config - The agent configuration
   * @param modelOverride - Optional model override (135-assistant-model-switch)
   */
  buildAgentContext(config: DefaultAgentConfig | null, modelOverride?: string): AgentContext | undefined {
    if (!config) return undefined;

    return {
      systemPrompt: config.resolvedSystemPrompt,
      allowedTools: config.agentContext.allowedTools,
      mcpServers: config.agentContext.mcpServers,
      model: modelOverride || config.agentContext.model,  // 135: Use override if provided
      subagents: config.resolvedSubagents,
    };
  }

  /**
   * Reset all cached configs (for testing)
   */
  reset(): void {
    this.defaultAgentConfig = null;
    this.agentConfigCache.clear();
  }
}

// Singleton instance
let defaultManager: AgentConfigManager | null = null;

/**
 * Get the default agent config manager (uses process.env configuration)
 */
export function getAgentConfigManager(apiClient: IApiClient): AgentConfigManager {
  if (!defaultManager) {
    defaultManager = new AgentConfigManager({ apiClient });
  }
  return defaultManager;
}

/**
 * Reset the default agent config manager (for testing)
 */
export function resetAgentConfigManager(): void {
  defaultManager = null;
}

/**
 * Create an agent config manager with custom dependencies (for testing)
 */
export function createAgentConfigManager(deps: AgentConfigManagerDeps): AgentConfigManager {
  return new AgentConfigManager(deps);
}
