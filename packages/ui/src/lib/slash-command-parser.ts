/**
 * Slash Command Parser
 *
 * Parses user input for slash commands that trigger entity creation/editing.
 * Supports commands like:
 * - /new prompt
 * - /edit spec:spec-123
 * - /create document
 * - /open pipeline:pipe-abc
 */

// Import FormEntityType from @capybara-chat/types (canonical source)
import { FormEntityType } from '@capybara-chat/types';

// Re-export for convenience
export { FormEntityType };

/**
 * Supported command actions
 */
export type CommandAction = 'new' | 'create' | 'edit' | 'open' | 'read' | 'help' | 'spawn';

/**
 * Parsed slash command result
 */
export interface ParsedCommand {
  action: CommandAction;
  entityType?: FormEntityType;
  entityId?: string;
  /** Custom name for /new commands (e.g., /new prompt MyPromptName) */
  entityName?: string;
  raw: string;
}

/**
 * Command suggestion for autocomplete
 */
export interface CommandSuggestion {
  command: string;
  description: string;
  action: CommandAction;
  entityType?: FormEntityType;
}

/**
 * Available entity types with display info
 */
export const ENTITY_TYPES: Record<FormEntityType, { label: string; description: string }> = {
  prompt: {
    label: 'Prompt',
    description: 'Create a reusable prompt segment with variables',
  },
  pipeline: {
    label: 'Pipeline',
    description: 'Compose multiple prompts into a pipeline',
  },
  spec: {
    label: 'Spec',
    description: 'Define a specification or requirement',
  },
  document: {
    label: 'Document',
    description: 'Create a markdown document with version history',
  },
  agentDefinition: {
    label: 'Agent',
    description: 'Create a configurable agent with system prompt and subagents',
  },
};

/**
 * Available command actions
 */
export const COMMAND_ACTIONS: Record<CommandAction, { aliases: string[]; description: string }> = {
  new: {
    aliases: ['new', 'create', 'n'],
    description: 'Create a new entity',
  },
  create: {
    aliases: ['create', 'new'],
    description: 'Create a new entity (alias for new)',
  },
  edit: {
    aliases: ['edit', 'e'],
    description: 'Edit an existing entity',
  },
  open: {
    aliases: ['open', 'o', 'view'],
    description: 'Open an entity for viewing',
  },
  read: {
    aliases: ['read', 'r'],
    description: 'Load a document into context',
  },
  help: {
    aliases: ['help', 'h', '?'],
    description: 'Show available commands',
  },
  spawn: {
    aliases: ['spawn', 'task'],
    description: 'Spawn a new worker task',
  },
};

/**
 * Command category for organized display
 */
export interface CommandCategory {
  id: string;
  label: string;
  icon: string;
  commands: CommandSuggestion[];
}

/**
 * All command suggestions organized by category
 */
export const COMMAND_CATEGORIES: CommandCategory[] = [
  {
    id: 'create',
    label: 'Create New',
    icon: '✨',
    commands: [
      { command: '/new prompt', description: 'Create a new prompt segment', action: 'new', entityType: FormEntityType.PROMPT },
      { command: '/new pipeline', description: 'Create a new prompt pipeline', action: 'new', entityType: FormEntityType.PIPELINE },
      { command: '/new spec', description: 'Create a new specification', action: 'new', entityType: FormEntityType.SPEC },
      { command: '/new document', description: 'Create a new document', action: 'new', entityType: FormEntityType.DOCUMENT },
    ],
  },
  {
    id: 'edit',
    label: 'Edit Existing',
    icon: '✏️',
    commands: [
      { command: '/edit prompt', description: 'Edit an existing prompt', action: 'edit', entityType: FormEntityType.PROMPT },
      { command: '/edit pipeline', description: 'Edit an existing pipeline', action: 'edit', entityType: FormEntityType.PIPELINE },
      { command: '/edit spec', description: 'Edit an existing spec', action: 'edit', entityType: FormEntityType.SPEC },
      { command: '/edit document', description: 'Edit an existing document', action: 'edit', entityType: FormEntityType.DOCUMENT },
    ],
  },
  {
    id: 'context',
    label: 'Context & Documents',
    icon: '📄',
    commands: [
      { command: '/read', description: 'Load a document into context (fuzzy match)', action: 'read', entityType: FormEntityType.DOCUMENT },
    ],
  },
  {
    id: 'tasks',
    label: 'Tasks',
    icon: '⚡',
    commands: [
      { command: '/spawn', description: 'Spawn a new worker task', action: 'spawn' },
      { command: '/task', description: 'Spawn a new worker task', action: 'spawn' },
    ],
  },
  {
    id: 'session',
    label: 'Session',
    icon: '💬',
    commands: [
      { command: '/compact', description: 'Compact conversation history', action: 'help' },
      { command: '/context', description: 'Show context usage', action: 'help' },
    ],
  },
  {
    id: 'help',
    label: 'Help',
    icon: '❓',
    commands: [
      { command: '/help', description: 'Show available commands', action: 'help' },
    ],
  },
];

