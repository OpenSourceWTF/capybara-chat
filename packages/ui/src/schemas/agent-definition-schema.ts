/**
 * Agent Definition Schema (UI)
 *
 * Pattern: Matches spec-schema.ts with defineEntitySchema
 * Validated against shared Zod schema from @capybara-chat/types.
 */

import { FormEntityType, EntityStatus, AgentDefinitionRole, MODEL_REGISTRY } from '@capybara-chat/types';
import { AgentModel, type AgentDefinition, type SubagentLink, type AgentMCPServerConfig, type PrefilledMessage } from '@capybara-chat/types';
import { CreateAgentDefinitionSchema } from '@capybara-chat/types';
import { defineEntitySchema, type SelectOption } from './define-schema';
import { mapZodErrors } from './zod-utils';

export interface AgentDefinitionFormData {
  name: string;
  slug: string;
  description: string;
  systemPrompt: string;
  systemPromptSegmentId: string | null;
  model: string;
  role: string;
  prefilledConversation: PrefilledMessage[];
  subagents: SubagentLink[];
  mcpServers: AgentMCPServerConfig[];
  skills: string;
  allowedTools: string[];
  tags: string;
  status: EntityStatus;
}

const MODEL_OPTIONS: SelectOption[] = [
  ...(Object.entries(MODEL_REGISTRY) as [string, { label: string }][]).map(([key, entry]) => ({
    value: key,
    label: entry.label,
  })),
  { value: AgentModel.INHERIT, label: 'Inherit from parent' },
];

const ROLE_OPTIONS: SelectOption[] = [
  { value: AgentDefinitionRole.SUBAGENT, label: 'Subagent (delegation only)' },
  { value: AgentDefinitionRole.ASSISTANT, label: 'Assistant (New Chat picker)' },
  { value: AgentDefinitionRole.TASK_AGENT, label: 'Task Agent (long-running work)' },
];

export const AVAILABLE_TOOLS: SelectOption[] = [
  { value: 'Read', label: 'Read' },
  { value: 'Write', label: 'Write' },
  { value: 'Edit', label: 'Edit' },
  { value: 'Bash', label: 'Bash' },
  { value: 'Grep', label: 'Grep' },
  { value: 'Glob', label: 'Glob' },
  { value: 'Task', label: 'Task (subagents)' },
  { value: 'WebFetch', label: 'WebFetch' },
  { value: 'WebSearch', label: 'WebSearch' },
];

