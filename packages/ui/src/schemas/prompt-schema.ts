/**
 * Prompt Schema Definition
 *
 * Schema for prompt segments used by the unified editor architecture.
 * Validated against shared Zod schema from @capybara-chat/types.
 */

import type { PromptSegment, PromptOutputType } from '@capybara-chat/types';
import { FormEntityType, EntityStatus } from '@capybara-chat/types';
import { CreatePromptSegmentSchema } from '@capybara-chat/types';
import { defineEntitySchema } from './define-schema';
import { mapZodErrors, tagsToString, stringToTags } from './zod-utils';

/**
 * Form data type for prompts
 */
export interface PromptFormData {
  name: string;
  content: string;
  summary: string;
  tags: string;
  outputType: string;
  status: EntityStatus;
}

/**
 * Output type options
 */
export const OUTPUT_TYPE_OPTIONS = [
  { value: '', label: 'None' },
  { value: 'prompt', label: 'Prompt' },
  { value: 'document', label: 'Document' },
  { value: 'code', label: 'Code' },
  { value: 'analysis', label: 'Analysis' },
] as const;

/**
 * Prompt entity schema
 */
export const promptSchema = defineEntitySchema<PromptSegment, PromptFormData>({
  entityType: FormEntityType.PROMPT,

  fields: {
    name: {
      type: 'text',
      label: 'Name',
      required: true,
      placeholder: 'e.g., code-review-intro',
    },
    content: {
      type: 'textarea',
      label: 'Prompt Template',
      required: true,
      placeholder: 'Enter your prompt template with {{variables}}...',
      props: { className: 'min-h-[200px] font-mono text-sm' },
    },
    summary: {
      type: 'text',
      label: 'Summary (optional)',
      placeholder: 'Brief description for the library',
    },
    tags: {
      type: 'tags',
      label: 'Tags',
      placeholder: 'e.g., code-review, development',
    },
    outputType: {
      type: 'select',
      label: 'Output Type (optional)',
      options: OUTPUT_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
    },
    status: {
      type: 'text',
      label: 'Status',
      props: { className: 'hidden' },
    }
  },

  defaultValues: {
    name: '',
    content: '',
    summary: '',
    tags: '',
    outputType: '',
    status: EntityStatus.DRAFT,
  },

  toFormData: (prompt) => ({
    name: prompt?.name || '',
    content: prompt?.content || '',
    summary: prompt?.summary || '',
    tags: tagsToString(prompt?.tags),
    outputType: prompt?.outputType || '',
    status: prompt?.status || EntityStatus.DRAFT,
  }),

  fromFormData: (form) => ({
    name: form.name.trim(),
    content: form.content,
    summary: form.summary || undefined,
    tags: stringToTags(form.tags),
    outputType: (form.outputType || undefined) as PromptOutputType | undefined,
    status: form.status,
  }),

  validate: (form) => {
    // Transform formatting to match what API expects
    const checkObj = {
      ...form,
      tags: stringToTags(form.tags),
      outputType: form.outputType || undefined,
    };

    const result = CreatePromptSegmentSchema.safeParse(checkObj);

    if (result.success) {
      return { isValid: true, errors: {} };
    } else {
      return { isValid: false, errors: mapZodErrors(result.error) };
    }
  },

  // PromptSegment uses 'status' for draft/published
  statusField: 'status',
});
