/**
 * Context Builder for Entity Editing
 *
 * Builds context to inject into messages when the user is editing an entity.
 * Uses a "Full Once, Minimal After" pattern for token efficiency:
 * - First message after entity selected: Full context (~300 tokens)
 * - Subsequent messages: Minimal prefix (~20 tokens)
 * - After compaction: Re-inject full context
 *
 * NOTE: This now uses huddle-mcp tools (spec_update, document_update, etc.)
 * instead of form-mcp tools. The agent directly persists changes to the database,
 * and the UI receives socket events to refresh its view.
 */

import { createLogger } from '@capybara-chat/types';
// B2/C2 fix: Use injectable API client instead of legacy functions
import { getApiClient } from './utils/api-client.js';

const log = createLogger('ContextBuilder');

interface EditingSession {
  editingEntityType: string;
  /** Entity ID - undefined for new/unsaved entities */
  editingEntityId?: string;
}

/**
 * Schema hints for new entity creation
 */
const ENTITY_FIELD_HINTS: Record<string, string> = {
  spec: `Required: title, content
Optional: priority (low/medium/high/critical), tags (array), workflowStatus (DRAFT/READY/IN_PROGRESS/IN_REVIEW/DONE)`,
  prompt: `Required: name, content
Optional: summary, tags (array)`,
  document: `Required: name, content
Optional: tags (array)`,
  agentDefinition: `Required: name, slug, description
Optional: systemPrompt, model (sonnet/opus/haiku/inherit), tags (array), allowedTools (array)`,
};

/**
 * Map entity types to their huddle-mcp tool names and parameter names
 */
const ENTITY_TOOL_MAP: Record<string, { get: string; update: string; create: string; idParam: string }> = {
  spec: { get: 'spec_get', update: 'spec_update', create: 'spec_create', idParam: 'specId' },
  prompt: { get: 'prompt_get', update: 'prompt_update', create: 'prompt_create', idParam: 'promptId' },
  document: { get: 'document_get', update: 'document_update', create: 'document_create', idParam: 'documentId' },
  agentDefinition: { get: 'agent_get', update: 'agent_update', create: 'agent_create', idParam: 'agentId' },
};

/**
 * Build full context (~300 tokens) - first message after entity selected
 */
export async function buildFullContext(session: EditingSession, userMessage: string): Promise<string> {
  // Handle new entity (no entityId)
  if (!session.editingEntityId) {
    return buildNewEntityContext(session.editingEntityType, userMessage);
  }

  const entity = await fetchEntity(session.editingEntityType, session.editingEntityId);
  const entityTitle = getEntityTitle(entity);
  const tools = ENTITY_TOOL_MAP[session.editingEntityType] || { get: 'get', update: 'update', create: 'create', idParam: 'id' };

  return `## Entity Editing Context

You are helping edit a **${session.editingEntityType}**: "${entityTitle}"
Entity ID: \`${session.editingEntityId}\`

### Available Tools (huddle-mcp)

Use these tools to read and update the entity. Changes are saved directly to the database:

- \`${tools.get}\` - Get current entity data
  - Parameters: \`{ ${tools.idParam}: "${session.editingEntityId}" }\`
- \`${tools.update}\` - Update the entity
  - Parameters: \`{ ${tools.idParam}: "${session.editingEntityId}", ...fieldsToUpdate }\`

### Current Values
\`\`\`json
${JSON.stringify(compactValues(entity), null, 2)}
\`\`\`

### Guidelines
1. Use \`${tools.update}\` to save changes - the UI will automatically refresh
2. Only include fields you want to change in the update
3. For content changes, include the full new content (not diffs)

---

**User:** ${userMessage}`;
}

/**
 * Build context for creating a NEW entity
 */
function buildNewEntityContext(entityType: string, userMessage: string): string {
  const fieldHints = ENTITY_FIELD_HINTS[entityType] || 'No schema hints available';
  const tools = ENTITY_TOOL_MAP[entityType] || { get: 'get', update: 'update', create: 'create' };

  return `## Entity Creation Context

You are helping create a **new ${entityType}**.

### Available Tools (huddle-mcp)

Use these tools to create the entity. The UI will automatically show the new entity:

- \`${tools.create}\` - Create the new ${entityType}
  - Parameters: See schema below

### Schema
${fieldHints}

### Guidelines
1. Gather all required information from the user first
2. Use \`${tools.create}\` when ready to save
3. The UI will automatically show the new entity after creation

---

**User:** ${userMessage}`;
}

/**
 * Build minimal prefix (~20 tokens) - subsequent messages
 */
export function buildMinimalPrefix(session: EditingSession, userMessage: string): string {
  const entityRef = session.editingEntityId
    ? `${session.editingEntityType}/${session.editingEntityId}`
    : `${session.editingEntityType}/new`;
  return `[editing: ${entityRef}]
${userMessage}`;
}

/**
 * Fetch entity data from server
 */
async function fetchEntity(type: string, id: string): Promise<Record<string, unknown>> {
  const pathMap: Record<string, string> = {
    spec: 'specs',
    prompt: 'prompts',
    document: 'documents',
    pipeline: 'pipelines',
    agentDefinition: 'agent-definitions',
  };

  const entityPath = pathMap[type];
  if (!entityPath) {
    log.warn('Unknown entity type, using empty context', { type });
    return { id, type };
  }

  const result = await getApiClient().get<Record<string, unknown>>(`/api/${entityPath}/${id}`);
  if (!result.ok) {
    log.warn('Failed to fetch entity', { type, id, error: result.error });
    return { id, type };
  }

  return result.data;
}

/**
 * Get entity title/name for display
 */
function getEntityTitle(entity: Record<string, unknown>): string {
  return (entity.title as string) || (entity.name as string) || 'Untitled';
}

/**
 * Compact entity values for context - removes metadata, truncates long values
 */
function compactValues(entity: Record<string, unknown>): Record<string, unknown> {
  const compact: Record<string, unknown> = {};
  const skipKeys = ['id', 'createdAt', 'updatedAt', 'sessionId', 'workspaceId'];

  for (const [key, value] of Object.entries(entity)) {
    if (value === null || value === undefined || value === '') continue;
    if (skipKeys.includes(key)) continue;

    if (typeof value === 'string' && value.length > 200) {
      compact[key] = value.slice(0, 200) + '...[truncated]';
    } else if (Array.isArray(value) && value.length > 10) {
      compact[key] = [...value.slice(0, 10), `...(${value.length - 10} more)`];
    } else {
      compact[key] = value;
    }
  }
  return compact;
}

/**
 * Mark session as having received full context injection
 */
export async function markContextInjected(sessionId: string): Promise<void> {
  const result = await getApiClient().patch(`/api/sessions/${sessionId}`, { formContextInjected: true });
  if (result.ok) {
    log.debug('Marked context as injected', { sessionId });
  } else {
    log.warn('Failed to mark context injected', { sessionId, error: result.error });
  }
}

/**
 * Reset context injection flag (call after compaction)
 */
export async function resetContextInjected(sessionId: string): Promise<void> {
  const result = await getApiClient().patch(`/api/sessions/${sessionId}`, { formContextInjected: false });
  if (result.ok) {
    log.debug('Reset context injection flag', { sessionId });
  } else {
    log.warn('Failed to reset context injected', { sessionId, error: result.error });
  }
}
