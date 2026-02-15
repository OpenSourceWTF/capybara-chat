/**
 * Spec Schema Definition
 *
 * Schema for specs used by the unified editor architecture.
 * Validated against shared Zod schema from @capybara-chat/types.
 */

import type { Spec } from '@capybara-chat/types';
import { FormEntityType, SpecStatus, Priority, EntityStatus } from '@capybara-chat/types';
import { CreateSpecSchema } from '@capybara-chat/types';
import { defineEntitySchema } from './define-schema';
import { mapZodErrors, tagsToString, stringToTags } from './zod-utils';

/**
 * Form data type for specs
 */
export interface SpecFormData {
  title: string;
  content: string;
  workflowStatus: SpecStatus;
  priority: Priority;
  tags: string;
  status: EntityStatus; // Added status field for toggling
}

/**
 * Spec entity schema
 */
export const specSchema = defineEntitySchema<Spec, SpecFormData>({
  entityType: FormEntityType.SPEC,

  fields: {
    title: {
      type: 'text',
      label: 'Title',
      required: true,
      placeholder: 'Spec title',
    },
    workflowStatus: {
      type: 'select',
      label: 'Status',
      options: [
        { value: SpecStatus.DRAFT, label: 'Draft' }, // Included for completeness, though specific validation logic might exclude it
        { value: SpecStatus.READY, label: 'Ready' },
        { value: SpecStatus.IN_PROGRESS, label: 'In Progress' },
        { value: SpecStatus.BLOCKED, label: 'Blocked' },
        { value: SpecStatus.COMPLETE, label: 'Complete' },
        { value: SpecStatus.ARCHIVED, label: 'Archived' },
      ],
    },
    priority: {
      type: 'select',
      label: 'Priority',
      options: [
        { value: Priority.LOW, label: 'Low' },
        { value: Priority.NORMAL, label: 'Normal' },
        { value: Priority.HIGH, label: 'High' },
        { value: Priority.CRITICAL, label: 'Critical' },
      ],
    },
    tags: {
      type: 'tags',
      label: 'Tags',
      placeholder: 'e.g., feature, design',
    },
    content: {
      type: 'markdown',
      label: 'Details',
      required: true,
      placeholder: 'Describe the spec...',
      props: { className: 'min-h-[300px]' },
    },
    status: {
      type: 'text', // Hidden field technically, handled by editor toggle
      label: 'Draft Status',
      props: { className: 'hidden' }, // Or just ignore in UI render if handled separately
    }
  },

  defaultValues: {
    title: '',
    content: '',
    workflowStatus: SpecStatus.READY,
    priority: Priority.NORMAL,
    tags: '',
    status: EntityStatus.DRAFT,
  },

  toFormData: (spec) => ({
    title: spec?.title || '',
    content: spec?.content || '',
    workflowStatus: spec?.workflowStatus || SpecStatus.READY,
    priority: spec?.priority || Priority.NORMAL,
    tags: tagsToString(spec?.tags),
    status: spec?.status || EntityStatus.DRAFT,
  }),

  fromFormData: (form) => ({
    title: form.title.trim(),
    content: form.content,
    workflowStatus: form.workflowStatus || SpecStatus.READY,
    priority: form.priority,
    tags: typeof form.tags === 'string'
      ? stringToTags(form.tags)
      : (Array.isArray(form.tags) ? form.tags : []),
    status: form.status,
  }),

  validate: (form) => {
    // Transform formatting to match what API expects
    const tagsArray = typeof form.tags === 'string'
      ? stringToTags(form.tags)
      : (Array.isArray(form.tags) ? form.tags : []);

    const checkObj = {
      ...form,
      tags: tagsArray,
    };

    const result = CreateSpecSchema.safeParse(checkObj);

    if (result.success) {
      return { isValid: true, errors: {} };
    } else {
      return { isValid: false, errors: mapZodErrors(result.error) };
    }
  },

  // Spec uses 'status' for draft/published
  statusField: 'status',
});