export const agentDefinitionSchema = defineEntitySchema<AgentDefinition, AgentDefinitionFormData>({
  entityType: FormEntityType.AGENT_DEFINITION,

  fields: {
    name: {
      type: 'text',
      label: 'Name',
      required: true,
      placeholder: 'My Agent',
    },
    slug: {
      type: 'text',
      label: 'Slug',
      required: true,
      placeholder: 'my-agent',
      validate: (v) => /^[a-z0-9-]+$/.test(v) ? undefined : 'Lowercase, numbers, hyphens only',
      props: { className: 'hidden' },
    },
    description: {
      type: 'textarea',
      label: 'Description',
      required: true,
      placeholder: 'Describe when this agent should be used...',
      props: { rows: 3, className: 'hidden' },
    },
    model: {
      type: 'select',
      label: 'Model',
      options: MODEL_OPTIONS,
    },
    role: {
      type: 'select',
      label: 'Role',
      options: ROLE_OPTIONS,
    },
    systemPromptSegmentId: {
      type: 'text',
      label: 'Prompt Library (Segment ID)',
      placeholder: 'seg-... (leave empty to use inline system prompt)',
      props: { className: 'hidden' },
    },
    systemPrompt: {
      type: 'textarea',
      label: 'System Prompt',
      placeholder: 'You are a helpful assistant... (or link a prompt segment above)',
      props: { rows: 12, className: 'hidden' },
    },
    prefilledConversation: {
      // Custom component would be needed for this
      type: 'textarea',
      label: 'Prefilled Conversation (JSON)',
      placeholder: '[{"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}]',
      props: { rows: 4, className: 'hidden' },
    },
    subagents: {
      // Custom editor component renders SubagentLink entries
      type: 'textarea',
      label: 'Subagents (JSON)',
      placeholder: '[{"agentDefinitionId": "...", "descriptionOverride": "When to use..."}]',
      props: { rows: 4, className: 'hidden' },
    },
    mcpServers: {
      type: 'textarea',
      label: 'MCP Servers (JSON)',
      placeholder: '[{"name": "...", "command": "...", "args": [], "env": {}, "enabled": true}]',
      props: { rows: 4, className: 'hidden' },
    },
    skills: {
      type: 'tags',
      label: 'Skills',
      placeholder: 'skill-slug-1, skill-slug-2',
      props: { className: 'hidden' },
    },
    allowedTools: {
      type: 'multiselect',
      label: 'Allowed Tools',
      options: AVAILABLE_TOOLS,
      props: { className: 'hidden' },
    },
    tags: {
      type: 'tags',
      label: 'Tags',
      placeholder: 'system, coding, analysis',
      props: { className: 'hidden' },
    },
    status: {
      type: 'text',
      label: 'Status',
      props: { className: 'hidden' },
    }
  },

  defaultValues: {
    name: '',
    slug: '',
    description: '',
    systemPrompt: '',
    systemPromptSegmentId: null,
    model: AgentModel.SONNET,
    role: 'subagent',
    prefilledConversation: [],
    subagents: [],
    mcpServers: [],
    skills: '',
    allowedTools: [],
    tags: '',
    status: EntityStatus.DRAFT,
  },

  toFormData: (entity) => ({
    name: entity?.name || '',
    slug: entity?.slug || '',
    description: entity?.description || '',
    systemPrompt: entity?.agentContext?.systemPrompt || '',
    systemPromptSegmentId: entity?.systemPromptSegmentId || null,
    model: entity?.agentContext?.model || AgentModel.SONNET,
    role: entity?.role || 'subagent',
    prefilledConversation: entity?.prefilledConversation || [],
    subagents: (entity?.agentContext?.subagents
      ? Object.entries(entity.agentContext.subagents).map(([id, def]) => ({
        agentDefinitionId: id,
        descriptionOverride: def.description,
        model: def.model,
      }))
      : []) as SubagentLink[],
    mcpServers: entity?.agentContext?.mcpServers || [],
    skills: entity?.skills?.join(', ') || '',
    allowedTools: entity?.agentContext?.allowedTools || [],
    tags: entity?.tags?.join(', ') || '',
    status: entity?.status || EntityStatus.DRAFT,
  }),

  fromFormData: (form) => ({
    name: form.name.trim(),
    slug: form.slug.trim(),
    description: form.description.trim(),
    systemPromptSegmentId: form.systemPromptSegmentId ?? null,
    role: form.role as AgentDefinitionRole,
    prefilledConversation: form.prefilledConversation.length > 0 ? form.prefilledConversation : undefined,
    skills: form.skills.split(',').map(s => s.trim()).filter(Boolean),
    tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
    status: form.status,
    agentContext: {
      systemPrompt: form.systemPrompt || undefined,
      model: form.model as AgentModel || undefined,
      subagents: form.subagents.length > 0
        ? Object.fromEntries(form.subagents.map(s => [s.agentDefinitionId, { description: s.descriptionOverride || '', prompt: '', model: s.model }]))
        : undefined,
      mcpServers: form.mcpServers.length > 0 ? form.mcpServers : undefined,
      allowedTools: form.allowedTools.length > 0 ? form.allowedTools : undefined,
    },
  }),

  validate: (form) => {
    const checkObj = {
      ...form,
      systemPromptSegmentId: form.systemPromptSegmentId ?? null,
      skills: form.skills.split(',').map(s => s.trim()).filter(Boolean),
      tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
      allowedTools: form.allowedTools.length > 0 ? form.allowedTools : undefined,
      model: form.model,
      role: form.role,
    };

    // Note: complex JSON fields (prefilledConversation, mcpServers) validation depends on 
    // them being correctly parsed in the form data. If they are strings in the UI but objects here,
    // this check might be tricky. Assuming form data matches types.

    const result = CreateAgentDefinitionSchema.safeParse(checkObj);

    if (result.success) {
      return { isValid: true, errors: {} };
    } else {
      return { isValid: false, errors: mapZodErrors(result.error) };
    }
  },

  // All entities now use 'status' for draft/published
  statusField: 'status',
});
