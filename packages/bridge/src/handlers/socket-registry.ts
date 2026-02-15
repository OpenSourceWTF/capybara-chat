/**
 * Socket Event Registry
 *
 * Extracted from bridge.ts for testability. Registers all socket event handlers
 * with proper dependency injection.
 *
 * Each handler can be tested independently by passing mock dependencies.
 *
 * Usage in production:
 *   registerSocketHandlers(socket, { services, config, ... });
 *
 * Usage in tests:
 *   const handler = createSessionHiddenHandler(mockDeps);
 *   handler({ sessionId: 'test-123' });
 */

import type { Socket } from 'socket.io-client';
import { createLogger, SOCKET_EVENTS } from '@capybara-chat/types';

import type { BridgeServices, BridgeStateManagers } from '../bridge-init.js';
import type { BridgeConfig } from '../interfaces.js';
import type { MessageHandler, SessionMessageData } from './message-handler.js';

const log = createLogger('SocketRegistry');

/**
 * Dependencies for socket event handlers
 */
export interface SocketHandlerDeps {
  services: BridgeServices;
  config: BridgeConfig;
  stateManagers: BridgeStateManagers;
}

/**
 * Create handler for SESSION_HUMAN_INPUT_RESPONSE event.
 * Forwards human input from UI to the HumanLoopHandler.
 */
export function createHumanInputResponseHandler(deps: SocketHandlerDeps) {
  const { services } = deps;

  return (data: { sessionId: string; response: string }) => {
    const { sessionId, response } = data;
    log.info('Received human input response', { sessionId });
    const provided = services.humanLoop.provideInput(sessionId, response);
    if (!provided) {
      log.warn('No pending human input request for session', { sessionId });
    }
  };
}

/**
 * Create handler for SESSION_HIDDEN event.
 * Cleans up all bridge state for a soft-deleted session to prevent memory leaks.
 */
export function createSessionHiddenHandler(deps: SocketHandlerDeps) {
  const { services, stateManagers } = deps;
  const { taskMessageQueue, concurrency, sessionContextStore } = stateManagers;

  return (data: { sessionId: string }) => {
    const { sessionId } = data;
    log.info('Session hidden, cleaning up bridge state', { sessionId });

    // Single cleanup point: SessionContextStore owns all session state
    sessionContextStore.delete(sessionId);
    concurrency.clearSession(sessionId);
    services.humanLoop.cancelRequest(sessionId);

    taskMessageQueue.clear(sessionId);
  };
}

/**
 * Create handler for SESSION_MESSAGE event.
 * Forwards messages from server to Claude via MessageHandler.
 */
export function createSessionMessageHandler(messageHandler: MessageHandler | null) {
  return async (data: SessionMessageData) => {
    // DUPLICATION DEBUG: Log every SESSION_MESSAGE arrival with full context
    log.info('SESSION_MESSAGE received', {
      sessionId: data.sessionId,
      messageId: data.messageId,
      content: data.content?.slice(0, 50),

      timestamp: Date.now(),
    });

    if (messageHandler) {
      await messageHandler.handleMessage(data);
    } else {
      log.warn('MessageHandler not initialized, ignoring message', { sessionId: data.sessionId });
    }
  };
}

/**
 * 135-assistant-model-switch: Create handler for SESSION_MODEL_SWITCH event.
 * When model switch is requested, store the override and close the CLI process.
 * The session will be RESUMED with the new model on next message (preserves context).
 */
export function createModelSwitchHandler(deps: SocketHandlerDeps) {
  const { stateManagers, services } = deps;
  const { sessionContextStore } = stateManagers;

  return async (data: { sessionId: string; model: string }) => {
    const { sessionId, model } = data;
    log.info('Model switch requested', { sessionId, model });

    const agentModel = model as import('@capybara-chat/types').AgentModel;

    const ctx = sessionContextStore.getOrCreate(sessionId);
    ctx.modelOverride = agentModel;
    sessionContextStore.update(ctx);

    // Close the current CLI process (if any) so next message spawns new one with new model
    // BUT keep claudeSessionId - we want to RESUME with the new model, not create fresh session
    const assistantPool = services.assistantPool;
    if (assistantPool) {
      await assistantPool.closeSession(sessionId);
      log.info('Closed CLI process for model switch', { sessionId });
    }

    // NOTE: We intentionally do NOT invalidate the session or reset context injection
    // The session will be resumed with --resume flag, preserving conversation history

    log.info('Model switch prepared, will resume with new model on next message', {
      sessionId,
      model,
    });
  };
}

/**
 * 168-right-bar-elimination: Create handler for SESSION_STOP event.
 * Stops the current generation by closing the CLI process.
 * The session can be resumed on next message (preserves context).
 */
export function createSessionStopHandler(deps: SocketHandlerDeps) {
  const { services } = deps;

  return async (data: { sessionId: string }) => {
    const { sessionId } = data;
    log.info('Session stop requested', { sessionId });

    // Close the current CLI process to interrupt generation
    const assistantPool = services.assistantPool;
    if (assistantPool) {
      await assistantPool.closeSession(sessionId);
      log.info('Closed CLI process for session stop', { sessionId });
    }
  };
}

/**
 * Register all socket event handlers.
 * Returns cleanup function to remove handlers.
 */
export function registerSocketEventHandlers(
  socket: Socket,
  deps: SocketHandlerDeps
): () => void {
  const { services } = deps;

  // Create handlers
  const humanInputHandler = createHumanInputResponseHandler(deps);
  const sessionHiddenHandler = createSessionHiddenHandler(deps);
  const sessionMessageHandler = createSessionMessageHandler(services.messageHandler);
  const modelSwitchHandler = createModelSwitchHandler(deps);
  const sessionStopHandler = createSessionStopHandler(deps);

  // Register handlers
  socket.on(SOCKET_EVENTS.SESSION_HUMAN_INPUT_RESPONSE, humanInputHandler);
  socket.on(SOCKET_EVENTS.SESSION_HIDDEN, sessionHiddenHandler);
  socket.on(SOCKET_EVENTS.SESSION_MESSAGE, sessionMessageHandler);
  socket.on(SOCKET_EVENTS.SESSION_MODEL_SWITCH, modelSwitchHandler);
  socket.on(SOCKET_EVENTS.SESSION_STOP, sessionStopHandler);

  log.debug('Socket event handlers registered');

  // Return cleanup function
  return () => {
    socket.off(SOCKET_EVENTS.SESSION_HUMAN_INPUT_RESPONSE, humanInputHandler);
    socket.off(SOCKET_EVENTS.SESSION_HIDDEN, sessionHiddenHandler);
    socket.off(SOCKET_EVENTS.SESSION_MESSAGE, sessionMessageHandler);
    socket.off(SOCKET_EVENTS.SESSION_MODEL_SWITCH, modelSwitchHandler);
    socket.off(SOCKET_EVENTS.SESSION_STOP, sessionStopHandler);
    log.debug('Socket event handlers unregistered');
  };
}
