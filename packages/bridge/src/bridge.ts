/**
 * Capybara Agent Bridge
 *
 * Orchestrates Claude sessions via direct CLI.
 * Handles bidirectional communication via Socket.io to server
 * and message queues to Claude agents.
 *
 * NOTE: Service initialization extracted to bridge-init.ts for testability.
 * NOTE: Socket event handlers extracted to handlers/socket-registry.ts.
 */

import express from 'express';
import { createServer } from 'http';
import { io as socketClient, type Socket } from 'socket.io-client';
import { now, createLogger, logRegistry, createRemoteTransport, SOCKET_EVENTS } from '@capybara-chat/types';
import { API_CONFIG, getApiClient } from './utils/api-client.js';
import { loadConfig } from './config.js';
import { createBridgeServices, startAssistantPool, stopAssistantPool, type BridgeServices } from './bridge-init.js';
import { registerSocketEventHandlers } from './handlers/index.js';
import { cleanupAllSubagentResources } from './streaming/bridge-hooks.js';
import { createSocketConnectionManager } from './utils/socket-connection-manager.js';

const log = createLogger('Bridge');

// Register remote transport to send logs to server
logRegistry.addTransport(createRemoteTransport({
  serverUrl: API_CONFIG.SERVER_URL,
  source: 'agent-bridge',
  apiKey: API_CONFIG.API_KEY,
  batchSize: 20,
  flushInterval: 3000,
}));

// Configuration - injectable for testability
const bridgeConfig = loadConfig();
const PORT = bridgeConfig.bridgePort;

// Socket.io client to server for real-time two-way communication
let serverSocket: Socket | null = null;

// Socket connection manager for idempotent connection handling
const socketManager = createSocketConnectionManager('Bridge');

// Bridge services container (populated by createBridgeServices)
let services: BridgeServices | null = null;

// Interval tracking for cleanup
let heartbeatInterval: NodeJS.Timeout | null = null;

// Get shared API client
const apiClient = getApiClient();

/**
 * Clear all intervals created during connect phase
 */
function clearIntervals(): void {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
    log.debug('Cleared heartbeat interval');
  }
}