/**
 * All available command suggestions for autocomplete (flat list for filtering)
 */
export const ALL_SUGGESTIONS: CommandSuggestion[] = COMMAND_CATEGORIES.flatMap(cat => cat.commands);

/**
 * Check if a string is a valid entity type
 */
export function isEntityType(value: string): value is FormEntityType {
  return value in ENTITY_TYPES;
}

/**
 * Normalize action aliases to canonical action
 */
function normalizeAction(input: string): CommandAction | null {
  const lower = input.toLowerCase();
  for (const [action, config] of Object.entries(COMMAND_ACTIONS)) {
    if (config.aliases.includes(lower)) {
      // Normalize 'create' to 'new' for consistency
      return action === 'create' ? 'new' : (action as CommandAction);
    }
  }
  return null;
}

/**
 * Parse entity reference (e.g., "spec:spec-123" or just "spec")
 */
function parseEntityRef(input: string): { entityType?: FormEntityType; entityId?: string } {
  const [type, id] = input.split(':');
  const entityType = isEntityType(type) ? type : undefined;
  return { entityType, entityId: id };
}

/**
 * Check if input starts with a slash command
 */
export function isSlashCommand(input: string): boolean {
  return input.trim().startsWith('/');
}

/**
 * Parse a slash command from user input
 *
 * @param input - The user input string
 * @returns Parsed command or null if not a valid command
 */
export function parseSlashCommand(input: string): ParsedCommand | null {
  const trimmed = input.trim();

  if (!isSlashCommand(trimmed)) {
    return null;
  }

  // Remove leading slash and split into parts
  const withoutSlash = trimmed.slice(1);
  const parts = withoutSlash.split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return null;
  }

  const [actionStr, entityRef, ...nameParts] = parts;
  const action = normalizeAction(actionStr);

  if (!action) {
    return null;
  }

  // Help and spawn commands don't need an entity
  if (action === 'help' || action === 'spawn') {
    return { action, raw: trimmed };
  }

  // Parse entity reference if provided
  if (entityRef) {
    const { entityType, entityId } = parseEntityRef(entityRef);

    // For /new commands, remaining parts are the entity name
    // e.g., /new prompt My Cool Prompt -> entityName = "My Cool Prompt"
    const entityName = (action === 'new' && nameParts.length > 0)
      ? nameParts.join(' ')
      : undefined;

    return { action, entityType, entityId, entityName, raw: trimmed };
  }

  return { action, raw: trimmed };
}

/**
 * Get autocomplete suggestions based on partial input
 *
 * @param input - The partial user input
 * @returns Array of matching suggestions, sorted by relevance
 */
export function getCommandSuggestions(input: string): CommandSuggestion[] {
  if (!input.trim()) {
    return [];
  }

  // Only suggest if input starts with /
  if (!input.startsWith('/')) {
    return [];
  }

  const searchTerm = input.toLowerCase();

  // Filter and sort suggestions by match quality
  return ALL_SUGGESTIONS.filter((suggestion) => {
    return suggestion.command.toLowerCase().startsWith(searchTerm);
  }).sort((a, b) => {
    // Prefer exact prefix matches
    const aExact = a.command.toLowerCase() === searchTerm;
    const bExact = b.command.toLowerCase() === searchTerm;
    if (aExact !== bExact) return aExact ? -1 : 1;

    // Then sort by command length (shorter = more relevant)
    return a.command.length - b.command.length;
  });
}

/**
 * Get categorized suggestions for organized display
 * 
 * Returns categories with their matching commands filtered by the search term.
 * Empty categories are excluded.
 *
 * @param input - The partial user input
 * @returns Array of categories with matching commands
 */
export function getCategorizedSuggestions(input: string): CommandCategory[] {
  // If just "/" is typed, show all categories
  const searchTerm = input.startsWith('/') ? input.toLowerCase() : '';

  if (!searchTerm) {
    return [];
  }

  // Filter categories to only include those with matching commands
  return COMMAND_CATEGORIES
    .map(category => ({
      ...category,
      commands: category.commands.filter(cmd =>
        cmd.command.toLowerCase().startsWith(searchTerm)
      ),
    }))
    .filter(category => category.commands.length > 0);
}

/**
 * Check if command is complete (has all required parts)
 */
