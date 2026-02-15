/**
 * Session Management - Pure Data Architecture
 *
 * Exports session context, pipeline, and related infrastructure.
 *
 * Design: SESSION_CONTEXT_DESIGN_V4.md
 */

export type {
  SessionContext,
  SessionStatus,
  SessionEvent,
  ContextUsage,
  EditingContext,
} from './session-context.js';

export { addEvent, MAX_EVENTS } from './session-context.js';

export {
  SessionContextStore,
  getSessionContextStore,
  resetSessionContextStore,
  createSessionContextStore,
} from './session-context-store.js';

export type {
  SessionLogger,
  LogEntry,
} from './session-logger.js';

export { SessionLogBuffer, createSessionLogger } from './session-logger.js';

export type {
  PipelineStage,
  BridgeDependencies,
} from './pipeline-stage.js';

export { MessagePipeline } from './message-pipeline.js';

export {
  AcquireLockStage,
  CheckContextInjectionStage,
  InjectContextStage,
  StreamResponseStage,
  FinalizeStage,
} from './stages/index.js';

export type { BridgeDepsAdapterConfig } from './bridge-deps-adapter.js';

export { createBridgeDependenciesAdapter } from './bridge-deps-adapter.js';
