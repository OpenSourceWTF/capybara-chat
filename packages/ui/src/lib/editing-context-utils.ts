/**
 * Editing Context Utilities - Pure functions for entity editing context
 *
 * Extracted from EditingContextBadge.tsx for unit testing.
 */

/**
 * Format entity type for display (title case)
 */
export function formatEntityType(type: string): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

/**
 * Map entity types to their huddle-mcp tool names
 */
export const ENTITY_TOOL_MAP: Record<string, { get: string; update: string; create: string }> = {
  prompt: { get: 'prompt_get', update: 'prompt_update', create: 'prompt_create' },
  document: { get: 'document_get', update: 'document_update', create: 'document_create' },
  agentDefinition: { get: 'agent_get', update: 'agent_update', create: 'agent_create' },
};

/**
 * Compact values for display - removes metadata, truncates long values
 */
export function compactValues(data: Record<string, unknown>): Record<string, unknown> {
  const compact: Record<string, unknown> = {};
  const skipKeys = ['id', 'createdAt', 'updatedAt', 'sessionId'];

  for (const [key, value] of Object.entries(data)) {
    if (value === null || value === undefined || value === '') continue;
    if (skipKeys.includes(key)) continue;

    if (typeof value === 'string' && value.length > 100) {
      compact[key] = value.slice(0, 100) + '...[truncated]';
    } else if (Array.isArray(value) && value.length > 5) {
      compact[key] = [...value.slice(0, 5), `...(${value.length - 5} more)`];
    } else {
      compact[key] = value;
    }
  }
  return compact;
}

/**
 * Build a preview of the injected context
 */
export function buildContextPreview(
  entityType: string,
  entityId: string | undefined,
  entityTitle: string | undefined,
  formData: Record<string, unknown> | undefined
): string {
  const title = entityTitle || 'Untitled';
  const compactData = formData ? compactValues(formData) : {};
  const tools = ENTITY_TOOL_MAP[entityType] || { get: 'get', update: 'update', create: 'create' };

  return `## Entity Editing Context

You are helping edit a **${entityType}**: "${title}"
Entity ID: \`${entityId || 'new'}\`

### Available Tools (huddle-mcp)

Use these tools to read and update the entity. Changes are saved directly to the database:

- \`${tools.get}\` - Get current entity data
- \`${tools.update}\` - Update the entity (UI auto-refreshes)

### Current Values
\`\`\`json
${JSON.stringify(compactData, null, 2)}
\`\`\`

### Guidelines
1. Use \`${tools.update}\` to save changes - the UI will automatically refresh
2. Only include fields you want to change in the update
3. For content changes, include the full new content (not diffs)`;
}