export function isCommandComplete(command: ParsedCommand): boolean {
  if (command.action === 'help' || command.action === 'spawn') {
    return true;
  }

  // new/create need entity type
  if (command.action === 'new') {
    return !!command.entityType;
  }

  // edit/open need entity type and optionally ID
  if (command.action === 'edit' || command.action === 'open') {
    return !!command.entityType;
  }

  // read can be sent directly (server does fuzzy match)
  if (command.action === 'read') {
    return true;
  }

  return false;
}

/**
 * Format command for display
 */
export function formatCommand(command: ParsedCommand): string {
  let result = `/${command.action}`;
  if (command.entityType) {
    result += ` ${command.entityType}`;
    if (command.entityId) {
      result += `:${command.entityId}`;
    }
  }
  return result;
}

/**
 * Entity selection state - used when user is typing an entity ID/name
 */
export interface EntitySelectionState {
  /** Whether we're in entity selection mode */
  active: boolean;
  /** The entity type being selected */
  entityType: FormEntityType | null;
  /** The action being performed */
  action: CommandAction | null;
  /** The search query (partial entity ID or name) */
  searchQuery: string;
  /** The full command prefix (e.g., "/edit spec ") */
  commandPrefix: string;
}

/**
 * Check if user is in entity selection mode
 *
 * Entity selection mode is active when:
 * - User has typed a valid action (edit/open)
 * - User has typed a valid entity type
 * - User is now typing after the entity type (optionally with ":")
 *
 * @example
 * "/edit spec " → active, entityType: spec, searchQuery: ""
 * "/edit spec:my" → active, entityType: spec, searchQuery: "my"
 * "/edit spec:my-spec-id" → active, entityType: spec, searchQuery: "my-spec-id"
 * "/new prompt" → not active (new doesn't need entity selection)
 */
export function getEntitySelectionState(input: string): EntitySelectionState {
  const inactive: EntitySelectionState = {
    active: false,
    entityType: null,
    action: null,
    searchQuery: '',
    commandPrefix: '',
  };

  if (!input.startsWith('/')) {
    return inactive;
  }

  const withoutSlash = input.slice(1);
  const parts = withoutSlash.split(/\s+/);

  if (parts.length < 2) {
    return inactive;
  }

  const [actionStr, entityPart] = parts;
  const action = normalizeAction(actionStr);

  // Only edit, open, and read support entity selection
  if (!action || (action !== 'edit' && action !== 'open' && action !== 'read')) {
    return inactive;
  }

  // For /read, entity type is implicitly 'document'
  if (action === 'read') {
    // Check if user has typed something after /read
    if (parts.length === 1 || (parts.length === 2 && entityPart === '')) {
      // Still typing, show suggestions when they add a space
      if (input.endsWith(' ')) {
        return {
          active: true,
          entityType: FormEntityType.DOCUMENT,
          action,
          searchQuery: '',
          commandPrefix: '/read ',
        };
      }
      return inactive;
    }
    // User is typing a search query
    const searchQuery = parts.slice(1).join(' ');
    return {
      active: true,
      entityType: FormEntityType.DOCUMENT,
      action,
      searchQuery,
      commandPrefix: '/read ',
    };
  }

  // Check if entity part contains type:query or just type
  const colonIndex = entityPart.indexOf(':');

  if (colonIndex === -1) {
    // Format: "/edit spec " or "/edit spec"
    const entityType = isEntityType(entityPart) ? entityPart : null;

    if (!entityType) {
      return inactive;
    }

    // Check if there's a space after entity type (user is typing search)
    const hasTrailingContent = parts.length > 2 || input.endsWith(' ');

    if (hasTrailingContent) {
      // "/edit spec " or "/edit spec some-search"
      const searchQuery = parts.slice(2).join(' ');
      return {
        active: true,
        entityType,
        action,
        searchQuery,
        commandPrefix: `/${actionStr} ${entityType}:`,
      };
    }

    // Still typing entity type, not in selection mode yet
    return inactive;
  } else {
    // Format: "/edit spec:query"
    const typePart = entityPart.slice(0, colonIndex);
    const queryPart = entityPart.slice(colonIndex + 1);

    const entityType = isEntityType(typePart) ? typePart : null;

    if (!entityType) {
      return inactive;
    }

    return {
      active: true,
      entityType,
      action,
      searchQuery: queryPart,
      commandPrefix: `/${actionStr} ${entityType}:`,
    };
  }
}

/**
 * Build complete command with selected entity
 */
export function buildCommandWithEntity(
  commandPrefix: string,
  entityId: string
): string {
  return `${commandPrefix}${entityId}`;
}
