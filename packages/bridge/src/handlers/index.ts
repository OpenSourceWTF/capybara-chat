/**
 * Bridge Handlers
 *
 * Extracted handler modules from bridge.ts for better testability
 * and separation of concerns.
 */


export {
  MessageHandler,
  type MessageHandlerDeps,
  type SessionMessageData,
} from './message-handler.js';
export {
  registerSocketEventHandlers,
  createHumanInputResponseHandler,
  createSessionHiddenHandler,
  createSessionMessageHandler,
  type SocketHandlerDeps,
} from './socket-registry.js';
