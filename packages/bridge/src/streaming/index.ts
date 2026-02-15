/**
 * Shared Streaming Module
 *
 * Exports the stream processor and hook factories for consistent
 * streaming behavior across bridge.ts and task-executor.ts.
 *
 * Design source: 088-shared-streaming-loop-design
 */

// Core processor
export { processClaudeStream } from './stream-processor.js';

// Hook factories
export {
  createBridgeHooks,
  type BridgeHooksConfig,
  type BridgeHooksWithSegmentInfo,
  type FinalSegmentInfo,
} from './bridge-hooks.js';
export {
  createTaskHooks,
  type TaskHooksConfig,
  type TaskHooksWithSegmentInfo,
} from './task-hooks.js';

// Timeout utilities (Phase 3.2, 137-idle-timeout)
export { withTimeout, createStreamTimeoutMessage, createIdleTimeout } from './timeout-wrapper.js';

// Types
export type {
  StreamMessageType,
  ToolUseData,
  ToolProgressData,
  ToolResultData,
  ResultData,
  SessionInitData,
  StreamEventHooks,
  StreamProcessorConfig,
  StreamProcessorResult,
} from './types.js';
