/**
 * Bridge Initialization
 *
 * Extracted from bridge.ts for testability. Creates and configures all bridge
 * services with proper dependency injection.
 *
 * Usage in production:
 *   const services = createBridgeServices({ config, getSocket, getAssistantPool });
 *   await startAssistantPool(services.assistantPool, config);
 *
 * Usage in tests:
 *   const services = createBridgeServices({ config, getSocket: () => mockSocket, ... });
 *   // Test services without starting real pool
 */

import type { Socket } from 'socket.io-client';
import { AssistantPool, createAssistantPool } from './pool/assistant-pool.js';
import { ProviderType } from '@capybara-chat/types';
import { createLogger, MODEL_DEFAULTS } from '@capybara-chat/types';
import type { BridgeConfig, IApiClient } from './interfaces.js';

import { HumanLoopHandler } from './human-loop.js';
import { MessageHandler } from './handlers/index.js';
import { getConcurrencyManager } from './concurrency.js';
import { getAgentConfigManager, type AgentConfigManager } from './state/agent-config-manager.js';
import { getSessionContextStore, type SessionContextStore } from './session/index.js';
import type { SessionConcurrencyManager } from './concurrency.js';

const log = createLogger('BridgeInit');

/**
 * State managers used by bridge services.
 * These are singletons that can be reset for testing.
 */
export interface BridgeStateManagers {
  concurrency: SessionConcurrencyManager;
  agentConfigManager: AgentConfigManager;
  sessionContextStore: SessionContextStore;
}

/**
 * Bridge services created by initialization.
 */
export interface BridgeServices {
  humanLoop: HumanLoopHandler;
  assistantPool: AssistantPool | null;
  messageHandler: MessageHandler | null;
  stateManagers: BridgeStateManagers;
}

/**
 * Dependencies for creating bridge services.
 */
export interface CreateBridgeServicesDeps {
  config: BridgeConfig;
  apiClient: IApiClient;
  /** Getter for socket (allows late binding after connection) */
  getSocket: () => Socket | null;
  /** Getter for assistant pool (allows late binding after creation) */
  getAssistantPool: () => AssistantPool | null;
  /** Optional: inject state managers for testing */
  stateManagers?: Partial<BridgeStateManagers>;
  /** Optional: factory to create custom AssistantPool (for testing with mock pool) */
  assistantPoolFactory?: () => AssistantPool;
}

/**
 * Get or create state managers.
 * Uses singletons by default, but accepts overrides for testing.
 */
export function getStateManagers(
  apiClient: IApiClient,
  overrides?: Partial<BridgeStateManagers>
): BridgeStateManagers {
  return {
    concurrency: overrides?.concurrency ?? getConcurrencyManager(),
    agentConfigManager: overrides?.agentConfigManager ?? getAgentConfigManager(apiClient),
    sessionContextStore: overrides?.sessionContextStore ?? getSessionContextStore(),
  };
}

/**
 * Create all bridge services with dependency injection.
 * Does NOT start the assistant pool - call startAssistantPool() separately.
 */
export function createBridgeServices(deps: CreateBridgeServicesDeps): BridgeServices {
  const { config, apiClient, getSocket, getAssistantPool, stateManagers: stateOverrides } = deps;
  const stateManagers = getStateManagers(apiClient, stateOverrides);

  const humanLoop = new HumanLoopHandler();

  // Create assistant pool (will be started separately)
  // Use injected factory if provided (for testing with mock pool)
  const providerType = config.useCliProvider ? ProviderType.CLI : ProviderType.SDK;

  if (config.useCliProvider) {
    log.info('Using CLI provider mode', { backend: config.cliBackend || 'claude' });
  }

  const assistantPool = deps.assistantPoolFactory?.() ?? createAssistantPool({
    minAgents: 1,
    maxAgents: 3,
    model: config.model || MODEL_DEFAULTS.CLAUDE_SONNET,
    bypassPermissions: true, // Autonomous mode - no permission prompts
    providerType,
    cliBackend: config.cliBackend,
  });

  // Create message handler with dependency injection
  const messageHandler = new MessageHandler({
    getSocket,
    getAssistantPool,
    concurrency: stateManagers.concurrency,
  });

  log.info('Using AssistantPool (direct CLI integration)');

  return {
    humanLoop,
    assistantPool,
    messageHandler,
    stateManagers,
  };
}

/**
 * Start the assistant pool (async operation).
 * Separate from creation to allow testing service wiring without starting pool.
 */
export async function startAssistantPool(pool: AssistantPool | null): Promise<void> {
  if (pool) {
    await pool.start();
    log.info('AssistantPool started');
  }
}

/**
 * Stop the assistant pool gracefully.
 */
export async function stopAssistantPool(pool: AssistantPool | null): Promise<void> {
  if (pool) {
    await pool.stop();
    log.info('AssistantPool stopped');
  }
}