async function main() {
  const app = express();
  const httpServer = createServer(app);

  app.use(express.json());

  // Will be set after serverSocket connects
  let socketEmitReady = false;

  // Create all bridge services using extracted initialization
  services = createBridgeServices({
    config: bridgeConfig,
    apiClient,
    getSocket: () => serverSocket,
    getAssistantPool: () => services?.assistantPool ?? null,
  });

  // Start assistant pool (async warmup)
  await startAssistantPool(services.assistantPool);

  // Destructure for easier access
  const { humanLoop, stateManagers } = services;
  const { concurrency, agentConfigManager, sessionContextStore } = stateManagers;

  // Health check
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'agent-bridge',
      timestamp: now(),
    });
  });

  // Session cleanup endpoint
  app.delete('/sessions/:sessionId', async (req, res) => {
    try {
      const { sessionId } = req.params;
      sessionContextStore.delete(sessionId);
      concurrency.clearSession(sessionId);
      humanLoop.cancelRequest(sessionId);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  // MCP callback for human-in-the-loop
  app.post('/sessions/:sessionId/human-input', async (req, res) => {
    const { sessionId } = req.params;
    const { question, context, options } = req.body;

    try {
      const response = await humanLoop.requestInput(sessionId, { question, context, options });
      res.json({ response });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  // Debug API endpoints for pipeline observability
  app.get('/debug/sessions/:sessionId/context', (req, res) => {
    const { sessionId } = req.params;

    if (!services || !services.messageHandler) {
      return res.status(503).json({ error: 'Pipeline not initialized' });
    }

    const contextStore = services.messageHandler.getContextStore();
    if (!contextStore) {
      return res.status(503).json({ error: 'Context store not available' });
    }

    const ctx = contextStore.get(sessionId);
    if (!ctx) {
      return res.status(404).json({ error: 'Session context not found' });
    }

    res.json(ctx);
  });

  app.get('/debug/sessions/:sessionId/logs', (req, res) => {
    const { sessionId } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;

    if (!services || !services.messageHandler) {
      return res.status(503).json({ error: 'Pipeline not initialized' });
    }

    const logBuffer = services.messageHandler.getLogBuffer();
    if (!logBuffer) {
      return res.status(503).json({ error: 'Log buffer not available' });
    }

    const logs = logBuffer.getLogs(sessionId, limit);
    res.json({ logs });
  });

  // GAP-DUPLICATION-FIX: Disconnect any existing socket before creating new one
  socketManager.disconnect();

  // Connect to server for two-way communication
  serverSocket = socketClient(API_CONFIG.SERVER_URL, {
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,
    reconnectionDelayMax: 1000,
    auth: {
      apiKey: API_CONFIG.API_KEY,
    },
  });

  serverSocket.on('connect', async () => {
    const isReconnect = serverSocket!.recovered || false;
    log.info(isReconnect ? 'Reconnected to server' : 'Connected to server', {
      url: API_CONFIG.SERVER_URL,
      recovered: serverSocket!.recovered,
    });

    // Register disconnect cleanup FIRST to prevent race condition
    serverSocket!.once('disconnect', () => {
      clearIntervals();
    });

    // Report bridge identity
    serverSocket!.emit(SOCKET_EVENTS.BRIDGE_REGISTER, {
      bridgeId: 'bridge-1',
    });

    // Update message handler socket for pipeline event emission
    if (services?.messageHandler) {
      services.messageHandler.setSocket(serverSocket!);
      log.info('Message handler socket configured for pipeline events');
    } else {
      log.warn('Message handler not available - pipeline events will not be emitted');
    }

    // Fetch default agent config for sessions
    await agentConfigManager.fetchDefaultAgentConfig();

    // Clear old intervals before creating new ones (prevents interval leaks on reconnect)
    clearIntervals();

    // 173-heartbeat: Report active message IDs to server so it can identify truly orphaned messages.
    const HEARTBEAT_INTERVAL_MS = 30_000; // 30 seconds
    heartbeatInterval = setInterval(() => {
      const activeMessageIds = concurrency.getActiveMessageIds();
      serverSocket!.emit(SOCKET_EVENTS.BRIDGE_HEARTBEAT, { activeMessageIds });
    }, HEARTBEAT_INTERVAL_MS);

    // Connect human loop handler to socket emitter
    if (!socketEmitReady) {
      humanLoop.setEventEmitter((event: string, data: unknown) => {
        serverSocket!.emit(event, data);
      });
      socketEmitReady = true;
    }

    // Register socket event handlers with idempotent connection manager
    if (services) {
      const cleanupHandlers = registerSocketEventHandlers(serverSocket!, {
        services,
        config: bridgeConfig,
        stateManagers,
      });

      // Register connection with socket manager for automatic cleanup
      socketManager.connect(serverSocket!, undefined, cleanupHandlers);
    } else {
      log.error('Services not initialized, cannot register socket handlers');
    }
  });

  serverSocket.on('connect_error', (error: Error) => {
    log.error('Socket connection error', { error: error.message, url: API_CONFIG.SERVER_URL });
  });

  serverSocket.on('reconnect_attempt', (attemptNumber: number) => {
    log.info('Socket reconnection attempt', { attempt: attemptNumber });
  });

  serverSocket.on('reconnect_error', (error: Error) => {
    log.error('Socket reconnection error', { error: error.message });
  });

  serverSocket.on('reconnect_failed', () => {
    log.error('Socket reconnection failed - exhausted all retry attempts', {
      reconnectionAttempts: 'Infinity',
      url: API_CONFIG.SERVER_URL,
    });
  });

  serverSocket.on('disconnect', (reason: string) => {
    log.warn('Disconnected from server', { reason });
    socketManager.disconnect();
  });

  httpServer.listen(PORT, () => {
    log.info(`Capybara Agent Bridge running`, { port: PORT });
  });

  // Graceful shutdown handlers
  const shutdown = async (signal: string) => {
    log.info(`Received ${signal}, shutting down gracefully...`);

    // Stop assistant pool
    await stopAssistantPool(services?.assistantPool ?? null);

    // 087-prevent-subagent-hangs: Cleanup all subagent timeouts and metrics
    cleanupAllSubagentResources();

    // Use socketManager.disconnect() for proper cleanup
    socketManager.disconnect();

    // Close HTTP server
    httpServer.close(() => {
      log.info('HTTP server closed');
      process.exit(0);
    });

    // Force exit after timeout
    setTimeout(() => {
      log.warn('Forced exit after timeout');
      process.exit(1);
    }, 5000);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err) => log.error('Fatal error', err));

export { main };
