/**
 * Capybara Flows — Event-Driven Task Automation (208)
 *
 * A Flow is a trigger rule that creates a WorkerTask when EventBus
 * conditions are met. "Flows are tasks triggered automatically by events."
 */

import type { AgentModel } from './enums.js';

// ===== Core Flow Types =====

/**
 * Flow — An automation rule: "When event X fires with conditions Y, create task Z."
 */
export interface Flow {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;

  /** Trigger: when should this flow fire? */
  trigger: FlowTrigger;

  /** Conditions: all must match for the flow to fire */
  conditions: FlowCondition[];

  /** What task to create when triggered */
  taskConfig: FlowTaskConfig;

  /** Max simultaneous in-flight tasks from this flow (default: 5) */
  maxConcurrent: number;

  createdAt: number;
  updatedAt: number;
}

/**
 * FlowTrigger — What event activates this flow
 */
export interface FlowTrigger {
  type: 'event' | 'cron' | 'manual';
  /** For 'event': EventBus event type (e.g., "worker_task:pr_merged") */
  eventType?: string;
  /** For 'cron': schedule expression (future) */
  cronExpression?: string;
}

/**
 * FlowCondition — A filter on the enriched event payload.
 * All conditions in a flow must match (AND logic).
 */
export interface FlowCondition {
  /** Dot-path into the enriched event payload (e.g., "task.workspace.defaultBranch") */
  field: string;
  operator: 'eq' | 'neq' | 'contains' | 'matches' | 'gt' | 'lt' | 'in';
  value: string | number | boolean | string[];
}

/**
 * FlowTaskConfig — What WorkerTask to create when the flow fires.
 * Maps directly to the POST /api/tasks creation payload.
 */
export interface FlowTaskConfig {
  specId?: string;
  specTemplate?: string;
  workspaceId?: string;
  agentDefinitionId: string;
  techniqueId?: string;
  modelOverride?: AgentModel;
  variables?: Record<string, unknown>;
  /** Map event payload fields to task variables. e.g., { "prUrl": "trigger.data.task.prUrl" } */
  variableMapping?: Record<string, string>;
  maxAttempts?: number;
}

/**
 * FlowExecution — Tracks that a flow fired and whether task creation succeeded.
 * Thin record — all real execution state lives on the WorkerTask.
 */
export interface FlowExecution {
  id: string;
  flowId: string;
  /** The WorkerTask that was created (null if creation failed) */
  taskId?: string;
  /** Serialized trigger event payload (JSON) */
  triggerEvent: string;
  /** Did task creation succeed? */
  status: 'created' | 'failed_to_create';
  createdAt: number;
  error?: string;
}
