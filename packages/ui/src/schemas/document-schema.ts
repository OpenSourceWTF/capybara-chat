/**
 * Document Schema Definition
 *
 * Schema for documents used by the unified editor architecture.
 * Validated against shared Zod schema from @capybara-chat/types.
 */

import type { Document } from '@capybara-chat/types';
import { FormEntityType, EntityStatus } from '@capybara-chat/types';
import { CreateDocumentSchema } from '@capybara-chat/types';
import { defineEntitySchema } from './define-schema';
import { mapZodErrors, tagsToString, stringToTags } from './zod-utils';

/**
 * Form data type for documents
 */
export interface DocumentFormData {
  name: string;
  content: string;
  tags: string;
  status: EntityStatus;
}

/**
 * Document entity schema
 */
export const documentSchema = defineEntitySchema<Document, DocumentFormData>({
  entityType: FormEntityType.DOCUMENT,

  fields: {
    name: {
      type: 'text',
      label: 'Name',
      required: true,
      placeholder: 'Document title',
    },
    content: {
      type: 'markdown',
      label: 'Content',
      required: true,
      placeholder: 'Write your document content in Markdown...',
      props: { className: 'min-h-[300px]' },
    },
    tags: {
      type: 'tags',
      label: 'Tags',
      placeholder: 'e.g., api, documentation',
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
    tags: '',
    status: EntityStatus.DRAFT,
  },

  toFormData: (doc) => ({
    name: doc?.name || '',
    content: doc?.content || '',
    tags: tagsToString(doc?.tags),
    status: doc?.status || EntityStatus.DRAFT,
  }),

  fromFormData: (form) => ({
    name: form.name.trim(),
    content: form.content,
    tags: stringToTags(form.tags),
    status: form.status,
  }),

  validate: (form) => {
    // Transform formatting to match what API expects
    const checkObj = {
      ...form,
      tags: stringToTags(form.tags),
    };

    const result = CreateDocumentSchema.safeParse(checkObj);

    if (result.success) {
      return { isValid: true, errors: {} };
    } else {
      return { isValid: false, errors: mapZodErrors(result.error) };
    }
  },

  // Document uses 'status' for draft/published
  statusField: 'status',
});
