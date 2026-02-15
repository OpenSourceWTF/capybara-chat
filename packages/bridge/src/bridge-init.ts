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

import { SessionSpawner } from './spawner.js';
import { HumanLoopHandler } from './human-loop.js';
import { MessageHandler } from './handlers/index.js';
import { getTaskMessageQueue } from './state/task-message-queue.js';
import { getConcurrencyManager } from './concurrency.js';
import { getAgentConfigManager, type AgentConfigManager } from './state/agent-config-manager.js';
import { getSessionContextStore, type SessionContextStore } from './session/index.js';
import type { TaskMessageQueue } from './state/task-message-queue.js';
import type { SessionConcurrencyManager } from './concurrency.js';
import { join } from 'path';

const log = createLogger('BridgeInit');

/**
 * State managers used by bridge services.
 * These are singletons that can be reset for testing.
 */
export interface BridgeStateManagers {
  taskMessageQueue: ReturnType<typeof getTaskMessageQueue>;
  concurrency: SessionConcurrencyManager;
  agentConfigManager: AgentConfigManager;
  sessionContextStore: SessionContextStore;
}

/**
 * Bridge services created by initialization.
 * All services are optional to support Docker mode (which doesn't use pool-based services).
 */
export interface BridgeServices {
  spawner: SessionSpawner;
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
    taskMessageQueue: overrides?.taskMessageQueue ?? getTaskMessageQueue(),
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

  // Always create spawner and human loop (used in all modes)
  const spawner = new SessionSpawner();
  const humanLoop = new HumanLoopHandler();

  // In Docker mode, pool-based services aren't used
  if (config.useDocker) {
    log.info('Using Docker container spawner');
    return {
      spawner,
      humanLoop,
      assistantPool: null,
      messageHandler: null,
      stateManagers,
    };
  }

  // Create assistant pool (will be started separately)
  // Use injected factory if provided (for testing with mock pool)
  // In CLI provider mode, spawn CLI directly (supports OAuth auth)
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
    useDocker: config.useDocker,
  });

  log.info('Using AssistantPool (direct CLI integration)');



  return {
    spawner,
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
